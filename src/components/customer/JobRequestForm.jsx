import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
// import { useForm } from 'react-hook-form';
// import { createJob } from '../../services/api/jobs';
// import { validateSingaporeAddress } from '../../services/onemap/addressValidation'; // Future OneMap integration
import LoadingSpinner from '../common/LoadingSpinner';
import PaymentForm from './PaymentForm';
import FixedStepperContainer from '../common/FixedStepperContainer';
import ConfirmationScreen from './ConfirmationScreen';

// Custom styles for the date picker
const datePickerStyles = `
  .react-datepicker {
    border: none !important;
    border-radius: 0.5rem !important;
    box-shadow: none !important;
    background-color: transparent !important;
  }
  .react-datepicker__header {
    background-color: transparent !important;
    border-bottom: 1px solid #e0e6e2 !important;
    border-top-left-radius: 0.5rem !important;
    border-top-right-radius: 0.5rem !important;
  }
  .react-datepicker__current-month {
    color: #111714 !important;
    font-weight: 600 !important;
  }
  .react-datepicker__day-name {
    color: #648772 !important;
    font-weight: 500 !important;
  }
  .react-datepicker__day {
    color: #111714 !important;
    border-radius: 50% !important;
    width: 2rem !important;
    height: 2rem !important;
    line-height: 2rem !important;
  }
  .react-datepicker__day:hover {
    background-color: rgba(56, 224, 123, 0.2) !important;
    border-radius: 50% !important;
  }
  .react-datepicker__day--selected {
    background-color: #38e07b !important;
    color: #122017 !important;
    font-weight: 700 !important;
  }
  .react-datepicker__day--today {
    background-color: rgba(56, 224, 123, 0.2) !important;
    color: #38e07b !important;
    font-weight: 600 !important;
  }
  .react-datepicker__day--disabled {
    color: #a0b5a9 !important;
    cursor: not-allowed !important;
  }
  .react-datepicker__navigation {
    top: 1rem !important;
  }
  .react-datepicker__navigation--previous {
    left: 1rem !important;
  }
  .react-datepicker__navigation--next {
    right: 1rem !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = datePickerStyles;
  document.head.appendChild(styleElement);
}

const JobRequestForm = ({ onJobCreated, onBackToHome }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiAccordionOpen, setAiAccordionOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [personalData, setPersonalData] = useState({});
  const [personalErrors, setPersonalErrors] = useState({});
  const [jobErrors, setJobErrors] = useState({});
  const [jobData, setJobData] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // Job form data state for persistence
  const [jobFormData, setJobFormData] = useState({
    selectedCategory: 'Carpentry',
    selectedTiming: 'Schedule',
    selectedMaterials: 'I will buy',
    selectedSiteVisit: 'No',
    selectedDate: new Date(),
    notes: '',
    time: '09:00 AM - 11:00 AM'
  });

  const [uploadedImages, setUploadedImages] = useState([]);
  const [totalUploadSize, setTotalUploadSize] = useState(0);

  // Destructure for backward compatibility
  const {
    selectedCategory,
    selectedTiming,
    selectedMaterials,
    selectedSiteVisit,
    selectedDate,
    notes
  } = jobFormData;

  // Placeholder for useForm
  const register = (name, options) => ({ name });
  const handleSubmit = (callback) => (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    callback(data);
  };
  const reset = () => {};

  // Validation functions
  const validatePersonalData = (data) => {
    const errors = {};

    if (!data.name || data.name.trim() === '') {
      errors.name = 'This field is required';
    }

    if (!data.email || data.email.trim() === '') {
      errors.email = 'This field is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(data.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!data.phone || data.phone.trim() === '') {
      errors.phone = 'This field is required';
    } else if (!/^[689]\d{7}$/.test(data.phone)) {
      errors.phone = 'Please enter a valid Singapore phone number';
    }

    if (!data.address || data.address.trim() === '') {
      errors.address = 'This field is required';
    }
    // Future: Add OneMap API validation here
    // } else if (!await validateSingaporeAddress(data.address)) {
    //   errors.address = 'Please enter a valid Singapore address';
    // }

    return errors;
  };

  const validateJobData = () => {
    const errors = {};

    if (!selectedCategory) {
      errors.category = 'This field is required';
    }

    if (!selectedTiming) {
      errors.timing = 'This field is required';
    }

    if (selectedTiming === 'Schedule' && !jobFormData.time) {
      errors.time = 'This field is required';
    }

    if (!selectedMaterials) {
      errors.materials = 'This field is required';
    }

    if (!selectedSiteVisit) {
      errors.siteVisit = 'This field is required';
    }

    if (!notes || notes.trim() === '') {
      errors.notes = 'This field is required';
    }

    return errors;
  };

  const serviceTypes = [
    'Plumbing',
    'Electrical',
    'Carpentry',
    'Appliance Repair',
    'Painting'
  ];

  const timingOptions = ['Immediate', 'Schedule'];
  const materialsOptions = ['I will buy', 'Handyman to buy (surcharge applies)'];
  const siteVisitOptions = ['Yes', 'No'];
  const timeSlots = [
    '09:00 AM - 11:00 AM',
    '11:00 AM - 01:00 PM',
    '01:00 PM - 03:00 PM',
    '03:00 PM - 05:00 PM'
  ];

  const handlePersonalSubmit = (data) => {
    const validationErrors = validatePersonalData(data);
    setPersonalErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setPersonalData(data);
      setCurrentStep(2);
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Function to update job form data while maintaining persistence
  const updateJobFormData = (field, value) => {
    setJobFormData(prev => ({ ...prev, [field]: value }));
  };

  // Function to handle proceeding to review page
  const handleProceedToReview = () => {
    const validationErrors = validateJobData();
    setJobErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setCurrentStep(3);
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Function to handle form submission for job details
  const handleJobFormSubmit = (e) => {
    e.preventDefault();
    handleProceedToReview();
  };

  // Function to handle proceeding to payment
  const handleProceedToPayment = () => {
    const finalJobData = {
      // Personal details
      customerName: personalData.name,
      customerEmail: personalData.email,
      customerPhone: personalData.phone,
      address: personalData.address,
      // Job details
      serviceType: selectedCategory,
      description: notes || `${selectedCategory} service requested`,
      location: personalData.address || 'Singapore',
      preferredTiming: selectedTiming,
      preferredDate: selectedTiming === 'Schedule' ? selectedDate.toISOString().split('T')[0] : null,
      preferredTime: jobFormData.time,
      materials: selectedMaterials,
      siteVisit: selectedSiteVisit,
      estimatedBudget: 120,
      status: 'pending',
      createdAt: new Date(),
      images: uploadedImages
    };

    setJobData(finalJobData);
    setCurrentStep(4); // Go to payment step
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Function to handle successful payment
  const handlePaymentSuccess = (paymentResultData) => {
    console.log('Payment successful:', paymentResultData);
    console.log('Job data:', jobData);

    // Store payment result for confirmation screen
    setPaymentResult(paymentResultData);

    // Here you would typically:
    // 1. Create the job with payment confirmation
    // 2. Call onJobCreated with the final job data
    // 3. Show confirmation screen

    if (onJobCreated) {
      onJobCreated({ ...jobData, paymentStatus: 'completed', paymentResult: paymentResultData });
    }

    // Move to confirmation screen (step 5)
    setCurrentStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJobSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const jobData = {
        // Personal details
        customerName: personalData.name,
        customerEmail: personalData.email,
        customerPhone: personalData.phone,
        address: personalData.address,
        // Job details
        serviceType: selectedCategory,
        description: data.notes || `${selectedCategory} service requested`,
        location: personalData.address || 'Singapore',
        preferredTiming: selectedTiming,
        preferredDate: selectedTiming === 'Schedule' ? `2024-10-${selectedDate.toString().padStart(2, '0')}` : null,
        preferredTime: data.time,
        materials: selectedMaterials,
        siteVisit: selectedSiteVisit,
        estimatedBudget: 120, // Default budget, you can make this dynamic
        status: 'pending',
        createdAt: new Date()
      };

      const job = await createJob(jobData);
      onJobCreated(job);
      reset();
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);

    // Calculate new file sizes
    const newFilesSize = files.reduce((total, file) => total + file.size, 0);
    const newTotalSize = totalUploadSize + newFilesSize;

    // Check if total size exceeds 50MB (50 * 1024 * 1024 bytes)
    const maxTotalSize = 50 * 1024 * 1024;
    if (newTotalSize > maxTotalSize) {
      alert(`Total file size cannot exceed 50MB. Current total: ${(totalUploadSize / (1024 * 1024)).toFixed(2)}MB, Selected files: ${(newFilesSize / (1024 * 1024)).toFixed(2)}MB`);
      // Clear the input to allow re-selection
      event.target.value = '';
      return;
    }

    // Check individual file sizes (10MB each)
    const maxFileSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files exceed the 10MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      // Clear the input to allow re-selection
      event.target.value = '';
      return;
    }

    const newImages = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9),
      size: file.size
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
    setTotalUploadSize(newTotalSize);

    // Clear the input value to allow re-uploading the same file
    event.target.value = '';
  };

  const removeImage = (imageId) => {
    const imageToRemove = uploadedImages.find(img => img.id === imageId);
    if (imageToRemove) {
      setTotalUploadSize(prev => prev - imageToRemove.size);
      // Clean up the object URL to prevent memory leaks
      URL.revokeObjectURL(imageToRemove.url);
    }
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Format bytes to readable format
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Get current date and max date (1 year from now)
  const today = new Date();
  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() + 1);

  // Progress stepper configuration
  const steps = [
    {
      id: 1,
      title: 'Personal Details',
      // description: 'Basic information'
    },
    {
      id: 2,
      title: 'Job Details',
      // description: 'Service requirements'
    },
    {
      id: 3,
      title: 'Review & Submit',
      // description: 'Confirm details'
    },
    {
      id: 4,
      title: 'Payment',
      // description: 'Complete payment'
    }
  ];

  // Handle step navigation from stepper
  const handleStepClick = (stepNumber) => {
    if (stepNumber < currentStep) {
      setCurrentStep(stepNumber);
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Render based on current step
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Fixed Progress Stepper */}
        <FixedStepperContainer
          currentStep={currentStep}
          steps={steps}
          onStepClick={handleStepClick}
          allowClickBack={false}
        />

        <div className="max-w-4xl mx-auto pt-8 px-4">
          {/* Form Card Container */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8">
              {/* Header */}
              <div className="mb-8 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Let's get started</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">First, we need a few details to create your job request.</p>
              </div>

              {/* Personal Details Form Container */}
              <div className="space-y-6">
            <form onSubmit={handleSubmit(handlePersonalSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="name">
                  Full Name
                </label>
                <input
              className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                personalErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              id="name"
              placeholder="e.g., John Doe"
              type="text"
              defaultValue={personalData.name || ''}
              {...register('name')}
                />
                {personalErrors.name && <span className="text-red-500 text-sm mt-1">{personalErrors.name}</span>}
              </div>

              <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="email">
              Email Address
            </label>
                <input
              className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                personalErrors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              id="email"
              placeholder="e.g., john.doe@example.com"
              type="email"
              defaultValue={personalData.email || ''}
              {...register('email')}
                />
                {personalErrors.email && <span className="text-red-500 text-sm mt-1">{personalErrors.email}</span>}
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
              placeholder="e.g., 9123 4567"
              type="tel"
              defaultValue={personalData.phone || ''}
              {...register('phone')}
                />
                {personalErrors.phone && <span className="text-red-500 text-sm mt-1">{personalErrors.phone}</span>}
          </div>

              <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="address">
              Job Address
            </label>
                <input
              className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                personalErrors.address ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              id="address"
              placeholder="e.g., 123 Orchard Road, #12-34, Singapore 238826"
              type="text"
              defaultValue={personalData.address || ''}
              {...register('address')}
                />
                {personalErrors.address && <span className="text-red-500 text-sm mt-1">{personalErrors.address}</span>}
          </div>

                  {/* Primary Action Button */}
                  <div className="mt-8">
                    <button
                    type="submit"
                    className="w-full h-12 px-5 bg-primary text-gray-900 font-bold text-base rounded-xl shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-background-dark transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Fixed Progress Stepper */}
        <FixedStepperContainer
          currentStep={currentStep}
          steps={steps}
          onStepClick={handleStepClick}
          allowClickBack={true}
        />

        <div className="w-full max-w-4xl mx-auto pt-8 px-4">
          {/* Form Card Container */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8">
              {/* Header with Back Button */}
              <div className="flex items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => { setCurrentStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Review Your Request</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Please review all the information before submitting your job request.</p>
                </div>
              </div>

              {/* Review Content Container */}
              <div className="space-y-6">
                {/* Personal Details Section */}
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">person</span>
                Personal Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <span className="font-medium">{personalData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Email:</span>
                  <span className="font-medium">{personalData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                  <span className="font-medium">{personalData.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">location_on</span>
                    Job Address:
                  </span>
                  <span className="font-medium text-right max-w-[60%]">{personalData.address}</span>
                </div>
              </div>
            </div>

                {/* Job Details Section */}
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">work</span>
                Job Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Service Category:</span>
                  <span className="font-medium">{selectedCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Timing:</span>
                  <span className="font-medium">{selectedTiming}</span>
                </div>
                {selectedTiming === 'Schedule' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="font-medium">{selectedDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Time:</span>
                      <span className="font-medium">{jobFormData.time}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Materials:</span>
                  <span className="font-medium">{selectedMaterials}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Site Visit:</span>
                  <span className="font-medium">{selectedSiteVisit}</span>
                </div>
                {notes && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Notes:</span>
                    <p className="mt-1 text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">{notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Uploaded Images Section */}
            {uploadedImages.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">photo_library</span>
                  Uploaded Images ({uploadedImages.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="relative">
                      <img
                        src={image.url}
                        alt="Job reference"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">Total size: {formatBytes(totalUploadSize)}</p>
              </div>
            )}

                {/* Primary Action Button */}
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl hover:bg-opacity-80 transition-colors shadow-lg"
                  >
                    Proceed to Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 4) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Fixed Progress Stepper */}
        <FixedStepperContainer
          currentStep={currentStep}
          steps={steps}
          onStepClick={handleStepClick}
          allowClickBack={true}
        />

        <div className="w-full max-w-4xl mx-auto pt-8 px-4">
          {/* Form Card Container */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8">
              {/* Header with Back Button */}
              <div className="flex items-center gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => { setCurrentStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Payment</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Complete your payment to submit your job request.</p>
                </div>
              </div>

              {/* Payment Content Container */}
              <div className="space-y-6">
                {/* Payment Form */}
                <PaymentForm
                  amount={120} // Default service fee
                  jobId={null} // Will be created after payment
                  onPaymentSuccess={handlePaymentSuccess}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Confirmation Screen
  if (currentStep === 5) {
    return (
      <ConfirmationScreen
        jobData={jobData}
        paymentResult={paymentResult}
        onBackToHome={onBackToHome}
        onViewJob={(jobData, jobId) => {
          // For now, just log the view job action
          // In a real app, this would navigate to a job detail page
          console.log('View job:', jobId, jobData);
        }}
      />
    );
  }

  // Step 2: Job Description Form
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Fixed Progress Stepper */}
      <FixedStepperContainer
        currentStep={currentStep}
        steps={steps}
        onStepClick={handleStepClick}
        allowClickBack={true}
      />

      <div className="w-full max-w-4xl mx-auto pt-8 px-4">
        {/* Form Card Container */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4 mb-8">
              <button
                type="button"
                onClick={() => { setCurrentStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">What do you need help with?</h1>
              </div>
            </div>

            {/* Job Details Content Container */}
            <div className="space-y-6">
          {/* AI Description Accordion - Commented out */}
      {/* <div className="border border-primary/30 bg-primary/5 dark:bg-primary/10 rounded-lg shadow-sm">
        <button
          type="button"
          onClick={() => setAiAccordionOpen(!aiAccordionOpen)}
          className="w-full px-4 py-3 text-left flex items-center justify-between bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/25 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <span className="font-medium text-gray-900 dark:text-white">
              Describe to AI your problem and AI will help you fill up the form
            </span>
          </div>
          <span className={`material-symbols-outlined transition-transform ${aiAccordionOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {aiAccordionOpen && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="Describe your problem in detail. For example: 'My kitchen sink is leaking water from underneath and making a dripping sound. The water seems to be coming from the pipes under the sink. I noticed it started yesterday after I used the garbage disposal.'"
              className="w-full h-32 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-gray-500 dark:placeholder:text-gray-400 text-sm"
                />
            <div className="mt-3 flex gap-2">
                  <button
                type="button"
                className="px-4 py-2 bg-primary text-background-dark font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  >
                Generate Form
              </button>
                  <button
                type="button"
                onClick={() => setAiDescription('')}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                  >
                Clear
              </button>
            </div>
          </div>
        )}
      </div> */}

          <form onSubmit={handleJobFormSubmit} className="space-y-6">
            {/* Category Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Select a category</h3>
              <div className="flex flex-wrap gap-3">
                {serviceTypes.map(service => (
                      <button
                    key={service}
                    type="button"
                    onClick={() => updateJobFormData('selectedCategory', service)}
                    className={`px-4 py-2 rounded-xl border transition-colors ${
                      selectedCategory === service
                        ? 'bg-primary text-black border-primary'
                        : 'border-gray-200 dark:border-gray-700 text-black/80 dark:text-white/80 hover:bg-primary/10'
                    }`}
                      >
                    {service}
                  </button>
                ))}
              </div>
              {jobErrors.category && <span className="text-red-500 text-sm mt-1">{jobErrors.category}</span>}
            </div>

            {/* Timing Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold">When do you need the service?</h3>
              <div className="flex flex-wrap gap-3">
                {timingOptions.map(timing => (
                      <button
                    key={timing}
                    type="button"
                    onClick={() => updateJobFormData('selectedTiming', timing)}
                    className={`px-4 py-2 rounded-xl border transition-colors ${
                      selectedTiming === timing
                        ? 'bg-primary text-black border-primary'
                        : 'border-gray-200 dark:border-gray-700 text-black/80 dark:text-white/80 hover:bg-primary/10'
                    }`}
                      >
                    {timing}
                  </button>
                ))}
              </div>
              {jobErrors.timing && <span className="text-red-500 text-sm mt-1">{jobErrors.timing}</span>}
            </div>

            {/* Calendar and Time Selection */}
            {selectedTiming === 'Schedule' && (
              <div className="grid sm:grid-cols-2 gap-6 items-start">
                {/* Calendar */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => updateJobFormData('selectedDate', date)}
                    minDate={today}
                    maxDate={maxDate}
                    inline
                    calendarClassName="w-full"
                      />
                </div>

                {/* Time Selection */}
                <div className="space-y-4">
                  <label className="text-lg font-bold">Select time</label>
                  <select
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:border-primary focus:ring-primary focus:ring-2"
                    defaultValue={jobFormData.time}
                    onChange={(e) => updateJobFormData('time', e.target.value)}
                    {...register('time')}
                      >
                    {timeSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                  {jobErrors.time && <span className="text-red-500 text-sm mt-1">{jobErrors.time}</span>}
                  <p className="text-sm text-black/60 dark:text-white/60">Surcharges may apply for scheduled times.</p>
                </div>
              </div>
            )}

            {/* Materials */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Materials </h3>
              <div className="flex flex-wrap gap-3">
                {materialsOptions.map(option => (
                      <button
                    key={option}
                    type="button"
                    onClick={() => updateJobFormData('selectedMaterials', option)}
                    className={`px-4 py-2 rounded-xl border transition-colors ${
                      selectedMaterials === option
                        ? 'bg-primary text-black border-primary'
                        : 'border-gray-200 dark:border-gray-700 text-black/80 dark:text-white/80 hover:bg-primary/10'
                    }`}
                      >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Site Visit */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Site Visit</h3>
              <div className="flex flex-wrap gap-3">
                {siteVisitOptions.map(option => (
                      <button
                    key={option}
                    type="button"
                    onClick={() => updateJobFormData('selectedSiteVisit', option)}
                    className={`px-4 py-2 rounded-xl border transition-colors ${
                      selectedSiteVisit === option
                        ? 'bg-primary text-black border-primary'
                        : 'border-gray-200 dark:border-gray-700 text-black/80 dark:text-white/80 hover:bg-primary/10'
                    }`}
                      >
                    {option}
                  </button>
                ))}
              </div>
              {jobErrors.siteVisit && <span className="text-red-500 text-sm mt-1">{jobErrors.siteVisit}</span>}
            </div>

            {/* Image Upload */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Upload Images</h3>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6">
                    <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                    />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                  <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                  <span className="font-medium">Click to upload photos</span>
                  <span className="text-sm">PNG, JPG up to 10MB each, 50MB total maximum</span>
                  <span className="text-xs text-gray-500">Used: {formatBytes(totalUploadSize)} / 50MB</span>
                </label>
              </div>

              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.url}
                        alt="Uploaded"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <label className="text-lg font-bold" htmlFor="notes">
                Notes
              </label>
              <textarea
                className={`w-full p-3 rounded-xl border bg-gray-50 dark:bg-gray-900 focus:border-primary focus:ring-primary focus:ring-2 placeholder:text-gray-500 dark:placeholder:text-gray-400 ${
                  jobErrors.notes ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                }`}
                id="notes"
                placeholder="Describe the issue in detail, e.g., 'Leaky pipe under the kitchen sink, water dripping constantly, started yesterday after using garbage disposal.'"
                rows="4"
                defaultValue={notes}
                onChange={(e) => updateJobFormData('notes', e.target.value)}
                {...register('notes')}
                  />
              {jobErrors.notes && <span className="text-red-500 text-sm">{jobErrors.notes}</span>}
            </div>

                {/* Primary Action Button */}
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={handleProceedToReview}
                    className="w-full bg-primary text-black font-bold text-lg py-4 px-6 rounded-xl hover:bg-opacity-80 transition-colors shadow-lg"
                  >
                    Proceed to Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobRequestForm;