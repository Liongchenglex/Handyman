# Spec: WhatsApp Job Threads (Masked Group Chat) — Handyman Platform

Status: Draft for implementation
Stack assumption: Existing Twilio WhatsApp integration (Programmable Messaging), backend + database, admin web dashboard.
New Twilio products required: Twilio Conversations API (with WhatsApp participants), Twilio webhooks.

---

## 0. Problem statement

Unlike a food delivery or ride booking, a handyman job is not a single transaction — it is a negotiation that unfolds over days. A typical job involves repeated back and forth: clarifying the actual problem (photos, videos, "is it this pipe or that one"), scheduling and rescheduling around the customer's availability, discovering additional issues once work starts, agreeing on scope and price changes mid-job, and — the messiest part — material procurement, where the handyman may need to source parts, confirm brands/prices with the customer, and coordinate a second visit.

Today this coordination has no good home. If it happens in direct customer↔handyman contact, the platform loses all visibility: it cannot mediate disputes ("he never agreed to $120 extra"), cannot ensure service quality, and risks disintermediation (the parties take the next job off-platform). If it happens through the platform's admin as a manual middleman, the admin becomes a bottleneck relaying every message.

**This feature gives every job a single shared WhatsApp thread — customer, handyman, and platform together — where all of that back and forth happens.** WhatsApp because that's where Singapore customers and handymen already are (no app adoption barrier); a shared thread so nothing is coordinated out of view; platform-mediated so contact details stay masked, every agreement is recorded, and the admin can observe silently and step in only when needed.

Success criteria:
- Zero direct exchange of personal phone numbers between customer and handyman.
- The full negotiation trail (scope, price changes, material agreements, schedule changes) is captured per job and usable as evidence in disputes.
- Admin effort shifts from relaying messages to monitoring exceptions.
- Coordination survives handyman changes and multi-day/multi-visit jobs without losing context.

---

## 1. Concept and architecture

WhatsApp's official API does not allow creating native group chats at our scale (Meta's Groups API is restricted to very large verified accounts and is not supported by Twilio). Instead, we implement a **relay ("virtual group") model** using Twilio Conversations:

- One **Conversation = one job**. Created automatically when a handyman accepts a job.
- The **customer** and **handyman** join as WhatsApp participants. Each of them sees a normal 1:1 WhatsApp thread with the **platform's WhatsApp number** — they never see each other's numbers. Number masking is inherent to the design, not a feature we build.
- Every message a participant sends is received by our Twilio number and relayed to the other participant(s), prefixed with a sender label, e.g. `Marcus (Handyman): I can come at 2pm`.
- The **admin** joins as a **chat (non-WhatsApp) participant** and reads/writes through our web dashboard, not a phone. Admin messages relay out to both WhatsApp participants labelled e.g. `HandyHelp Support: ...`.
- Every message event is mirrored into **our own database via webhooks**. Our DB is the system of record; Twilio is transport.

```
Customer WA  ──┐                       ┌── relays to ──> Handyman WA
               ├──> Platform WA number ┤
Handyman WA ───┘   (Twilio Conversation │── relays to ──> Customer WA
                    per job)            └── webhook ────> DB + Admin dashboard
```

### Why not alternatives
- **Native WhatsApp groups via API**: gated behind Official Business Account + ~100k monthly business-initiated conversations; not supported by Twilio. Revisit if Meta widens eligibility.
- **Unofficial APIs** (whatsapp-web.js, Baileys, Whapi, etc.): ToS violation, number-ban risk. Rejected — the chat thread is core to operations and cannot sit on a bannable channel.

---

## 2. Global constraints (read before implementing anything)

These apply across all features and drive most of the edge-case handling.

**C1 — Participant uniqueness.** In Twilio Conversations, the pair (participant WhatsApp number, our proxy WhatsApp number) may exist in only **one non-closed Conversation at a time**. Consequences:
  - A customer cannot be in two active job Conversations through the same sender number. Adding them to a second one fails with an error.
  - Closing a Conversation (state = `closed`) releases the pair for reuse. Feature 3 (thread closing) is therefore not just UX — it is what makes the next job possible.
  - Concurrent jobs for the same customer require either (a) a pool of sender numbers with one assigned per job, or (b) multiplexing into one thread with job tags. See §6.
  - **Design mandate:** store `sender_number` on every Conversation record from day one, even while we only have one number. This makes a future number pool a config change, not a refactor.

