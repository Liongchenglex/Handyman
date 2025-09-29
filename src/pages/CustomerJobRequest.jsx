import React from 'react';
import { useNavigate } from 'react-router-dom';
import JobRequestForm from '../components/customer/JobRequestForm';

const CustomerJobRequest = () => {
  const navigate = useNavigate();

  // Handle job completion (including payment) - this will be called from JobRequestForm
  const handleJobCompleted = (job) => {
    console.log('Job completed successfully:', job);
    // You can add any additional logic here if needed
    // The JobRequestForm will handle showing the confirmation screen
  };

  // Handle navigation back to home page
  const handleBackToHome = () => {
    // Navigate to home page with replace to avoid back button issues
    navigate('/', { replace: true });
    // Scroll to top immediately (React Router will handle this after navigation)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-black dark:text-white">
      <div className="flex flex-col min-h-screen">

        {/* Main Content */}
        <main className="flex-grow">
          <JobRequestForm
            onJobCreated={handleJobCompleted}
            onBackToHome={handleBackToHome}
          />
        </main>
      </div>
    </div>
  );
};

export default CustomerJobRequest;