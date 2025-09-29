import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
// import { QueryClient, QueryClientProvider } from 'react-query';
// import { AuthProvider } from './context/AuthContext';
// import { JobProvider } from './context/JobContext';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import HomePage from './pages/HomePage';
import CustomerJobRequest from './pages/CustomerJobRequest';
// import HandymanDashboard from './pages/HandymanDashboard';
// import JobBoard from './pages/JobBoard';
// import JobDetails from './pages/JobDetails';
// import './styles/globals.css';

// const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className="App">
      {!isHomePage && <Header />}
      <main className={isHomePage ? '' : 'main-content'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/request-job" element={<CustomerJobRequest />} />
          {/* <Route path="/handyman-dashboard" element={<HandymanDashboard />} /> */}
          {/* <Route path="/jobs" element={<JobBoard />} /> */}
          {/* <Route path="/jobs/:id" element={<JobDetails />} /> */}
        </Routes>
      </main>
      {!isHomePage && <Footer />}
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