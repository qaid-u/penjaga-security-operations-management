import React, { forwardRef } from 'react';

export const Input = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md text-sm shadow-sm placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white
          ${error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-slate-700'}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export const Select = forwardRef(({ label, error, children, className = '', ...props }, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md text-sm shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white
          ${error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-slate-700'}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export const Textarea = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md text-sm shadow-sm placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white min-h-[100px]
          ${error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-slate-700'}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
