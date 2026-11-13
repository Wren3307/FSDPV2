/** Labelled form field with an error message wired up for screen readers. */
export function Field({ name, label, error, optional, hint, children }) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={name}>{label}{optional && <span className="optional"> (optional)</span>}</label>
      {hint && <p className="field-hint" id={`${name}-hint`}>{hint}</p>}
      {children}
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </div>
  );
}

/** Props for an input inside <Field>: id, name, and the aria wiring for its error and hint. */
export function fieldProps(name, errors, { hint = false } = {}) {
  const described = [hint && `${name}-hint`, errors[name] && `${name}-error`].filter(Boolean).join(' ');
  return {
    id: name,
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': described || undefined,
  };
}

/** Moves focus to the first field with an error, so keyboard and screen reader users land on it. */
export function focusFirstError(errors) {
  const first = Object.keys(errors ?? {})[0];
  if (first) document.getElementById(first)?.focus();
}

export function Notice({ children, tone = 'error' }) {
  return <p className={tone === 'error' ? 'notice' : 'notice notice-ok'} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}