**C2 — 24-hour customer service window (CSW), per participant.** Free-form messages can only be delivered to a WhatsApp user within 24h of *their* last inbound message. Outside the window, only pre-approved **template** messages can be sent. Consequences:
  - A relay can silently fail for one recipient whose window has lapsed (e.g. handyman chats actively, customer has been quiet for 2 days).
  - The relay engine MUST check window state per recipient before relaying. If lapsed: queue the message and send a utility template ("New updates on your job #1234 — reply to view them"), then flush the queue when the recipient replies.
  - Each participant's window is independent. Track `last_inbound_at` per participant per Conversation.

**C3 — No history replay.** Adding a participant to an existing Conversation does not deliver prior messages to their WhatsApp. Any newly added participant (e.g. replacement handyman) needs an explicit recap message generated by us.

**C4 — Delivered messages cannot be recalled.** Once relayed to a phone, a WhatsApp message cannot be unsent via API. "Delete message" (Feature 1) can only remove it from our records/dashboard and stop further relay — it cannot remove it from recipients' phones. See §4 for the moderation-hold option if true pre-delivery control is required.

**C5 — Templates require Meta approval.** Every business-initiated message type (job intro, reopen nudge, recap, payment request, completion notice) needs a pre-approved template, categorised as **Utility** (never Marketing — utility is far cheaper and free inside the CSW). Approval takes minutes to days; build the template pack early. Misclassified templates get recategorised by Meta and billed at the higher rate.

**C6 — Opt-in required.** WhatsApp policy requires user opt-in before business-initiated messages. Capture opt-in at booking (customer) and at handyman onboarding, and store proof (timestamp + method) — Meta can ask for it.

**C7 — Quality rating and messaging limits.** Meta assigns the sender number a quality score; user blocks/reports lower it and can throttle or suspend the number. Mitigations: never send anything marketing-like in job threads, honour STOP requests, keep templates strictly transactional.

**C8 — PDPA (Singapore).** Chat logs contain personal data (names, addresses, photos of homes). Define retention (suggest: 2 years post-job for dispute cover, then purge), access controls on the admin dashboard, and include chat-log processing in the privacy policy. Media stored in Twilio should be mirrored to our own storage and pruned from Twilio to control both cost and data residency.

---

## 3. Feature 0 (default): masked three-party job thread

**Trigger:** handyman accepts job → backend creates thread.

Flow:
1. Create Conversation with attributes `{job_id, customer_id, handyman_id, sender_number, status: "active"}`. Set `friendlyName = "Job #<id> — <short description>"`.
2. Add customer as WhatsApp participant (their number + our proxy number). Handle C1 error: if the customer is already in an active Conversation on this sender, apply the concurrency policy (§6).
3. Add handyman as WhatsApp participant (same handling).
4. Add admin service identity as chat participant (one shared identity such as `admin-console`; individual staff identity mapping lives in our dashboard layer).
5. Send opening **utility templates** to customer and handyman (business-initiated, so templates are mandatory):
   - To customer: "You're connected with your handyman for Job #1234 (leaky tap, Bedok). Reply here to chat — messages go to your handyman and our support team."
   - To handyman: job details + house rules (no sharing personal contacts, etc.).
6. Relay engine (webhook `onMessageAdded`):
   - Persist message to DB (sender, body, media refs, timestamps, job_id).
   - Determine recipients = all WhatsApp participants except sender.
   - For each recipient: if CSW open → relay with sender prefix; else → queue + send reopen template (C2). Do not re-prefix admin dashboard copies (dashboard renders sender natively).
   - Media (photos of the job site are core to this product): relay media messages as media; mirror files to our object storage (see C8, and media storage cost §8).

Sender label convention: `<First name> (<Role>): <message>`. Keep labels short — they consume the 1,600-char body budget and get repetitive on phones.

