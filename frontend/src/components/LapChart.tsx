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
  showAiInsight?: boolean;
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

export const LapChart: React.FC<LapChartProps> = ({ gp, session, driver, year = 2026, selectedClipId, selectedLapNumber, selectedMoodLabel, lapTimes, onSelectedLapInsight, showAiInsight = false }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiInsight, setAiInsight] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

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

  useEffect(() => {
    if (selectedLapNumber == null || !data.length || !showAiInsight) {
      setAiInsight(null);
      return;
    }

    const lapIndex = data.findIndex(l => Math.abs(l.lap_number - selectedLapNumber) < 0.01);
    if (lapIndex === -1 || lapIndex >= data.length - 1) {
      setAiInsight(null);
      return;
    }

    const nextLaps = data.slice(lapIndex + 1, lapIndex + 4);
    const lapDeltas = nextLaps.map(l => l.delta_from_median).filter(d => typeof d === 'number');

    if (lapDeltas.length === 0) {
      setAiInsight(null);
      return;
    }

    const fetchAiInsight = async () => {
      setAiLoading(true);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
        const response = await fetch(`${baseUrl}/api/analyze/performance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mood: selectedMoodLabel || 'neutral',
            lap_deltas: lapDeltas
          })
        });
        if (response.ok) {
          const result = await response.json();
          setAiInsight(result);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setAiLoading(false);
      }
    };

    fetchAiInsight();
  }, [selectedLapNumber, data, selectedMoodLabel, showAiInsight]);


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
    lap.is_pit_lap ? (lap.pit_duration ? `pit out (${lap.pit_duration.toFixed(1)}s)` : 'pit in') : null,
    lap.position != null ? `P${lap.position}${lap.position_change ? ` (${lap.position_change > 0 ? '+' : ''}${lap.position_change})` : ''}` : null,
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
              {data.traffic && (
                <p style={{ marginTop: '4px', color: '#f5a623', fontWeight: 'bold' }}>⚠️ DIRTY AIR ALERT: {data.traffic}</p>
              )}
              {data.pace_drop && (
                <p style={{ marginTop: '4px', color: '#ff4757', fontWeight: 'bold' }}>⚠️ SIGNIFICANT PACE DROP (+{data.delta_from_median?.toFixed(1)}s)</p>
              )}
              {data.position_change > 0 && (
                <p style={{ marginTop: '4px', color: '#2ed573', fontWeight: 'bold' }}>⚡ OVERTAKE LAP (+{data.position_change} POS)</p>
              )}
              {data.position_change < 0 && (
                <p style={{ marginTop: '4px', color: '#ff4757', fontWeight: 'bold' }}>⚠️ POSITION LOST ({data.position_change} POS)</p>
              )}
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

      {/* AI Analysis Box */}
      {selectedLapNumber != null && showAiInsight && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>AI PERFORMANCE INSIGHT</span>
           </div>
           {aiLoading ? (
             <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Analyzing post-radio lap telemetry...</span>
           ) : aiInsight ? (
             <p style={{ 
               fontSize: '0.85rem', 
               lineHeight: 1.4, 
               color: aiInsight.impact === 'negative' ? '#f5a623' : aiInsight.impact === 'positive' ? '#2ed573' : '#a4b0be'
             }}>
               {aiInsight.summary}
             </p>
           ) : (
             <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Insufficient data to analyze post-radio performance impact.</span>
           )}
        </div>
      )}
    </Card>
  );
};
