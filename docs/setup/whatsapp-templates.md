# WhatsApp Message Templates for Meta Approval

These templates need to be submitted and approved by Meta before use in production. For testing, continue using the `hello_world` template.

## How to Submit Templates to Meta

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to your WhatsApp Business Account
3. Go to **WhatsApp Manager** → **Message Templates**
4. Click **Create Template**
5. Fill in the details below for each template
6. Wait for Meta approval (usually 24-48 hours)

---

## Template 1: Job Payment Confirmation

**Template Name:** `job_payment_confirmation`

**Category:** `TRANSACTIONAL`

**Language:** English (US)

**Template Content:**

```
Hi {{1}},

Your job request has been confirmed! 🎉

*Service:* {{2}}
*Job ID:* {{3}}
*Amount Paid:* ${{4}}
*Scheduled:* {{5}}

We're matching you with available handymen in your area. You'll receive a notification when someone accepts your job.

Thank you for choosing EazyDone!

Need help? Reply to this message anytime.
```

**Variables:**
- `{{1}}` = Customer name (e.g., "John Tan")
- `{{2}}` = Service type (e.g., "Plumbing Repair")
- `{{3}}` = Job ID (e.g., "JOB-12345")
- `{{4}}` = Estimated budget (e.g., "150")
- `{{5}}` = Scheduled timing (e.g., "Tomorrow, 2:00 PM" or "As soon as possible")

**Header:** None

**Footer:** `EazyDone - Your Trusted Handyman Service`

**Buttons:** None

**Sample Variables for Testing:**
```
{{1}} = Lex Liong
{{2}} = Plumbing Repair
{{3}} = JOB-ABC123
{{4}} = 150
{{5}} = Tomorrow, 2:00 PM
```

---

## Template 2: Handyman Job Acceptance

**Template Name:** `handyman_accepted_job`

**Category:** `TRANSACTIONAL`

**Language:** English (US)

**Template Content:**

```
Great news, {{1}}! 🎉

Handyman *{{2}}* has accepted your job request.

*Service:* {{3}}
*Job ID:* {{4}}
*Scheduled:* {{5}}

{{2}} will contact you shortly to confirm the details and arrival time.

*Important:*
• Please ensure someone is available at the scheduled time
• Have the work area accessible and clear
• Payment will be collected after job completion

Questions? Reply to this message!
```

**Variables:**
- `{{1}}` = Customer name (e.g., "John Tan")
- `{{2}}` = Handyman name (e.g., "Ahmad Lee")
- `{{3}}` = Service type (e.g., "Plumbing Repair")
- `{{4}}` = Job ID (e.g., "JOB-12345")
- `{{5}}` = Scheduled timing (e.g., "Tomorrow, 2:00 PM")

**Header:** None

**Footer:** `EazyDone - Your Trusted Handyman Service`

**Buttons:**
```
[Call Handyman] - Phone number action (if available in future)
```
*Note: Call button requires handyman phone number integration*

**Sample Variables for Testing:**
```
{{1}} = Lex Liong
{{2}} = Ahmad Lee
{{3}} = Plumbing Repair
{{4}} = JOB-ABC123
{{5}} = Tomorrow, 2:00 PM
```

---

## Template 3: Job Completion Confirmation

**Template Name:** `job_completion_request`

**Category:** `TRANSACTIONAL`

**Language:** English (US)

**Template Content:**

```
Hi {{1}},

Your handyman *{{2}}* has marked the job as complete! ✅

*Service:* {{3}}
*Job ID:* {{4}}

Please confirm that the work has been completed to your satisfaction.

*Before confirming:*
• Check that all work is completed as discussed
• Test any repairs or installations
• Ensure the work area has been cleaned up

Tap below to confirm completion or report an issue.
```

**Variables:**
- `{{1}}` = Customer name (e.g., "John Tan")
- `{{2}}` = Handyman name (e.g., "Ahmad Lee")
- `{{3}}` = Service type (e.g., "Plumbing Repair")
- `{{4}}` = Job ID (e.g., "JOB-12345")

**Header:** None

**Footer:** `EazyDone - Your Trusted Handyman Service`

**Buttons:**
```
[Quick Reply] Confirm Completion
[Quick Reply] Report Issue
```

**Button Configuration:**
- **Button 1:** Quick Reply - Text: "✅ Confirm Completion"
- **Button 2:** Quick Reply - Text: "⚠️ Report Issue"

*Note: When customer taps a button, you'll receive their response via webhook. You'll need to handle these responses in your backend.*

**Sample Variables for Testing:**
```
{{1}} = Lex Liong
{{2}} = Ahmad Lee
{{3}} = Plumbing Repair
{{4}} = JOB-ABC123
```

---

## Additional Notes for Meta Submission

### General Guidelines:
1. **Category Selection:**
   - Use `TRANSACTIONAL` for all templates (not `MARKETING`)
   - Transactional messages have higher delivery rates and no opt-out requirements

2. **Variable Format:**
   - Use `{{1}}`, `{{2}}`, `{{3}}` format (not `{{name}}` or `{{customer_name}}`)
   - Meta requires numbered placeholders
   - Keep variables in order (1, 2, 3, 4, 5...)