**Acceptance criteria**
- Customer and handyman exchange messages within 5s relay latency, never seeing each other's numbers.
- A photo sent by the customer arrives with the handyman and appears in the dashboard.
- If one party's CSW has lapsed, the other party's messages are not lost — they are delivered after the reopen template gets a reply.
- All messages appear in DB with correct job_id attribution.

---

## 4. Feature 1: admin oversight (+ message deletion)

**Read access (must-have):**
- Dashboard lists all Conversations with filters (active/closed, unread, job status, handyman, flagged) and unread counts.
- Real-time updates via our webhook-fed DB (or Twilio Conversations SDK if we want typing indicators etc. — webhook-fed DB is simpler and keeps one source of truth).
- Full history per thread, including media, retained per PDPA policy even after Twilio Conversation closure.
- Admin can send into any thread; message relays to both WhatsApp parties labelled as platform support.

**Escalation aids (should-have, cheap to build):**
- Keyword flags: "cancel", "refund", "complaint", "MOM", "police", profanity → notify on-duty admin (push/WA notification), mark thread flagged.
- Unanswered-thread alert: customer message with no handyman reply in N minutes (configurable, e.g. 60) → alert admin.
- Contact-leak detector: regex for phone numbers/emails in message bodies → flag for admin review (anti-disintermediation). Recommend flag-and-review, not auto-block, to avoid false positives (unit numbers, postal codes look like phone fragments).

**Message deletion (good-to-have — with a hard constraint):**
- Per C4, a message already relayed to a phone cannot be recalled. What "delete" can mean:
  a. **Record delete:** remove/redact from dashboard + DB (keep a tombstone for audit). Twilio API supports deleting a message from a Conversation resource.
  b. **Relay interception (only true control):** introduce a moderation hold — messages from flagged threads (or all threads) are held for X seconds/manual approval before relay. Adds latency and admin workload; recommend OFF by default, enable per-thread when a dispute turns hostile.
- Recommendation: ship (a) for MVP; build (b) as a per-thread toggle later.

---

## 5. Feature 2: handyman swap (forfeit / reassignment)

**Trigger:** handyman forfeits, is removed by admin, or job is reassigned.

Flow:
1. Remove handyman 1 as participant. His thread with our number stays on his phone, but nothing further relays in or out. Configure an auto-reply for non-participants messaging the sender number about a job they're no longer on ("You are no longer assigned to this job. Contact support if this is unexpected.").
2. Post system message to thread: "Ah Seng has withdrawn from this job. We're assigning a new handyman." (Relays to customer if CSW open; else utility template.)
3. On acceptance by handyman 2: add as participant (C1 check: he must not be in another active Conversation with this customer on this sender — edge case, but handle the error).
4. Send handyman 2 a **recap utility template** (C3): job scope, address, agreed price, materials discussed, links/photos re-hosted from our storage. Auto-generate from DB (job record + optionally an LLM summary of the thread).
5. Customer-side: same thread continues seamlessly; no action needed.

**Acceptance criteria**
- Handyman 1 receives nothing after removal; his outbound messages do not reach the customer.
- Handyman 2 receives recap before any live relay.
- Audit trail records who was in the thread during which interval (participant join/leave timestamps) — critical for disputes.

---

## 6. Feature 3: thread lifecycle (close on completion; new job = new thread)

Lifecycle: `active → inactive (optional) → closed`.

1. **Close on job completion:** when the job is marked done (and any review/payment step finishes), send closing template ("Job #1234 is complete. This thread is now closed — for new requests, book at ..."), then set Conversation state to `closed`. Closing releases the (customer, sender_number) pair (C1), so the customer's next job can get a fresh Conversation.
2. **Grace period (recommended):** don't close instantly on "done". Keep active for 48–72h for post-job issues ("the tap is dripping again"), then auto-close on inactivity. Use Twilio's inactivity timers or our own scheduler.
3. **New job, same customer:** always a new Conversation. Because everything relays through the same WhatsApp number, on the *customer's phone* it is one continuous thread with our number — that is unavoidable with a single sender. Mitigate with clear job-boundary messages (opening/closing templates with job IDs).
4. **Message after closure:** customer texts our number with no active Conversation → auto-response service flow: "No active job found. Reply 1 to reopen Job #1234 (closed 2 days ago), 2 to book a new job, 3 to talk to support." Reopening = new Conversation referencing the old job (never reopen closed Conversations; create fresh and link via attributes).
5. **Concurrent jobs (same customer, overlapping):** blocked by C1 on a single sender. Policy options:
   - **MVP:** multiplex — attach the second job to the existing active Conversation, tag every relayed message `[Job #1235]`, route ambiguous replies to the most recently active job, and prompt with a quick-reply when confidence is low. Instrument how often this happens.
   - **Scale-up:** sender number pool — assign a different WhatsApp sender per concurrent job so the customer sees separate threads. Requires per-number WA registration + templates. The `sender_number` field (C1) makes this a config change.

