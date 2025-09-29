import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createHandymanProfile } from '../../services/api/handymen';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

const HandymanRegistration = ({ onRegistrationComplete }) => {
  const { user, login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm();

  const serviceTypes = [
    'Plumbing',
    'Electrical',
    'Carpentry',
    'Painting',
    'Air-con Servicing',
    'General Repairs',
    'Cleaning',
    'Moving/Delivery'
  ];

  const experienceLevels = [
    { value: 'beginner', label: 'Beginner (0-2 years)' },
    { value: 'intermediate', label: 'Intermediate (2-5 years)' },
    { value: 'experienced', label: 'Experienced (5-10 years)' },
    { value: 'expert', label: 'Expert (10+ years)' }
  ];

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      let currentUser = user;
      
      // If not authenticated, create anonymous account
      if (!currentUser) {
        currentUser = await login({
          phone: data.phone,
          name: data.name
        });
      }

      const handymanData = {
        ...data,
        userId: currentUser.uid,
        isAvailable: true,
        rating: 0,
        completedJobs: 0,
        createdAt: new Date(),
        serviceTypes: data.serviceTypes || [],
        hourlyRates: data.hourlyRates ? JSON.parse(data.hourlyRates) : {}
      };
      
      await createHandymanProfile(handymanData);
      onRegistrationComplete(handymanData);
    } catch (error) {
      console.error('Error creating handyman profile:', error);
      alert('Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="handyman-registration">
      <div className="registration-header">
        <h2>Become a Handyman</h2>
        <div className="progress-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Personal Info</span>
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Skills & Experience</span>
          </div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Preferences</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="registration-form">
        {currentStep === 1 && (
          <div className="form-step">
            <h3>Personal Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <span className="error">{errors.name.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                placeholder="+65 XXXX XXXX"
                {...register('phone', { 
                  required: 'Phone number is required',
                  pattern: {
                    value: /^(\+65)?[689]\d{7}$/,
                    message: 'Please enter a valid Singapore phone number'
                  }
                })}
              />
              {errors.phone && <span className="error">{errors.phone.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                {...register('email', {
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Please enter a valid email address'
                  }
                })}
              />
              {errors.email && <span className="error">{errors.email.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="location">Service Area *</label>
              <input
                type="text"
                id="location"
                placeholder="Areas you can serve (e.g., Central, East Singapore)"
                {...register('serviceArea', { required: 'Service area is required' })}
              />
              {errors.serviceArea && <span className="error">{errors.serviceArea.message}</span>}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="form-step">
            <h3>Skills & Experience</h3>
            
            <div className="form-group">
              <label>Services You Offer *</label>
              <div className="checkbox-group">
                {serviceTypes.map(service => (
                  <label key={service} className="checkbox-label">
                    <input
                      type="checkbox"
                      value={service}
                      {...register('serviceTypes', { 
                        required: 'Please select at least one service' 
                      })}
                    />
                    {service}
                  </label>
                ))}
              </div>
              {errors.serviceTypes && <span className="error">{errors.serviceTypes.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="experience">Experience Level *</label>
              <select
                id="experience"
                {...register('experienceLevel', { required: 'Experience level is required' })}
              >
                <option value="">Select your experience level</option>
                {experienceLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              {errors.experienceLevel && <span className="error">{errors.experienceLevel.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">About You</label>
              <textarea
                id="description"
                rows="4"
                placeholder="Tell customers about your experience and skills..."
                {...register('description')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="hourlyRate">Standard Hourly Rate (SGD)</label>
              <input
                type="number"
                id="hourlyRate"
                min="0"
                step="0.01"
                placeholder="Your standard hourly rate"
                {...register('hourlyRate')}
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="form-step">
            <h3>Work Preferences</h3>
            
            <div className="form-group">
              <label>Preferred Working Hours</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    value="morning"
                    {...register('preferredHours')}
                  />
                  Morning (9AM - 12PM)
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    value="afternoon"
                    {...register('preferredHours')}
                  />
                  Afternoon (12PM - 6PM)
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    value="evening"
                    {...register('preferredHours')}
                  />
                  Evening (6PM - 9PM)
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    value="weekend"
                    {...register('preferredHours')}
                  />
                  Weekends
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="maxJobsPerDay">Maximum Jobs Per Day</label>
              <select id="maxJobsPerDay" {...register('maxJobsPerDay')}>
                <option value="">No limit</option>
                <option value="1">1 job</option>
                <option value="2">2 jobs</option>
                <option value="3">3 jobs</option>
                <option value="5">5 jobs</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  {...register('acceptWhatsAppNotifications')}
                />
                I want to receive WhatsApp notifications for new jobs
              </label>
            </div>

            <div className="terms-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  {...register('acceptTerms', { 
                    required: 'You must accept the terms and conditions' 
                  })}
                />
                I agree to the Terms of Service and Privacy Policy
              </label>
              {errors.acceptTerms && <span className="error">{errors.acceptTerms.message}</span>}
            </div>
          </div>
        )}

        <div className="form-navigation">
          {currentStep > 1 && (
            <button type="button" onClick={prevStep} className="btn-secondary">
              Previous
            </button>
          )}
          
          {currentStep < 3 ? (
            <button type="button" onClick={nextStep} className="btn-primary">
              Next
            </button>
          ) : (
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoadingSpinner size="small" /> : 'Complete Registration'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default HandymanRegistration;