import React from 'react';
import { Card } from './ui/Card';
import { MoodBadge } from './ui/MoodBadge';

interface MoodDisplayProps {
  transcript: string | null;
  chunks?: { text: string; timestamp: [number, number | null] }[] | null;
  playbackTime?: number | null;
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
  moodIntensity?: number | null;
  moodSource?: string | null;
  fatigueLabel?: string | null;
  fatigueConfidence?: number | null;
  fatigueEvidence?: string[] | null;
  fatigueStatus?: string | null;
  onEditTranscript?: (newTranscript: string) => void;
  onEditMood?: (newMood: string, newIntensity: number) => void;
}

export const MoodDisplay: React.FC<MoodDisplayProps> = ({
  transcript,
  chunks,
  playbackTime,
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
  moodIntensity,
  moodSource,
  fatigueLabel,
  fatigueConfidence,
  fatigueEvidence,
  fatigueStatus,
  onEditTranscript,
  onEditMood,
}) => {
  const [isEditingTranscript, setIsEditingTranscript] = React.useState(false);
  const [editedTranscript, setEditedTranscript] = React.useState(transcript || '');
  const [isEditingMood, setIsEditingMood] = React.useState(false);
  const [editedMood, setEditedMood] = React.useState(moodLabel || 'unknown');
  const [editedIntensity, setEditedIntensity] = React.useState(moodIntensity || (moodConfidence ? Math.max(1, Math.round(moodConfidence * 5)) : 3));

  React.useEffect(() => {
    setEditedTranscript(transcript || '');
    setEditedMood(moodLabel || 'unknown');
    setEditedIntensity(moodIntensity || (moodConfidence ? Math.max(1, Math.round(moodConfidence * 5)) : 3));
  }, [transcript, moodLabel, moodConfidence, moodIntensity]);
  // Derive a rough 1-5 intensity for audio based on confidence (0-1) so it visually matches the text intensity badge
  const derivedAudioIntensity = audioConfidence 
    ? Math.max(1, Math.min(5, Math.round(audioConfidence * 5))) 
    : undefined;

  const renderTranscript = () => {
    if (!transcript) return "No transcript available.";
    if (!chunks || !chunks.length) return transcript;

    return chunks.map((chunk, index) => {
      const start = chunk.timestamp[0];
      const end = chunk.timestamp[1] ?? (index === chunks.length - 1 ? 999 : chunks[index + 1].timestamp[0]);
      
      const isActive = playbackTime !== null && playbackTime !== undefined && playbackTime >= start && playbackTime <= end;
      const isPast = playbackTime !== null && playbackTime !== undefined && playbackTime > end;
      
      return (
        <span 
          key={index} 
          style={{ 
            color: isActive ? 'var(--text-primary)' : isPast ? 'var(--text-secondary)' : 'var(--text-muted)',
            transition: 'color 0.1s ease',
            textShadow: isActive ? '0 0 8px rgba(255,255,255,0.2)' : 'none'
          }}
        >
          {chunk.text}
        </span>
      );
    });
  };

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
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            Transcript
            {onEditTranscript && !isEditingTranscript && (
              <button onClick={() => setIsEditingTranscript(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: 'var(--mood-frustrated)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }} title="Edit Transcript">
                EDIT
              </button>
            )}
          </h3>
          {isEditingTranscript ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <textarea 
                value={editedTranscript}
                onChange={e => setEditedTranscript(e.target.value)}
                style={{ width: '100%', minHeight: '80px', padding: '0.5rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', textAlign: 'center' }}
              />
              <button 
                onClick={() => { onEditTranscript?.(editedTranscript); setIsEditingTranscript(false); }}
                style={{ padding: '0.4rem 1rem', background: 'var(--accent-f1)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textTransform: 'uppercase' }}
              >
                Save Transcript
              </button>
            </div>
          ) : (
            <p style={{ 
              fontSize: '1.125rem', 
              lineHeight: 1.6, 
              color: 'var(--text-primary)',
              fontStyle: transcript?.includes('REQUIRED') ? 'italic' : 'normal',
              opacity: transcript?.includes('REQUIRED') ? 0.7 : 1,
              textAlign: 'center'
            }}>
              {renderTranscript()}
            </p>
          )}
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

        {/* Emotion Signals Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          
          {/* Text Signal */}
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

        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MOOD SIGNAL</span>
            {onEditMood && !isEditingMood && (
              <button onClick={() => setIsEditingMood(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: 'var(--mood-frustrated)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }} title="Edit Mood">
                EDIT
              </button>
            )}
          </div>
          {isEditingMood ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select 
                value={editedMood}
                onChange={e => setEditedMood(e.target.value)}
                style={{ background: 'var(--bg-app)', color: 'white', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
              >
                <option value="unknown">Unknown</option>
                <option value="neutral">Neutral</option>
                <option value="frustrated">Frustrated</option>
                <option value="happy">Happy</option>
                <option value="dejected">Dejected</option>
              </select>
              <select
                value={editedIntensity}
                onChange={e => setEditedIntensity(parseInt(e.target.value))}
                style={{ background: 'var(--bg-app)', color: 'white', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
              >
                <option value={1}>Lvl 1</option>
                <option value={2}>Lvl 2</option>
                <option value={3}>Lvl 3</option>
                <option value={4}>Lvl 4</option>
                <option value={5}>Lvl 5</option>
              </select>
              <button 
                onClick={() => { onEditMood?.(editedMood, editedIntensity); setIsEditingMood(false); }}
                style={{ padding: '0.3rem 0.6rem', background: 'var(--accent-f1)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', textTransform: 'uppercase' }}
              >
                Save
              </button>
            </div>
          ) : moodLabel && moodLabel !== 'unknown' ? (
            <>
              <MoodBadge mood={moodLabel as any} intensity={moodIntensity || (moodConfidence ? Math.max(1, Math.round(moodConfidence * 5)) : undefined)} size="md" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {moodSource === 'combined' ? 'Voice + transcript' : moodSource === 'voice' ? 'Voice signal' : 'Transcript signal'}
                {moodConfidence ? ` · ${(moodConfidence * 100).toFixed(0)}% confidence` : ''}
              </span>
            </>
          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No reliable mood signal</span>}
        </div>
      </div>
    </Card>
  );
};
