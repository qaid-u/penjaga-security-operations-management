import { forwardRef } from 'react';

export const Input = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-secondary-token mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`app-input w-full px-3 py-2 border rounded-md text-sm shadow-sm ${error ? 'status-error' : ''}`}
        {...props}
      />
      {error && (
        <p className="status-error mt-1 rounded-md border px-2 py-1 text-sm">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export const Select = forwardRef(({ label, error, children, className = '', ...props }, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-secondary-token mb-1.5">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`app-input w-full px-3 py-2 border rounded-md text-sm shadow-sm ${error ? 'status-error' : ''}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="status-error mt-1 rounded-md border px-2 py-1 text-sm">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export const Textarea = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-secondary-token mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`app-input w-full px-3 py-2 border rounded-md text-sm shadow-sm min-h-[100px] ${error ? 'status-error' : ''}`}
        {...props}
      />
      {error && (
        <p className="status-error mt-1 rounded-md border px-2 py-1 text-sm">{error}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
