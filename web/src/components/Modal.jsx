import { useEffect, useId, useRef } from 'react';

// Native <dialog>: focus trapping and Escape-to-close come from the browser.
export default function Modal({ open, title, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('.modal-body :is(input, select, textarea):not([disabled])')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <>
          <div className="modal-head">
            <h2 id={titleId} className="h3">{title}</h2>
            <button type="button" className="btn btn-quiet btn-small" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
