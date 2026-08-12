import React, { useEffect, useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { LoadingState } from './ui/LoadingState';

interface TrackPoint {
  x: number;
  y: number;
  corner?: string;
}

interface TrackMapProps {
  gp: string;
  session: string;
  driver: string;
  year?: number;
  selectedLapNumber?: number | null;
  selectedMoodLabel?: string | null;
  selectedClipId?: string | null;
}

export const TrackMap: React.FC<TrackMapProps> = ({ gp, session, driver, year = 2026, selectedLapNumber, selectedMoodLabel, selectedClipId }) => {
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [clipPoint, setClipPoint] = useState<TrackPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gp || !session || !driver) return;
    
    const fetchTrackMap = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const url = `${baseUrl}/api/telemetry/track-map?gp=${encodeURIComponent(gp)}&session=${encodeURIComponent(session)}&driver=${encodeURIComponent(driver)}&year=${year}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail || 'Track telemetry unavailable.');
        }
        
        const result = await response.json();
        setPoints(result.track_path);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackMap();
  }, [gp, session, driver, year]);

  useEffect(() => {
    if (!selectedClipId) {
      setClipPoint(null);
      return;
    }
    
    const fetchClipLocation = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const url = `${baseUrl}/api/telemetry/clip-location?clip_id=${encodeURIComponent(selectedClipId)}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setClipPoint(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchClipLocation();
  }, [selectedClipId]);

  const { viewBox, pathData } = useMemo(() => {
    if (!points.length) return { viewBox: '0 0 100 100', pathData: '' };

    // Find min and max for X and Y to calculate the SVG viewBox
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      // Note: FastF1 Y coordinates are often inverted compared to screen coordinates
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const paddingX = (maxX - minX) * 0.1;
    const paddingY = (maxY - minY) * 0.1;
    
    const vb = `${minX - paddingX} ${minY - paddingY} ${maxX - minX + paddingX * 2} ${maxY - minY + paddingY * 2}`;
    
    // Construct SVG path
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return { viewBox: vb, pathData: path };
  }, [points]);
  
  const getMoodColor = (mood?: string) => {
    switch(mood) {
      case 'frustrated': return '#ff4757';
      case 'dejected': return '#3742fa';
      case 'happy': return '#2ed573';
      case 'neutral': return '#a4b0be';
      default: return '#52525b';
    }
  };

  return (
    <Card variant="glass" style={{ width: '100%', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Circuit Telemetry ({gp})</h3>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', marginTop: '0.25rem' }}>
            GPS PATH · {clipPoint?.corner ? `RADIO AT ${clipPoint.corner.toUpperCase()}` : (points.length > 0 ? 'DATA ACTIVE' : 'AWAITING TELEMETRY')}
          </p>
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <LoadingState message={`DOWNLOADING TRACK TELEMETRY (CAN TAKE ~30S FOR NEW RACES)...`} />
          </div>
        ) : error ? (
          <div style={{ color: 'var(--mood-frustrated)', textAlign: 'center' }}>
            {error}
          </div>
        ) : points.length > 0 ? (
          <svg 
            viewBox={viewBox} 
            style={{ width: '100%', height: '100%', maxHeight: '400px', transform: 'scaleY(-1)' }} 
            preserveAspectRatio="xMidYMid meet"
          >
            <path 
              d={pathData} 
              fill="none" 
              stroke="var(--border-subtle)" 
              strokeWidth={(viewBox.split(' ')[2] as any) * 0.015} // scale stroke width relative to viewBox
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
            />
            
            {/* If a lap is selected, highlight the track in their mood color */}
            {selectedLapNumber != null && (
              <path 
                d={pathData} 
                fill="none" 
                stroke={getMoodColor(selectedMoodLabel || 'neutral')} 
                strokeWidth={(viewBox.split(' ')[2] as any) * 0.025}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
                style={{
                  filter: `drop-shadow(0px 0px 8px ${getMoodColor(selectedMoodLabel || 'neutral')})`
                }}
              />
            )}
            
            {/* If we have the exact clip point, draw a glowing dot */}
            {clipPoint && (
              <circle
                cx={clipPoint.x}
                cy={clipPoint.y}
                r={(viewBox.split(' ')[2] as any) * 0.04}
                fill={getMoodColor(selectedMoodLabel || 'neutral')}
                stroke="white"
                strokeWidth={(viewBox.split(' ')[2] as any) * 0.01}
                style={{
                  filter: `drop-shadow(0px 0px 12px ${getMoodColor(selectedMoodLabel || 'neutral')})`
                }}
              />
            )}
          </svg>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            NO TELEMETRY AVAILABLE
          </div>
        )}
      </div>
    </Card>
  );
};
