/**
 * Jobs API - Firebase Integration
 *
 * Handles all job-related operations with Firebase Firestore
 */

import {
  createJob as createJobFirebase,
  getJob,
  updateJob,
  getAvailableJobs as getAvailableJobsFirebase,
  getJobsByCustomer,
  getJobsByHandyman,
  uploadImage
} from '../firebase';

/**
 * Create a new job request
 * @param {Object} jobData - Job details
 * @param {string} jobData.customerId - Customer's Firebase user ID
 * @param {string} jobData.customerName - Customer name
 * @param {string} jobData.customerEmail - Customer email
 * @param {string} jobData.customerPhone - Customer phone
 * @param {string} jobData.address - Job location address
 * @param {string} jobData.serviceType - Type of service (Plumbing, Electrical, etc.)
 * @param {string} jobData.description - Job description
 * @param {string} jobData.preferredTiming - 'Immediate' or 'Schedule'
 * @param {string} jobData.preferredDate - ISO date string (if scheduled)
 * @param {string} jobData.preferredTime - Time slot
 * @param {string} jobData.materials - Who provides materials
 * @param {string} jobData.siteVisit - 'Yes' or 'No'
 * @param {number} jobData.estimatedBudget - Budget in SGD
 * @param {Array} jobData.images - Array of image file objects (optional)
 * @param {Object} jobData.paymentResult - Stripe payment result (optional)
 * @returns {Promise<Object>} Created job with ID
 */
export const createJob = async (jobData) => {
  try {
    console.log('Creating job in Firestore:', jobData);

    // Upload images to Firebase Storage if provided
    let imageUrls = [];
    if (jobData.images && jobData.images.length > 0) {
      console.log(`Uploading ${jobData.images.length} images...`);

      const uploadPromises = jobData.images.map(async (image, index) => {
        const path = `jobs/temp-${Date.now()}/images/${image.file.name}`;
        try {
          const url = await uploadImage(image.file, path, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.8
          });
          return url;
        } catch (error) {
          console.error(`Error uploading image ${index}:`, error);
          return null;
        }
      });

      imageUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
      console.log(`Successfully uploaded ${imageUrls.length} images`);
    }

    // Prepare job data for Firestore
    const firestoreJobData = {
      customerId: jobData.customerId,
      customerName: jobData.customerName,
      customerEmail: jobData.customerEmail,
      customerPhone: jobData.customerPhone,
      address: jobData.address,
      location: jobData.location || jobData.address,
      serviceType: jobData.serviceType,
      description: jobData.description,
      preferredTiming: jobData.preferredTiming,
      preferredDate: jobData.preferredDate,
      preferredTime: jobData.preferredTime,
      materials: jobData.materials,
      siteVisit: jobData.siteVisit,
      estimatedBudget: jobData.estimatedBudget || 120,
      status: 'pending',
      handymanId: null, // Initialize as null, will be set when handyman expresses interest
      imageUrls: imageUrls,
      paymentStatus: jobData.paymentResult ? 'pending' : 'pending', // Payment intent created but not captured yet
      paymentIntentId: jobData.paymentResult?.paymentIntent?.id || null
    };

    // Create job in Firestore
    const jobId = await createJobFirebase(firestoreJobData);
    console.log('Job created successfully with ID:', jobId);

    // Note: Payment record is now created in JobRequestForm after card confirmation
    // This ensures the job exists BEFORE payment, and payment data is accurate

    // Return complete job object
    return {
      id: jobId,
      ...firestoreJobData
    };
  } catch (error) {
    console.error('Error creating job:', error);
    throw new Error(`Failed to create job: ${error.message}`);
  }
};

/**
 * Get available jobs (for handymen to browse)
 * @param {Object} filters - Optional filters
 * @param {string} filters.serviceType - Filter by service type
 * @returns {Promise<Array>} List of available jobs
 */
export const getAvailableJobs = async (filters = {}) => {
  try {
    console.log('Getting available jobs with filters:', filters);
    const jobs = await getAvailableJobsFirebase(filters.serviceType);
    return jobs;
  } catch (error) {
    console.error('Error getting available jobs:', error);
    throw new Error(`Failed to get jobs: ${error.message}`);
  }
};

/**
 * Get job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job details
 */
export const getJobById = async (jobId) => {
  try {
    console.log('Getting job by ID:', jobId);
    const job = await getJob(jobId);
    return job;
  } catch (error) {
    console.error('Error getting job:', error);
    throw new Error(`Failed to get job: ${error.message}`);
  }
};

/**
 * Accept a job (handyman)
 * @param {string} jobId - Job ID
 * @param {string} handymanId - Handyman user ID
 * @returns {Promise<Object>} Success result
 */
export const acceptJob = async (jobId, handymanId) => {
  try {
    console.log('Accepting job:', jobId, 'by handyman:', handymanId);
    await updateJob(jobId, {
      handymanId: handymanId,
      status: 'in_progress',
      acceptedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error accepting job:', error);
    throw new Error(`Failed to accept job: ${error.message}`);
  }
};

/**
 * Update job status
 * @param {string} jobId - Job ID
 * @param {string} status - New status (pending, in_progress, completed, cancelled)
 * @returns {Promise<Object>} Success result
 */
export const updateJobStatus = async (jobId, status) => {
  try {
    console.log('Updating job status:', jobId, 'to:', status);
    await updateJob(jobId, {
      status: status,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating job status:', error);
    throw new Error(`Failed to update job status: ${error.message}`);
  }
};

/**
 * Get customer's jobs
 * @param {string} customerId - Customer user ID
 * @returns {Promise<Array>} List of customer's jobs
 */
export const getCustomerJobs = async (customerId) => {
  try {
    console.log('Getting jobs for customer:', customerId);
    const jobs = await getJobsByCustomer(customerId);
    return jobs;
  } catch (error) {
    console.error('Error getting customer jobs:', error);
    throw new Error(`Failed to get customer jobs: ${error.message}`);
  }
};

/**
 * Get handyman's jobs
 * @param {string} handymanId - Handyman user ID
 * @returns {Promise<Array>} List of handyman's jobs
 */
export const getHandymanJobs = async (handymanId) => {
  try {
    console.log('Getting jobs for handyman:', handymanId);
    const jobs = await getJobsByHandyman(handymanId);
    return jobs;
  } catch (error) {
    console.error('Error getting handyman jobs:', error);
    throw new Error(`Failed to get handyman jobs: ${error.message}`);
  }
};