import React from 'react';
import '../../theme/index.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'glass' | 'solid';
  glowColor?: 'frustrated' | 'happy' | 'dejected' | 'neutral';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  variant = 'glass', 
  glowColor,
  style, 
  ...props 
}) => {
  const baseStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    backgroundColor: variant === 'glass' ? 'var(--bg-panel)' : 'var(--bg-panel-solid)',
    backdropFilter: variant === 'glass' ? 'blur(16px)' : 'none',
    WebkitBackdropFilter: variant === 'glass' ? 'blur(16px)' : 'none',
    border: '1px solid var(--border-subtle)',
    boxShadow: glowColor ? `0 8px 32px var(--mood-${glowColor}-glow)` : '0 4px 24px rgba(0,0,0,0.2)',
    transition: 'var(--transition-smooth)',
  };

  return (
    <div style={{ ...baseStyle, ...style }} {...props}>
      {children}
    </div>
  );
};
