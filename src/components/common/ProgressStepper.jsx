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

    const baseClasses = "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-all duration-300";

    return `${baseClasses} ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}`;
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
    <div className="w-full max-w-3xl mx-auto py-6 px-4">
      {/* Desktop/Tablet View */}
      <div className="hidden sm:block">
        <div className="relative">
          {/* Background Progress Line */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 z-0">
            {/* Active Progress Line */}
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Steps Container */}
          <div className="relative z-10 flex justify-between items-start">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const status = getStepStatus(stepNumber);

              return (
                <div key={step.id} className="flex flex-col items-center max-w-[120px]">
                  {/* Step Circle */}
                  <div
                    className={`${getStepClasses(stepNumber)} relative z-10 border-2 transition-all duration-300 ${
                      status === 'completed'
                        ? 'border-primary bg-primary transform hover:scale-110'
                        : status === 'current'
                        ? 'border-primary bg-primary shadow-lg shadow-primary/30 animate-pulse'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                    onClick={() => handleStepClick(stepNumber)}
                    role={allowClickBack && stepNumber < currentStep ? "button" : undefined}
                    tabIndex={allowClickBack && stepNumber < currentStep ? 0 : -1}
                  >
                    {status === 'completed' ? (
                      <span className="material-symbols-outlined text-sm text-white">check</span>
                    ) : (
                      <span className={`text-sm font-bold ${
                        status === 'current'
                          ? 'text-white'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stepNumber}
                      </span>
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="mt-3 text-center">
                    <div className={`text-sm font-semibold transition-colors duration-200 ${
                      status === 'current'
                        ? 'text-primary'
                        : status === 'completed'
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {step.title}
                    </div>
                    {step.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile View */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Step {currentStep} of {steps.length}
          </h3>
          <div className="flex space-x-2">
            {steps.map((_, index) => {
              const stepNumber = index + 1;
              const status = getStepStatus(stepNumber);

              return (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    status === 'completed'
                      ? 'bg-primary scale-110'
                      : status === 'current'
                      ? 'bg-primary animate-pulse scale-125'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Current Step Info */}
        <div className="text-center mb-6">
          <div className="text-xl font-bold text-primary mb-2">
            {steps[currentStep - 1]?.title}
          </div>
          {steps[currentStep - 1]?.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {steps[currentStep - 1]?.description}
            </div>
          )}
        </div>

        {/* Enhanced Progress Bar */}
        <div className="relative">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-primary/80 h-full rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-pulse" />
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right mt-1">
            {Math.round((currentStep / steps.length) * 100)}% Complete
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressStepper;