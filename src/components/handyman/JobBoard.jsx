import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { getAvailableJobs } from '../../services/api/jobs';
import JobCard from './JobCard';
import LoadingSpinner from '../common/LoadingSpinner';

const JobBoard = () => {
  const [filters, setFilters] = useState({
    serviceType: '',
    location: '',
    budgetRange: '',
    sortBy: 'createdAt'
  });

  const { data: jobs, isLoading, error, refetch } = useQuery(
    ['availableJobs', filters],
    () => getAvailableJobs(filters),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const serviceTypes = [
    'Plumbing',
    'Electrical',
    'Carpentry',
    'Painting',
    'Air-con Servicing',
    'General Repairs',
    'Cleaning',
    'Moving/Delivery'
  ];

  const budgetRanges = [
    { label: 'Under $50', value: '0-50' },
    { label: '$50 - $100', value: '50-100' },
    { label: '$100 - $200', value: '100-200' },
    { label: '$200 - $500', value: '200-500' },
    { label: 'Above $500', value: '500-999999' }
  ];

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading available jobs..." />;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Failed to load jobs. Please try again.</p>
        <button onClick={refetch} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="job-board">
      <div className="job-board-header">
        <h2>Available Jobs</h2>
        <div className="job-count">
          {jobs?.length || 0} jobs available
        </div>
      </div>

      <div className="filters-section">
        <div className="filters">
          <div className="filter-group">
            <label>Service Type</label>
            <select
              value={filters.serviceType}
              onChange={(e) => handleFilterChange('serviceType', e.target.value)}
            >
              <option value="">All Services</option>
              {serviceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Location</label>
            <input
              type="text"
              placeholder="Enter area or postal code"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Budget Range</label>
            <select
              value={filters.budgetRange}
              onChange={(e) => handleFilterChange('budgetRange', e.target.value)}
            >
              <option value="">Any Budget</option>
              {budgetRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="createdAt">Newest First</option>
              <option value="estimatedBudget">Budget (High to Low)</option>
              <option value="estimatedBudget_asc">Budget (Low to High)</option>
              <option value="urgency">Most Urgent</option>
            </select>
          </div>
        </div>

        <button 
          onClick={refetch}
          className="btn-secondary refresh-btn"
        >
          🔄 Refresh Jobs
        </button>
      </div>

      <div className="jobs-grid">
        {jobs && jobs.length > 0 ? (
          jobs.map(job => (
            <JobCard 
              key={job.id} 
              job={job}
              onJobAccepted={refetch}
            />
          ))
        ) : (
          <div className="no-jobs">
            <p>No jobs match your current filters.</p>
            <button 
              onClick={() => setFilters({
                serviceType: '',
                location: '',
                budgetRange: '',
                sortBy: 'createdAt'
              })}
              className="btn-primary"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobBoard;