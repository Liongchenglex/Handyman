// Placeholder API functions for handymen
// These will connect to Firebase when fully implemented

export const createHandymanProfile = async (profileData) => {
  console.log('Creating handyman profile:', profileData);
  // Placeholder
  return {
    id: 'handyman-' + Date.now(),
    ...profileData,
    createdAt: new Date().toISOString()
  };
};

export const getHandymanProfile = async (userId) => {
  console.log('Getting handyman profile for user:', userId);
  // Placeholder - simulate profile not found for first-time users
  if (Math.random() > 0.5) {
    throw new Error('Profile not found');
  }

  return {
    id: userId,
    name: 'John Handyman',
    phone: '+65 9876 5432',
    email: 'john@example.com',
    serviceArea: 'Central Singapore',
    serviceTypes: ['Plumbing', 'Electrical'],
    experienceLevel: 'intermediate',
    isAvailable: true,
    rating: 4.5,
    completedJobs: 25,
    notificationPreferences: {
      whatsappNotifications: true,
      emailNotifications: false
    }
  };
};

export const updateHandymanNotifications = async (userId, preferences) => {
  console.log('Updating notification preferences for:', userId, preferences);
  // Placeholder
  return { success: true };
};