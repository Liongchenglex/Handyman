import React from 'react';
import ProgressStepper from './ProgressStepper';

/**
 * FixedStepperContainer Component
 *
 * A wrapper component that provides a fixed-position container for the ProgressStepper
 * to ensure consistent placement across all form steps and provide a uniform experience.
 *
 * @param {number} currentStep - Current active step (1-based)
 * @param {Array} steps - Array of step objects with { id, title, description }
 * @param {function} onStepClick - Callback when a completed step is clicked (optional)
 * @param {boolean} allowClickBack - Whether clicking previous steps is allowed
 * @param {string} className - Additional CSS classes for the container
 */
const FixedStepperContainer = ({
  currentStep,
  steps,
  onStepClick = null,
  allowClickBack = false,
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Fixed Stepper Container */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-md backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
        <div className="max-w-4xl mx-auto px-4">
          <ProgressStepper
            currentStep={currentStep}
            steps={steps}
            onStepClick={onStepClick}
            allowClickBack={allowClickBack}
          />
        </div>
      </div>
    </div>
  );
};

export default FixedStepperContainer;