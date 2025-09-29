import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';
import ExpressInterestButton from './ExpressInterestButton';

/**
 * JobBoard Component
 *
 * Displays available jobs for handymen with filtering and search capabilities
 * Follows the established design patterns and is ready for API integration
 *
 * @param {Function} onJobSelect - Callback when a job is selected
 */
const JobBoard = ({
  onJobSelect
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    serviceType: '',
    budgetRange: '',
    location: '',
    urgency: '',
    sortBy: 'newest'
  });

  // Mock job data for frontend verification (replace with API call)
  const mockJobs = [
    {
      id: 'JOB-001',
      customerName: 'Sarah Chen',
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
      postedAt: '2 hours ago',
      images: 2,
      status: 'pending'
    },
    {
      id: 'JOB-002',
      customerName: 'Michael Tan',
      serviceType: 'Electrical',
      description: 'Power outlet in bedroom stopped working. Need electrician to check and fix the wiring issue.',
      location: 'Tampines, East',
      estimatedBudget: 80,
      preferredTiming: 'Immediate',
      materials: 'I will buy',
      siteVisit: 'No',
      urgency: 'normal',
      postedAt: '4 hours ago',
      images: 1,
      status: 'pending'
    },
    {
      id: 'JOB-003',
      customerName: 'Emily Wong',
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
      postedAt: '6 hours ago',
      images: 3,
      status: 'pending'
    },
    {
      id: 'JOB-004',
      customerName: 'David Lim',
      serviceType: 'Appliance Repair',
      description: 'Washing machine making loud noise during spin cycle. Need diagnosis and repair.',
      location: 'Clementi, West',
      estimatedBudget: 100,
      preferredTiming: 'Schedule',
      preferredDate: '2024-01-18',
      preferredTime: '11:00 AM - 01:00 PM',
      materials: 'Handyman to buy (surcharge applies)',
      siteVisit: 'Yes',
      urgency: 'normal',
      postedAt: '1 day ago',
      images: 0,
      status: 'pending'
    },
    {
      id: 'JOB-005',
      customerName: 'Lisa Koh',
      serviceType: 'Painting',
      description: 'Touch up paint work in 2-bedroom apartment. Some wall scratches and nail holes need fixing.',
      location: 'Toa Payoh, Central',
      estimatedBudget: 200,
      preferredTiming: 'Schedule',
      preferredDate: '2024-01-25',
      preferredTime: '09:00 AM - 11:00 AM',
      materials: 'Handyman to buy (surcharge applies)',
      siteVisit: 'Yes',
      urgency: 'normal',
      postedAt: '2 days ago',
      images: 4,
      status: 'pending'
    }
  ];

  // Filter and search options
  const serviceTypes = [
    'All Services',
    'Plumbing',
    'Electrical',
    'Carpentry',
    'Appliance Repair',
    'Painting',
    'Flooring',
    'HVAC',
    'General Maintenance'
  ];

  const budgetRanges = [
    { label: 'All Budgets', value: '' },
    { label: 'Under $50', value: '0-50' },
    { label: '$50 - $100', value: '50-100' },
    { label: '$100 - $200', value: '100-200' },
    { label: '$200 - $500', value: '200-500' },
    { label: 'Above $500', value: '500+' }
  ];

  const locations = [
    'All Locations',
    'Central',
    'North',
    'South',
    'East',
    'West',
    'Northeast'
  ];

  const urgencyOptions = [
    { label: 'All Urgency', value: '' },
    { label: 'Urgent', value: 'urgent' },
    { label: 'Normal', value: 'normal' }
  ];

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Highest Budget', value: 'budget-high' },
    { label: 'Lowest Budget', value: 'budget-low' },
    { label: 'Urgent First', value: 'urgent' }
  ];

  // Filter jobs based on search and filters
  const filteredJobs = mockJobs.filter(job => {
    const matchesSearch = job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesService = !selectedFilters.serviceType ||
                          selectedFilters.serviceType === 'All Services' ||
                          job.serviceType === selectedFilters.serviceType;

    const matchesLocation = !selectedFilters.location ||
                           selectedFilters.location === 'All Locations' ||
                           job.location.includes(selectedFilters.location);

    const matchesBudget = !selectedFilters.budgetRange || (() => {
      const [min, max] = selectedFilters.budgetRange.split('-').map(Number);
      if (selectedFilters.budgetRange === '500+') return job.estimatedBudget >= 500;
      return job.estimatedBudget >= min && job.estimatedBudget <= max;
    })();

    const matchesUrgency = !selectedFilters.urgency || job.urgency === selectedFilters.urgency;

    return matchesSearch && matchesService && matchesLocation && matchesBudget && matchesUrgency;
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    switch (selectedFilters.sortBy) {
      case 'budget-high':
        return b.estimatedBudget - a.estimatedBudget;
      case 'budget-low':
        return a.estimatedBudget - b.estimatedBudget;
      case 'urgent':
        return a.urgency === 'urgent' ? -1 : 1;
      default: // newest
        return new Date(b.postedAt) - new Date(a.postedAt);
    }
  });

  const handleFilterChange = (filterType, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API refresh
    setTimeout(() => {
      console.log('Refreshing job listings...');
      setIsLoading(false);
    }, 1000);
  };

  const handleSeeDetails = (job) => {
    // Navigate to job details page with job data
    navigate(`/job-details/${job.id}`, { state: { job } });
  };

  const getUrgencyBadge = (urgency) => {
    return urgency === 'urgent' ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <span className="material-symbols-outlined text-xs">emergency</span>
        Urgent
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        Normal
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Available Jobs</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 material-symbols-outlined text-gray-400">
                search
              </span>
              <input
                type="text"
                placeholder="Search jobs by description, service type, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Filter Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Service Type
              </label>
              <select
                value={selectedFilters.serviceType}
                onChange={(e) => handleFilterChange('serviceType', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {serviceTypes.map(type => (
                  <option key={type} value={type === 'All Services' ? '' : type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Budget Range
              </label>
              <select
                value={selectedFilters.budgetRange}
                onChange={(e) => handleFilterChange('budgetRange', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {budgetRanges.map(range => (
                  <option key={range.label} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Location
              </label>
              <select
                value={selectedFilters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {locations.map(location => (
                  <option key={location} value={location === 'All Locations' ? '' : location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Urgency
              </label>
              <select
                value={selectedFilters.urgency}
                onChange={(e) => handleFilterChange('urgency', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {urgencyOptions.map(option => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <select
                value={selectedFilters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {sortOptions.map(option => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFilters({
                  serviceType: '',
                  budgetRange: '',
                  location: '',
                  urgency: '',
                  sortBy: 'newest'
                });
              }}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Clear all filters
            </button>
          </div>
        </div>

        {/* Job Cards Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="large" />
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-6xl text-gray-400 mb-4">work_off</span>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No jobs found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters to find more jobs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedJobs.map(job => (
              <div
                key={job.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  {/* Job Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {job.serviceType}
                        </span>
                        {getUrgencyBadge(job.urgency)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Posted {job.postedAt} • Job #{job.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        ${job.estimatedBudget}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Estimated
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-gray-400">person</span>
                    <span className="font-medium text-gray-900 dark:text-white">{job.customerName}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400">{job.location}</span>
                  </div>

                  {/* Job Description */}
                  <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
                    {job.description}
                  </p>

                  {/* Job Details */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-gray-400 text-sm">schedule</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {job.preferredTiming === 'Immediate' ? 'Immediate' :
                         `${job.preferredDate} at ${job.preferredTime}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-gray-400 text-sm">build</span>
                      <span className="text-gray-600 dark:text-gray-400">{job.materials}</span>
                    </div>
                    {job.siteVisit === 'Yes' && (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-400 text-sm">home</span>
                        <span className="text-gray-600 dark:text-gray-400">Site visit required</span>
                      </div>
                    )}
                    {job.images > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-400 text-sm">photo_library</span>
                        <span className="text-gray-600 dark:text-gray-400">{job.images} image{job.images !== 1 ? 's' : ''} attached</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <ExpressInterestButton
                      job={job}
                      onJobSelect={onJobSelect}
                      buttonStyle="full-width"
                    />
                    <button
                      onClick={() => handleSeeDetails(job)}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-medium py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                      See Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button (for pagination when integrated with API) */}
        {sortedJobs.length > 0 && (
          <div className="text-center mt-8">
            <button
              className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Load More Jobs
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default JobBoard;