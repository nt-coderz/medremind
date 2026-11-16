import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  icon: Icon,
  className = ''
}) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#238B78]/30 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none cursor-pointer";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-5 py-3 text-base gap-2.5"
  };

  const variantStyles = {
    primary: "bg-[#238B78] hover:bg-[#1b6d5e] text-white shadow-sm shadow-[#238B78]/25",
    secondary: "bg-[#DDEFE8] hover:bg-[#cbe5dc] text-[#1b6d5e] font-semibold",
    outline: "border border-[#E6ECE8] bg-white hover:bg-[#F8FAF8] text-[#202B28]",
    ghost: "text-[#7A8782] hover:text-[#202B28] hover:bg-[#E6ECE8]/40",
    danger: "bg-red-50 hover:bg-red-100 text-red-600 border border-red-100",
    success: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100"
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}
