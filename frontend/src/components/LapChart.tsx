import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from './ui/Card';
import { LoadingState } from './ui/LoadingState';

interface LapChartProps {
  gp: string;
  session: string;
  driver: string;
  year?: number;
  selectedClipId?: string;
  selectedLapNumber?: number | null;
  selectedMoodLabel?: string | null;
  lapTimes?: number[];
  onSelectedLapInsight?: (lap: any | null) => void;
}

const toLapPoints = (lapTimes: number[]) => {
  const sorted = [...lapTimes].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return lapTimes.map((lapTime, index) => ({
    lap_number: index + 1,
    lap_time: lapTime,
    delta_from_median: lapTime - median,
  }));
};

export const LapChart: React.FC<LapChartProps> = ({ gp, session, driver, year = 2026, selectedClipId, selectedLapNumber, selectedMoodLabel, lapTimes, onSelectedLapInsight }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLaps = async () => {
      if (lapTimes?.length) {
        setLoading(false);
        setError(null);
        setData(toLapPoints(lapTimes));
        return;
      }
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
  }, [gp, session, driver, year, lapTimes]);

  useEffect(() => {
    if (!onSelectedLapInsight) return;
    const selected = selectedLapNumber == null ? null : data.find((lap) => Math.abs(lap.lap_number - selectedLapNumber) < 0.01) || null;
    onSelectedLapInsight(selected);
  }, [data, onSelectedLapInsight, selectedLapNumber]);

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

  const contextLabel = (lap: any) => [
    lap.tyre_compound ? `${lap.tyre_compound}${lap.tyre_age != null ? ` · ${lap.tyre_age} laps` : ''}` : null,
    lap.is_pit_lap ? 'pit lap' : null,
    lap.safety_car ? 'safety-car/VSC' : null,
    lap.weather || null,
    lap.traffic ? `traffic: ${lap.traffic}` : null,
  ].filter(Boolean).join(' · ');

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    if (payload.selected_radio) {
      const color = getMoodColor(payload.radio_mood);
      return (
        <g>
          <circle cx={cx} cy={cy} r={10} fill="var(--bg-panel-solid)" stroke={color} strokeWidth={3} />
          <circle cx={cx} cy={cy} r={4} fill={color} />
        </g>
      );
    }
    
    // Normal lap point
    return <circle cx={cx} cy={cy} r={data.length === 1 ? 8 : 2} fill={data.length === 1 ? 'var(--accent-f1)' : 'rgba(255,255,255,0.2)'} />;
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
          {typeof data.delta_from_median === 'number' && <p>vs median: {data.delta_from_median >= 0 ? '+' : ''}{data.delta_from_median.toFixed(3)}s</p>}
          {data.pace_trend && data.pace_trend !== 'warming_up' && <p>3-lap pace: {data.pace_trend}</p>}
          {data.sector_1_time != null && <p>Sectors: {data.sector_1_time.toFixed(3)} / {data.sector_2_time?.toFixed(3) ?? '—'} / {data.sector_3_time?.toFixed(3) ?? '—'}s</p>}
          {contextLabel(data) && <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Race context: {contextLabel(data)}</p>}
          {data.concerning_radio_before && <p style={{ marginTop: '8px', color: '#f5a623' }}>Radio cue before this lap: {data.concern_reason}</p>}
          {data.selected_radio && (
            <div style={{ marginTop: '8px', color: getMoodColor(data.radio_mood) }}>
              <p>Selected radio: {data.radio_mood?.toUpperCase() || 'AWAITING ANALYSIS'}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const dataWithSelectedRadio = selectedClipId && selectedLapNumber != null
    ? data.map((lap) => Math.abs(lap.lap_number - selectedLapNumber) < 0.01
      ? { ...lap, selected_radio: true, radio_clip_id: selectedClipId, radio_mood: selectedMoodLabel || 'neutral' }
      : lap)
    : data;

  return (
    <Card variant="glass" style={{ width: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Lap Times & Radio Mood ({driver})</h3>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', marginTop: '0.25rem' }}>ONE POINT = ONE RACE LAP · RING = SELECTED RADIO</p>
        </div>
        {selectedLapNumber != null && <span style={{ color: getMoodColor(selectedMoodLabel || 'neutral'), fontFamily: 'var(--font-mono)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>RADIO · LAP {selectedLapNumber}</span>}
      </div>
      <div style={{ flex: 1, minHeight: '280px' }}>
        {loading ? (
          <LoadingState message={`FETCHING TELEMETRY FOR ${driver}...`} />
        ) : error ? (
          <div style={{ color: 'var(--mood-frustrated)', textAlign: 'center', paddingTop: '2rem' }}>
            {error}
          </div>
        ) : dataWithSelectedRadio.length === 1 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>LAP 1 TIME</p>
              <p style={{ fontSize: '2.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>{dataWithSelectedRadio[0].lap_time.toFixed(3)}s</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem' }}>Add one more lap time to plot the performance trend.</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dataWithSelectedRadio} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
