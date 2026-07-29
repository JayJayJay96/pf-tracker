'use client';

import { useState } from 'react';

/**
 * Two-step submit for an irreversible action.
 *
 * Replaces the previous `<details><summary>` disclosure, where the confirmation
 * question was the summary text and the confirming button looked like every
 * other button on the page. Arming the action is deliberate, the consequence is
 * announced, and cancelling is always offered.
 */
export function ConfirmSubmit({
  label,
  confirmLabel,
  description,
}: {
  /** Text of the resting button, e.g. "Delete Nasi lemak". */
  label: string;
  /** Text of the button that actually submits, e.g. "Yes, delete permanently". */
  confirmLabel: string;
  /** What happens if the person continues. Announced when armed. */
  description: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        className="danger-button"
        type="button"
        onClick={() => setArmed(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="confirm-group" role="group" aria-label={label}>
      <span className="confirm-description" role="alert">{description}</span>
      <span className="confirm-actions">
        <button className="danger-button" type="submit">{confirmLabel}</button>
        <button className="ghost-button" type="button" onClick={() => setArmed(false)}>
          Cancel
        </button>
      </span>
    </span>
  );
}