3. **Character Limits:**
   - Header: 60 characters
   - Body: 1024 characters
   - Footer: 60 characters

4. **Buttons:**
   - Maximum 3 buttons per template
   - Button types: Quick Reply, Call to Action (URL or Phone)
   - Quick Reply buttons return text responses

5. **Approval Time:**
   - Usually 24-48 hours
   - Meta may request changes if template doesn't meet guidelines
   - Templates with buttons may take longer to review

### Testing Before Approval:
- Continue using `hello_world` template during development
- Test all variables and edge cases with sandbox numbers
- Ensure phone numbers are verified in Meta dashboard

### After Approval:
- Update `whatsappService.js` to use approved template names
- Add template variables to function calls
- Test with real customer data
- Monitor delivery rates in Meta dashboard

---

## Implementation Code

After templates are approved, update your `whatsappService.js`:

```javascript
// Template 1: Job Payment Confirmation
export const sendJobCreationNotification = async (jobData) => {
  const timingText = jobData.preferredTiming === 'Schedule'
    ? `${new Date(jobData.preferredDate).toLocaleDateString()} at ${jobData.preferredTime}`
    : 'As soon as possible';

  return await sendTemplateMessage(
    jobData.customerPhone,
    'job_payment_confirmation',
    'en_US',
    [
      jobData.customerName,
      jobData.serviceType,
      jobData.id,
      jobData.estimatedBudget.toString(),
      timingText
    ]
  );
};

// Template 2: Handyman Job Acceptance
export const sendJobAcceptanceNotification = async (job, handyman) => {
  const timingText = job.preferredTiming === 'Schedule'
    ? `${new Date(job.preferredDate).toLocaleDateString()} at ${job.preferredTime}`
    : 'As soon as possible';

  return await sendTemplateMessage(
    job.customerPhone,
    'handyman_accepted_job',
    'en_US',
    [
      job.customerName,
      handyman.name,
      job.serviceType,
      job.id,
      timingText
    ]
  );
};

// Template 3: Job Completion Request
export const sendJobCompletionNotification = async (job, handyman) => {
  return await sendTemplateMessage(
    job.customerPhone,
    'job_completion_request',
    'en_US',
    [
      job.customerName,
      handyman.name,
      job.serviceType,
      job.id
    ]
  );
};
```

### Update `sendTemplateMessage()` to support variables:

```javascript
export const sendTemplateMessage = async (
  to,
  templateName = 'hello_world',
  languageCode = 'en_US',
  variables = [] // Add variables parameter
) => {
  if (!isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp not configured. Message not sent.');
    return { success: false, error: 'WhatsApp not configured', fallback: true };
  }

  try {
    const formattedPhone = formatPhoneNumber(to);

    // Build template components
    const templateComponents = [];

    // Add body component with variables if provided
    if (variables.length > 0) {
      templateComponents.push({
        type: "body",
        parameters: variables.map(value => ({
          type: "text",
          text: value.toString()
        }))
      });
    }

    console.log('📱 Sending WhatsApp template message...');
    console.log(`To: ${formattedPhone}`);
    console.log(`Template: ${templateName}`);
    console.log(`Variables:`, variables);

    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_CONFIG.apiVersion}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: templateComponents.length > 0 ? templateComponents : undefined
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API Error:', data);
      throw new Error(data.error?.message || 'Failed to send WhatsApp template');
    }

    console.log('✅ WhatsApp template sent successfully');
    console.log('Message ID:', data.messages?.[0]?.id);

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      data
    };

  } catch (error) {
    console.error('❌ Error sending WhatsApp template:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

---

## Webhook Setup for Interactive Buttons

When customers tap Quick Reply buttons in Template 3, you'll need a webhook to handle responses:

1. **Set up webhook in Meta Dashboard:**
   - Go to WhatsApp → Configuration
   - Add Callback URL: `https://your-domain.com/api/whatsapp/webhook`
   - Add Verify Token (random secret string)
   - Subscribe to `messages` webhook field

2. **Create webhook handler:**
   - Verify webhook requests from Meta
   - Parse incoming messages
   - Handle "Confirm Completion" and "Report Issue" responses
   - Update job status in Firebase accordingly

3. **Response Flow:**
   - Customer taps "✅ Confirm Completion" → Job status → `completed`
   - Customer taps "⚠️ Report Issue" → Job status → `disputed`, notify operations

---

## Cost Considerations

**Meta WhatsApp Business Pricing (as of 2024):**
- **Template Messages (Notification):** ~$0.05 - $0.10 per message (varies by country)
- **Customer Service Window (24h):** Free responses to customer-initiated messages
- **Singapore Rates:** ~$0.088 per template message

**Monthly Cost Estimate:**
- 100 jobs/month = ~$8.80 (3 notifications per job)
- 500 jobs/month = ~$44.00
- 1000 jobs/month = ~$88.00

**Cost Optimization Tips:**
- Combine multiple updates into single message when possible
- Use customer service window for follow-ups (free)
- Monitor template delivery rates in Meta dashboard

---

## Support Resources

- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Template Guidelines](https://www.facebook.com/business/help/2055875911147364)
- [Interactive Messages](https://developers.facebook.com/docs/whatsapp/guides/interactive-messages)
