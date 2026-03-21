import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  const errId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="field-hint muted">{hint}</p> : null}
      {error ? (
        <p className="field-error" id={errId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
