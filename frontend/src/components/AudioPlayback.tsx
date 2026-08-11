import React, { useMemo, useRef, useState } from 'react';


interface AudioPlaybackProps {
  audioUrl: string;
  transcript?: string | null;
  title?: string;
}

const apiAudioUrl = (audioUrl: string) => {
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('blob:')) return audioUrl;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  return `${baseUrl}${audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`}`;
};

export const AudioPlayback: React.FC<AudioPlaybackProps> = ({ audioUrl, transcript, title = 'Radio playback' }) => {
  const playerRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const words = useMemo(() => transcript?.split(/\s+/).filter(Boolean) ?? [], [transcript]);
  const highlightedWordCount = duration > 0 ? Math.ceil((currentTime / duration) * words.length) : 0;

  const changeSpeed = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    if (playerRef.current) playerRef.current.playbackRate = nextSpeed;
  };

  return (
    <section aria-label={title} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{title}</p>
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          Speed&nbsp;
          <select aria-label="Playback speed" value={speed} onChange={(event) => changeSpeed(Number(event.target.value))} style={{ background: 'var(--bg-panel-solid)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
            {[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
      </div>
      <audio
        ref={playerRef}
        controls
        preload="metadata"
        src={apiAudioUrl(audioUrl)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        style={{ width: '100%', height: '40px', outline: 'none' }}
      />
      {words.length > 0 && (
        <p aria-live="off" style={{ marginTop: '0.75rem', fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
          {words.map((word, index) => (
            <span key={`${word}-${index}`} style={{ color: index < highlightedWordCount ? 'var(--text-primary)' : undefined, background: index < highlightedWordCount ? 'rgba(225, 6, 0, 0.18)' : 'transparent', borderRadius: '2px', marginRight: '0.25rem' }}>
              {word}
            </span>
          ))}
        </p>
      )}
    </section>
  );
};
