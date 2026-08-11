import React from 'react';
import { Card } from './ui/Card';
import { MoodBadge } from './ui/MoodBadge';

interface MoodDisplayProps {
  transcript: string | null;
  audioLabel: string;
  audioConfidence?: number | null;
  textLabel?: string | null;
  textIntensity?: number | null;
  transcriptionStatus?: string | null;
  audioStatus?: string | null;
  textStatus?: string | null;
}

export const MoodDisplay: React.FC<MoodDisplayProps> = ({
  transcript,
  audioLabel,
  audioConfidence,
  textLabel,
  textIntensity,
  transcriptionStatus,
  audioStatus,
  textStatus
}) => {
  // Derive a rough 1-5 intensity for audio based on confidence (0-1) so it visually matches the text intensity badge
  const derivedAudioIntensity = audioConfidence 
    ? Math.max(1, Math.min(5, Math.round(audioConfidence * 5))) 
    : undefined;

  return (
    <Card variant="solid" style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Transcript Section */}
        <div>
          <h3 style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
            fontFamily: 'var(--font-mono)'
          }}>
            Transcript
          </h3>
          <p style={{ 
            fontSize: '1.125rem', 
            lineHeight: 1.6, 
            color: 'var(--text-primary)',
            fontStyle: transcript?.includes('REQUIRED') ? 'italic' : 'normal',
            opacity: transcript?.includes('REQUIRED') ? 0.7 : 1
          }}>
            {transcript || "No transcript available."}
          </p>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

        {(transcriptionStatus || audioStatus || textStatus) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {transcriptionStatus && <span>TEXT: {transcriptionStatus.replace('_', ' ').toUpperCase()}</span>}
            {audioStatus && <span>VOICE: {audioStatus.replace('_', ' ').toUpperCase()}</span>}
            {textStatus && <span>SENTIMENT: {textStatus.replace('_', ' ').toUpperCase()}</span>}
          </div>
        )}

        {/* Emotion Signals Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          {/* Audio Signal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)'
            }}>
              AUDIO VIBRATION SIGNAL
            </span>
            <div>
              <MoodBadge 
                mood={audioLabel as any} 
                intensity={derivedAudioIntensity} 
                size="md" 
              />
            </div>
            {audioConfidence && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Confidence: {(audioConfidence * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {/* Text Signal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)'
            }}>
              NLP TEXT SENTIMENT
            </span>
            <div>
              {textLabel ? (
                <MoodBadge 
                  mood={textLabel as any} 
                  intensity={textIntensity} 
                  size="md" 
                />
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No text sentiment data
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </Card>
  );
};
