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
export { db, auth, storage } from './config';

// Authentication functions
export {
  // Handyman auth
  registerHandyman,
  signInHandyman,
  // Customer auth
  createAnonymousUser,
  // Common auth
  signOutUser,
  onAuthStateChange,
  getCurrentUser,
  isAuthenticated,
  getCurrentUserRole,
  // Password management
  resetPassword
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

// Import for default export
import { db as database, auth as authentication, storage as storageInstance } from './config';
import {
  registerHandyman as registerHandymanFunc,
  signInHandyman as signInHandymanFunc,
  createAnonymousUser as createAnonymousUserFunc,
  signOutUser as signOutUserFunc,
  onAuthStateChange as onAuthStateChangeFunc,
  getCurrentUser as getCurrentUserFunc,
  isAuthenticated as isAuthenticatedFunc,
  getCurrentUserRole as getCurrentUserRoleFunc,
  resetPassword as resetPasswordFunc
} from './auth';
import {
  COLLECTIONS as COLLECTIONS_CONST,
  JOB_STATUS as JOB_STATUS_CONST,
  SERVICE_TYPES as SERVICE_TYPES_CONST,
  createUser as createUserFunc,
  getUser as getUserFunc,
  updateUser as updateUserFunc,
  createJob as createJobFunc,
  getJob as getJobFunc,
  updateJob as updateJobFunc,
  getJobsByCustomer as getJobsByCustomerFunc,
  getJobsByHandyman as getJobsByHandymanFunc,
  getAvailableJobs as getAvailableJobsFunc,
  subscribeToJob as subscribeToJobFunc,
  subscribeToCustomerJobs as subscribeToCustomerJobsFunc,
  createHandyman as createHandymanFunc,
  getHandyman as getHandymanFunc,
  updateHandyman as updateHandymanFunc,
  getVerifiedHandymen as getVerifiedHandymenFunc,
  subscribeToHandyman as subscribeToHandymanFunc,
  createJobApplication as createJobApplicationFunc,
  getJobApplications as getJobApplicationsFunc,
  getHandymanApplications as getHandymanApplicationsFunc,
  updateJobApplication as updateJobApplicationFunc,
  deleteJobApplication as deleteJobApplicationFunc,
  createReview as createReviewFunc,
  getHandymanReviews as getHandymanReviewsFunc,
  createNotification as createNotificationFunc,
  getUserNotifications as getUserNotificationsFunc,
  markNotificationAsRead as markNotificationAsReadFunc,
  markAllNotificationsAsRead as markAllNotificationsAsReadFunc,
  subscribeToNotifications as subscribeToNotificationsFunc,
  createPayment as createPaymentFunc,
  getPayment as getPaymentFunc,
  getCustomerPayments as getCustomerPaymentsFunc
} from './collections';
import {
  createDocument as createDocumentFunc,
  getDocument as getDocumentFunc,
  updateDocument as updateDocumentFunc,
  deleteDocument as deleteDocumentFunc,
  queryDocuments as queryDocumentsFunc,
  subscribeToDocument as subscribeToDocumentFunc,
  subscribeToCollection as subscribeToCollectionFunc
} from './firestore';
import {
  uploadFile as uploadFileFunc,
  uploadImage as uploadImageFunc,
  deleteFile as deleteFileFunc,
  getFileURL as getFileURLFunc,
  listFiles as listFilesFunc
} from './storage';

// Default export with all services
export default {
  // Core
  db: database,
  auth: authentication,
  storage: storageInstance,

  // Constants
  COLLECTIONS: COLLECTIONS_CONST,
  JOB_STATUS: JOB_STATUS_CONST,
  SERVICE_TYPES: SERVICE_TYPES_CONST,

  // Auth
  registerHandyman: registerHandymanFunc,
  signInHandyman: signInHandymanFunc,
  createAnonymousUser: createAnonymousUserFunc,
  signOutUser: signOutUserFunc,
  onAuthStateChange: onAuthStateChangeFunc,
  getCurrentUser: getCurrentUserFunc,
  isAuthenticated: isAuthenticatedFunc,
  getCurrentUserRole: getCurrentUserRoleFunc,
  resetPassword: resetPasswordFunc,

  // Firestore
  createDocument: createDocumentFunc,
  getDocument: getDocumentFunc,
  updateDocument: updateDocumentFunc,
  deleteDocument: deleteDocumentFunc,
  queryDocuments: queryDocumentsFunc,
  subscribeToDocument: subscribeToDocumentFunc,
  subscribeToCollection: subscribeToCollectionFunc,

  // Collections
  createUser: createUserFunc,
  getUser: getUserFunc,
  updateUser: updateUserFunc,
  createJob: createJobFunc,
  getJob: getJobFunc,
  updateJob: updateJobFunc,
  getJobsByCustomer: getJobsByCustomerFunc,
  getJobsByHandyman: getJobsByHandymanFunc,
  getAvailableJobs: getAvailableJobsFunc,
  subscribeToJob: subscribeToJobFunc,
  subscribeToCustomerJobs: subscribeToCustomerJobsFunc,
  createHandyman: createHandymanFunc,
  getHandyman: getHandymanFunc,
  updateHandyman: updateHandymanFunc,
  getVerifiedHandymen: getVerifiedHandymenFunc,
  subscribeToHandyman: subscribeToHandymanFunc,
  createJobApplication: createJobApplicationFunc,
  getJobApplications: getJobApplicationsFunc,
  getHandymanApplications: getHandymanApplicationsFunc,
  updateJobApplication: updateJobApplicationFunc,
  deleteJobApplication: deleteJobApplicationFunc,
  createReview: createReviewFunc,
  getHandymanReviews: getHandymanReviewsFunc,
  createNotification: createNotificationFunc,
  getUserNotifications: getUserNotificationsFunc,
  markNotificationAsRead: markNotificationAsReadFunc,
  markAllNotificationsAsRead: markAllNotificationsAsReadFunc,
  subscribeToNotifications: subscribeToNotificationsFunc,
  createPayment: createPaymentFunc,
  getPayment: getPaymentFunc,
  getCustomerPayments: getCustomerPaymentsFunc,

  // Storage
  uploadFile: uploadFileFunc,
  uploadImage: uploadImageFunc,
  deleteFile: deleteFileFunc,
  getFileURL: getFileURLFunc,
  listFiles: listFilesFunc
};
