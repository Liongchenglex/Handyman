// Placeholder API functions for jobs
// These will connect to Firebase when fully implemented

export const createJob = async (jobData) => {
  console.log('Creating job:', jobData);
  // Placeholder - return mock job for testing
  return {
    id: 'job-' + Date.now(),
    ...jobData,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
};

export const getAvailableJobs = async (filters = {}) => {
  console.log('Getting jobs with filters:', filters);
  // Placeholder - return mock jobs for testing
  return [
    {
      id: 'job-1',
      serviceType: 'Plumbing',
      description: 'Fix leaky faucet in kitchen',
      location: 'Orchard Road, Singapore',
      estimatedBudget: 80,
      customerName: 'John Doe',
      customerPhone: '+65 9123 4567',
      status: 'pending',
      createdAt: new Date().toISOString()
    },
    {
      id: 'job-2',
      serviceType: 'Electrical',
      description: 'Install new ceiling fan',
      location: 'Tampines, Singapore',
      estimatedBudget: 150,
      customerName: 'Jane Smith',
      customerPhone: '+65 8765 4321',
      status: 'pending',
      createdAt: new Date().toISOString()
    }
  ];
};

export const getJobById = async (jobId) => {
  console.log('Getting job by ID:', jobId);
  // Placeholder
  return {
    id: jobId,
    serviceType: 'Plumbing',
    description: 'Fix leaky faucet in kitchen',
    location: 'Orchard Road, Singapore',
    estimatedBudget: 80,
    customerName: 'John Doe',
    customerPhone: '+65 9123 4567',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
};

export const acceptJob = async (jobId, handymanId) => {
  console.log('Accepting job:', jobId, 'by handyman:', handymanId);
  // Placeholder
  return { success: true };
};

export const updateJobStatus = async (jobId, status) => {
  console.log('Updating job status:', jobId, 'to:', status);
  // Placeholder
  return { success: true };
};