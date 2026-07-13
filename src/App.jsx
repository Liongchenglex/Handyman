import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
// import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from './context/AuthContext';
// import { JobProvider } from './context/JobContext';
import { initializeEmailService } from './services/emailService';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import HelpContact from './components/common/HelpContact';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import ProtectedRoute from './components/common/ProtectedRoute';
import HomePage from './pages/HomePage';
import PickTime from './pages/PickTime';

// Route-level code splitting: each chunk loads on first navigation, keeping
// the initial bundle small. HomePage is eagerly imported because it's the
// landing route — splitting it would just delay the first paint.
const CustomerJobRequest = lazy(() => import('./pages/CustomerJobRequest'));
const HandymanAuthPage = lazy(() => import('./pages/HandymanAuth'));
const HandymanRegistrationPage = lazy(() => import('./pages/HandymanRegistration'));
const HandymanDashboard = lazy(() => import('./pages/HandymanDashboard'));
const ApproveHandyman = lazy(() => import('./pages/ApproveHandyman'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminAccountApproval = lazy(() => import('./pages/AdminAccountApproval'));
const AdminFundRelease = lazy(() => import('./pages/AdminFundRelease'));
const AdminDisputedJobs = lazy(() => import('./pages/AdminDisputedJobs'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const JobCard = lazy(() => import('./components/handyman/JobCard'));
// import JobBoard from './pages/JobBoard';
// import JobDetails from './pages/JobDetails';
// import './styles/globals.css';

// const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isHandymanFlow = location.pathname.startsWith('/handyman');
  const isJobDetailsPage = location.pathname.startsWith('/job-details');
  const isAdminPage = location.pathname.startsWith('/admin');
  const isLegalPage = location.pathname === '/terms-of-service' || location.pathname === '/privacy-policy';

  // Pages that use their own layout (no header/footer)
  const hasCustomLayout = isHomePage || isHandymanFlow || isJobDetailsPage || isAdminPage || isLegalPage;

  return (
    <div className="App">
      {!hasCustomLayout && <Header />}
      <main className={hasCustomLayout ? '' : 'main-content'}>
        <Suspense fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <LoadingSpinner />
          </div>
        }>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/request-job" element={<CustomerJobRequest />} />
            <Route path="/pick-time" element={<PickTime />} />
            <Route path="/help" element={<HelpContact />} />
            <Route path="/contact" element={<HelpContact />} />
            <Route path="/handyman-auth" element={<HandymanAuthPage />} />
            <Route path="/handyman-registration" element={<HandymanRegistrationPage />} />
            <Route path="/handyman-dashboard" element={<HandymanDashboard />} />
            {/*
              Admin routes: gated by ProtectedRoute (requireAdmin) so the
              page chunks aren't even rendered for non-admins. Backend
              Cloud Functions enforce the same allow-list independently,
              so this is defense-in-depth, not the sole gate.

              /admin/approve-handyman is gated as "must be signed in"
              (not admin-only) because operations team members may follow
              an email link before realising they need to log in — the
              page itself surfaces a permission error and the Firestore
              rule rejects writes if they aren't actually an admin.
            */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/account-approval" element={<ProtectedRoute requireAdmin><AdminAccountApproval /></ProtectedRoute>} />
            <Route path="/admin/approve-handyman" element={<ProtectedRoute><ApproveHandyman /></ProtectedRoute>} />
            <Route path="/admin/fund-release" element={<ProtectedRoute requireAdmin><AdminFundRelease /></ProtectedRoute>} />
            <Route path="/admin/disputed-jobs" element={<ProtectedRoute requireAdmin><AdminDisputedJobs /></ProtectedRoute>} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/job-details/:jobId" element={<JobCard />} />
            {/* <Route path="/jobs" element={<JobBoard />} /> */}
            {/* <Route path="/jobs/:id" element={<JobDetails />} /> */}
          </Routes>
        </Suspense>
      </main>
      {!hasCustomLayout && <Footer />}
    </div>
  );
}

function App() {
  // Initialize EmailJS service on app mount
  useEffect(() => {
    initializeEmailService();
  }, []);

  return (
    // <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          {/* <JobProvider> */}
            <Router>
              <AppContent />
            </Router>
          {/* </JobProvider> */}
        </AuthProvider>
      </ErrorBoundary>
    // </QueryClientProvider>
  );
}

export default App;