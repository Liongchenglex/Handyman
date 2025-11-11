/**
 * Firebase Collections Service
 *
 * Domain-specific functions for interacting with Firestore collections
 * Provides type-safe operations for the Handyman platform
 */

import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  subscribeToDocument,
  subscribeToCollection
} from './firestore';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  JOBS: 'jobs',
  HANDYMEN: 'handymen',
  JOB_APPLICATIONS: 'jobApplications',
  REVIEWS: 'reviews',
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
  CUSTOMERS: 'customers' // Legacy support
};

/**
 * Job Status Enum
 */
export const JOB_STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment', // Job created but payment not yet authorized
  PENDING: 'pending', // Payment authorized, job visible to handymen
  IN_PROGRESS: 'in_progress',
  PENDING_CONFIRMATION: 'pending_confirmation', // Handyman marked as complete, awaiting customer confirmation
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

/**
 * Service Types
 */
export const SERVICE_TYPES = [
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Painting',
  'Cleaning',
  'Aircon Servicing',
  'Moving',
  'Handyman',
  'Other'
];

// ==================== USERS ====================

/**
 * Create a new user profile
 * @param {string} userId - Firebase Auth User ID (used as document ID)
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user object
 */
export const createUser = async (userId, userData) => {
  const user = {
    userId, // Include userId in the document data
    ...userData,
    role: userData.role || 'customer',
    createdAt: new Date().toISOString()
  };

  // Use setDoc with specific ID instead of createDocument
  const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
  const { db } = await import('./config');

  await setDoc(doc(db, COLLECTIONS.USERS, userId), {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return user;
};

/**
 * Get user profile by ID
 */
export const getUser = async (userId) => {
  return await getDocument(COLLECTIONS.USERS, userId);
};

/**
 * Update user profile
 */
export const updateUser = async (userId, updates) => {
  return await updateDocument(COLLECTIONS.USERS, userId, updates);
};

// ==================== JOBS ====================

/**
 * Create a new job request
 */
export const createJob = async (jobData) => {
  const job = {
    ...jobData,
    // Preserve status from jobData (e.g., 'awaiting_payment'), or default to 'pending'
    status: jobData.status || JOB_STATUS.PENDING,
    createdAt: new Date().toISOString()
  };
  return await createDocument(COLLECTIONS.JOBS, job);
};

/**
 * Get job by ID
 */
export const getJob = async (jobId) => {
  return await getDocument(COLLECTIONS.JOBS, jobId);
};

/**
 * Update job details
 */
export const updateJob = async (jobId, updates) => {
  return await updateDocument(COLLECTIONS.JOBS, jobId, updates);
};

/**
 * Get jobs by customer ID
 */
export const getJobsByCustomer = async (customerId) => {
  return await queryDocuments(
    COLLECTIONS.JOBS,
    [{ field: 'customerId', operator: '==', value: customerId }],
    'createdAt',
    'desc'
  );
};

/**
 * Get jobs by handyman ID
 */
export const getJobsByHandyman = async (handymanId) => {
  return await queryDocuments(
    COLLECTIONS.JOBS,
    [{ field: 'handymanId', operator: '==', value: handymanId }],
    'createdAt',
    'desc'
  );
};

/**
 * Get available jobs (pending status)
 * Only returns jobs with 'pending' status (payment authorized)
 * Excludes jobs with 'awaiting_payment' status (not yet paid)
 */
export const getAvailableJobs = async (serviceType = null) => {
  const conditions = [
    { field: 'status', operator: '==', value: JOB_STATUS.PENDING }
  ];

  if (serviceType) {
    conditions.push({ field: 'serviceType', operator: '==', value: serviceType });
  }

  return await queryDocuments(
    COLLECTIONS.JOBS,
    conditions,
    'createdAt',
    'desc'
  );
};

/**
 * Subscribe to job updates
 */
export const subscribeToJob = (jobId, callback) => {
  return subscribeToDocument(COLLECTIONS.JOBS, jobId, callback);
};

/**
 * Subscribe to jobs for a customer
 */
export const subscribeToCustomerJobs = (customerId, callback) => {
  return subscribeToCollection(
    COLLECTIONS.JOBS,
    [{ field: 'customerId', operator: '==', value: customerId }],
    'createdAt',
    'desc',
    callback
  );
};

// ==================== HANDYMEN ====================

/**
 * Create handyman profile
 * @param {string} handymanId - Handyman user ID (used as document ID)
 * @param {Object} handymanData - Handyman profile data
 * @returns {Promise<Object>} Created handyman object
 */
export const createHandyman = async (handymanId, handymanData) => {
  const handyman = {
    handymanId, // Include handymanId in the document data
    ...handymanData,
    verified: false,
    status: 'pending', // Initial status: awaiting operations approval
    isAvailable: true,
    rating: 0,
    totalJobs: 0,
    createdAt: new Date().toISOString()
  };

  // Use setDoc with specific ID instead of createDocument
  const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
  const { db } = await import('./config');

  await setDoc(doc(db, COLLECTIONS.HANDYMEN, handymanId), {
    ...handyman,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return handyman;
};

/**
 * Get handyman profile
 */
export const getHandyman = async (handymanId) => {
  return await getDocument(COLLECTIONS.HANDYMEN, handymanId);
};

/**
 * Update handyman profile
 */
export const updateHandyman = async (handymanId, updates) => {
  return await updateDocument(COLLECTIONS.HANDYMEN, handymanId, updates);
};

/**
 * Get verified handymen by service type
 * @param {string|null} serviceType - Optional service type filter (currently not used in query)
 * @returns {Promise<Array>} Array of verified handymen
 */
export const getVerifiedHandymen = async (serviceType = null) => {
  const conditions = [
    { field: 'verified', operator: '==', value: true },
    { field: 'isAvailable', operator: '==', value: true }
  ];

  // Note: serviceType filtering would require array-contains query
  // Can be implemented when needed with serviceTypes array field
  console.log('Fetching handymen', serviceType ? `for ${serviceType}` : '');

  return await queryDocuments(
    COLLECTIONS.HANDYMEN,
    conditions,
    'rating',
    'desc'
  );
};

/**
 * Subscribe to handyman profile updates
 */
export const subscribeToHandyman = (handymanId, callback) => {
  return subscribeToDocument(COLLECTIONS.HANDYMEN, handymanId, callback);
};

// ==================== JOB APPLICATIONS ====================

/**
 * Create job application
 */
export const createJobApplication = async (applicationData) => {
  const application = {
    ...applicationData,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  return await createDocument(COLLECTIONS.JOB_APPLICATIONS, application);
};

/**
 * Get applications for a job
 */
export const getJobApplications = async (jobId) => {
  return await queryDocuments(
    COLLECTIONS.JOB_APPLICATIONS,
    [{ field: 'jobId', operator: '==', value: jobId }],
    'createdAt',
    'desc'
  );
};

/**
 * Get handyman's applications
 */
export const getHandymanApplications = async (handymanId) => {
  return await queryDocuments(
    COLLECTIONS.JOB_APPLICATIONS,
    [{ field: 'handymanId', operator: '==', value: handymanId }],
    'createdAt',
    'desc'
  );
};

/**
 * Update job application
 */
export const updateJobApplication = async (applicationId, updates) => {
  return await updateDocument(COLLECTIONS.JOB_APPLICATIONS, applicationId, updates);
};

/**
 * Delete job application
 */
export const deleteJobApplication = async (applicationId) => {
  return await deleteDocument(COLLECTIONS.JOB_APPLICATIONS, applicationId);
};

// ==================== REVIEWS ====================

/**
 * Create review
 */
export const createReview = async (reviewData) => {
  const review = {
    ...reviewData,
    createdAt: new Date().toISOString()
  };
  const reviewId = await createDocument(COLLECTIONS.REVIEWS, review);

  // Update handyman's rating
  await updateHandymanRating(reviewData.handymanId);

  return reviewId;
};

/**
 * Get reviews for a handyman
 */
export const getHandymanReviews = async (handymanId) => {
  return await queryDocuments(
    COLLECTIONS.REVIEWS,
    [{ field: 'handymanId', operator: '==', value: handymanId }],
    'createdAt',
    'desc'
  );
};

/**
 * Update handyman's average rating
 */
const updateHandymanRating = async (handymanId) => {
  try {
    const reviews = await getHandymanReviews(handymanId);
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      await updateHandyman(handymanId, {
        rating: parseFloat(avgRating.toFixed(2)),
        totalReviews: reviews.length
      });
    }
  } catch (error) {
    console.error('Error updating handyman rating:', error);
  }
};

// ==================== NOTIFICATIONS ====================

/**
 * Create notification
 */
export const createNotification = async (notificationData) => {
  const notification = {
    ...notificationData,
    read: false,
    createdAt: new Date().toISOString()
  };
  return await createDocument(COLLECTIONS.NOTIFICATIONS, notification);
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (userId, unreadOnly = false) => {
  const conditions = [{ field: 'userId', operator: '==', value: userId }];

  if (unreadOnly) {
    conditions.push({ field: 'read', operator: '==', value: false });
  }

  return await queryDocuments(
    COLLECTIONS.NOTIFICATIONS,
    conditions,
    'createdAt',
    'desc'
  );
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  return await updateDocument(COLLECTIONS.NOTIFICATIONS, notificationId, { read: true });
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (userId) => {
  const notifications = await getUserNotifications(userId, true);
  const promises = notifications.map(notification =>
    markNotificationAsRead(notification.id)
  );
  await Promise.all(promises);
};

/**
 * Subscribe to user notifications
 */
export const subscribeToNotifications = (userId, callback) => {
  return subscribeToCollection(
    COLLECTIONS.NOTIFICATIONS,
    [{ field: 'userId', operator: '==', value: userId }],
    'createdAt',
    'desc',
    callback
  );
};

// ==================== PAYMENTS ====================

/**
 * Create payment record
 */
export const createPayment = async (paymentData) => {
  const payment = {
    ...paymentData,
    createdAt: new Date().toISOString()
  };
  return await createDocument(COLLECTIONS.PAYMENTS, payment);
};

/**
 * Get payment by ID
 */
export const getPayment = async (paymentId) => {
  return await getDocument(COLLECTIONS.PAYMENTS, paymentId);
};

/**
 * Get customer payments
 */
export const getCustomerPayments = async (customerId) => {
  return await queryDocuments(
    COLLECTIONS.PAYMENTS,
    [{ field: 'customerId', operator: '==', value: customerId }],
    'createdAt',
    'desc'
  );
};

export default {
  COLLECTIONS,
  JOB_STATUS,
  SERVICE_TYPES,
  // Users
  createUser,
  getUser,
  updateUser,
  // Jobs
  createJob,
  getJob,
  updateJob,
  getJobsByCustomer,
  getJobsByHandyman,
  getAvailableJobs,
  subscribeToJob,
  subscribeToCustomerJobs,
  // Handymen
  createHandyman,
  getHandyman,
  updateHandyman,
  getVerifiedHandymen,
  subscribeToHandyman,
  // Job Applications
  createJobApplication,
  getJobApplications,
  getHandymanApplications,
  updateJobApplication,
  deleteJobApplication,
  // Reviews
  createReview,
  getHandymanReviews,
  // Notifications
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,
  // Payments
  createPayment,
  getPayment,
  getCustomerPayments
};
