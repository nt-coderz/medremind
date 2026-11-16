import React from 'react';

export default function Input({
  label,
  error,
  helperText,
  icon: Icon,
  id,
  className = '',
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
          {label}
        </label>
      )}
      
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7A8782]">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full rounded-xl bg-white border border-[#E6ECE8] px-3.5 py-2.5 text-sm text-[#202B28] placeholder-[#7A8782]/60
            transition-all duration-150 focus:outline-none focus:border-[#238B78] focus:ring-2 focus:ring-[#238B78]/15
            disabled:bg-gray-50 disabled:text-gray-400
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}
          `}
          {...props}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-[#7A8782]">{helperText}</p>
      )}
    </div>
  );
}
