import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { registerOpenModal } from '../../utils/modalRegistry';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  const modalId = useId();

  useEffect(() => {
    if (!isOpen) return;

    // Register with Android hardware back-button handler stack
    const unregister = registerOpenModal(modalId, onClose);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unregister();
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, modalId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      <div className={`
        relative w-full ${maxWidth} bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-[#E6ECE8]
        max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 z-10
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6ECE8]">
          <h3 className="font-semibold text-lg text-[#202B28]">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#7A8782] hover:bg-[#F8FAF8] hover:text-[#202B28] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
