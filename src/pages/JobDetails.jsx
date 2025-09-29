import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobById, acceptJob, updateJobStatus } from '../services/api/jobs';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadJob = async () => {
      try {
        const jobData = await getJobById(id);
        setJob(jobData);
      } catch (error) {
        console.error('Error loading job:', error);
        setError('Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [id]);

  const handleAcceptJob = async () => {
    if (!user) {
      alert('Please sign in to accept jobs');
      return;
    }

    setIsAccepting(true);
    try {
      await acceptJob(job.id, user.uid);
      setJob(prev => ({ ...prev, status: 'accepted', handymanId: user.uid }));
      setShowContactModal(true);
    } catch (error) {
      console.error('Error accepting job:', error);
      alert('Failed to accept job. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleMarkCompleted = async () => {
    try {
      await updateJobStatus(job.id, 'completed');
      setJob(prev => ({ ...prev, status: 'completed' }));
      alert('Job marked as completed! Payment will be processed.');
    } catch (error) {
      console.error('Error updating job status:', error);
      alert('Failed to update job status. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      accepted: 'blue',
      in_progress: 'purple',
      completed: 'green',
      cancelled: 'red'
    };
    return colors[status] || 'gray';
  };

  const formatDate = (date) => {
    if (!date) return 'Flexible';
    return new Date(date).toLocaleDateString('en-SG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading job details..." />;
  }

  if (error || !job) {
    return (
      <div className="error-container">
        <h2>Job Not Found</h2>
        <p>{error || 'The job you are looking for does not exist.'}</p>
        <button onClick={() => navigate('/jobs')} className="btn-primary">
          Back to Job Board
        </button>
      </div>
    );
  }

  const isJobOwner = user && (user.uid === job.customerId || user.uid === job.handymanId);
  const canAccept = job.status === 'pending' && user && user.uid !== job.customerId;
  const canMarkCompleted = job.status === 'accepted' && user && user.uid === job.handymanId;

  return (
    <div className="job-details-page">
      <div className="container">
        <div className="job-details-header">
          <button onClick={() => navigate(-1)} className="back-button">
            ← Back
          </button>
          <div className="job-status">
            <span className={`status-badge status-${job.status}`}>
              {job.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>

        <div className="job-details-content">
          <div className="job-main-info">
            <h1>{job.serviceType} Service Required</h1>
            
            <div className="job-meta">
              <div className="meta-item">
                <span className="meta-label">Posted:</span>
                <span className="meta-value">
                  {new Date(job.createdAt).toLocaleDateString('en-SG')}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Job ID:</span>
                <span className="meta-value">{job.id}</span>
              </div>
            </div>

            <div className="job-budget">
              <h3>Budget: SGD ${job.estimatedBudget}</h3>
            </div>

            <div className="job-description">
              <h3>Job Description</h3>
              <p>{job.description}</p>
            </div>

            <div className="job-info-grid">
              <div className="info-section">
                <h4>Location & Timing</h4>
                <div className="info-item">
                  <span className="icon">📍</span>
                  <div>
                    <strong>Location:</strong>
                    <p>{job.location}</p>
                  </div>
                </div>
                
                {job.preferredDate && (
                  <div className="info-item">
                    <span className="icon">📅</span>
                    <div>
                      <strong>Preferred Date:</strong>
                      <p>{formatDate(job.preferredDate)}</p>
                    </div>
                  </div>
                )}
                
                {job.preferredTime && (
                  <div className="info-item">
                    <span className="icon">⏰</span>
                    <div>
                      <strong>Preferred Time:</strong>
                      <p className="capitalize">{job.preferredTime}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="info-section">
                <h4>Customer Information</h4>
                <div className="info-item">
                  <span className="icon">👤</span>
                  <div>
                    <strong>Name:</strong>
                    <p>{job.customerName}</p>
                  </div>
                </div>
                
                {isJobOwner && (
                  <>
                    <div className="info-item">
                      <span className="icon">📱</span>
                      <div>
                        <strong>Phone:</strong>
                        <p>{job.customerPhone}</p>
                      </div>
                    </div>
                    
                    {job.customerEmail && (
                      <div className="info-item">
                        <span className="icon">📧</span>
                        <div>
                          <strong>Email:</strong>
                          <p>{job.customerEmail}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {job.handymanId && (
              <div className="handyman-info">
                <h4>Assigned Handyman</h4>
                <p>This job has been accepted by a qualified handyman.</p>
                {isJobOwner && (
                  <p>You will be contacted via WhatsApp to coordinate the service.</p>
                )}
              </div>
            )}

            <div className="job-actions">
              {canAccept && (
                <button
                  onClick={handleAcceptJob}
                  disabled={isAccepting}
                  className="btn-primary btn-large"
                >
                  {isAccepting ? <LoadingSpinner size="small" /> : 'Accept This Job'}
                </button>
              )}

              {canMarkCompleted && (
                <button
                  onClick={handleMarkCompleted}
                  className="btn-success btn-large"
                >
                  Mark as Completed
                </button>
              )}

              {job.status === 'pending' && !canAccept && (
                <div className="action-message">
                  <p>This job is available for handymen to accept.</p>
                </div>
              )}

              {job.status === 'accepted' && !canMarkCompleted && (
                <div className="action-message">
                  <p>This job has been accepted and is in progress.</p>
                </div>
              )}

              {job.status === 'completed' && (
                <div className="action-message success">
                  <p>✅ This job has been completed successfully!</p>
                </div>
              )}
            </div>
          </div>

          <div className="job-sidebar">
            <div className="sidebar-section">
              <h4>Payment Protection</h4>
              <div className="protection-info">
                <p>💳 Payment secured in escrow</p>
                <p>🛡️ Funds released after completion</p>
                <p>⭐ Rate your experience</p>
              </div>
            </div>

            <div className="sidebar-section">
              <h4>Need Help?</h4>
              <div className="help-info">
                <p>📱 WhatsApp: +65 XXXX XXXX</p>
                <p>📧 support@handymansg.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Job Accepted Successfully!"
        size="medium"
      >
        <div className="contact-modal">
          <div className="success-message">
            <div className="success-icon">🎉</div>
            <h3>Congratulations!</h3>
            <p>You have successfully accepted this job.</p>
          </div>

          <div className="next-steps">
            <h4>What happens next?</h4>
            <ol>
              <li>The customer will be notified via WhatsApp</li>
              <li>You'll receive the customer's contact details</li>
              <li>Coordinate timing and final details via WhatsApp</li>
              <li>Complete the job and mark it as finished</li>
              <li>Receive payment once customer confirms completion</li>
            </ol>
          </div>

          <div className="customer-contact">
            <h4>Customer Contact Details</h4>
            <div className="contact-info">
              <p><strong>Name:</strong> {job.customerName}</p>
              <p><strong>Phone:</strong> {job.customerPhone}</p>
              {job.customerEmail && (
                <p><strong>Email:</strong> {job.customerEmail}</p>
              )}
              <p><strong>Location:</strong> {job.location}</p>
            </div>
          </div>

          <div className="modal-actions">
            <button
              onClick={() => setShowContactModal(false)}
              className="btn-primary"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default JobDetails;