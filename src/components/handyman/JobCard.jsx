import React, { useState } from 'react';
import { acceptJob } from '../../services/api/jobs';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';

const JobCard = ({ job, onJobAccepted }) => {
  const { user } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleAcceptJob = async () => {
    if (!user) {
      alert('Please sign in to accept jobs');
      return;
    }

    setIsAccepting(true);
    try {
      await acceptJob(job.id, user.uid);
      alert('Job accepted successfully! You will be contacted via WhatsApp.');
      onJobAccepted();
    } catch (error) {
      console.error('Error accepting job:', error);
      alert('Failed to accept job. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Flexible';
    return new Date(date).toLocaleDateString('en-SG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getUrgencyClass = () => {
    const createdDate = new Date(job.createdAt);
    const now = new Date();
    const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
    
    if (hoursDiff < 2) return 'urgent-high';
    if (hoursDiff < 24) return 'urgent-medium';
    return 'urgent-low';
  };

  return (
    <>
      <div className={`job-card ${getUrgencyClass()}`}>
        <div className="job-card-header">
          <div className="service-type">
            <span className="service-badge">{job.serviceType}</span>
          </div>
          <div className="job-budget">
            SGD ${job.estimatedBudget}
          </div>
        </div>

        <div className="job-card-content">
          <h3 className="job-title">
            {job.serviceType} Service Required
          </h3>
          
          <p className="job-description">
            {job.description.length > 100 
              ? `${job.description.substring(0, 100)}...`
              : job.description
            }
          </p>

          <div className="job-details">
            <div className="detail-item">
              <span className="icon">📍</span>
              <span>{job.location}</span>
            </div>
            
            {job.preferredDate && (
              <div className="detail-item">
                <span className="icon">📅</span>
                <span>{formatDate(job.preferredDate)}</span>
              </div>
            )}
            
            {job.preferredTime && (
              <div className="detail-item">
                <span className="icon">⏰</span>
                <span className="capitalize">{job.preferredTime}</span>
              </div>
            )}
          </div>

          <div className="job-meta">
            <div className="posted-time">
              Posted {new Date(job.createdAt).toLocaleString('en-SG')}
            </div>
            <div className="customer-info">
              Customer: {job.customerName}
            </div>
          </div>
        </div>

        <div className="job-card-actions">
          <button
            onClick={() => setShowDetails(true)}
            className="btn-secondary btn-small"
          >
            View Details
          </button>
          
          <button
            onClick={handleAcceptJob}
            disabled={isAccepting}
            className="btn-primary btn-small"
          >
            {isAccepting ? <LoadingSpinner size="small" /> : 'Accept Job'}
          </button>
        </div>
      </div>

      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Job Details"
        size="medium"
      >
        <div className="job-details-modal">
          <div className="detail-section">
            <h4>Service Information</h4>
            <div className="detail-row">
              <span className="label">Service Type:</span>
              <span className="value">{job.serviceType}</span>
            </div>
            <div className="detail-row">
              <span className="label">Budget:</span>
              <span className="value">SGD ${job.estimatedBudget}</span>
            </div>
          </div>

          <div className="detail-section">
            <h4>Job Description</h4>
            <p>{job.description}</p>
          </div>

          <div className="detail-section">
            <h4>Location & Timing</h4>
            <div className="detail-row">
              <span className="label">Address:</span>
              <span className="value">{job.location}</span>
            </div>
            {job.preferredDate && (
              <div className="detail-row">
                <span className="label">Preferred Date:</span>
                <span className="value">{formatDate(job.preferredDate)}</span>
              </div>
            )}
            {job.preferredTime && (
              <div className="detail-row">
                <span className="label">Preferred Time:</span>
                <span className="value capitalize">{job.preferredTime}</span>
              </div>
            )}
          </div>

          <div className="detail-section">
            <h4>Customer Information</h4>
            <div className="detail-row">
              <span className="label">Name:</span>
              <span className="value">{job.customerName}</span>
            </div>
            <div className="detail-row">
              <span className="label">Phone:</span>
              <span className="value">{job.customerPhone}</span>
            </div>
            {job.customerEmail && (
              <div className="detail-row">
                <span className="label">Email:</span>
                <span className="value">{job.customerEmail}</span>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              onClick={handleAcceptJob}
              disabled={isAccepting}
              className="btn-primary"
            >
              {isAccepting ? <LoadingSpinner size="small" /> : 'Accept This Job'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default JobCard;