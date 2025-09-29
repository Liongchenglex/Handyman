import React from 'react';

/**
 * ProgressStepper Component
 *
 * An interactive stepper component that shows progress through multi-step forms
 *
 * @param {number} currentStep - Current active step (1-based)
 * @param {Array} steps - Array of step objects with { id, title, description }
 * @param {function} onStepClick - Callback when a completed step is clicked (optional)
 * @param {boolean} allowClickBack - Whether clicking previous steps is allowed
 */
const ProgressStepper = ({
  currentStep,
  steps,
  onStepClick = null,
  allowClickBack = false
}) => {
  const handleStepClick = (stepNumber) => {
    // Only allow clicking on completed steps or current step if allowClickBack is true
    if (allowClickBack && stepNumber < currentStep && onStepClick) {
      onStepClick(stepNumber);
    }
  };

  const getStepStatus = (stepNumber) => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepClasses = (stepNumber) => {
    const status = getStepStatus(stepNumber);
    const isClickable = allowClickBack && stepNumber < currentStep && onStepClick;

    const baseClasses = "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-200";

    switch (status) {
      case 'completed':
        return `${baseClasses} bg-primary text-background-dark ${isClickable ? 'cursor-pointer hover:bg-primary/90' : ''}`;
      case 'current':
        return `${baseClasses} bg-primary text-background-dark ring-4 ring-primary/20`;
      case 'upcoming':
        return `${baseClasses} bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400`;
      default:
        return baseClasses;
    }
  };

  const getConnectorClasses = (stepNumber) => {
    const isCompleted = stepNumber < currentStep;
    return `h-1 rounded transition-all duration-200 ${
      isCompleted
        ? 'bg-primary'
        : 'bg-gray-200 dark:bg-gray-700'
    }`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4">
      {/* Desktop/Tablet View */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-4 gap-4 items-start">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const status = getStepStatus(stepNumber);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="relative flex flex-col items-center">
                {/* Step Circle */}
                <div
                  className={getStepClasses(stepNumber)}
                  onClick={() => handleStepClick(stepNumber)}
                  role={allowClickBack && stepNumber < currentStep ? "button" : undefined}
                  tabIndex={allowClickBack && stepNumber < currentStep ? 0 : -1}
                >
                  {status === 'completed' ? (
                    <span className="material-symbols-outlined text-sm">check</span>
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <div className={`text-sm font-medium ${
                    status === 'current'
                      ? 'text-primary'
                      : status === 'completed'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {step.description}
                    </div>
                  )}
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="absolute top-4 left-full w-full h-1 -translate-y-1/2">
                    <div className={`w-full ${getConnectorClasses(stepNumber)}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile View */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Step {currentStep} of {steps.length}
          </h3>
          <div className="flex space-x-1">
            {steps.map((_, index) => {
              const stepNumber = index + 1;
              const status = getStepStatus(stepNumber);

              return (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    status === 'completed' || status === 'current'
                      ? 'bg-primary'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Current Step Info */}
        <div className="text-center">
          <div className="text-xl font-bold text-primary mb-1">
            {steps[currentStep - 1]?.title}
          </div>
          {steps[currentStep - 1]?.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {steps[currentStep - 1]?.description}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProgressStepper;