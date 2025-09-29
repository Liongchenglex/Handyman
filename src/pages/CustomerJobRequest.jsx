import React, { useState } from 'react';
import JobRequestForm from '../components/customer/JobRequestForm';
import PaymentForm from '../components/customer/PaymentForm';
import JobConfirmation from '../components/customer/JobConfirmation';

const CustomerJobRequest = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [jobData, setJobData] = useState(null);
  const [paymentIntent, setPaymentIntent] = useState(null);

  const handleJobCreated = (job) => {
    setJobData(job);
    setCurrentStep(2);
  };

  const handlePaymentSuccess = (payment) => {
    setPaymentIntent(payment);
    setCurrentStep(3);
  };

  const handleBackToForm = () => {
    setCurrentStep(1);
    setJobData(null);
    setPaymentIntent(null);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-black dark:text-white">
      <div className="flex flex-col min-h-screen">

        {/* Main Content */}
        <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentStep === 1 && (
            <JobRequestForm onJobCreated={handleJobCreated} />
          )}

          {currentStep === 2 && jobData && (
            <div className="payment-step">
              <div className="step-header">
                <h2>Secure Payment</h2>
                <p>Your payment will be held securely until the job is completed</p>
              </div>
              
              <div className="job-summary-card">
                <h3>Job Summary</h3>
                <div className="summary-details">
                  <div className="detail">
                    <span className="label">Service:</span>
                    <span className="value">{jobData.serviceType}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Location:</span>
                    <span className="value">{jobData.location}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Customer:</span>
                    <span className="value">{jobData.customerName}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Amount:</span>
                    <span className="value amount">SGD ${jobData.estimatedBudget}</span>
                  </div>
                </div>
              </div>

              <PaymentForm 
                amount={jobData.estimatedBudget}
                jobId={jobData.id}
                onPaymentSuccess={handlePaymentSuccess}
              />

              <div className="payment-actions">
                <button 
                  onClick={handleBackToForm}
                  className="btn-secondary"
                >
                  ← Back to Job Details
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && jobData && paymentIntent && (
            <JobConfirmation 
              job={jobData}
              paymentIntent={paymentIntent}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default CustomerJobRequest;