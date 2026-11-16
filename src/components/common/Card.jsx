import React from 'react';

export default function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  highlight = false
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl border border-[#E6ECE8] p-4.5 transition-all duration-200
        ${highlight ? 'border-[#238B78]/50 ring-1 ring-[#238B78]/10' : 'shadow-xs'}
        ${hoverable ? 'hover:border-[#238B78]/40 hover:shadow-sm cursor-pointer active:scale-[0.99]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
