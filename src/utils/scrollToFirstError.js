/**
 * scrollToFirstError
 *
 * After a form's validation fails, smooth-scroll the page to (and focus)
 * the first field in error so the user isn't left staring at an unchanged
 * screen wondering why "Continue" did nothing — especially on long, mobile
 * forms where the failing field is often off-screen.
 *
 * Resolution order for each errored field, top-to-bottom by `order`:
 *   1. a form control whose id or name === the error key (inputs/selects/
 *      textareas — these get focused so the user can type immediately);
 *   2. an explicit [data-field="<key>"] anchor (for non-input fields such
 *      as button/chip groups and radio cards that have no single control).
 * If none resolve (e.g. a field type we don't recognise), it falls back to
 * the first errored input / [data-error] element in DOM order.
 *
 * Only the currently mounted step is in the DOM (the multi-step forms render
 * one step at a time), so a document-wide lookup is safe and unambiguous.
 *
 * @param {Object} errors  - validation errors keyed by field name
 * @param {string[]} [order=[]] - field keys in visual (top-to-bottom) order;
 *                                when omitted, Object.keys(errors) is used.
 */
export const scrollToFirstError = (errors, order = []) => {
  if (!errors || Object.keys(errors).length === 0) return;

  const keys = order.length
    ? order.filter((key) => errors[key])
    : Object.keys(errors);

  const reveal = (el, focusable) => {
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (focusable && typeof el.focus === 'function') {
      // preventScroll: scrollIntoView already positioned it; avoid a jump.
      try {
        el.focus({ preventScroll: true });
      } catch (_) {
        el.focus();
      }
    }
    return true;
  };

  // Defer to the next frame so the error styles/anchors have been committed
  // to the DOM by React before we query for them.
  const run = () => {
    for (const key of keys) {
      const control =
        document.getElementById(key) ||
        document.querySelector(`[name="${key}"]`);
      if (reveal(control, true)) return;

      const anchor = document.querySelector(`[data-field="${key}"]`);
      if (reveal(anchor, false)) return;
    }
    // Fallback: first errored control / explicitly marked error in the DOM.
    reveal(document.querySelector('.border-red-500, [data-error="true"]'), false);
  };

  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(run);
  } else {
    run();
  }
};

export default scrollToFirstError;