**Acceptance criteria**
- After closure, creating a new Conversation for the same customer succeeds.
- Post-closure inbound messages never disappear silently — they always hit the auto-response flow and are logged.

---

## 7. Feature 4 (future): payments in-thread

Scope: admin (or system) sends a payment request into the job thread; customer pays via link; thread receives confirmation.

- Mechanics: generate a payment link (Stripe Payment Link / HitPay / Airwallex — HitPay is popular in SG and supports PayNow QR) tied to the job invoice. Send in-thread:
  - Inside customer's CSW → free-form message with the link (no template needed, no Meta fee).
  - Outside CSW → **utility** template: "Your invoice for Job #1234 is ready: SGD {{amount}}. Pay securely: {{link}}". Payment requests/receipts are a textbook utility category.
- Webhook from payment provider → post system confirmation to thread ("Payment of SGD 180 received — receipt: {{link}}") + update job state.
- Do NOT attempt WhatsApp-native payments (only available in select markets like India/Brazil; not SG).
- Keep payment content strictly transactional to protect the number's quality rating (C7). Never bundle promos into a payment message.
- Constraint reminder: money movement stays with the payment provider; the thread only carries links and confirmations. No card data in chat, ever (PCI + PDPA).

---

## 8. Features you didn't list but should consider

1. **Quote / variation-order approvals in-thread.** Handyman finds extra work mid-job ("your pipe is corroded, +$120 to replace"). Structured flow: handyman triggers a variation order in the app → system posts an approval message to the customer (quick-reply buttons Yes/No) → recorded approval in DB. This converts the murkiest dispute source (verbal scope creep) into an audit trail. Arguably higher ROI than payments.
2. **Scheduling nudges.** Appointment reminder utility template T-1 day / T-2h; "handyman on the way" with ETA. Cheap, high perceived quality.
3. **Material procurement sub-flow.** Since you called this out as the messy part: structured messages for "materials needed" lists, receipt photo capture tagged to the job for reimbursement, admin approval step for material spend above a threshold.
4. **Post-job rating capture in-thread.** After closing template, one-tap rating (1–5 quick replies). Response rates in WhatsApp far exceed email.
5. **Read receipts / delivery status handling.** Twilio surfaces delivered/read/failed statuses. Track `failed` and `undelivered` per relay (recipient blocked us, number deactivated, etc.) and surface in the dashboard — silent relay failure is the worst failure mode of this architecture.
6. **STOP/opt-out handling.** Mandatory. If a participant opts out mid-job, freeze the thread, alert admin, and fall back to phone/SMS.
7. **Multi-admin presence.** Label which staff member replied (`Sarah from HandyHelp:`) and record staff identity in DB even though Twilio sees one admin identity.
8. **Thread transcript export.** PDF/HTML export of a job thread for disputes, insurance claims, or CASE complaints.
9. **LLM assist (later).** Auto-summarise long threads for admin, draft recap messages for handyman swaps, auto-tag threads (pricing dispute / scheduling / materials).

---

## 9. Data model (minimum)

```
conversations
  id (pk) | twilio_conversation_sid | job_id (fk) | sender_number
  status (active|inactive|closed) | created_at | closed_at

conversation_participants
  id | conversation_id | party_type (customer|handyman|admin)
  user_id | twilio_participant_sid | wa_number (E.164, encrypted)
  joined_at | removed_at | last_inbound_at   -- drives CSW checks

messages
  id | conversation_id | twilio_message_sid | sender_participant_id
  body | media_refs[] | created_at
  relay_status jsonb  -- per-recipient: {participant_id: queued|sent|delivered|read|failed}
  deleted_at | deleted_by | flag_reasons[]

templates
  key (job_intro_customer, job_intro_handyman, reopen_nudge, swap_recap,
       payment_request, job_closed, appointment_reminder, ...)
  twilio_content_sid | meta_category (utility) | status (approved|pending)

opt_ins
  user_id | channel (whatsapp) | granted_at | method | revoked_at
```

