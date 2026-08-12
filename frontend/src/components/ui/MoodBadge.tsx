import React from 'react';
import '../../theme/index.css';

interface MoodBadgeProps {
  mood: 'frustrated' | 'happy' | 'dejected' | 'neutral' | 'error';
  intensity?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export const MoodBadge: React.FC<MoodBadgeProps> = ({ mood, intensity, size = 'md' }) => {
  // If intensity is 5, it gets a brighter glow and a thicker border
  const glowOpacity = intensity ? 0.1 + (intensity * 0.05) : 0.2;
  const safeMood = mood === 'error' ? 'neutral' : mood; // Fallback for UI if error
  const colorVar = mood === 'error' ? 'var(--text-muted)' : `var(--mood-${safeMood})`;
  
  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '0.75rem' },
    md: { padding: '4px 12px', fontSize: '0.875rem' },
    lg: { padding: '6px 16px', fontSize: '1rem', fontWeight: 600 }
  };
  const symbol = mood === 'frustrated' ? '!' : mood === 'dejected' ? '↓' : mood === 'happy' ? '↑' : mood === 'neutral' ? '•' : '×';

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: mood === 'error' ? 'rgba(255,255,255,0.05)' : `color-mix(in srgb, ${colorVar} ${glowOpacity * 100}%, transparent)`,
    border: `1px solid ${mood === 'error' ? 'var(--border-subtle)' : colorVar}`,
    color: colorVar,
    borderRadius: 'var(--radius-full)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
    ...sizeStyles[size]
  };

  return (
    <div style={style}>
      <span aria-hidden="true" style={{ fontWeight: 700, minWidth: '0.6rem', textAlign: 'center' }}>{symbol}</span>
      {mood === 'error' ? 'ERROR' : mood}
      {intensity && <span style={{ opacity: 0.7, marginLeft: '4px' }}>LVL.{intensity}</span>}
    </div>
  );
};
