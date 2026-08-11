import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Card } from './ui/Card';
import { LoadingState } from './ui/LoadingState';

interface LapChartProps {
  gp: string;
  session: string;
  driver: string;
  year?: number;
  selectedClipId?: string;
  selectedLapNumber?: number | null;
}

export const LapChart: React.FC<LapChartProps> = ({ gp, session, driver, year = 2026, selectedClipId, selectedLapNumber }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowerLapsOnly, setSlowerLapsOnly] = useState(false);

  useEffect(() => {
    const fetchLaps = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const url = `${baseUrl}/api/laps?gp=${encodeURIComponent(gp)}&session=${encodeURIComponent(session)}&driver=${encodeURIComponent(driver)}&year=${year}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail || 'FastF1 lap timing is unavailable for this selection.');
        }
        
        const result = await response.json();
        setData(result.laps);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLaps();
  }, [gp, session, driver, year]);

  // CSS variables are tricky in recharts config, so we map them directly
  const getMoodColor = (mood?: string) => {
    switch(mood) {
      case 'frustrated': return '#ff4757';
      case 'dejected': return '#3742fa';
      case 'happy': return '#2ed573';
      case 'neutral': return '#a4b0be';
      default: return '#52525b';
    }
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    if (payload.clip_id) {
      const color = getMoodColor(payload.human_label);
      const isAmbiguous = payload.is_ambiguous;
      
      return (
        <circle 
          cx={cx} 
          cy={cy} 
          r={isAmbiguous ? 6 : 8} 
          stroke={color} 
          strokeWidth={2}
          strokeDasharray={isAmbiguous ? "3 3" : "0"}
          fill={isAmbiguous ? 'transparent' : color} 
          opacity={isAmbiguous ? 0.7 : 1}
        />
      );
    }
    
    // Normal lap point
    return <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.2)" />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'var(--bg-panel-solid)',
          border: '1px solid var(--border-subtle)',
          padding: '10px',
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)'
        }}>
          <p>Lap: {data.lap_number}</p>
          <p>Time: {data.lap_time.toFixed(3)}s</p>
          {data.clip_id && (
            <div style={{ marginTop: '8px', color: getMoodColor(data.human_label) }}>
              <p>Mood: {data.human_label?.toUpperCase()}</p>
              {data.is_ambiguous && <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>(Timing Approx.)</p>}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const dataWithSelectedRadio = selectedClipId && selectedLapNumber != null
    ? data.map((lap) => Math.abs(lap.lap_number - selectedLapNumber) < 0.01
      ? { ...lap, clip_id: selectedClipId, human_label: lap.human_label || 'neutral', is_ambiguous: false }
      : lap)
    : data;

  const chartData = slowerLapsOnly
    ? dataWithSelectedRadio.map((lap) => lap.delta_from_median && lap.delta_from_median > 0 ? lap : { ...lap, clip_id: null, human_label: null })
    : dataWithSelectedRadio;

  return (
    <Card variant="glass" style={{ width: '100%', height: '400px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Lap Time Telemetry & Emotion Overlay ({driver})</h3>
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={slowerLapsOnly} onChange={(event) => setSlowerLapsOnly(event.target.checked)} /> Slower laps only
        </label>
      </div>
      
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <LoadingState message={`FETCHING TELEMETRY FOR ${driver}...`} />
        ) : error ? (
          <div style={{ color: 'var(--mood-frustrated)', textAlign: 'center', paddingTop: '2rem' }}>
            {error}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="lap_number" 
                stroke="var(--text-muted)" 
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                tickLine={false}
              />
              <YAxis 
                domain={['auto', 'auto']}
                stroke="var(--text-muted)" 
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="lap_time" 
                stroke="var(--border-subtle)" 
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{ r: 6, fill: 'var(--text-primary)' }}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
