import React from 'react';
import '../../theme/index.css';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = "Processing Telemetry..." }) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 'var(--space-8)',
      gap: 'var(--space-4)'
    }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--accent-f1)',
              borderRadius: '2px',
              animation: `pulse 1.5s infinite ease-in-out ${i * 0.2}s`,
              boxShadow: '0 0 10px var(--accent-f1)'
            }}
          />
        ))}
      </div>
      <p style={{ 
        color: 'var(--text-secondary)', 
        fontFamily: 'var(--font-mono)',
        fontSize: '0.875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }}>
        {message}
      </p>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};
