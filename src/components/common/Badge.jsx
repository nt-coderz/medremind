import React from 'react';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon: Icon,
  className = ''
}) {
  const variantStyles = {
    primary: "bg-[#DDEFE8] text-[#1b6d5e] border border-[#238B78]/20",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    warning: "bg-amber-50 text-amber-700 border border-amber-200/60",
    danger: "bg-red-50 text-red-700 border border-red-200/60",
    neutral: "bg-gray-100 text-gray-700 border border-gray-200"
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] font-medium gap-1",
    md: "px-2.5 py-1 text-xs font-medium gap-1.5"
  };

  return (
    <span className={`inline-flex items-center rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}
