import React, { createContext, useContext, useState } from 'react';

const JobContext = createContext();

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};

export const JobProvider = ({ children }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addJob = (job) => {
    setJobs(prev => [job, ...prev]);
  };

  const updateJob = (jobId, updates) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, ...updates } : job
    ));
  };

  const removeJob = (jobId) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
  };

  const value = {
    jobs,
    setJobs,
    addJob,
    updateJob,
    removeJob,
    loading,
    setLoading
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};