import React, { useState, useEffect } from 'react';
import { getJobsByHandyman } from '../../services/firebase';

/**
 * ProfileView Component
 *
 * Displays handyman profile information including:
 * - Contact details
 * - Professional information
 * - Service types
 * - Stats (jobs completed, rating, etc.)
 */
const ProfileView = ({ user, userProfile }) => {
  const [myJobs, setMyJobs] = useState([]);
  const handymanProfile = userProfile?.handyman || {};

  // Fetch jobs for stats display
  useEffect(() => {
    const fetchMyJobs = async () => {
      if (user) {
        try {
          const jobs = await getJobsByHandyman(user.uid);
          setMyJobs(jobs);
        } catch (error) {
          console.error('Error fetching my jobs for profile:', error);
        }
      }
    };

    fetchMyJobs();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          {handymanProfile.profileImageUrl ? (
            <img
              src={handymanProfile.profileImageUrl}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border-4 border-primary/30"
            />
          ) : (
            <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-4">
              <span className="material-symbols-outlined text-primary text-2xl">engineering</span>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {userProfile.name || user.displayName || 'Handyman Profile'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        </div>

        {/* Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Contact Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                <p className="font-medium text-gray-900 dark:text-white">
                  {userProfile.email || user.email}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Phone</label>
                <p className="font-medium text-gray-900 dark:text-white">
                  {userProfile.phone || handymanProfile.phone || 'Not provided'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Email Verified</label>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user.emailVerified ? (
                    <span className="text-green-600">✓ Verified</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Not verified</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              Professional Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Service Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {handymanProfile.serviceTypes && handymanProfile.serviceTypes.length > 0 ? (
                    handymanProfile.serviceTypes.map(service => (
                      <span
                        key={service}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium"
                      >
                        {service}
                      </span>
                    ))
                  ) : (
                    <p className="font-medium text-gray-500">Not specified</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Experience Level</label>
                <p className="font-medium text-gray-900 dark:text-white">
                  {handymanProfile.experience || 'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Verification Status</label>
                <p className="font-medium text-gray-900 dark:text-white">
                  {handymanProfile.verified ? (
                    <span className="text-green-600">✓ Verified Handyman</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Pending Verification</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Availability</label>
                <p className="font-medium text-gray-900 dark:text-white">
                  {handymanProfile.isAvailable ? (
                    <span className="text-green-600">✓ Available</span>
                  ) : (
                    <span className="text-red-600">✗ Not Available</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {handymanProfile.bio && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">About Me</h3>
            <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              {handymanProfile.bio}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {handymanProfile.totalJobs || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Jobs Completed</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {myJobs.filter(j => j.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {handymanProfile.rating || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Average Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
