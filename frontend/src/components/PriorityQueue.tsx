import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { formatTrackTime } from '../utils/timeUtils';

interface PriorityQueueProps {
  onClipSelect: (clip: any) => void;
  refreshKey?: string | null;
  maxItems?: number;
}

const storageKey = 'pit-wall-acknowledged-clips';
const getMood = (clip: any) => String(clip.mood_label || clip.human_label || clip.audio_model_label || '').toLowerCase();
const isConcerning = (clip: any) => ['frustrated', 'dejected'].includes(getMood(clip)) || ['high', 'watch'].includes(clip.fatigue_label);

export const PriorityQueue: React.FC<PriorityQueueProps> = ({ onClipSelect, refreshKey, maxItems = 3 }) => {
  const [clips, setClips] = useState<any[]>([]);
  const [acknowledged, setAcknowledged] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    let cancelled = false;
    const fetchQueue = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${baseUrl}/api/clips`);
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) setClips(payload);
      } catch {
        // The queue is supplementary; the selected radio remains fully usable offline.
      }
    };
    fetchQueue();
    const interval = window.setInterval(fetchQueue, 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [refreshKey]);

  const queue = useMemo(() => clips
    .filter(isConcerning)
    .sort((left, right) => {
      const score = (clip: any) => (clip.fatigue_label === 'high' ? 3 : clip.fatigue_label === 'watch' ? 2 : 1) + (acknowledged.includes(clip.clip_id) ? -10 : 0);
      return score(right) - score(left);
    })
    .slice(0, maxItems), [acknowledged, clips, maxItems]);

  const acknowledge = (clipId: string) => {
    setAcknowledged((current) => {
      const next = Array.from(new Set([...current, clipId]));
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  if (!queue.length) return null;
  return (
    <Card variant="glass" style={{ padding: '0.7rem 0.8rem' }} aria-label="Priority radio queue">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
        <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>⚑ PRIORITY RADIO QUEUE</p>
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{queue.filter((clip) => !acknowledged.includes(clip.clip_id)).length} UNACKNOWLEDGED</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.45rem' }}>
        {queue.map((clip) => {
          const done = acknowledged.includes(clip.clip_id);
          const label = clip.fatigue_label === 'high' ? 'CHECK DRIVER' : clip.fatigue_label === 'watch' ? 'WATCH CUES' : `${getMood(clip).toUpperCase()} SIGNAL`;
          return (
            <div key={clip.clip_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center', borderLeft: `3px solid ${done ? 'var(--text-muted)' : clip.fatigue_label === 'high' ? 'var(--mood-frustrated)' : '#f5a623'}`, padding: '0.32rem 0 0.32rem 0.5rem' }}>
              <button type="button" onClick={() => onClipSelect(clip)} style={{ border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{done ? '✓ REVIEWED' : '⚑ REVIEW'} · {clip.driver_code} · {label}</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.68rem', marginTop: '0.12rem' }}>
                  {(() => {
                    let timeStr = '';
                    if (clip.date) {
                      timeStr = formatTrackTime(clip.date, clip.gp);
                    } else if (clip.uploaded_at) {
                      timeStr = formatTrackTime(clip.uploaded_at, clip.gp);
                    } else {
                      const match = clip.clip_id.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
                      if (match) {
                        const isoStr = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
                        timeStr = formatTrackTime(isoStr, clip.gp);
                      }
                    }
                    const parts = [];
                    if (timeStr) parts.push(timeStr);
                    if (clip.lap_number) parts.push(`L${clip.lap_number}`);
                    return parts.length > 0 ? parts.join(' · ') : 'Live Radio';
                  })()}
                </span>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.68rem', marginTop: '0.12rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{clip.text || 'Transcript pending'}</span>
              </button>
              <button type="button" onClick={() => acknowledge(clip.clip_id)} disabled={done} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: done ? 'var(--text-muted)' : 'var(--text-primary)', padding: '0.3rem 0.45rem', cursor: done ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.62rem' }}>{done ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE'}</button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
