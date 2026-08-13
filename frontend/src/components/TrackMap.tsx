import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card } from './ui/Card';
import { LoadingState } from './ui/LoadingState';

interface TrackPoint {
  x: number;
  y: number;
  corner?: string;
}

interface CornerMarker {
  x: number;
  y: number;
  number: string;
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

const TEAM_COLORS: Record<number, Record<string, string>> = {
  2023: {
    'Red Bull Racing': '#3671C6',
    'Ferrari': '#E8002D',
    'Mercedes': '#00A19C',
    'McLaren': '#FF8700',
    'Alpine': '#FF87BC',
    'Aston Martin': '#006F62',
    'Williams': '#005AFF',
    'AlphaTauri': '#2B4562',
    'Alfa Romeo': '#C92D4B',
    'Haas': '#B6BABD'
  },
  2024: {
    'Red Bull Racing': '#3671C6',
    'Ferrari': '#E8002D',
    'Mercedes': '#00A19C',
    'McLaren': '#FF8000',
    'Alpine': '#FF87BC',
    'Aston Martin': '#006F62',
    'Williams': '#005AFF',
    'RB': '#6692FF',
    'Stake F1 Team': '#00E701',
    'Haas': '#B6BABD'
  },
  2025: {
    'McLaren': '#FF8000',
    'Ferrari': '#E8002D',
    'Red Bull Racing': '#3671C6',
    'Mercedes': '#00D2BE',
    'Aston Martin': '#006F62',
    'Alpine': '#FF87BC',
    'Williams': '#1868DB',
    'Racing Bulls': '#6692FF',
    'Haas': '#B6BABD',
    'Kick Sauber': '#00E701'
  },
  2026: {
    'McLaren': '#FF8000',
    'Ferrari': '#E80020',
    'Red Bull Racing': '#3671C6',
    'Mercedes': '#27F4D2',
    'Aston Martin': '#00665E',
    'Alpine': '#FF87BC',
    'Williams': '#1868DB',
    'Racing Bulls': '#6692FF',
    'Haas': '#B6BABD',
    'Audi': '#F50537',
    'Cadillac': '#C0C0C0'
  }
};

export const TrackMap: React.FC<TrackMapProps> = ({ gp, session, driver, year = 2026, selectedLapNumber, selectedMoodLabel, selectedClipId }) => {
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [corners, setCorners] = useState<CornerMarker[]>([]);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [clipPoint, setClipPoint] = useState<TrackPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<TrackPoint | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

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
        if (result.corners) {
          setCorners(result.corners);
        }
        if (result.team_name) {
          setTeamName(result.team_name);
        } else {
          setTeamName(null);
        }
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

  const { viewBox, pathData, scaleFactor, trackDimensions } = useMemo(() => {
    if (!points.length) return { viewBox: '0 0 100 100', pathData: '', scaleFactor: 1, trackDimensions: 100 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const paddingX = (maxX - minX) * 0.15;
    const paddingY = (maxY - minY) * 0.15;
    
    const vbW = maxX - minX + paddingX * 2;
    const vbH = maxY - minY + paddingY * 2;
    const vb = `${minX - paddingX} ${minY - paddingY} ${vbW} ${vbH}`;
    
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return { 
      viewBox: vb, 
      pathData: path,
      scaleFactor: Math.max(vbW, vbH) / 1000,
      trackDimensions: Math.max(vbW, vbH)
    };
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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !points.length) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    let minD = Infinity;
    let closest = null;
    
    // Check if we are near a corner first
    let hoverCorner = null;
    corners.forEach(c => {
      const d = Math.hypot(c.x - svgP.x, c.y - svgP.y);
      if (d < minD) { minD = d; hoverCorner = c.number; closest = { x: c.x, y: c.y, corner: `Turn ${c.number}` }; }
    });
    
    if (minD > (scaleFactor * 80)) {
       // Check path points
       points.forEach(p => {
         const d = Math.hypot(p.x - svgP.x, p.y - svgP.y);
         if (d < minD) { minD = d; closest = p; }
       });
    }

    if (minD < (scaleFactor * 150) && closest) {
       setHoverPoint(closest as TrackPoint);
    } else {
       setHoverPoint(null);
    }
  };

  return (
    <Card variant="glass" style={{ width: '100%', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
      <style>
        {`
          .trace-path {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: drawPath 2.5s ease-out forwards;
          }
          @keyframes drawPath {
            to { stroke-dashoffset: 0; }
          }
          .corner-dot {
            transition: all 0.2s ease;
          }
          .corner-dot:hover {
            fill: white;
            r: ${scaleFactor * 30};
          }
        `}
      </style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Circuit Telemetry ({gp})</h3>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              GPS PATH · {clipPoint?.corner ? `RADIO AT ${clipPoint.corner.toUpperCase()}` : (points.length > 0 ? 'DATA ACTIVE' : 'AWAITING TELEMETRY')}
            </p>
            {hoverPoint?.corner && (
              <p style={{ color: 'var(--accent-f1)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                HOVER: {hoverPoint.corner.toUpperCase()}
              </p>
            )}
          </div>
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
            ref={svgRef}
            viewBox={viewBox} 
            style={{ width: '100%', height: '100%', maxHeight: '400px', transform: 'scaleY(-1)', cursor: 'crosshair' }} 
            preserveAspectRatio="xMidYMid meet"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverPoint(null)}
          >
            <defs>
              <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4158D0" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#C850C0" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFCC70" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Base track (Animated Draw) */}
            <path 
              id="main-track-path"
              d={pathData} 
              fill="none" 
              stroke="var(--border-subtle)" 
              strokeWidth={scaleFactor * 15}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              className="trace-path"
            />
            
            {/* If a lap is selected, highlight the track in their mood color */}
            {selectedLapNumber != null && (
              <path 
                d={pathData} 
                fill="none" 
                stroke={getMoodColor(selectedMoodLabel || 'neutral')} 
                strokeWidth={scaleFactor * 25}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
                pathLength="100"
                className="trace-path"
                style={{
                  filter: `drop-shadow(0px 0px ${scaleFactor * 20}px ${getMoodColor(selectedMoodLabel || 'neutral')})`
                }}
              />
            )}

            {/* Corner Markers */}
            {corners.map((c, idx) => (
              <circle
                key={`corner-${idx}`}
                cx={c.x}
                cy={c.y}
                r={scaleFactor * 12}
                fill="rgba(255, 255, 255, 0.3)"
                className="corner-dot"
                style={{ animation: `fadeIn 0.5s ease-out ${idx * 0.05 + 1.5}s both` }}
              >
                <title>Turn {c.number}</title>
              </circle>
            ))}
            
            {/* Hover ghost dot */}
            {hoverPoint && !clipPoint && (
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r={scaleFactor * 25}
                fill="none"
                stroke="white"
                strokeWidth={scaleFactor * 4}
                opacity={0.6}
              />
            )}

            {/* Lap Replay Ghost Car */}
            {selectedLapNumber != null && (
              <circle r={scaleFactor * 20} fill={(teamName && TEAM_COLORS[year]?.[teamName]) || getMoodColor(selectedMoodLabel || 'neutral')}>
                <animateMotion 
                  dur="4s" 
                  repeatCount="indefinite"
                  path={pathData}
                />
              </circle>
            )}

            {/* The Glowing Dot (Radio Beacon) */}
            {clipPoint && (
              <g>
                {/* Pulsing rings */}
                <circle cx={clipPoint.x} cy={clipPoint.y} r={scaleFactor * 40} fill="none" stroke={getMoodColor(selectedMoodLabel || 'neutral')} strokeWidth={scaleFactor * 6}>
                  <animate attributeName="r" values={`${scaleFactor * 40};${scaleFactor * 150}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle cx={clipPoint.x} cy={clipPoint.y} r={scaleFactor * 40} fill="none" stroke={getMoodColor(selectedMoodLabel || 'neutral')} strokeWidth={scaleFactor * 3}>
                  <animate attributeName="r" values={`${scaleFactor * 20};${scaleFactor * 100}`} dur="1.5s" begin="0.75s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0" dur="1.5s" begin="0.75s" repeatCount="indefinite" />
                </circle>
                
                {/* Solid Dot */}
                <circle
                  cx={clipPoint.x}
                  cy={clipPoint.y}
                  r={scaleFactor * 40}
                  fill={getMoodColor(selectedMoodLabel || 'neutral')}
                  stroke="white"
                  strokeWidth={scaleFactor * 10}
                  style={{ filter: `drop-shadow(0px 0px ${scaleFactor * 30}px ${getMoodColor(selectedMoodLabel || 'neutral')})` }}
                />
              </g>
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
