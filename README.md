# EazyDone - Handyman Platform Singapore

A mobile-first web application platform connecting customers with trusted handymen across Singapore. Features a modern, responsive design built with React, Firebase, Stripe payments, and WhatsApp notifications.

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- Stripe account (for payments)
- WhatsApp Business API access (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Handyman

# Install dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..

# Create environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm start
```

### Environment Setup

See **[Environment Setup Guide](./docs/setup/environment-setup.md)** for detailed configuration instructions.

**Quick .env.local template:**
```env
# Firebase
REACT_APP_FIREBASE_API_KEY=xxxxx
REACT_APP_FIREBASE_AUTH_DOMAIN=eazydone-d06cf.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=eazydone-d06cf
REACT_APP_FIRESTORE_DATABASE=devs  # Use 'devs' for development

# Stripe
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Email (EmailJS)
REACT_APP_EMAILJS_SERVICE_ID=service_xxxxx
REACT_APP_OPERATIONS_EMAIL=operations@eazydone.com
REACT_APP_APPROVAL_BASE_URL=http://localhost:3000/admin/approve-handyman

# WhatsApp (optional)
REACT_APP_WHATSAPP_PHONE_NUMBER_ID=xxxxx
REACT_APP_WHATSAPP_ACCESS_TOKEN=xxxxx
```

---

## 📚 Documentation

### Feature Documentation

Comprehensive guides for each feature with key files, functions, and implementation details:

- **[Authentication](./docs/features/authentication.md)** - Handyman & customer auth, role-based access
- **[Handyman Registration & Stripe Onboarding](./docs/features/handyman-registration.md)** - Complete registration flow, document upload, verification, Stripe Connect
- **[Job Creation Flow](./docs/features/job-creation-flow.md)** - Customer job request, anonymous auth, job creation before payment
- **[Stripe Payment Integration](./docs/features/stripe-payment.md)** - Escrow, manual capture, 3-way splits, Connect accounts
- **[WhatsApp Notifications](./docs/features/whatsapp-notifications.md)** - Meta Cloud API, template messages
- **[Job Dashboard (Handyman)](./docs/features/job-dashboard.md)** - Job board, my jobs, profile, status views
- **[Common Components & Utilities](./docs/features/common-components.md)** - Shared UI, hooks, contexts, helpers
- **[Project Requirements](./docs/features/project-requirements.md)** - Original project vision and user journeys

### Setup Guides

- **[Firebase Setup](./docs/setup/firebase-setup.md)** - Firestore, Auth, Storage, Functions configuration
- **[Email Setup (EmailJS)](./docs/setup/email-setup.md)** - Handyman registration emails, operations notifications
- **[Environment Configuration](./docs/setup/environment-setup.md)** - Dev vs production, database separation
- **[WhatsApp Templates](./docs/setup/whatsapp-templates.md)** - Template submission to Meta, webhook setup

### Deployment

- **[Production Deployment Checklist](./docs/deployment/production-checklist.md)** - Complete pre-deployment, deployment, and testing checklist

---

## 🏗️ Project Structure

```
Handyman/
├── src/
│   ├── components/
│   │   ├── common/          # Shared components (Header, Footer, Modal, etc.)
│   │   ├── customer/        # Customer-facing components (JobRequestForm, PaymentForm, etc.)
│   │   └── handyman/        # Handyman components (Dashboard, JobBoard, Registration, etc.)
│   ├── pages/               # Route pages (HomePage, HandymanDashboard, etc.)
│   ├── services/
│   │   ├── firebase/        # Firebase services (auth, firestore, storage)
│   │   ├── stripe/          # Stripe API integration
│   │   ├── api/             # API services (jobs, handymen)
│   │   ├── emailService.js  # EmailJS integration
│   │   └── whatsappService.js  # WhatsApp Cloud API
│   ├── hooks/               # Custom React hooks (useAuth, useJobs, etc.)
│   ├── context/             # React contexts (AuthContext)
│   ├── config/              # Configuration (servicePricing, emailConfig)
│   └── utils/               # Utility functions
├── functions/               # Firebase Cloud Functions
│   └── index.js            # Stripe payment & Connect functions
├── docs/                    # Documentation
│   ├── features/           # Feature documentation
│   ├── setup/              # Setup guides
│   └── deployment/         # Deployment guides
└── public/                  # Static assets
```

---

## 🎯 Key Features

### For Customers
- ✅ Anonymous job creation (no registration required)
- ✅ Service selection with transparent pricing
- ✅ Secure payment with Stripe (escrow/manual capture)
- ✅ Photo upload for job description
- ✅ Job tracking
- ⚠️ WhatsApp & email notifications (template approval pending)
- ❌ Handyman selection (currently manual matching)
- ❌ Real-time job status updates

### For Handymen
- ✅ Email/password registration
- ✅ Document upload (NRIC, certifications, insurance)
- ✅ Verification workflow with operations team approval
- ✅ Stripe Connect onboarding for payments
- ✅ Job board with available jobs
- ✅ Profile management
- ✅ Status-specific dashboard views (pending/approved/rejected)
- ❌ Job acceptance and management
- ❌ Earnings dashboard
- ❌ Rating system

### Payment System
- ✅ Stripe payment intents with manual capture (escrow)
- ✅ 10% platform fee calculation
- ✅ Stripe Elements card collection
- ✅ 3D Secure (SCA) authentication
- ✅ Real job ID tracking in Stripe metadata
- ✅ Stripe Connect for handyman payouts
- ❌ Payment capture after job completion
- ❌ 3-way payment split (handyman 100% service fee, 50/50 platform fee split)
- ❌ Auto-release after 3 days
- ❌ Refund system

### Admin/Operations
- ✅ Email-based handyman approval system
- ✅ Approval/rejection with reasons
- ✅ Document review via Storage URLs
- ❌ Admin dashboard
- ❌ Bulk approval tools

---

## 🔑 Key Technologies

- **Frontend:** React 18, React Router
- **Backend:** Firebase (Auth, Firestore, Storage, Functions)
- **Payments:** Stripe (PaymentIntents, Connect, Elements)
- **Notifications:** EmailJS, WhatsApp Cloud API
- **Deployment:** Firebase Hosting
- **Database:** Firestore (dev & production databases)

---

## 📊 Database Structure

### Collections

**`users/{uid}`** - User profiles (all users)
- role: "handyman" | "customer" | "admin"
- email, name, phone
- createdAt, updatedAt

**`handymen/{uid}`** - Handyman profiles
- serviceTypes, experience, bio
- verificationStatus: "pending" | "approved" | "rejected" | "suspended"
- documents (NRIC, certifications, insurance URLs)
- stripeAccountId, stripeOnboardingComplete
- rating, totalJobs

**`jobs/{jobId}`** - Job requests
- customerId, customerName, customerEmail, customerPhone, customerAddress
- serviceType, description, estimatedBudget, photoURL
- status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
- paymentStatus: "pending" | "authorized" | "captured" | "released" | "refunded"
- paymentIntentId, assignedHandymanId
- createdAt, updatedAt

**`payments/{paymentId}`** - Payment records
- jobId, customerId, paymentIntentId
- amount, currency, status
- clientSecret, paymentMethod
- stripeResponse (full PaymentIntent object)
- createdAt

---

## 🛠️ Development Workflow

### Branches

- **`dev`** - Development branch (uses `devs` Firestore database)
- **`main`** - Production branch (uses `(default)` Firestore database)

### Local Development

```bash
# Switch to dev branch
git checkout dev

# Start development server
npm start
# App runs at http://localhost:3000
# Automatically uses 'devs' database
```

### Production Deployment

```bash
# Switch to main branch
git checkout main

# Merge tested changes from dev
git merge dev

# Build and deploy
npm run build
firebase deploy

# Deployed to: https://eazydone-d06cf.web.app
# Automatically uses '(default)' database
```

See **[Production Deployment Checklist](./docs/deployment/production-checklist.md)** for complete deployment process.

---

## 🧪 Testing

### Test Accounts

**Handyman Login:**
- Email: (register via /handyman-registration)
- Password: (set during registration)

**Test Payment Cards:**
- Success: `4242 4242 4242 4242`
- 3D Secure: `4000 0027 6000 3184`
- Declined: `4000 0000 0000 0002`

All cards: Any future expiry, any 3-digit CVC, any postal code

### Manual Testing

1. **Customer Job Creation:**
   - Go to `/request-job`
   - Fill multi-step form
   - Upload photo (optional)
   - Complete payment with test card
   - Verify job in Firestore `jobs` collection
   - Verify payment in Stripe Dashboard (should show "Uncaptured")

2. **Handyman Registration:**
   - Go to `/handyman-registration`
   - Complete 4-step registration
   - Upload documents
   - Check operations email for approval link
   - Approve/reject via email link
   - Login and complete Stripe onboarding

3. **Payment Escrow:**
   - Create job as customer
   - Check Stripe Dashboard: payment should be "Uncaptured"
   - Check Firestore: `paymentStatus` should be "authorized"
   - Funds held but not charged

---

## 🚧 Current Implementation Status

### ✅ Completed Features

- Customer anonymous job creation
- Multi-step job request form
- Handyman registration with document upload
- Operations team approval workflow
- Stripe payment intent creation (escrow/manual capture)
- Stripe Elements card collection with 3D Secure
- Stripe Connect handyman onboarding
- Email notifications (EmailJS)
- Job created BEFORE payment (proper flow)
- Real job IDs in Stripe metadata
- Environment-based configuration (dev/prod databases)
- Status-based handyman dashboard views

### ⚠️ Partially Implemented

- WhatsApp notifications (API configured, templates not approved)
- Payment system (escrow works, release/split not implemented)
- Job dashboard (view jobs, but can't accept/complete)

### ❌ Not Yet Implemented

- Payment capture after job completion
- 3-way payment split to handyman/cofounder/operator
- Auto-release escrow after 3 days
- Refund system
- Job acceptance by handyman
- Job start/complete functionality
- Customer confirmation workflow
- Handyman earnings dashboard
- Rating & review system
- Real-time notifications
- Admin dashboard for bulk operations
- Job matching algorithm

---

## 📞 Support & Contact

**Development Team:**
- Operations Email: `REACT_APP_OPERATIONS_EMAIL` (configured in .env)

**Resources:**
- Firebase Console: https://console.firebase.google.com/project/eazydone-d06cf
- Stripe Dashboard: https://dashboard.stripe.com

---

## 📝 License

[Your License Here]

---

## 🙏 Acknowledgments

Built with:
- React
- Firebase
- Stripe
- EmailJS
- WhatsApp Business Cloud API

---

**Last Updated:** 2025-12-11
**Version:** 1.0.0
**Status:** Development (Pre-Production)
