import React, { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import FixedStepperContainer from '../common/FixedStepperContainer';
import { registerHandyman, uploadImage, uploadFile, updateDocument } from '../../services/firebase';

/**
 * HandymanRegistration Component
 *
 * Multi-step registration form for handymen to complete their profile
 * Follows the same patterns as the customer JobRequestForm
 *
 * @param {Object} initialData - Initial user data from signup (email, tempUserId)
 * @param {Function} onRegistrationComplete - Callback when registration is completed
 * @param {Function} onBackToAuth - Callback to return to auth screen
 */
const HandymanRegistration = ({
  initialData = {},
  onRegistrationComplete,
  onBackToAuth
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data state for each step
  const [personalData, setPersonalData] = useState({
    fullName: '',
    phone: '',
    email: initialData.email || '',
    password: initialData.password || '', // Store password from signup
    address: '',
    postalCode: ''
  });

  const [professionalData, setProfessionalData] = useState({
    serviceTypes: [],
    experienceLevel: '',
    hourlyRate: '',
    serviceAreas: [],
    description: '',
    availability: 'full-time'
  });

  const [documentsData, setDocumentsData] = useState({
    workExperience: [], // CV and work experience documents
    profileImage: null // Profile picture (single image)
  });

  const [preferencesData, setPreferencesData] = useState({
    whatsappNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    jobAlerts: true,
    marketingEmails: false
  });

  // Error states for each step
  const [personalErrors, setPersonalErrors] = useState({});
  const [professionalErrors, setProfessionalErrors] = useState({});
  const [documentsErrors, setDocumentsErrors] = useState({});

  // Service types and other options
  const serviceTypes = [
    'Plumbing',
    'Electrical',
    'Carpentry',
    'Appliance Repair',
    'Painting',
    'Flooring',
    'HVAC',
    'General Maintenance'
  ];

  const experienceLevels = [
    { value: 'beginner', label: 'Beginner (0-2 years)' },
    { value: 'intermediate', label: 'Intermediate (3-5 years)' },
    { value: 'experienced', label: 'Experienced (6-10 years)' },
    { value: 'expert', label: 'Expert (10+ years)' }
  ];

  const singaporeAreas = [
    'Central', 'North', 'South', 'East', 'West', 'Northeast'
  ];

  const availabilityOptions = [
    { value: 'full-time', label: 'Full-time (40+ hours/week)' },
    { value: 'part-time', label: 'Part-time (20-40 hours/week)' },
    { value: 'weekends', label: 'Weekends only' },
    { value: 'flexible', label: 'Flexible schedule' }
  ];

  // Validation functions
  const validatePersonalData = (data) => {
    const errors = {};

    if (!data.fullName || data.fullName.trim() === '') {
      errors.fullName = 'Full name is required';
    }

    if (!data.phone || data.phone.trim() === '') {
      errors.phone = 'Phone number is required';
    } else if (!/^[689]\d{7}$/.test(data.phone)) {
      errors.phone = 'Please enter a valid Singapore phone number';
    }

    if (!data.address || data.address.trim() === '') {
      errors.address = 'Address is required';
    }

    if (!data.postalCode || data.postalCode.trim() === '') {
      errors.postalCode = 'Postal code is required';
    } else if (!/^\d{6}$/.test(data.postalCode)) {
      errors.postalCode = 'Please enter a valid 6-digit postal code';
    }

    return errors;
  };

  const validateProfessionalData = (data) => {
    const errors = {};

    if (!data.serviceTypes || data.serviceTypes.length === 0) {
      errors.serviceTypes = 'Please select at least one service type';
    }

    if (!data.experienceLevel) {
      errors.experienceLevel = 'Please select your experience level';
    }

    if (!data.hourlyRate || data.hourlyRate.trim() === '') {
      errors.hourlyRate = 'Hourly rate is required';
    } else if (isNaN(data.hourlyRate) || parseFloat(data.hourlyRate) < 10) {
      errors.hourlyRate = 'Please enter a valid hourly rate (minimum $10)';
    }

    if (!data.serviceAreas || data.serviceAreas.length === 0) {
      errors.serviceAreas = 'Please select at least one service area';
    }

    if (!data.description || data.description.trim() === '') {
      errors.description = 'Please provide a description of your services';
    } else if (data.description.length < 50) {
      errors.description = 'Description should be at least 50 characters';
    }

    return errors;
  };

  // Progress stepper configuration
  const steps = [
    {
      id: 1,
      title: 'Personal Details',
      description: 'Basic information'
    },
    {
      id: 2,
      title: 'Professional Info',
      description: 'Skills & experience'
    },
    {
      id: 3,
      title: 'Documents',
      description: 'CV & portfolio'
    },
    {
      id: 4,
      title: 'Preferences',
      description: 'Notifications & settings'
    }
  ];

  // Handle step navigation
  const handleStepClick = (stepNumber) => {
    if (stepNumber < currentStep) {
      setCurrentStep(stepNumber);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Step 1: Personal Details handlers
  const handlePersonalSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validatePersonalData(personalData);
    setPersonalErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updatePersonalData = (field, value) => {
    setPersonalData(prev => ({ ...prev, [field]: value }));
    if (personalErrors[field]) {
      setPersonalErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Step 2: Professional Info handlers
  const handleProfessionalSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateProfessionalData(professionalData);
    setProfessionalErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateProfessionalData = (field, value) => {
    setProfessionalData(prev => ({ ...prev, [field]: value }));
    if (professionalErrors[field]) {
      setProfessionalErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const toggleServiceType = (serviceType) => {
    const updatedServices = professionalData.serviceTypes.includes(serviceType)
      ? professionalData.serviceTypes.filter(s => s !== serviceType)
      : [...professionalData.serviceTypes, serviceType];

    updateProfessionalData('serviceTypes', updatedServices);
  };

  const toggleServiceArea = (area) => {
    const updatedAreas = professionalData.serviceAreas.includes(area)
      ? professionalData.serviceAreas.filter(a => a !== area)
      : [...professionalData.serviceAreas, area];

    updateProfessionalData('serviceAreas', updatedAreas);
  };

  // Step 3: Documents handlers
  const handleDocumentsSubmit = (e) => {
    e.preventDefault();
    // Documents are optional for now, but validation can be added
    setCurrentStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = (field, files) => {
    setDocumentsData(prev => ({ ...prev, [field]: files }));
  };

  // Step 4: Final submission
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Step 1: Register handyman with Firebase
      const { user, profile } = await registerHandyman({
        email: personalData.email,
        password: personalData.password,
        name: personalData.fullName,
        phone: personalData.phone,
        serviceTypes: professionalData.serviceTypes,
        experience: professionalData.experienceLevel,
        bio: professionalData.description
      });

      console.log('Handyman registered successfully:', user.uid);

      // Step 2: Upload work experience documents if any (PDFs, DOCs, images)
      let workExperienceUrls = [];
      if (documentsData.workExperience && documentsData.workExperience.length > 0) {
        console.log('Uploading work experience documents...');
        const uploadPromises = documentsData.workExperience.map(async (file, index) => {
          const path = `handymen/${user.uid}/work-experience/${file.name}`;
          try {
            // Use uploadFile instead of uploadImage to support PDFs, DOCs, etc.
            const url = await uploadFile(file, path);
            return url;
          } catch (error) {
            console.error(`Error uploading work experience document ${index}:`, error);
            return null;
          }
        });
        workExperienceUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);
        console.log(`Uploaded ${workExperienceUrls.length} work experience documents`);
      }

      // Step 3: Upload profile image if provided
      let profileImageUrl = null;
      if (documentsData.profileImage) {
        console.log('Uploading profile image...');
        const path = `handymen/${user.uid}/profile/${documentsData.profileImage.name}`;
        try {
          profileImageUrl = await uploadImage(documentsData.profileImage, path, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.85
          });
          console.log('Profile image uploaded successfully');
        } catch (error) {
          console.error('Error uploading profile image:', error);
        }
      }

      // Step 4: Update handyman document with uploaded file URLs
      if (workExperienceUrls.length > 0 || profileImageUrl) {
        console.log('Updating handyman profile with document URLs...');
        await updateDocument('handymen', user.uid, {
          workExperienceUrls: workExperienceUrls,
          profileImageUrl: profileImageUrl,
          updatedAt: new Date().toISOString()
        });
      }

      // Combine all form data for callback
      const completeData = {
        uid: user.uid,
        email: personalData.email,
        name: personalData.fullName,
        phone: personalData.phone,
        address: personalData.address,
        postalCode: personalData.postalCode,
        serviceTypes: professionalData.serviceTypes,
        experienceLevel: professionalData.experienceLevel,
        hourlyRate: professionalData.hourlyRate,
        serviceAreas: professionalData.serviceAreas,
        description: professionalData.description,
        availability: professionalData.availability,
        preferences: preferencesData,
        role: profile.role,
        isAuthenticated: true,
        workExperienceUrls: workExperienceUrls,
        profileImageUrl: profileImageUrl,
        registeredAt: new Date().toISOString()
      };

      if (onRegistrationComplete) {
        onRegistrationComplete(completeData);
      }
      setIsSubmitting(false);

    } catch (error) {
      console.error('Registration error:', error);
      alert(error.message || 'Registration failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const updatePreferencesData = (field, value) => {
    setPreferencesData(prev => ({ ...prev, [field]: value }));
  };

  // Render Step 1: Personal Details
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FixedStepperContainer
          currentStep={currentStep}
          steps={steps}
          onStepClick={handleStepClick}
          allowClickBack={false}
        />

        <div className="max-w-4xl mx-auto pt-8 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={onBackToAuth}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Personal Information</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Let's start with your basic details</p>
                </div>
              </div>

              <form onSubmit={handlePersonalSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="fullName">
                    Full Name
                  </label>
                  <input
                    className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      personalErrors.fullName ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    id="fullName"
                    type="text"
                    placeholder="e.g., John Smith"
                    value={personalData.fullName}
                    onChange={(e) => updatePersonalData('fullName', e.target.value)}
                  />
                  {personalErrors.fullName && <span className="text-red-500 text-sm mt-1">{personalErrors.fullName}</span>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      personalErrors.phone ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    id="phone"
                    type="tel"
                    placeholder="e.g., 9123 4567"
                    value={personalData.phone}
                    onChange={(e) => updatePersonalData('phone', e.target.value)}
                  />
                  {personalErrors.phone && <span className="text-red-500 text-sm mt-1">{personalErrors.phone}</span>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    className="w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-4 font-bold text-gray-500 dark:text-gray-400"
                    id="email"
                    type="email"
                    value={personalData.email}
                    disabled
                  />
                  <p className="text-sm text-gray-500 mt-1">Email cannot be changed after signup</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="address">
                    Address
                  </label>
                  <input
                    className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      personalErrors.address ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    id="address"
                    type="text"
                    placeholder="e.g., 123 Orchard Road #12-34"
                    value={personalData.address}
                    onChange={(e) => updatePersonalData('address', e.target.value)}
                  />
                  {personalErrors.address && <span className="text-red-500 text-sm mt-1">{personalErrors.address}</span>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="postalCode">
                    Postal Code
                  </label>
                  <input
                    className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      personalErrors.postalCode ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    id="postalCode"
                    type="text"
                    placeholder="e.g., 238864"
                    value={personalData.postalCode}
                    onChange={(e) => updatePersonalData('postalCode', e.target.value)}
                  />
                  {personalErrors.postalCode && <span className="text-red-500 text-sm mt-1">{personalErrors.postalCode}</span>}
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl hover:bg-opacity-80 transition-colors shadow-lg"
                  >
                    Continue to Professional Info
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Step 2: Professional Information
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FixedStepperContainer
          currentStep={currentStep}
          steps={steps}
          onStepClick={handleStepClick}
          allowClickBack={true}
        />

        <div className="max-w-4xl mx-auto pt-8 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => { setCurrentStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Professional Information</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Tell us about your skills and experience</p>
                </div>
              </div>

              <form onSubmit={handleProfessionalSubmit} className="space-y-8">
                {/* Service Types */}
                <div>
                  <h3 className="text-lg font-bold mb-4">Service Types</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select all services you can provide</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {serviceTypes.map(service => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleServiceType(service)}
                        className={`px-4 py-3 rounded-xl border transition-colors text-left ${
                          professionalData.serviceTypes.includes(service)
                            ? 'bg-primary text-black border-primary'
                            : 'border-gray-200 dark:border-gray-700 text-black/80 dark:text-white/80 hover:bg-primary/10'
                        }`}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                  {professionalErrors.serviceTypes && <span className="text-red-500 text-sm mt-2">{professionalErrors.serviceTypes}</span>}
                </div>

                {/* Experience Level */}
                <div>
                  <label className="block text-lg font-bold mb-4">Experience Level</label>
                  <div className="space-y-3">
                    {experienceLevels.map(level => (
                      <label
                        key={level.value}
                        className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                          professionalData.experienceLevel === level.value
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="experienceLevel"
                          value={level.value}
                          checked={professionalData.experienceLevel === level.value}
                          onChange={(e) => updateProfessionalData('experienceLevel', e.target.value)}
                          className="sr-only"
                        />
                        <span className="font-medium">{level.label}</span>
                      </label>
                    ))}
                  </div>
                  {professionalErrors.experienceLevel && <span className="text-red-500 text-sm mt-2">{professionalErrors.experienceLevel}</span>}
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="block text-lg font-bold mb-2" htmlFor="hourlyRate">
                    Hourly Rate (SGD)
                  </label>
                  <input
                    className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      professionalErrors.hourlyRate ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    id="hourlyRate"
                    type="number"
                    min="10"
                    placeholder="e.g., 25"
                    value={professionalData.hourlyRate}
                    onChange={(e) => updateProfessionalData('hourlyRate', e.target.value)}
                  />
                  {professionalErrors.hourlyRate && <span className="text-red-500 text-sm mt-1">{professionalErrors.hourlyRate}</span>}
                </div>

                {/* Service Areas */}
                <div>
                  <h3 className="text-lg font-bold mb-4">Service Areas</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select areas where you can provide services</p>
                  <div className="flex flex-wrap gap-3">
                    {singaporeAreas.map(area => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleServiceArea(area)}
                        className={`px-4 py-2 rounded-xl border transition-colors ${
                          professionalData.serviceAreas.includes(area)
                            ? 'bg-primary text-black border-primary'
                            : 'border-gray-200 dark:border-gray-700 text-black/80 dark:text-white/80 hover:bg-primary/10'
                        }`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                  {professionalErrors.serviceAreas && <span className="text-red-500 text-sm mt-2">{professionalErrors.serviceAreas}</span>}
                </div>

                {/* Availability */}
                <div>
                  <label className="block text-lg font-bold mb-4">Availability</label>
                  <div className="space-y-3">
                    {availabilityOptions.map(option => (
                      <label
                        key={option.value}
                        className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                          professionalData.availability === option.value
                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="availability"
                          value={option.value}
                          checked={professionalData.availability === option.value}
                          onChange={(e) => updateProfessionalData('availability', e.target.value)}
                          className="sr-only"
                        />
                        <span className="font-medium">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-lg font-bold mb-2" htmlFor="description">
                    Service Description
                  </label>
                  <textarea
                    className={`w-full p-4 rounded-xl border bg-gray-50 dark:bg-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      professionalErrors.description ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    id="description"
                    rows="4"
                    placeholder="Describe your services, experience, and what makes you the right choice for customers. Be specific about your specialties and approach to work."
                    value={professionalData.description}
                    onChange={(e) => updateProfessionalData('description', e.target.value)}
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    {professionalData.description.length}/500 characters (minimum 50)
                  </div>
                  {professionalErrors.description && <span className="text-red-500 text-sm mt-1">{professionalErrors.description}</span>}
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl hover:bg-opacity-80 transition-colors shadow-lg"
                  >
                    Continue to Documents
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Step 3: Documents
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FixedStepperContainer
          currentStep={currentStep}
          steps={steps}
          onStepClick={handleStepClick}
          allowClickBack={true}
        />

        <div className="max-w-4xl mx-auto pt-8 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => { setCurrentStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Documents & Portfolio</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Showcase your experience and work (optional)</p>
                </div>
              </div>

              <form onSubmit={handleDocumentsSubmit} className="space-y-8">
                {/* Work Experience/CV */}
                <div>
                  <h3 className="text-lg font-bold mb-4">Work Experience / CV</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Upload your CV, resume, or work experience documents to help customers understand your background
                  </p>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload('workExperience', Array.from(e.target.files))}
                      className="hidden"
                      id="cv-upload"
                    />
                    <label
                      htmlFor="cv-upload"
                      className="cursor-pointer flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="material-symbols-outlined text-3xl">work</span>
                      <span className="font-medium">Upload CV or Work Experience</span>
                      <span className="text-sm">PDF, DOC, DOCX, PNG, JPG up to 10MB each</span>
                    </label>
                  </div>

                  {/* File Preview for Work Experience */}
                  {documentsData.workExperience && documentsData.workExperience.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploaded Files:</h4>
                      {documentsData.workExperience.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-400">description</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</span>
                            <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = documentsData.workExperience.filter((_, i) => i !== index);
                              setDocumentsData(prev => ({ ...prev, workExperience: updated }));
                            }}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Profile Picture */}
                <div>
                  <h3 className="text-lg font-bold mb-4">Profile Picture (Optional)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Upload a professional photo of yourself to help customers recognize you
                  </p>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('profileImage', e.target.files[0])}
                      className="hidden"
                      id="profile-upload"
                    />
                    <label
                      htmlFor="profile-upload"
                      className="cursor-pointer flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="material-symbols-outlined text-3xl">account_circle</span>
                      <span className="font-medium">Upload Profile Picture</span>
                      <span className="text-sm">PNG, JPG (square image recommended)</span>
                    </label>
                  </div>

                  {/* Image Preview for Profile Picture */}
                  {documentsData.profileImage && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Profile Picture Preview:</h4>
                      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <img
                          src={URL.createObjectURL(documentsData.profileImage)}
                          alt="Profile preview"
                          className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{documentsData.profileImage.name}</p>
                          <p className="text-xs text-gray-500">({(documentsData.profileImage.size / 1024).toFixed(1)} KB)</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocumentsData(prev => ({ ...prev, profileImage: null }))}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
                      info
                    </span>
                    <div className="text-left">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                        Build Trust with Customers
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300 text-sm">
                        These documents are optional but highly recommended. A strong portfolio and CV help customers choose you with confidence. You can always add more later from your dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl hover:bg-opacity-80 transition-colors shadow-lg"
                  >
                    Continue to Preferences
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Step 4: Preferences & Final Submission
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <FixedStepperContainer
        currentStep={currentStep}
        steps={steps}
        onStepClick={handleStepClick}
        allowClickBack={true}
      />

      <div className="max-w-4xl mx-auto pt-8 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <button
                type="button"
                onClick={() => { setCurrentStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notification Preferences</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Choose how you'd like to receive updates</p>
              </div>
            </div>

            <form onSubmit={handleFinalSubmit} className="space-y-8">
              {/* Notification Settings */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold">Communication Preferences</h3>

                {[
                  { key: 'whatsappNotifications', label: 'WhatsApp notifications', description: 'Job alerts and updates via WhatsApp' },
                  { key: 'emailNotifications', label: 'Email notifications', description: 'Job summaries and account updates' },
                  { key: 'smsNotifications', label: 'SMS notifications', description: 'Urgent job alerts via SMS' },
                  { key: 'jobAlerts', label: 'New job alerts', description: 'Immediate notifications for matching jobs' },
                  { key: 'marketingEmails', label: 'Marketing emails', description: 'Tips, promotions, and platform updates' }
                ].map((pref) => (
                  <label
                    key={pref.key}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={preferencesData[pref.key]}
                      onChange={(e) => updatePreferencesData(pref.key, e.target.checked)}
                      className="mt-1 w-5 h-5 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{pref.label}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{pref.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Summary Box */}
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">summarize</span>
                  Registration Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Name:</span>
                    <span className="font-medium">{personalData.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Services:</span>
                    <span className="font-medium">{professionalData.serviceTypes.length} selected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                    <span className="font-medium">{experienceLevels.find(l => l.value === professionalData.experienceLevel)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Rate:</span>
                    <span className="font-medium">${professionalData.hourlyRate}/hour</span>
                  </div>
                </div>
              </div>

              {/* Final Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 flex items-center justify-center bg-primary text-black font-bold text-lg rounded-xl hover:bg-opacity-80 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    'Complete Registration'
                  )}
                </button>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
                  By registering, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandymanRegistration;