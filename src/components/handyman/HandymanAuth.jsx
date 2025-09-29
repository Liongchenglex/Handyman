import React, { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * HandymanAuth Component
 *
 * Unified login/signup screen for handymen with toggle between modes
 * Follows the established design patterns from customer flow
 *
 * @param {Function} onLoginSuccess - Callback when login is successful
 * @param {Function} onSignupSuccess - Callback when signup is successful (redirects to registration)
 * @param {Function} onBackToHome - Callback to return to home page
 */
const HandymanAuth = ({
  onLoginSuccess,
  onSignupSuccess,
  onBackToHome
}) => {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  // Validation functions
  const validateLoginData = (data) => {
    const errors = {};

    if (!data.email || data.email.trim() === '') {
      errors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(data.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!data.password || data.password.trim() === '') {
      errors.password = 'Password is required';
    } else if (data.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    return errors;
  };

  const validateSignupData = (data) => {
    const errors = validateLoginData(data);

    if (!data.confirmPassword || data.confirmPassword.trim() === '') {
      errors.confirmPassword = 'Please confirm your password';
    } else if (data.password !== data.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const validationErrors = authMode === 'login'
      ? validateLoginData(formData)
      : validateSignupData(formData);

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      try {
        if (authMode === 'login') {
          // Simulate login API call
          setTimeout(() => {
            console.log('Login successful:', formData.email);
            if (onLoginSuccess) {
              onLoginSuccess({
                email: formData.email,
                handymanId: 'hm_' + Date.now(),
                isAuthenticated: true
              });
            }
            setIsSubmitting(false);
          }, 1500);
        } else {
          // Simulate signup API call
          setTimeout(() => {
            console.log('Signup successful:', formData.email);
            if (onSignupSuccess) {
              onSignupSuccess({
                email: formData.email,
                tempUserId: 'temp_' + Date.now()
              });
            }
            setIsSubmitting(false);
          }, 1500);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setErrors({ general: 'Authentication failed. Please try again.' });
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(false);
    }
  };

  // Toggle between login and signup modes
  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
    setErrors({});
    setFormData({
      email: formData.email, // Keep email when switching
      password: '',
      confirmPassword: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md mx-auto pt-16 px-4">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Handyman {authMode === 'login' ? 'Login' : 'Sign Up'}
            </h1>
          </div>
        </div>

        {/* Auth Card Container */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            {/* Welcome Message */}
            <div className="mb-8 text-center">
              <div className="mb-6 flex justify-center">
                <div className="bg-primary/20 dark:bg-primary/30 rounded-full p-4">
                  <span className="material-symbols-outlined text-primary text-3xl">
                    handyman
                  </span>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {authMode === 'login'
                  ? 'Welcome back!'
                  : 'Join our handyman network'
                }
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {authMode === 'login'
                  ? 'Sign in to access your dashboard and manage jobs'
                  : 'Create an account to start accepting jobs and grow your business'
                }
              </p>
            </div>

            {/* General Error Message */}
            {errors.general && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="email">
                  Email Address
                </label>
                <input
                  className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                    errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                  id="email"
                  type="email"
                  placeholder="e.g., john.smith@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={isSubmitting}
                />
                {errors.email && <span className="text-red-500 text-sm mt-1">{errors.email}</span>}
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="password">
                  Password
                </label>
                <input
                  className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                    errors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isSubmitting}
                />
                {errors.password && <span className="text-red-500 text-sm mt-1">{errors.password}</span>}
              </div>

              {/* Confirm Password Field (Signup only) */}
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    className={`w-full h-12 bg-gray-50 dark:bg-gray-900 border rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-shadow ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    disabled={isSubmitting}
                  />
                  {errors.confirmPassword && <span className="text-red-500 text-sm mt-1">{errors.confirmPassword}</span>}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 flex items-center justify-center bg-primary text-gray-900 font-bold text-lg rounded-xl shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    authMode === 'login' ? 'Sign In' : 'Create Account'
                  )}
                </button>
              </div>
            </form>

            {/* Mode Toggle */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {authMode === 'login'
                  ? "Don't have an account yet?"
                  : "Already have an account?"
                }
              </p>
              <button
                type="button"
                onClick={toggleAuthMode}
                disabled={isSubmitting}
                className="mt-2 text-primary hover:text-primary/80 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {authMode === 'login'
                  ? 'Sign up as a handyman'
                  : 'Sign in to your account'
                }
              </button>
            </div>

            {/* Additional Info for Signup */}
            {authMode === 'signup' && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">
                    info
                  </span>
                  <div className="text-left">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      What happens next?
                    </h3>
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                      After creating your account, you'll complete your handyman profile with skills, experience, and service areas.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandymanAuth;