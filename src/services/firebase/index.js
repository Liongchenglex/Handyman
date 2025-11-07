/**
 * Firebase Services - Central Export Module
 *
 * This module provides a single entry point for all Firebase services.
 * Import everything you need from this file instead of individual modules.
 *
 * @example
 * // Import specific functions
 * import { createJob, uploadImage, auth } from './services/firebase';
 *
 * // Import collections constants
 * import { COLLECTIONS, JOB_STATUS } from './services/firebase';
 */

// Core Firebase instances
export { db, auth } from './config';

// Authentication functions
export {
  createAnonymousUser,
  signOutUser,
  onAuthStateChange,
  getCurrentUser
} from './auth';

// Firestore generic operations
export {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  subscribeToDocument,
  subscribeToCollection
} from './firestore';

// Collection-specific operations
export {
  // Constants
  COLLECTIONS,
  JOB_STATUS,
  SERVICE_TYPES,

  // User operations
  createUser,
  getUser,
  updateUser,

  // Job operations
  createJob,
  getJob,
  updateJob,
  getJobsByCustomer,
  getJobsByHandyman,
  getAvailableJobs,
  subscribeToJob,
  subscribeToCustomerJobs,

  // Handyman operations
  createHandyman,
  getHandyman,
  updateHandyman,
  getVerifiedHandymen,
  subscribeToHandyman,

  // Job Application operations
  createJobApplication,
  getJobApplications,
  getHandymanApplications,
  updateJobApplication,
  deleteJobApplication,

  // Review operations
  createReview,
  getHandymanReviews,

  // Notification operations
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,

  // Payment operations
  createPayment,
  getPayment,
  getCustomerPayments
} from './collections';

// Storage operations
export {
  uploadFile,
  uploadImage,
  deleteFile,
  getFileURL,
  listFiles
} from './storage';

// Default export with all services
export default {
  // Core
  db,
  auth,

  // Constants
  COLLECTIONS,
  JOB_STATUS,
  SERVICE_TYPES,

  // Auth
  createAnonymousUser,
  signOutUser,
  onAuthStateChange,
  getCurrentUser,

  // Firestore
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  subscribeToDocument,
  subscribeToCollection,

  // Collections
  createUser,
  getUser,
  updateUser,
  createJob,
  getJob,
  updateJob,
  getJobsByCustomer,
  getJobsByHandyman,
  getAvailableJobs,
  subscribeToJob,
  subscribeToCustomerJobs,
  createHandyman,
  getHandyman,
  updateHandyman,
  getVerifiedHandymen,
  subscribeToHandyman,
  createJobApplication,
  getJobApplications,
  getHandymanApplications,
  updateJobApplication,
  deleteJobApplication,
  createReview,
  getHandymanReviews,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,
  createPayment,
  getPayment,
  getCustomerPayments,

  // Storage
  uploadFile,
  uploadImage,
  deleteFile,
  getFileURL,
  listFiles
};
