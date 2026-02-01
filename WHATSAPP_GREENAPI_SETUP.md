# WhatsApp Notifications Setup - Green-API

This document outlines the setup steps for WhatsApp notifications using Green-API.

## ✅ Advantages of Green-API

| Feature | Green-API | Twilio/Meta |
|---------|-----------|-------------|
| **Templates Required** | ❌ No | ✅ Yes (24-48hr approval) |
| **24hr Window** | ❌ No | ✅ Yes |
| **Setup Complexity** | Simple (QR scan) | Complex (business verification) |
| **Polls** | ✅ Yes | ❌ No (buttons need approval) |
| **Cost** | Pay per instance | Pay per message |
| **Time to Start** | ~5 minutes | Days/weeks |

---

## 📋 Setup Steps

### Step 1: Create Green-API Account

**Time Required:** 2 minutes

1. Go to https://console.green-api.com
2. Click **Register**
3. Enter your email and select country
4. Verify email with the code sent
5. Login to your console

---

### Step 2: Create an Instance

**Time Required:** 2 minutes

1. In the console, click **Create an instance**
2. Choose your plan (there's a free tier for testing)
3. Wait up to 2 minutes for instance activation
4. You'll see your instance with:
   - **idInstance**: Your instance ID number
   - **apiTokenInstance**: Your API token
   - **apiUrl**: The API endpoint URL

---

### Step 3: Authorize Instance (Scan QR Code)

**Time Required:** 2 minutes

1. In the console, find your instance
2. Click on **QR Code** or **Authorization**
3. Open WhatsApp/WhatsApp Business on your phone:
   - Go to **Settings** → **Linked Devices**
   - Tap **Link a Device**
   - Scan the QR code shown in the console
4. Wait for "Instance Authorized" status

**Important:** Your phone must stay connected to the internet for messages to be sent/received.

---

### Step 4: Configure Environment Variables

**Time Required:** 2 minutes

Add these to your `.env.local` file:

```env
# Green-API Configuration
REACT_APP_GREENAPI_API_URL=https://api.green-api.com
REACT_APP_GREENAPI_ID_INSTANCE=your_instance_id
REACT_APP_GREENAPI_API_TOKEN=your_api_token
```

**Where to find these values:**
- **API URL**: Usually `https://api.green-api.com` (check your console)
- **ID Instance**: Shown in your console dashboard
- **API Token**: Shown in your console dashboard (click to reveal)

---

### Step 5: Configure Firebase Functions (For Webhook)

**Time Required:** 5 minutes

The webhook handler needs Green-API credentials to send confirmation messages.

```bash
# Set Firebase functions config
firebase functions:config:set greenapi.apiurl="https://api.green-api.com"
firebase functions:config:set greenapi.idinstance="your_instance_id"
firebase functions:config:set greenapi.apitoken="your_api_token"

# Verify config
firebase functions:config:get
```

---

### Step 6: Configure Webhook in Green-API Console

**Time Required:** 5 minutes

To receive poll responses, you need to configure a webhook.

1. In Green-API console, find your instance
2. Go to **Settings** or **Webhook** section
3. Set **Webhook URL**:
   ```
   https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/whatsappWebhook
   ```
4. Enable these webhook types:
   - ✅ **Receive notifications about incoming messages**
   - ✅ **Receive notifications about polls**
5. Save settings

---

### Step 7: Deploy Cloud Functions

**Time Required:** 5 minutes

```bash
cd functions
firebase deploy --only functions:whatsappWebhook
```

Note the deployed URL and update Green-API webhook settings if needed.

---

### Step 8: Test the Integration

**Time Required:** 10 minutes

#### 8.1 Restart Development Server

```bash
npm start
```

#### 8.2 Test Job Creation Flow

1. Create a new job as a customer
2. Use your phone number (the one linked to WhatsApp)
3. Complete the payment
4. Check WhatsApp for the job confirmation message

**Expected Message:**
```
Hi [Your Name]! 👋

Your job request has been posted successfully! ✅

📋 *Service:* Plumbing Repair
💰 *Service Fee:* $150.00
🔖 *Job ID:* abc123xyz
📅 *Timing:* As soon as possible

A qualified handyman will accept your job shortly...
```

#### 8.3 Test Job Acceptance Flow

1. Login as a handyman
2. Accept the test job
3. Check WhatsApp for acceptance notification

**Expected Message:**
```
Great news, [Customer Name]! 🎉

*[Handyman Name]* has accepted your job request!

📋 *Service:* Plumbing Repair
🔖 *Job ID:* abc123xyz

The handyman will contact you shortly...
```

#### 8.4 Test Job Completion Flow with Poll

1. As handyman, mark the job as complete
2. Check WhatsApp for completion message + poll

**Expected Messages:**
```
Hello [Customer Name]! 👋

Your handyman *[Handyman Name]* has marked the following job as complete:

📋 *Service:* Plumbing Repair
🔖 *Job ID:* abc123xyz

Please confirm if the work has been completed to your satisfaction.
```

Followed by a **Poll**:
```
Is the job "Plumbing Repair" completed satisfactorily?
○ ✅ Yes, Confirm Complete
○ ⚠️ No, Report Issue
```

3. Vote on the poll
4. Check that you receive a confirmation message
5. Verify job status updated in Firestore

---

## 📱 Message Flow Summary

### 1. Job Created (After Payment)
```
Customer receives: Text message with job details
```

### 2. Job Accepted (Handyman Accepts)
```
Customer receives: Text message with handyman info
```

### 3. Job Completed (Handyman Marks Complete)
```
Customer receives:
1. Text message with completion info
2. Poll with confirm/report options

Customer votes on poll →
Webhook receives vote →
Job status updated →
Customer receives confirmation message
```

---

## 🔧 Troubleshooting

### Messages Not Sending

**Check:**
1. Environment variables are set correctly
2. Instance is authorized (green status in console)
3. Phone has internet connection
4. Restart development server after adding env vars

**Debug:**
```javascript
// Add to browser console
console.log('Green-API Config:', {
  apiUrl: process.env.REACT_APP_GREENAPI_API_URL,
  idInstance: process.env.REACT_APP_GREENAPI_ID_INSTANCE,
  hasToken: !!process.env.REACT_APP_GREENAPI_API_TOKEN
});
```

### Poll Votes Not Processing

**Check:**
1. Webhook URL is correct in Green-API console
2. Cloud Functions are deployed
3. "Receive notifications about polls" is enabled
4. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only whatsappWebhook
   ```

### Instance Disconnected

**Solution:**
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Check if the Green-API device is connected
4. If not, re-scan the QR code in Green-API console

---

## 💰 Cost Information

### Green-API Pricing

- **Free tier**: Limited messages for testing
- **Paid plans**: Based on instance, not per message
- **No per-message fees** for most plans

**Compared to Twilio:**
- Twilio: ~$0.008 per message (Singapore)
- Green-API: Fixed monthly cost per instance

---

## 📚 Documentation Links

- [Green-API Documentation](https://green-api.com/en/docs/)
- [Green-API API Reference](https://green-api.com/en/docs/api/)
- [Sending Messages](https://green-api.com/en/docs/api/sending/)
- [Receiving Webhooks](https://green-api.com/en/docs/api/receiving/)
- [SendPoll Method](https://green-api.com/en/docs/api/sending/SendPoll/)

---

## ✅ Implementation Checklist

- [ ] Create Green-API account
- [ ] Create instance
- [ ] Scan QR code to authorize
- [ ] Add environment variables to `.env.local`
- [ ] Configure Firebase functions config
- [ ] Configure webhook URL in Green-API console
- [ ] Deploy Cloud Functions
- [ ] Test job creation notification
- [ ] Test job acceptance notification
- [ ] Test job completion notification with poll
- [ ] Test poll voting and webhook processing

---

**Last Updated:** 2026-01-22
**Status:** ✅ Ready for implementation
