import React, { useState } from 'react';

/**
 * UserMenu
 *
 * The shared account-dropdown shell used by both the public Header and the
 * HandymanHeader. It owns the open/close state, renders the toggle button, a
 * full-screen backdrop that closes the menu on any outside click, and an
 * absolutely-positioned panel.
 *
 * The trigger content and the panel body are supplied by the caller so each
 * header can keep its own contents while the interaction/markup lives here.
 *
 * @param {object} props
 * @param {React.ReactNode} props.trigger            Content inside the toggle button.
 * @param {string}          [props.triggerClassName] Classes for the toggle button.
 * @param {string}          [props.panelClassName='w-56'] Extra classes (e.g. width) for the panel.
 * @param {(close: () => void) => React.ReactNode} props.children
 *        Render-prop for the panel body. Receives a `close` callback so menu
 *        items can dismiss the menu when activated.
 */
const UserMenu = ({ trigger, triggerClassName = '', panelClassName = 'w-56', children }) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open && (
        <>
          {/* Backdrop — closes the menu on any outside click/tap */}
          <div className="fixed inset-0 z-10" onClick={close} />
          {/* Panel */}
          <div
            className={`absolute right-0 mt-2 ${panelClassName} bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-20`}
          >
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;