---

## 10. Costs (verified June–July 2026 — re-check Meta's rate card before launch)

Four cost lines: Twilio per-message fee, Meta template fees, Twilio Conversations MAU, fixed costs.

**a) Twilio per-message fee:** US$0.005 per WhatsApp message, inbound and outbound; failed messages US$0.001. This applies to EVERY relayed copy — the relay architecture roughly doubles Twilio fees vs 1:1 chat (one inbound + one outbound per relayed message; admin messages fan out to two outbound).

**b) Meta fees (recipient country = Singapore):**
- **Free-form messages inside the 24h CSW: free.** In an actively chatting job thread, this covers the overwhelming majority of traffic — this is the single biggest cost lever, and why the relay engine must prefer free-form over templates whenever the window is open.
- **Utility templates inside an open CSW: free.** Outside the window: charged per delivered message at the Singapore utility rate.
- **IMPORTANT — rate change effective 1 July 2026 (i.e. yesterday):** Singapore moved off the "Rest of Asia Pacific" regional rate onto its own standalone rate card, with HIGHER utility and authentication rates than before, and volume tiers now count per-market. SGD billing is also now available (new WABA required to switch billing currency). Pull the exact SGD/USD figures from Meta's rate card (developers.facebook.com → WhatsApp pricing) the week you budget — do not use blog numbers.
- Marketing category: irrelevant to job threads; never use it here.

**c) Twilio Conversations API:** US$0.05 per monthly active user; first 200 MAU/month free. Each unique customer or handyman WhatsApp number active in a month = 1 MAU (counted once even across multiple threads). Media storage US$0.25/GB/month — mirror media to our own storage and prune Twilio copies.

**d) Fixed:** WhatsApp sender number rental (the WA sender does not have to be an SG number; a cheap US long code works, though a local +65 presents better — SG numbers rent higher on Twilio). One-time: Meta Business verification (free, but takes days), template approvals (free).

**Worked example — 100 jobs/month, everyone in Singapore:**
Assume per job: ~40 participant messages (customer 15, handyman 20, admin 5), plus ~5 utility templates (2 intros, 1 reminder, 1 reopen nudge, 1 closing), of which ~2 land outside a CSW and are billable by Meta.

- Twilio message fees: 35 inbound + 45 relayed outbound + 5 template sends ≈ 85 msgs × $0.005 ≈ **$0.43/job**
- Meta fees: ~2 billable utility msgs × Singapore utility rate (assume $0.02–0.05 as a planning band pending rate-card check) ≈ **$0.04–0.10/job**
- Per job messaging cost: **≈ US$0.50** → 100 jobs ≈ **US$50/month**
- MAU: ~100 customers + ~30 handymen = 130 → under the 200 free tier → **$0** (at 400 MAU it'd be ~$10)
- Number: ~US$1–15/month depending on choice.

**Total at 100 jobs/month: roughly US$55–70/month.** Scales linearly with message volume; the dominant term is Twilio's $0.005 × relay fan-out, not Meta. Cost-control levers, in order of impact: keep chats inside CSWs (design nudges so users reply), keep templates in the Utility category, batch system notifications, prune media storage.

---

## 11. Implementation order

1. Foundations: Conversations service setup, webhook ingestion → DB, template pack submitted for approval (long pole — start day 1).
2. Feature 0: create-on-accept, relay engine with CSW handling, sender labels, media relay.
3. Feature 3: closing/lifecycle + post-closure auto-response (needed before real traffic — C1 makes this non-optional).
4. Feature 1: dashboard read + admin send + flags; record-delete.
5. Feature 2: swap flow + recap generation.
6. Enhancements: variation-order approvals, reminders, ratings.
7. Feature 4: payment links.
8. Scale work when data justifies: number pool for concurrent jobs, moderation hold, LLM summaries.
