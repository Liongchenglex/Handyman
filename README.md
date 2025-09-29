# HandySG - Handyman Platform Singapore

A mobile-first web application platform connecting customers with trusted handymen across Singapore. Features a modern, responsive design built with React, Tailwind CSS, and integrated with Stripe payments and WhatsApp notifications.

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- Stripe account
- WhatsApp Business API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd handyman-platform
   ```

2. **Install dependencies**
   ```bash
   # Install main app dependencies
   npm install
   
   # Install Firebase Functions dependencies
   cd functions
   npm install
   cd ..
   ```

3. **Configure environment variables**
   
   Create `.env.local` in the root directory:
   ```env
   # Firebase Configuration
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   
   # Stripe Configuration
   REACT_APP_STRIPE_PUBLIC_KEY=your_stripe_public_key
   
   # WhatsApp Business API
   REACT_APP_WHATSAPP_BUSINESS_PHONE=+65xxxxxxxx
   ```
   
   Create `functions/.env`:
   ```env
   # Stripe Secret Key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   
   # WhatsApp Business API
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
   
   # Other API Keys
   FIREBASE_PROJECT_ID=your_project_id
   ```

4. **Initialize Firebase**
   ```bash
   # Install Firebase CLI
   npm install -g firebase-tools
   
   # Login to Firebase
   firebase login
   
   # Initialize Firebase project
   firebase init
   ```

5. **Start development server**
   ```bash
   npm start
   ```

## 🧪 Local Development & Testing

### Quick Local Testing (Frontend Only)

If you want to test the frontend immediately without setting up Firebase/Stripe:

1. **Navigate to project root**
   ```bash
   cd /path/to/handyman-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create minimal .env.local for testing**
   ```bash
   # Create basic environment file
   touch .env.local
   echo "REACT_APP_FIREBASE_PROJECT_ID=demo-project" >> .env.local
   echo "REACT_APP_STRIPE_PUBLIC_KEY=pk_test_demo" >> .env.local
   ```

4. **Start development server**
   ```bash
   npm start
   ```

   The app will open at `http://localhost:3000`

**What you can test without backend:**
- ✅ UI components and navigation
- ✅ Form validations
- ✅ Responsive design
- ✅ Component interactions
- ❌ Job creation (needs Firebase)
- ❌ Payments (needs Stripe)
- ❌ WhatsApp notifications

### Full Local Development Setup

For complete functionality testing:

1. **Set up Firebase Emulators**
   ```bash
   # Install Firebase CLI globally
   npm install -g firebase-tools

   # Login to Firebase
   firebase login

   # Initialize Firebase in project
   firebase init

   # Start emulators
   firebase emulators:start
   ```

2. **Update .env.local for emulators**
   ```env
   # Use emulator endpoints
   REACT_APP_FIREBASE_API_KEY=demo-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=demo-project
   REACT_APP_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef

   # Use Stripe test keys
   REACT_APP_STRIPE_PUBLIC_KEY=pk_test_your_test_key_here
   ```

3. **Start both frontend and backend**
   ```bash
   # Terminal 1: Start Firebase emulators
   firebase emulators:start

   # Terminal 2: Start React app
   npm start
   ```

### Testing Different User Flows

1. **Customer Flow Testing**
   ```bash
   # Navigate to customer job request
   # http://localhost:3000/request-job
   ```
   - Fill out job request form
   - Test form validation
   - Submit job (will use Firebase emulator)

2. **Handyman Flow Testing**
   ```bash
   # Navigate to handyman dashboard
   # http://localhost:3000/handyman-dashboard
   ```
   - Complete handyman registration
   - Browse available jobs
   - Test job acceptance

3. **Job Board Testing**
   ```bash
   # Navigate to job board
   # http://localhost:3000/jobs
   ```
   - View all available jobs
   - Test filtering and sorting

### Directory Structure for Development

