import React, { useRef, useState } from 'react';


interface AudioPlaybackProps {
  audioUrl: string;
  title?: string;
  onTimeUpdate?: (time: number) => void;
}

const apiAudioUrl = (audioUrl: string) => {
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('blob:')) return audioUrl;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  return `${baseUrl}${audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`}`;
};

export const AudioPlayback: React.FC<AudioPlaybackProps> = ({ audioUrl, title = 'Radio playback', onTimeUpdate }) => {
  const playerRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);

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
        onTimeUpdate={(e) => onTimeUpdate?.((e.target as HTMLAudioElement).currentTime)}
        style={{ width: '100%', height: '40px', outline: 'none' }}
      />
    </section>
  );
};
