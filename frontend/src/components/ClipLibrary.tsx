import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { MoodBadge } from './ui/MoodBadge';
import { LoadingState } from './ui/LoadingState';
import '../theme/index.css';

interface ClipLibraryProps {
  onClipSelect: (clip: any) => void;
  selectedClipId?: string;
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({ onClipSelect, selectedClipId }) => {
  const [clips, setClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [driverFilter, setDriverFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('');

  useEffect(() => {
    const fetchClips = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${baseUrl}/api/clips`);
        if (!response.ok) throw new Error('Failed to load library');
        
        const data = await response.json();
        setClips(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClips();
  }, []);

  const filteredClips = clips.filter(clip => {
    if (driverFilter && clip.driver_code.toLowerCase() !== driverFilter.toLowerCase()) return false;
    if (moodFilter && clip.human_label?.toLowerCase() !== moodFilter.toLowerCase()) return false;
    return true;
  });

  if (loading) return <Card variant="solid"><LoadingState message="LOADING DATABASE..." /></Card>;
  if (error) return <Card variant="solid" style={{ color: 'var(--mood-frustrated)' }}>{error}</Card>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* Filter Header */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          placeholder="Driver (e.g. HAM)" 
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          style={{ 
            background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', 
            color: 'var(--text-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
            width: '50%', fontFamily: 'var(--font-mono)'
          }}
        />
        <select 
          value={moodFilter}
          onChange={(e) => setMoodFilter(e.target.value)}
          style={{ 
            background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', 
            color: 'var(--text-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)',
            width: '50%', fontFamily: 'var(--font-mono)'
          }}
        >
          <option value="">All Moods</option>
          <option value="frustrated">Frustrated</option>
          <option value="dejected">Dejected</option>
          <option value="happy">Happy</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>

      {/* Scrollable List */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.5rem',
        paddingRight: '0.5rem'
      }}>
        {filteredClips.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No clips found.
          </div>
        ) : (
          filteredClips.map((clip) => {
            const isSelected = selectedClipId === clip.clip_id;
            return (
              <div 
                key={clip.clip_id}
                onClick={() => onClipSelect(clip)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isSelected ? 'var(--bg-glass)' : 'var(--bg-panel-solid)',
                  border: `1px solid ${isSelected ? 'var(--accent-f1)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{clip.driver_code}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>|</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{clip.gp}</span>
                  </div>
                  {clip.human_label && (
                    <MoodBadge mood={clip.human_label} intensity={clip.human_label_intensity} size="sm" />
                  )}
                </div>
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  "{clip.text}"
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
