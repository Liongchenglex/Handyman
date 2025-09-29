import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getHandymanProfile } from '../services/api/handymen';
import HandymanRegistration from '../components/handyman/HandymanRegistration';
import JobBoard from '../components/handyman/JobBoard';
import NotificationPreferences from '../components/handyman/NotificationPreferences';
import LoadingSpinner from '../components/common/LoadingSpinner';

const HandymanDashboard = () => {
  const { user } = useAuth();
  const [handymanProfile, setHandymanProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs');

  useEffect(() => {
    const loadHandymanProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getHandymanProfile(user.uid);
        setHandymanProfile(profile);
      } catch (error) {
        console.error('Error loading handyman profile:', error);
        // Profile doesn't exist, user needs to register
        setHandymanProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadHandymanProfile();
  }, [user]);

  const handleRegistrationComplete = (profileData) => {
    setHandymanProfile(profileData);
    setActiveTab('jobs');
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  // If user is not registered as handyman, show registration form
  if (!handymanProfile) {
    return (
      <div className="handyman-dashboard">
        <div className="container">
          <HandymanRegistration onRegistrationComplete={handleRegistrationComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="handyman-dashboard">
      <div className="container">
        <div className="dashboard-header">
          <div className="profile-summary">
            <h1>Welcome back, {handymanProfile.name}!</h1>
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-value">{handymanProfile.completedJobs || 0}</span>
                <span className="stat-label">Jobs Completed</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {handymanProfile.rating ? handymanProfile.rating.toFixed(1) : 'New'}
                </span>
                <span className="stat-label">Rating</span>
              </div>
              <div className="stat">
                <span className={`stat-value ${handymanProfile.isAvailable ? 'available' : 'unavailable'}`}>
                  {handymanProfile.isAvailable ? 'Available' : 'Busy'}
                </span>
                <span className="stat-label">Status</span>
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <button 
              className={`availability-toggle ${handymanProfile.isAvailable ? 'available' : 'unavailable'}`}
              onClick={() => {
                // TODO: Implement availability toggle
                alert('Availability toggle coming soon!');
              }}
            >
              {handymanProfile.isAvailable ? '🟢 Available' : '🔴 Unavailable'}
            </button>
          </div>
        </div>

        <div className="dashboard-tabs">
          <button 
            className={`tab ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            Available Jobs
          </button>
          <button 
            className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
          <button 
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button 
            className={`tab ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            Earnings
          </button>
        </div>

        <div className="dashboard-content">
          {activeTab === 'jobs' && (
            <div className="jobs-tab">
              <JobBoard />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="notifications-tab">
              <NotificationPreferences />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="profile-tab">
              <div className="profile-details">
                <h3>Profile Information</h3>
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Name:</label>
                    <span>{handymanProfile.name}</span>
                  </div>
                  <div className="profile-item">
                    <label>Phone:</label>
                    <span>{handymanProfile.phone}</span>
                  </div>
                  <div className="profile-item">
                    <label>Email:</label>
                    <span>{handymanProfile.email || 'Not provided'}</span>
                  </div>
                  <div className="profile-item">
                    <label>Service Area:</label>
                    <span>{handymanProfile.serviceArea}</span>
                  </div>
                  <div className="profile-item">
                    <label>Experience Level:</label>
                    <span className="capitalize">{handymanProfile.experienceLevel}</span>
                  </div>
                  <div className="profile-item">
                    <label>Hourly Rate:</label>
                    <span>SGD ${handymanProfile.hourlyRate || 'Not set'}</span>
                  </div>
                </div>

                <div className="services-offered">
                  <h4>Services Offered</h4>
                  <div className="service-tags">
                    {handymanProfile.serviceTypes?.map(service => (
                      <span key={service} className="service-tag">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                {handymanProfile.description && (
                  <div className="profile-description">
                    <h4>About</h4>
                    <p>{handymanProfile.description}</p>
                  </div>
                )}

                <div className="profile-actions">
                  <button className="btn-primary">
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="earnings-tab">
              <div className="earnings-summary">
                <h3>Earnings Overview</h3>
                <div className="earnings-cards">
                  <div className="earnings-card">
                    <h4>This Month</h4>
                    <div className="amount">SGD $0.00</div>
                    <small>0 jobs completed</small>
                  </div>
                  <div className="earnings-card">
                    <h4>Total Earnings</h4>
                    <div className="amount">SGD $0.00</div>
                    <small>{handymanProfile.completedJobs || 0} jobs completed</small>
                  </div>
                  <div className="earnings-card">
                    <h4>Pending</h4>
                    <div className="amount">SGD $0.00</div>
                    <small>0 jobs in progress</small>
                  </div>
                </div>
              </div>

              <div className="earnings-history">
                <h4>Recent Transactions</h4>
                <div className="no-data">
                  <p>No earnings history yet. Complete your first job to see earnings here!</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HandymanDashboard;