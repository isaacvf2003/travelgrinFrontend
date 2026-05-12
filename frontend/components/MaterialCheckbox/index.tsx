import { useState } from 'react';

// Checkbox rounded simple Material Design
const RoundedCheckbox = ({ 
  id, 
  label, 
  checked = false, 
  onChange,
  disabled = false,
  size = "md" // sm, md, lg
}: any) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5", 
    lg: "w-6 h-6"
  };

  const iconSizes = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4"
  };

  const handleChange = (e: any) => {
    if (onChange) {
      onChange(e);
    }
  };

  const handleLabelClick = () => {
    if (!disabled) {
      const syntheticEvent = {
        target: {
          checked: !checked,
          value: !checked
        }
      };
      handleChange(syntheticEvent);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${id === "intermediario" ? "-ml-[22px] sm:-ml-[0px]":" "}`}>
      <div className="relative">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          onClick={handleLabelClick}
          className={`relative flex items-center justify-center ${sizeClasses[size]} rounded-full cursor-pointer transition-all duration-300 transform hover:scale-110 active:scale-95  ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : ''
          }`}
          style={{
            background: checked 
              ? disabled 
                ? '#d1d5db' 
                : 'linear-gradient(135deg, #08D9BD 0%, #04B5BD 50%, #009ABC 100%)'
              : 'transparent',
            boxShadow: checked && !disabled
              ? '0 8px 25px -8px rgba(8, 217, 189, 0.4), 0 4px 12px -4px rgba(4, 181, 189, 0.3), 0 2px 8px -3px rgba(0, 154, 188, 0.2)'
              : disabled
                ? 'none'
                : '0 4px 15px -4px rgba(156, 163, 175, 0.2), inset 0 2px 4px rgba(156, 163, 175, 0.1)',
            border: checked 
              ? 'none' 
              : disabled 
                ? '2px solid #d1d5db'
                : '2px solid #9ca3af',
            filter: checked && !disabled 
              ? 'drop-shadow(0 4px 12px rgba(8, 217, 189, 0.25))' 
              : 'none'
          }}
        >
          {/* Efecto de onda al hacer clic */}
          <div 
            className={`absolute inset-0 rounded-full transition-all duration-300 ${
              checked && !disabled 
                ? 'bg-white opacity-20 scale-0 animate-ping' 
                : ''
            }`}
          />
          
          {/* Checkmark animado */}
          <svg
            className={`${iconSizes[size]} text-white transition-all duration-300 ease-out transform ${
              checked 
                ? 'opacity-100 scale-100 rotate-0' 
                : 'opacity-0 scale-50 rotate-45'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
              style={{
                strokeDasharray: '20',
                strokeDashoffset: checked ? '0' : '20',
                transition: 'stroke-dashoffset 0.3s ease'
              }}
            />
          </svg>
          
          {/* Brillo interno */}
          {checked && !disabled && (
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
                transform: 'rotate(-45deg)'
              }}
            />
          )}
        </div>
      </div>
      
      {label && (
        <span
          onClick={handleLabelClick}
          className={`text-sm font-medium cursor-pointer select-none transition-colors duration-200 ${
            disabled 
              ? 'text-gray-400 cursor-not-allowed' 
              : checked
                ? 'text-gray-800'
                : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export { RoundedCheckbox };