import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JobBoard from '../components/handyman/JobBoard';

/**
 * HandymanDashboard Page
 *
 * Main dashboard for authenticated handymen
 * Shows job board and handyman profile/stats
 */
const HandymanDashboard = () => {
  const navigate = useNavigate();
  const [handymanData, setHandymanData] = useState(null);
  const [currentView, setCurrentView] = useState('jobs'); // 'jobs', 'my-jobs', 'profile'

  useEffect(() => {
    // Check if handyman is authenticated
    const userData = localStorage.getItem('handymanUser');
    if (!userData) {
      navigate('/handyman-auth');
      return;
    }

    setHandymanData(JSON.parse(userData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('handymanUser');
    localStorage.removeItem('tempHandymanUser');
    navigate('/');
  };

  const handleJobSelect = (job) => {
    console.log('Job selected:', job);
    // In a real app, this would navigate to job details or start application process
    alert(`You've expressed interest in job ${job.id}. The customer will be notified via WhatsApp.`);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  if (!handymanData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Dashboard Navigation
  const DashboardNav = () => (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary">HandySG</h1>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600 dark:text-gray-400">Handyman Dashboard</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setCurrentView('jobs')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'jobs'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Available Jobs
            </button>
            <button
              onClick={() => setCurrentView('my-jobs')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'my-jobs'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              My Jobs
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'profile'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              My Profile
            </button>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {handymanData.fullName || handymanData.email}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {handymanData.serviceTypes?.join(', ') || 'Handyman'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // My Jobs View - Shows jobs accepted by this handyman
  const MyJobsView = () => {
    // Mock accepted jobs data (replace with API call)
    const acceptedJobs = [
      {
        id: 'JOB-001',
        customerName: 'Sarah Chen',
        customerPhone: '+65 9123 4567',
        serviceType: 'Plumbing',
        description: 'Kitchen sink is leaking from underneath. Water dripping constantly. Need urgent repair.',
        location: 'Orchard Road, Central',
        estimatedBudget: 120,
        preferredTiming: 'Schedule',
        preferredDate: '2024-01-15',
        preferredTime: '09:00 AM - 11:00 AM',
        materials: 'Handyman to buy (surcharge applies)',
        siteVisit: 'Yes',
        urgency: 'urgent',
        status: 'accepted',
        acceptedAt: '1 hour ago',
        scheduledDate: '2024-01-15',
        scheduledTime: '09:00 AM - 11:00 AM'
      },
      {
        id: 'JOB-003',
        customerName: 'Emily Wong',
        customerPhone: '+65 8765 4321',
        serviceType: 'Carpentry',
        description: 'Need to install floating shelves in living room. Have all materials ready, just need installation service.',
        location: 'Jurong West, West',
        estimatedBudget: 150,
        preferredTiming: 'Schedule',
        preferredDate: '2024-01-20',
        preferredTime: '01:00 PM - 03:00 PM',
        materials: 'I will buy',
        siteVisit: 'Yes',
        urgency: 'normal',
        status: 'in_progress',
        acceptedAt: '2 days ago',
        scheduledDate: '2024-01-20',
        scheduledTime: '01:00 PM - 03:00 PM'
      }
    ];

    const getStatusColor = (status) => {
      switch (status) {
        case 'accepted':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        case 'in_progress':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'completed':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'accepted':
          return 'Accepted';
        case 'in_progress':
          return 'In Progress';
        case 'completed':
          return 'Completed';
        default:
          return 'Unknown';
      }
    };

    const handleMarkInProgress = (jobId) => {
      console.log('Marking job as in progress:', jobId);
      // In a real app, this would update the job status via API
      alert('Job marked as in progress. Customer will be notified via WhatsApp.');
    };

    const handleMarkCompleted = (jobId) => {
      console.log('Marking job as completed:', jobId);
      // In a real app, this would update the job status via API
      alert('Job marked as completed. Customer will be notified and payment will be processed.');
    };

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Jobs ({acceptedJobs.length})
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Jobs you have accepted and are working on
          </p>
        </div>

        {acceptedJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-gray-400 text-2xl">work</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No accepted jobs
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You haven't accepted any jobs yet. Check the Available Jobs tab to find work.
            </p>
            <button
              onClick={() => setCurrentView('jobs')}
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <span className="material-symbols-outlined">search</span>
              Browse Available Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {acceptedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                {/* Job Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {job.serviceType}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {getStatusText(job.status)}
                      </span>
                      {job.urgency === 'urgent' && (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                          🔥 Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Job ID: {job.id} • Accepted {job.acceptedAt}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Customer: {job.customerName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      SGD ${job.estimatedBudget}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Budget
                    </p>
                  </div>
                </div>

                {/* Job Description */}
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {job.description}
                </p>

                {/* Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Location</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{job.location}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Scheduled Time</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {job.scheduledDate} at {job.scheduledTime}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Materials</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{job.materials}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Site Visit</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{job.siteVisit}</p>
                  </div>
                </div>

                {/* Customer Contact */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Customer Contact
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {job.customerName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {job.customerPhone}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${job.customerPhone}`}
                        className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                      >
                        <span className="material-symbols-outlined text-sm">call</span>
                        Call
                      </a>
                      <a
                        href={`https://wa.me/${job.customerPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {job.status === 'accepted' && (
                    <button
                      onClick={() => handleMarkInProgress(job.id)}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Start Work
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      onClick={() => handleMarkCompleted(job.id)}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Mark Complete
                    </button>
                  )}
                  <button className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    Get Directions
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Profile View
  const ProfileView = () => (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-4">
            <span className="material-symbols-outlined text-primary text-2xl">person</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {handymanData.fullName || 'Handyman Profile'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Registered {handymanData.registeredAt ? new Date(handymanData.registeredAt).toLocaleDateString() : 'Recently'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-bold mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                <p className="font-medium">{handymanData.email}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Phone</label>
                <p className="font-medium">{handymanData.phone || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Address</label>
                <p className="font-medium">{handymanData.address || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div>
            <h3 className="text-lg font-bold mb-4">Professional Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Service Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {handymanData.serviceTypes?.map(service => (
                    <span
                      key={service}
                      className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-sm"
                    >
                      {service}
                    </span>
                  )) || <p className="font-medium">Not specified</p>}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Experience Level</label>
                <p className="font-medium">{handymanData.experienceLevel || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Hourly Rate</label>
                <p className="font-medium">
                  {handymanData.hourlyRate ? `$${handymanData.hourlyRate}/hour` : 'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Service Areas</label>
                <p className="font-medium">
                  {handymanData.serviceAreas?.join(', ') || 'Not specified'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {handymanData.description && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4">About Me</h3>
            <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              {handymanData.description}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-2xl font-bold text-primary">0</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Jobs Completed</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-2xl font-bold text-primary">0</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Applications</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-2xl font-bold text-primary">5.0</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Average Rating</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardNav />

      {currentView === 'jobs' && (
        <JobBoard
          onJobSelect={handleJobSelect}
        />
      )}
      {currentView === 'my-jobs' && <MyJobsView />}
      {currentView === 'profile' && <ProfileView />}
    </div>
  );
};

export default HandymanDashboard;