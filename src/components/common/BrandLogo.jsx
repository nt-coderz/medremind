import React from 'react';

export default function BrandLogo({ size = 'md', showTagline = false, className = '' }) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* MedRemind Emblem: Custom App Icon */}
      <div className={`${iconSizes[size]} bg-[#142822] rounded-2xl flex items-center justify-center text-white shadow-sm shadow-[#238B78]/20 flex-shrink-0 relative overflow-hidden`}>
        <img 
          src="/app-icon.png" 
          alt="MedRemind Logo" 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div>
        <div className={`font-bold tracking-tight text-[#202B28] leading-none ${textSizes[size]}`}>
          Med<span className="text-[#238B78]">Remind</span>
        </div>
        {showTagline && (
          <p className="text-xs text-[#7A8782] font-normal mt-1 tracking-normal">
            Your health routine, thoughtfully managed.
          </p>
        )}
      </div>
    </div>
  );
}