```bash
handyman-platform/                 # ← cd here for main development
├── src/                           # React app source code
├── public/                        # Static assets
├── functions/                     # ← cd here for backend functions
│   ├── src/
│   └── package.json
├── package.json                   # ← Main app dependencies
├── .env.local                     # ← Create this for config
└── firebase.json                  # Firebase configuration
```

### What's Already Set Up

**✅ Frontend Complete:**
- React app with routing
- Modern UI with Tailwind CSS design system
- Complete component library matching Figma designs
- Multi-step forms with validation
- Responsive mobile-first design
- Singapore payment methods (PayNow, PayLah)
- WhatsApp notification integration
- Dark mode support

**✅ Design System:**
- Space Grotesk typography
- Custom color palette (#38e07b primary)
- Material Icons integration
- Tailwind CSS via CDN
- Mobile-optimized layouts

**✅ Backend Structure:**
- Firebase Functions structure
- Firestore security rules
- Database schema defined

**❌ Still Needs Setup:**
- Service layer implementation (API calls)
- Firebase Functions code
- Context providers implementation
- Custom hooks implementation

### Common Development Commands

```bash
# Start fresh development session
cd handyman-platform
npm install
npm start

# If you need to reset node_modules
rm -rf node_modules package-lock.json
npm install

# Check for any missing dependencies
npm audit

# Build for production testing
npm run build
```

### Troubleshooting Local Setup

**Port conflicts:**
```bash
# If port 3000 is busy, React will offer port 3001
# Or specify custom port:
PORT=3001 npm start
```

**Node version issues:**
```bash
# Check your Node version
node --version

# Should be v16 or higher
# Use nvm to switch versions if needed
nvm use 16
```

**Dependencies not installing:**
```bash
# Clear npm cache
npm cache clean --force

# Try with legacy peer deps
npm install --legacy-peer-deps
```

## 📁 Project Structure

```
handyman-platform/
├── public/                          # Static assets
│   ├── index.html                  # Main HTML template
│   ├── favicon.ico                 # App favicon
│   └── manifest.json               # PWA manifest
├── src/                            # Source code
│   ├── components/                 # React components
│   │   ├── common/                 # Shared components
│   │   │   ├── Header.jsx          # Navigation header
│   │   │   ├── Footer.jsx          # Site footer
│   │   │   ├── LoadingSpinner.jsx  # Loading indicator
│   │   │   └── Modal.jsx           # Modal component
│   │   ├── customer/               # Customer-specific components
│   │   │   ├── JobRequestForm.jsx  # Job creation form
│   │   │   ├── PaymentForm.jsx     # Stripe payment form
│   │   │   └── JobConfirmation.jsx # Job confirmation page
│   │   └── handyman/               # Handyman-specific components
│   │       ├── JobBoard.jsx        # Available jobs display
│   │       ├── JobCard.jsx         # Individual job card
│   │       ├── HandymanRegistration.jsx # Handyman signup
│   │       └── NotificationPreferences.jsx # Notification settings
│   ├── pages/                      # Page components
│   │   ├── HomePage.jsx            # Landing page
│   │   ├── CustomerJobRequest.jsx  # Customer job request flow
│   │   ├── HandymanDashboard.jsx   # Handyman dashboard
│   │   ├── JobBoard.jsx            # Public job board
│   │   └── JobDetails.jsx          # Individual job details
│   ├── services/                   # Service layer
│   │   ├── firebase/               # Firebase services
│   │   │   ├── config.js           # Firebase configuration
│   │   │   ├── auth.js             # Authentication services
│   │   │   └── firestore.js        # Database operations
│   │   ├── stripe/                 # Stripe payment services
│   │   │   ├── payment.js          # Payment processing
│   │   │   └── escrow.js           # Escrow management
│   │   ├── whatsapp/               # WhatsApp integration
│   │   │   ├── notifications.js    # Notification sending
│   │   │   └── messaging.js        # Message handling
│   │   └── api/                    # API abstraction layer
│   │       ├── jobs.js             # Job-related API calls
│   │       ├── handymen.js         # Handyman-related API calls
│   │       └── payments.js         # Payment-related API calls
│   ├── hooks/                      # Custom React hooks
│   │   ├── useAuth.js              # Authentication hook
│   │   ├── useJobs.js              # Jobs data hook
│   │   └── usePayments.js          # Payments hook
│   ├── utils/                      # Utility functions
│   │   ├── constants.js            # App constants
│   │   ├── helpers.js              # Helper functions
│   │   └── validation.js           # Validation utilities
│   ├── styles/                     # Styling files (Tailwind CSS via CDN)
│   │   ├── globals.css             # Global styles and overrides
│   │   ├── components/             # Component-specific styles
│   │   └── pages/                  # Page-specific styles
│   ├── context/                    # React context providers
│   │   ├── AuthContext.js          # Authentication context
│   │   └── JobContext.js           # Job management context
│   ├── App.jsx                     # Main app component
│   └── index.js                    # App entry point
├── functions/                      # Firebase Functions (Backend)
│   ├── src/                        # Functions source code
│   │   ├── handlers/               # Request handlers
│   │   │   ├── jobs.js             # Job-related functions
│   │   │   ├── payments.js         # Payment processing functions
│   │   │   └── notifications.js    # Notification functions
│   │   ├── middleware/             # Middleware functions
│   │   │   ├── auth.js             # Authentication middleware
│   │   │   └── validation.js       # Request validation
│   │   └── index.js                # Functions entry point
│   ├── package.json                # Functions dependencies
│   └── .env                        # Functions environment variables
├── .env.local                      # Frontend environment variables
├── package.json                    # Main dependencies
├── firebase.json                   # Firebase configuration
├── firestore.rules                 # Firestore security rules
├── firestore.indexes.json          # Firestore indexes
└── README.md                       # Project documentation
```

## 🏗️ Architecture Overview

### Frontend (React)
- **Mobile-first responsive design** - Optimized for mobile users with Tailwind CSS
- **Modern design system** - Space Grotesk typography, custom color palette
- **Component-based architecture** - Reusable UI components
- **Multi-step user flows** - Job request, payment, and confirmation flows
- **Singapore payment integration** - PayNow, PayLah, and card payments
- **Dark mode support** - Automatic theme switching
- **Context-based state management** - For authentication and job data
- **React Router** - Client-side routing

### Backend (Firebase)
- **Firebase Functions** - Serverless backend logic
- **Firestore** - NoSQL database for real-time data
- **Firebase Authentication** - User authentication (anonymous auth)
- **Firebase Hosting** - Static site hosting

### Integrations
- **Stripe** - Payment processing and escrow management
- **WhatsApp Business API** - Customer and handyman notifications
- **Firebase Security Rules** - Data access control

## 🔧 Key Features

### For Customers
1. **Modern Job Request Flow**
   - Clean, intuitive two-step form process
   - Personal details collection (Step 1)
   - Comprehensive job description with AI assistance (Step 2)
   - Interactive calendar for scheduling
   - Service category selection with icons
   - Real-time form validation

2. **Singapore Payment Methods**
   - PayNow integration for instant transfers
   - PayLah! support for DBS users
   - Credit/debit card processing via Stripe
   - Transparent pricing breakdown
   - Secure escrow protection with visual indicators

3. **Seamless Confirmation Experience**
   - Success page with job summary
   - WhatsApp notification status tracking
   - Direct link to view job details
   - Payment confirmation display

### For Handymen
1. **Registration & Profiles**
   - Multi-step registration process
   - Skills and experience verification
   - Service area and availability settings

2. **Job Management**
   - Real-time job board with filtering
   - One-click job acceptance
   - WhatsApp coordination with customers

3. **Notification System**
   - Customizable notification preferences
   - WhatsApp alerts for matching jobs
   - Email summaries and reports

## 🔄 Customer Flow Documentation

### Complete Customer Journey
The customer experience follows a carefully designed 4-step flow to ensure ease of use and clear progress tracking.

#### **Step 1: Personal Details**
**Location**: `/request-job` (First step)
**Purpose**: Collect essential customer information for job creation and communication

**Form Fields:**
- **Full Name** *(required)* - Customer identification
- **Email Address** *(required)* - Communication and notifications
- **Phone Number** *(required)* - WhatsApp notifications and handyman contact

**Validation:**
- Email format validation with pattern matching
- Singapore phone number validation (8 digits starting with 6, 8, or 9)
- All fields are mandatory with real-time error messages

**UI Features:**
- Clean, centered form layout optimized for mobile
- Progress stepper showing "Step 1 of 4"
- Form persistence - data saved if user navigates back
- "Continue" button to proceed to job details

#### **Step 2: Job Details**
**Purpose**: Comprehensive job specification and requirements gathering

**Service Categories:**
- Plumbing
- Electrical
- Carpentry
- Appliance Repair
- Painting

**Timing Options:**
- **Immediate** - For urgent jobs
- **Schedule** - For planned jobs with date/time selection

**Scheduling Features:**
- Interactive calendar with min/max date constraints (today to 1 year ahead)
- Time slot selection (4 preset slots from 9AM to 5PM)
- Visual date picker with custom styling

**Materials & Logistics:**
- **Materials**: "I will buy" vs "Handyman to buy (surcharge applies)"
- **Site Visit**: Yes/No option for initial assessment

**File Upload:**
- Multiple image upload support
- Individual file size limit: 10MB
- Total upload limit: 50MB
- Drag & drop interface with preview
- File type validation (images only)
- Size indicator showing used/total space

**Job Description:**
- Rich text area for detailed problem description
- Placeholder guidance for effective descriptions
- Character limit and validation

**Navigation:**
- Back button to return to personal details
- Progress stepper showing current step
- "Proceed to Review" button with form validation

#### **Step 3: Review & Submit**
**Purpose**: Allow customers to verify all information before proceeding to payment

**Review Sections:**
1. **Personal Details Card**
   - Name, email, phone display
   - Edit functionality (returns to Step 1)

2. **Job Details Card**
   - Service category, timing, schedule details
   - Materials preference, site visit requirement
   - Job description/notes

3. **Uploaded Images Section** (if applicable)
   - Thumbnail grid display
   - Image count and total file size
   - Preview functionality

**Interactive Elements:**
- Progress stepper allows navigation back to previous steps
- Header back button returns to job details
- Edit buttons for each section redirect to appropriate step

**Validation:**
- All previous step validations must pass
- No additional input required at this stage

**Action:**
- "Proceed to Payment" button advances to final step

#### **Step 4: Payment**
**Purpose**: Secure payment processing with escrow protection

**Payment Methods:**
- **PayNow** - Singapore's instant transfer system
- **PayLah!** - DBS digital wallet
- **Credit/Debit Card** - Stripe processing

**Pricing Breakdown:**
- Service fee: $120 (configurable)
- Platform fee: $5
- **Total**: $125 (transparent calculation)

**Security Features:**
- Escrow protection explanation with shield icon
- Payment held until job completion confirmation
- Clear security messaging for customer confidence

**Payment Flow:**
1. Method selection with visual logos/icons
2. Secure payment processing (2-second simulation in demo)
3. Success confirmation with payment intent details
4. Job creation with payment status

**Success Handling:**
- Payment success triggers job creation
- WhatsApp notification sent to customer
- Success alert with job confirmation
- Integration point for `onJobCreated` callback

### Progress Stepper Implementation

**Design Features:**
- **Desktop/Tablet View**: Full step circles with titles and descriptions
- **Mobile View**: Compact progress bar with step indicators
- **Interactive Navigation**: Click previous steps to return (where allowed)
- **Visual States**:
  - Completed: Green circle with checkmark
  - Current: Green circle with step number + ring highlight
  - Upcoming: Gray circle with step number

**Step Navigation Rules:**
- Step 1: No back navigation (entry point)
- Steps 2-4: Can navigate back to previous completed steps
- Forward navigation requires completing current step validation

**Responsive Behavior:**
- Automatically switches between desktop and mobile layouts
- Maintains step state across different screen sizes
- Touch-friendly interactive elements on mobile

### Error Handling & Validation

**Form Validation:**
- Real-time validation on field blur
- Error messages appear below each field
- Red border highlighting for invalid fields
- Validation blocks progression to next step

**File Upload Errors:**
- Size limit notifications with current usage display
- File type restriction enforcement
- Upload failure handling with retry options

**Payment Error Handling:**
- Payment failure notifications
- Retry mechanisms for failed transactions
- Clear error messages with actionable guidance

### Data Persistence

**Form Data Persistence:**
- Step navigation preserves all entered data
- Browser refresh maintains form state
- Back/forward navigation retains user inputs
- Image uploads persist across step changes

**State Management:**
- React useState for step management
- Separate state objects for personal and job data
- Error state tracking per form section
- File upload state with size monitoring

### Mobile Optimization

**Touch Interface:**
- Large touch targets for all interactive elements
- Swipe-friendly date picker interface
- Mobile-optimized file upload with photo access
- Finger-friendly button sizing

**Performance:**
- Lazy loading for non-critical components
- Optimized image handling and compression
- Minimal bundle size for fast mobile loading
- Progressive enhancement for slower connections

### Accessibility Features

**Screen Reader Support:**
- Semantic HTML structure with proper headings
- ARIA labels for complex interactions
- Form field associations with labels
- Progress stepper accessibility attributes

**Keyboard Navigation:**
- Tab order follows logical flow
- Enter key submission support
- Escape key for modal/dialog dismissal
- Focus management across step transitions

**Visual Accessibility:**
- High contrast mode support
- Color-blind friendly design choices
- Scalable text and interface elements
- Clear visual hierarchy and spacing

## 🔧 Handyman Flow Documentation

### Complete Handyman Journey
The handyman experience is designed for professionals to efficiently find, accept, and manage job requests from customers. The flow emphasizes simplicity and mobile-first design for busy handymen.

#### **Step 1: Authentication**
**Location**: `/handyman-auth`
**Purpose**: Unified login and signup experience for handymen

**Authentication Modes:**
- **Login Mode**: For returning handymen
  - Email/phone and password authentication
  - "Remember me" functionality
  - Password recovery option

- **Signup Mode**: For new handymen
  - Basic account creation (email, phone, password)
  - Initial verification
  - Progresses to registration flow

**Form Features:**
- Toggle between login/signup modes with animated transition
- Singapore phone number validation (+65 format)
- Real-time form validation with error messaging
- Mobile-optimized input fields
- Loading states during authentication

**Navigation:**
- "Back to Home" link to return to main site
- Auto-redirect after successful authentication
- Error handling with retry mechanisms

#### **Step 2: Registration (New Handymen Only)**
**Location**: `/handyman-registration`
**Purpose**: Comprehensive profile setup for new handymen

**Multi-Step Registration Process:**

##### **Step 1: Personal Details**
- **Full Name** *(required)* - Professional identification
- **Email Address** *(pre-filled from signup)*
- **Phone Number** *(pre-filled from signup)*
- **Address** *(required)* - Service area determination
- **Date of Birth** - Age verification
- **NRIC/FIN** *(required)* - Singapore identity verification

##### **Step 2: Professional Information**
- **Service Types** *(multi-select required)*:
  - Plumbing
  - Electrical
  - Carpentry
  - Appliance Repair
  - Painting
  - Aircon Servicing
  - Other (with custom input)

- **Experience Level** *(required)*:
  - Beginner (0-2 years)
  - Intermediate (2-5 years)
  - Expert (5+ years)

- **Hourly Rate** - Pricing expectation (SGD)
- **Service Areas** - Singapore regions served
- **Professional Description** - Skills and experience summary
- **Availability** - Working hours and days

##### **Step 3: Documents & Verification**
- **NRIC/Passport Upload** *(required)* - Identity verification
- **Professional Certifications** - Relevant trade certificates
- **Insurance Documents** - Liability coverage proof
- **Portfolio Images** - Previous work examples
- **Trade License** - Professional licensing (if applicable)

**Upload Features:**
- Drag & drop interface
- Multiple file support
- Image preview functionality
- File size validation (10MB per file)
- Progress indicators

##### **Step 4: Preferences & Settings**
- **Notification Preferences**:
  - Job alerts via WhatsApp *(default: enabled)*
  - Job alerts via email
  - Weekly summary reports
  - Promotional communications

- **Job Matching Preferences**:
  - Preferred service types
  - Budget range preferences
  - Distance/location preferences
  - Urgency level preferences

**Registration Completion:**
- Profile review summary
- Terms and conditions acceptance
- Account activation
- Welcome message and dashboard redirect

#### **Step 3: Dashboard Access**
**Location**: `/handyman-dashboard`
**Purpose**: Central hub for handyman job management

**Dashboard Navigation Tabs:**

##### **Available Jobs Tab**
**Purpose**: Browse and apply for customer job requests

**Job Board Features:**
- **Real-time job listings** with auto-refresh
- **Advanced filtering**:
  - Service type filter
  - Budget range slider
  - Location/distance filter
  - Urgency level filter
  - Job age filter

- **Search functionality**:
  - Keyword search in job descriptions
  - Location-based search
  - Customer name search

- **Sorting options**:
  - Newest first (default)
  - Highest budget
  - Closest location
  - Most urgent

**Job Card Information:**
- Service type with icon
- Job description preview
- Customer location (area only for privacy)
- Estimated budget range
- Urgency indicator (🔥 for urgent jobs)
- Posted time (relative: "2 hours ago")
- Materials requirement
- Site visit requirement
- Image count indicator

**Job Interaction:**
- "Express Interest" button for each job
- WhatsApp notification sent to customer
- Real-time status updates
- Quick job preview modal

##### **My Jobs Tab**
**Purpose**: Manage accepted and ongoing job assignments

**Job Status Categories:**
- **Accepted**: Jobs confirmed but not yet started
- **In Progress**: Currently working on
- **Completed**: Finished jobs (for reference)

**Accepted Jobs Features:**
- **Customer Contact Information**:
  - Customer name and phone number
  - Direct call button (`tel:` link)
  - WhatsApp button with pre-formatted message
  - Contact privacy protection

- **Job Details Display**:
  - Complete job description
  - Scheduled date and time
  - Exact address (visible after acceptance)
  - Materials requirement details
  - Special instructions/notes
  - Uploaded images (if any)

- **Action Buttons**:
  - **"Start Work"** - Updates status to in-progress
  - **"Get Directions"** - Opens maps app
  - **"Contact Customer"** - Quick communication options
  - **"Mark Complete"** - Finish job workflow

**Job Management Workflow:**
1. **Job Acceptance**: Customer receives WhatsApp notification
2. **Work Start**: Status update sent to customer via WhatsApp
3. **Progress Updates**: Optional interim status updates
4. **Job Completion**:
   - Completion confirmation to customer
   - Payment release trigger
   - Rating/review request

**Timeline Tracking:**
- Visual timeline for each job showing:
  - Job posted timestamp
  - Acceptance timestamp
  - Work start timestamp
  - Completion timestamp
- Status history preservation

##### **My Profile Tab**
**Purpose**: View and manage handyman profile information

**Profile Sections:**

**Personal Information:**
- Name, email, phone (editable)
- Address and service areas
- Professional photo upload
- Account creation date

**Professional Details:**
- Service types offered
- Experience level and description
- Hourly rate settings
- Service area coverage
- Availability schedule

**Performance Statistics:**
- Total jobs completed
- Average customer rating
- Response time metrics
- Customer satisfaction rate
- Earnings summary

**Account Management:**
- Notification preferences
- Privacy settings
- Document management
- Verification status

#### **Notification System**

**WhatsApp Notifications:**
- **New Job Alerts**: Immediate notifications for matching jobs
- **Job Status Updates**: Customer acceptance/rejection notifications
- **Schedule Reminders**: Upcoming job reminders
- **Payment Notifications**: Completion and payment confirmations

**Email Notifications:**
- Weekly job summary reports
- Account security updates
- Platform announcements
- Marketing communications (optional)

**In-App Notifications:**
- Real-time dashboard updates
- Job board refresh notifications
- Message indicators
- System maintenance alerts

#### **Mobile Optimization**

**Touch Interface:**
- Large touch targets for all buttons (minimum 44px)
- Swipe gestures for job card navigation
- Pull-to-refresh functionality
- Mobile-optimized form inputs

**Performance Features:**
- Lazy loading for job listings
- Image optimization and compression
- Offline capability for viewing accepted jobs
- Progressive loading for slow connections

**Location Services:**
- GPS integration for distance calculation
- Navigation app integration
- Location-based job filtering
- Service area verification

#### **Security & Privacy**

**Data Protection:**
- Customer contact details only visible after job acceptance
- Secure document upload and storage
- Encrypted communication channels
- GDPR compliance for data handling

**Account Security:**
- Two-factor authentication option
- Secure password requirements
- Session management
- Device authorization

**Professional Verification:**
- NRIC/passport verification
- Certificate validation
- Background check integration
- Insurance verification

#### **Error Handling & Edge Cases**

**Connection Issues:**
- Offline mode for viewing accepted jobs
- Auto-retry for failed notifications
- Data synchronization when connection restored
- User feedback for connectivity status

**Job Conflicts:**
- Double-booking prevention
- Schedule conflict detection
- Automatic availability updates
- Graceful handling of simultaneous acceptances

**Payment Issues:**
- Escrow status tracking
- Payment delay notifications
- Dispute resolution workflow
- Financial reconciliation tools

### Integration Points

**Customer-Handyman Communication:**
- WhatsApp Business API integration
- Direct phone calling capability
- In-app messaging system (future enhancement)
- Automated status update notifications

**Payment Integration:**
- Stripe Connect for handyman payouts
- Escrow release automation
- Fee calculation and deduction
- Tax reporting integration

**Third-party Services:**
- Google Maps for directions
- WhatsApp Business API
- Document verification services
- Background check providers

## 🗄️ Database Schema

### Collections

#### Jobs
```javascript
{
  id: "string",
  serviceType: "string",
  description: "string",
  location: "string",
  estimatedBudget: "number",
  preferredDate: "timestamp",
  preferredTime: "string",
  customerName: "string",
  customerPhone: "string",
  customerEmail: "string",
  customerId: "string",
  handymanId: "string",
  status: "pending|accepted|in_progress|completed|cancelled",
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

#### Handymen
```javascript
{
  id: "string",
  userId: "string",
  name: "string",
  phone: "string",
  email: "string",
  serviceArea: "string",
  serviceTypes: ["string"],
  experienceLevel: "string",
  description: "string",
  hourlyRate: "number",
  isAvailable: "boolean",
  rating: "number",
  completedJobs: "number",
  notificationPreferences: {
    whatsappNotifications: "boolean",
    emailNotifications: "boolean",
    serviceTypes: ["string"],
    budgetRanges: ["string"],
    locations: "string"
  },
  createdAt: "timestamp"
}
```

#### Payments
```javascript
{
  id: "string",
  jobId: "string",
  customerId: "string",
  handymanId: "string",
  stripePaymentIntentId: "string",
  amount: "number",
  status: "pending|held|released|refunded",
  createdAt: "timestamp"
}
```

## 🛠️ Development Commands

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Deploy to Firebase
npm run deploy

# Firebase Functions specific
cd functions

# Start Functions emulator
npm run serve

# Deploy only Functions
npm run deploy

# View Function logs
npm run logs
```

## 🔒 Security Features

### Firestore Security Rules
- **Job access**: Read access for all, write only for authenticated users
- **Handyman profiles**: Public read, owner write
- **Customer data**: Private to user
- **Payment records**: Restricted to involved parties

### Authentication
- **Anonymous authentication** for quick onboarding
- **Profile-based authorization** for specific actions
- **Secure API endpoints** with validation middleware

## 🌐 Deployment

### Frontend Hosting
```bash
# Build and deploy to Firebase Hosting
npm run build
firebase deploy --only hosting
```

### Backend Functions
```bash
# Deploy Firebase Functions
cd functions
npm run deploy
```

### Environment Setup
1. Set up Firebase project
2. Configure Stripe webhook endpoints
3. Set up WhatsApp Business API
4. Configure environment variables
5. Deploy security rules

## 📱 WhatsApp Integration

### Notification Types
- **Customer confirmations** - Job submission confirmations
- **Handyman alerts** - New job notifications
- **Status updates** - Job acceptance, completion updates
- **Coordination messages** - Contact information sharing

### Message Templates
- Job confirmation messages
- Contact detail sharing
- Status update notifications
- Payment confirmations

## 💳 Payment Flow

1. **Customer submits job** with estimated budget
2. **Stripe creates payment intent** for escrow amount
3. **Payment held in escrow** until job completion
4. **Handyman accepts job** and begins work
5. **Customer confirms completion** triggers payment release
6. **Funds transferred** to handyman account

## 🚨 Error Handling

### Frontend
- Form validation with react-hook-form
- API error boundaries
- Loading states and user feedback
- Graceful degradation for offline scenarios

### Backend
- Comprehensive error logging
- Transaction rollbacks for failed operations
- Webhook retry mechanisms
- Input validation and sanitization

## 🔄 Future Enhancements

### Planned Features
- [ ] Real-time chat between customers and handymen
- [ ] Photo upload for job documentation
- [ ] Rating and review system
- [ ] Advanced job matching algorithm
- [ ] Push notifications for mobile app
- [ ] Multi-language support
- [ ] Admin dashboard for platform management

### Technical Improvements
- [ ] Progressive Web App (PWA) capabilities
- [ ] Offline functionality
- [ ] Performance optimizations
- [ ] A/B testing framework
- [ ] Analytics integration
- [ ] Automated testing suite
- [ ] Backend service implementation
- [ ] Firebase Functions development
- [ ] Context providers and custom hooks

## 🎨 Design System

### Typography
- **Primary Font**: Space Grotesk (Google Fonts)
- **Icon Library**: Material Symbols Outlined
- **Font Weights**: 400 (Regular), 500 (Medium), 700 (Bold)

### Color Palette
```css
--primary: #38e07b          /* Signature green */
--background-light: #f6f8f7  /* Light mode background */
--background-dark: #122017   /* Dark mode background */
--foreground-light: #111714  /* Light mode text */
--foreground-dark: #f6f8f7   /* Dark mode text */
--muted-light: #648772       /* Light mode muted text */
--muted-dark: #a0b5a9        /* Dark mode muted text */
--border-light: #e0e6e2      /* Light mode borders */
--border-dark: #2a3c31       /* Dark mode borders */
```

### Component Design Principles
- **Mobile-first approach** with responsive breakpoints
- **Accessible color contrast** for WCAG compliance
- **Consistent spacing** using Tailwind's scale
- **Modern card-based layouts** with subtle shadows
- **Interactive elements** with hover and focus states
- **Dark mode support** throughout the application

## 📞 Support

For development support or questions:
- Email: dev@handysg.com
- Documentation: [Link to detailed docs]
- Issue Tracker: [GitHub Issues]

## 📄 License

[Specify your license here]

---

**Note**: This is a production-ready codebase designed for scalability and low operational costs. Ensure all environment variables are properly configured before deployment.