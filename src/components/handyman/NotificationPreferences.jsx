import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { updateHandymanNotifications, getHandymanProfile } from '../../services/api/handymen';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

const NotificationPreferences = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  
  const { register, handleSubmit, reset, watch } = useForm();

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

  const budgetRanges = [
    { value: '0-50', label: 'Under $50' },
    { value: '50-100', label: '$50 - $100' },
    { value: '100-200', label: '$100 - $200' },
    { value: '200-500', label: '$200 - $500' },
    { value: '500-999999', label: 'Above $500' }
  ];

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const handymanProfile = await getHandymanProfile(user.uid);
        setProfile(handymanProfile);
        
        // Reset form with current settings
        reset({
          whatsappNotifications: handymanProfile.notificationPreferences?.whatsappNotifications ?? true,
          emailNotifications: handymanProfile.notificationPreferences?.emailNotifications ?? false,
          serviceTypeNotifications: handymanProfile.notificationPreferences?.serviceTypes || [],
          budgetRangeNotifications: handymanProfile.notificationPreferences?.budgetRanges || [],
          locationNotifications: handymanProfile.notificationPreferences?.locations || '',
          instantNotifications: handymanProfile.notificationPreferences?.instantNotifications ?? true,
          dailySummary: handymanProfile.notificationPreferences?.dailySummary ?? false,
          weeklyReport: handymanProfile.notificationPreferences?.weeklyReport ?? false
        });
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user, reset]);

  const onSubmit = async (data) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const notificationPreferences = {
        whatsappNotifications: data.whatsappNotifications,
        emailNotifications: data.emailNotifications,
        serviceTypes: data.serviceTypeNotifications || [],
        budgetRanges: data.budgetRangeNotifications || [],
        locations: data.locationNotifications,
        instantNotifications: data.instantNotifications,
        dailySummary: data.dailySummary,
        weeklyReport: data.weeklyReport,
        updatedAt: new Date()
      };

      await updateHandymanNotifications(user.uid, notificationPreferences);
      alert('Notification preferences updated successfully!');
    } catch (error) {
      console.error('Error updating preferences:', error);
      alert('Failed to update preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const watchWhatsApp = watch('whatsappNotifications');
  const watchEmail = watch('emailNotifications');

  if (isLoading) {
    return <LoadingSpinner message="Loading your preferences..." />;
  }

  if (!profile) {
    return (
      <div className="error-container">
        <p>Please complete your handyman registration first.</p>
      </div>
    );
  }

  return (
    <div className="notification-preferences">
      <div className="preferences-header">
        <h2>Notification Preferences</h2>
        <p>Customize how you want to be notified about new job opportunities</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="preferences-form">
        <div className="preference-section">
          <h3>Notification Methods</h3>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('whatsappNotifications')}
              />
              <span className="checkmark"></span>
              WhatsApp Notifications
              <small>Get instant notifications via WhatsApp when new jobs match your preferences</small>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('emailNotifications')}
              />
              <span className="checkmark"></span>
              Email Notifications
              <small>Receive email alerts for job opportunities</small>
            </label>
          </div>
        </div>

        <div className="preference-section">
          <h3>Job Filters</h3>
          <p>Only get notified for jobs that match these criteria:</p>
          
          <div className="form-group">
            <label>Service Types</label>
            <div className="checkbox-grid">
              {serviceTypes.map(service => (
                <label key={service} className="checkbox-label small">
                  <input
                    type="checkbox"
                    value={service}
                    {...register('serviceTypeNotifications')}
                  />
                  <span className="checkmark"></span>
                  {service}
                </label>
              ))}
            </div>
            <small>Leave empty to get notifications for all service types</small>
          </div>

          <div className="form-group">
            <label>Budget Ranges</label>
            <div className="checkbox-grid">
              {budgetRanges.map(range => (
                <label key={range.value} className="checkbox-label small">
                  <input
                    type="checkbox"
                    value={range.value}
                    {...register('budgetRangeNotifications')}
                  />
                  <span className="checkmark"></span>
                  {range.label}
                </label>
              ))}
            </div>
            <small>Leave empty to get notifications for all budget ranges</small>
          </div>

          <div className="form-group">
            <label htmlFor="locationNotifications">Preferred Locations</label>
            <input
              type="text"
              id="locationNotifications"
              placeholder="e.g., Central, Orchard, Tampines (comma-separated)"
              {...register('locationNotifications')}
            />
            <small>Leave empty to get notifications for all locations</small>
          </div>
        </div>

        <div className="preference-section">
          <h3>Notification Frequency</h3>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('instantNotifications')}
                disabled={!watchWhatsApp && !watchEmail}
              />
              <span className="checkmark"></span>
              Instant Notifications
              <small>Get notified immediately when matching jobs are posted</small>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('dailySummary')}
                disabled={!watchEmail}
              />
              <span className="checkmark"></span>
              Daily Summary (Email only)
              <small>Receive a daily email with all matching jobs posted that day</small>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register('weeklyReport')}
                disabled={!watchEmail}
              />
              <span className="checkmark"></span>
              Weekly Report (Email only)
              <small>Get a weekly summary of your job activity and platform updates</small>
            </label>
          </div>
        </div>

        <div className="notification-preview">
          <h4>Preview</h4>
          <div className="preview-content">
            {watchWhatsApp || watchEmail ? (
              <p>
                ✅ You will receive notifications via{' '}
                {watchWhatsApp && watchEmail ? 'WhatsApp and Email' : 
                 watchWhatsApp ? 'WhatsApp' : 'Email'}
                {' '}for matching job opportunities.
              </p>
            ) : (
              <p>⚠️ You won't receive any notifications. Enable at least one notification method.</p>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isSaving}
          >
            {isSaving ? <LoadingSpinner size="small" /> : 'Save Preferences'}
          </button>
          
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => reset()}
          >
            Reset to Default
          </button>
        </div>
      </form>

      <div className="preferences-info">
        <h4>Important Notes</h4>
        <ul>
          <li>WhatsApp notifications are sent to: <strong>{profile.phone}</strong></li>
          <li>Email notifications are sent to: <strong>{profile.email || 'No email provided'}</strong></li>
          <li>You can update these preferences anytime</li>
          <li>Instant notifications may be delayed during high traffic periods</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationPreferences;