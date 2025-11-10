import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HandymanHeader from '../components/handyman/HandymanHeader';
import JobBoard from '../components/handyman/JobBoard';
import PendingStatusView from '../components/handyman/status-views/PendingStatusView';
import RejectedStatusView from '../components/handyman/status-views/RejectedStatusView';
import SuspendedStatusView from '../components/handyman/status-views/SuspendedStatusView';
import MyJobsView from '../components/handyman/MyJobsView';
import ProfileView from '../components/handyman/ProfileView';

/**
 * HandymanDashboard Page
 *
 * Main dashboard for authenticated handymen
 * Shows different views based on handyman status:
 * - Pending: Application under review
 * - Rejected: Application not approved
 * - Suspended: Account suspended
 * - Active: Full dashboard with job board
 *
 * Uses Firebase AuthContext for user data and role checking
 */
const HandymanDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile, isHandyman, loading } = useAuth();
  const [currentView, setCurrentView] = useState('jobs'); // 'jobs', 'my-jobs', 'profile'

  // Redirect if not authenticated or not a handyman
  useEffect(() => {
    if (!loading && (!user || !isHandyman)) {
      navigate('/handyman-auth');
    }
  }, [user, isHandyman, loading, navigate]);

  const handleJobSelect = (job) => {
    console.log('Job selected after expressing interest:', job);
    // After expressing interest, switch to My Jobs tab to see the accepted job
    setCurrentView('my-jobs');
  };

  // Show loading state while checking authentication
  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Get handyman status from profile
  const handymanStatus = userProfile?.handyman?.status || 'pending';
  const handymanVerified = userProfile?.handyman?.verified || false;

  // Check handyman status and show appropriate view
  // Priority order: pending → rejected → suspended → active
  if (handymanStatus === 'pending') {
    return <PendingStatusView userProfile={userProfile} />;
  }

  if (handymanStatus === 'rejected') {
    return <RejectedStatusView userProfile={userProfile} />;
  }

  if (handymanStatus === 'suspended') {
    return <SuspendedStatusView userProfile={userProfile} />;
  }

  // Only show full dashboard if status is 'active' and verified
  if (handymanStatus !== 'active' || !handymanVerified) {
    return <PendingStatusView userProfile={userProfile} />;
  }

  // Active handyman - show full dashboard
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <HandymanHeader
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <main>
        {currentView === 'jobs' && (
          <JobBoard onJobSelect={handleJobSelect} />
        )}
        {currentView === 'my-jobs' && (
          <MyJobsView user={user} onViewChange={setCurrentView} />
        )}
        {currentView === 'profile' && (
          <ProfileView user={user} userProfile={userProfile} />
        )}
      </main>
    </div>
  );
};

export default HandymanDashboard;
