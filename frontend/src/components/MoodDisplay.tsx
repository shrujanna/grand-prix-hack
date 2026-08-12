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
  audioFallback?: boolean;
  moodLabel?: string | null;
  moodConfidence?: number | null;
  moodSource?: string | null;
  fatigueLabel?: string | null;
  fatigueConfidence?: number | null;
  fatigueEvidence?: string[] | null;
  fatigueStatus?: string | null;
}

export const MoodDisplay: React.FC<MoodDisplayProps> = ({
  transcript,
  audioLabel,
  audioConfidence,
  textLabel,
  textIntensity,
  transcriptionStatus,
  audioStatus,
  textStatus,
  audioFallback,
  moodLabel,
  moodConfidence,
  moodSource,
  fatigueLabel,
  fatigueConfidence,
  fatigueEvidence,
  fatigueStatus,
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
              {audioFallback ? 'NOISY-RADIO FALLBACK' : 'AUDIO VIBRATION SIGNAL'}
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
            {audioFallback && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated from the transcript because noise blocked a reliable acoustic read.</span>}
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

        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OPERATOR MOOD SIGNAL</span>
            {moodLabel && moodLabel !== 'unknown' ? (
              <>
                <MoodBadge mood={moodLabel as any} intensity={moodConfidence ? Math.max(1, Math.round(moodConfidence * 5)) : undefined} size="md" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {moodSource === 'combined' ? 'Voice + transcript' : moodSource === 'voice' ? 'Voice signal' : 'Transcript signal'}
                  {moodConfidence ? ` · ${(moodConfidence * 100).toFixed(0)}% confidence` : ''}
                </span>
              </>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No reliable mood signal</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>FATIGUE CUE SCREEN</span>
            {fatigueStatus === 'screened' ? (
              <>
                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', borderRadius: 'var(--radius-full)', border: `1px solid ${fatigueLabel === 'high' ? 'var(--mood-frustrated)' : fatigueLabel === 'watch' ? '#f5a623' : 'var(--border-subtle)'}`, color: fatigueLabel === 'high' ? 'var(--mood-frustrated)' : fatigueLabel === 'watch' ? '#f5a623' : 'var(--text-secondary)', padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', textTransform: 'uppercase' }}>
                  {fatigueLabel === 'high' ? 'Check driver' : fatigueLabel === 'watch' ? 'Watch cues' : 'No cue found'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {fatigueEvidence?.length ? fatigueEvidence.join(' · ') : 'No explicit tiredness or focus cue in the transcript.'}
                  {fatigueConfidence ? ` · ${(fatigueConfidence * 100).toFixed(0)}% cue strength` : ''}
                </span>
              </>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Transcript required</span>}
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.45 }}>Fatigue is a transcript cue screen, not a medical assessment. Confirm any concern with the driver and team protocol.</p>
      </div>
    </Card>
  );
};
