import React, { useEffect } from 'react';

/**
 * Modal
 *
 * Accessible, mobile-first modal dialog built entirely with Tailwind
 * utilities (no dependency on legacy global CSS).
 *
 * Layout strategy:
 *  - The overlay is a full-screen flex container. Content is centered on
 *    larger screens and pinned to the bottom on phones, where a sheet-style
 *    presentation is easier to reach with a thumb.
 *  - The panel is width-capped per `size` but always `w-full` first, so it
 *    fills small screens and never overflows horizontally.
 *  - `max-h-[90vh]` + `overflow-y-auto` keeps tall content scrollable
 *    instead of pushing the close button off-screen.
 *
 * Props:
 *  - isOpen   {boolean}  Controls visibility.
 *  - onClose  {Function} Called on overlay click, close button, or Escape.
 *  - title    {string}   Heading shown in the modal header.
 *  - children {ReactNode} Modal body content.
 *  - size     {'small'|'medium'|'large'} Max width of the panel.
 */
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  // Lock background scroll while the modal is open, and close on Escape.
  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Width caps per size. Base width is always full so the panel adapts to
  // narrow screens; the cap only kicks in once there is room.
  const sizeClass = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
  }[size] || 'max-w-2xl';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`bg-white dark:bg-gray-800 w-full ${sizeClass} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header — sticky so the close button stays reachable while scrolling */}
        <div className="sticky top-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex-shrink-0 flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
