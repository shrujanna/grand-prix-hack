import React from 'react';
import '../../theme/index.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  style,
  disabled,
  ...props 
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--accent-f1)',
          color: '#fff',
          border: '1px solid var(--accent-f1)',
          boxShadow: '0 0 15px rgba(225, 6, 0, 0.4)',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--bg-glass)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-glow)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'var(--transition-fast)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    ...getVariantStyles(),
    ...style
  };

  return (
    <button 
      style={baseStyle}
      disabled={disabled}
      onMouseOver={(e) => {
        if (!disabled && variant !== 'primary') e.currentTarget.style.color = '#fff';
        if (!disabled && variant === 'ghost') e.currentTarget.style.backgroundColor = 'var(--bg-glass)';
      }}
      onMouseOut={(e) => {
        if (!disabled && variant !== 'primary') e.currentTarget.style.color = getVariantStyles().color as string;
        if (!disabled && variant === 'ghost') e.currentTarget.style.backgroundColor = 'transparent';
      }}
      {...props}
    >
      {children}
    </button>
  );
};
