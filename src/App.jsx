import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
// import { QueryClient, QueryClientProvider } from 'react-query';
// import { AuthProvider } from './context/AuthContext';
// import { JobProvider } from './context/JobContext';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import HomePage from './pages/HomePage';
import CustomerJobRequest from './pages/CustomerJobRequest';
import HandymanAuthPage from './pages/HandymanAuth';
import HandymanRegistrationPage from './pages/HandymanRegistration';
import HandymanDashboard from './pages/HandymanDashboard';
import JobCard from './components/handyman/JobCard';
// import JobBoard from './pages/JobBoard';
// import JobDetails from './pages/JobDetails';
// import './styles/globals.css';

// const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isHandymanFlow = location.pathname.startsWith('/handyman');
  const isJobDetailsPage = location.pathname.startsWith('/job-details');

  return (
    <div className="App">
      {!isHomePage && !isHandymanFlow && !isJobDetailsPage && <Header />}
      <main className={isHomePage || isHandymanFlow || isJobDetailsPage ? '' : 'main-content'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/request-job" element={<CustomerJobRequest />} />
          <Route path="/handyman-auth" element={<HandymanAuthPage />} />
          <Route path="/handyman-registration" element={<HandymanRegistrationPage />} />
          <Route path="/handyman-dashboard" element={<HandymanDashboard />} />
          <Route path="/job-details/:jobId" element={<JobCard />} />
          {/* <Route path="/jobs" element={<JobBoard />} /> */}
          {/* <Route path="/jobs/:id" element={<JobDetails />} /> */}
        </Routes>
      </main>
      {!isHomePage && !isHandymanFlow && !isJobDetailsPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    // <QueryClientProvider client={queryClient}>
      // <AuthProvider>
        // <JobProvider>
          <Router>
            <AppContent />
          </Router>
        // </JobProvider>
      // </AuthProvider>
    // </QueryClientProvider>
  );
}

export default App;