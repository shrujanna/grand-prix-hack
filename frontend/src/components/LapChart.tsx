import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Card } from './ui/Card';
import { LoadingState } from './ui/LoadingState';

const comparisonInputStyle: React.CSSProperties = {
  background: 'var(--bg-panel-solid)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.5rem 0.6rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
};

type PerformanceSummary = {
  baseline_lap_time?: number | null;
  radio_events: number;
  concerning_events: number;
  slower_followups: number;
  average_followup_delta?: number | null;
  fastest_lap_time?: number | null;
  average_lap_time?: number | null;
  slowest_lap_time?: number | null;
  summary: string;
  flags: Array<{
    clip_id: string;
    radio_lap: number;
    followup_lap: number;
    reason: string;
    followup_delta: number;
    context_category: 'driver_state_signal' | 'race_condition';
    context_notes: string[];
  }>;
  timeline: Array<{
    lap_number: number;
    lap_time: number;
    delta_from_median?: number | null;
    pace_trend?: 'improving' | 'worsening' | 'stable' | 'warming_up' | null;
    clip_id?: string | null;
    mood_label?: string | null;
    fatigue_label?: string | null;
    race_context: string[];
  }>;
  stints: Array<{
    stint_number: number;
    start_lap: number;
    end_lap: number;
    lap_count: number;
    average_lap_time: number;
    concerning_radio_events: number;
    mood_events: string[];
  }>;
};

interface LapChartProps {
  gp: string;
  session: string;
  driver: string;
  year?: number;
  selectedClipId?: string;
  selectedLapNumber?: number | null;
  lapTimes?: number[];
  onClipSelect?: (clip: any) => void;
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

export const LapChart: React.FC<LapChartProps> = ({ gp, session, driver, year = 2026, selectedClipId, selectedLapNumber, lapTimes, onClipSelect, onSelectedLapInsight }) => {
  const [data, setData] = useState<any[]>([]);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slowerLapsOnly, setSlowerLapsOnly] = useState(false);
  const [comparisonDriver, setComparisonDriver] = useState('');
  const [comparisonSession, setComparisonSession] = useState('');
  const [comparison, setComparison] = useState<{ driver: string; session: string; performance: PerformanceSummary } | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    const fetchLaps = async () => {
      if (lapTimes?.length) {
        setLoading(false);
        setError(null);
        setData(toLapPoints(lapTimes));
        setPerformance(null);
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
        setPerformance(result.performance || null);
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
    
    if (payload.clip_id) {
      const color = getMoodColor(payload.human_label);
      const isAmbiguous = payload.is_ambiguous;
      
      const openClip = async () => {
        if (!onClipSelect) return;
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
          const response = await fetch(`${baseUrl}/api/clips/${encodeURIComponent(payload.clip_id)}`);
          if (!response.ok) throw new Error('The associated clip is unavailable.');
          onClipSelect(await response.json());
        } catch (error) {
          console.warn(error);
        }
      };
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
          onClick={openClip}
          style={{ cursor: onClipSelect ? 'pointer' : 'default' }}
        />
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
    ? dataWithSelectedRadio.filter((lap) => typeof lap.delta_from_median === 'number' && lap.delta_from_median > 0)
    : dataWithSelectedRadio;
  const currentTrend = performance?.timeline.at(-1)?.pace_trend;
  const timelineEvents = performance?.timeline
    .filter((event) => event.clip_id || event.race_context.length || ['improving', 'worsening'].includes(event.pace_trend || ''))
    .slice(-12) || [];

  const fetchComparison = async () => {
    const nextDriver = comparisonDriver.trim().toUpperCase();
    const nextSession = comparisonSession.trim() || session;
    if (!nextDriver) {
      setComparisonError('Enter a three-letter driver code to compare.');
      return;
    }
    setLoadingComparison(true);
    setComparisonError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const url = `${baseUrl}/api/laps?gp=${encodeURIComponent(gp)}&session=${encodeURIComponent(nextSession)}&driver=${encodeURIComponent(nextDriver)}&year=${year}`;
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'Comparison telemetry is unavailable.');
      setComparison({ driver: nextDriver, session: nextSession, performance: payload.performance });
    } catch (error: any) {
      setComparison(null);
      setComparisonError(error.message);
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <Card variant="glass" style={{ width: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Lap Time Telemetry & Emotion Overlay ({driver})</h3>
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={slowerLapsOnly} onChange={(event) => setSlowerLapsOnly(event.target.checked)} /> Slower laps only
        </label>
      </div>
      {performance && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.9rem', fontFamily: 'var(--font-mono)' }}>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.55rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>SESSION MEDIAN</p>
            <p style={{ color: 'var(--text-primary)', marginTop: '0.25rem' }}>{performance.baseline_lap_time?.toFixed(3) ?? '—'}s</p>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.55rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>FASTEST / AVG / SLOWEST</p>
            <p style={{ color: 'var(--text-primary)', marginTop: '0.25rem', fontSize: '0.72rem' }}>{performance.fastest_lap_time?.toFixed(3) ?? '—'} / {performance.average_lap_time?.toFixed(3) ?? '—'} / {performance.slowest_lap_time?.toFixed(3) ?? '—'}s</p>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.55rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>CONCERNING RADIOS</p>
            <p style={{ color: performance.concerning_events ? '#f5a623' : 'var(--text-primary)', marginTop: '0.25rem' }}>{performance.concerning_events}</p>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.55rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>FOLLOW-UP DELTA</p>
            <p style={{ color: performance.average_followup_delta && performance.average_followup_delta > 0 ? '#f5a623' : 'var(--text-primary)', marginTop: '0.25rem' }}>
              {performance.average_followup_delta == null ? '—' : `${performance.average_followup_delta >= 0 ? '+' : ''}${performance.average_followup_delta.toFixed(3)}s`}
            </p>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.55rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>PACE TREND</p>
            <p style={{ color: currentTrend === 'worsening' ? '#f5a623' : 'var(--text-primary)', marginTop: '0.25rem', textTransform: 'uppercase' }}>{currentTrend?.replace('_', ' ') ?? '—'}</p>
          </div>
          <p style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.72rem', lineHeight: 1.4, margin: '0.1rem 0 0' }}>{performance.summary}</p>
          {performance.flags.length > 0 && (
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.55rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginBottom: '0.35rem' }}>CONTEXT CHECK</p>
              {performance.flags.map((flag) => (
                <p key={`${flag.clip_id}-${flag.followup_lap}`} style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.7rem', marginTop: '0.22rem' }}>
                  Lap {flag.followup_lap}: {flag.reason} → {flag.followup_delta >= 0 ? '+' : ''}{flag.followup_delta.toFixed(3)}s. {flag.context_category === 'race_condition' ? `Race condition present (${flag.context_notes.join(', ')}); do not attribute this pace change to driver state.` : 'No pit, safety-car/VSC, or rain context detected.'}
                </p>
              ))}
            </div>
          )}
          {performance.stints.length > 0 && (
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.55rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginBottom: '0.35rem' }}>STINT STATE COMPARISON</p>
              <div style={{ display: 'flex', overflowX: 'auto', gap: '0.45rem' }}>
                {performance.stints.map((stint) => (
                  <div key={stint.stint_number} style={{ minWidth: 150, borderLeft: `3px solid ${stint.concerning_radio_events ? '#f5a623' : 'var(--border-subtle)'}`, paddingLeft: '0.45rem', fontFamily: 'var(--font-sans)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Stint {stint.stint_number} · L{stint.start_lap}–{stint.end_lap}</strong>
                    <p>{stint.average_lap_time.toFixed(3)}s avg · {stint.concerning_radio_events} concern{stint.concerning_radio_events === 1 ? '' : 's'}</p>
                    <p>{stint.mood_events.length ? stint.mood_events.join(' · ') : 'No radio mood events'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
        ) : chartData.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '2rem' }}>
            No laps slower than this driver&apos;s session median.
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
              {!slowerLapsOnly && (
                <Line
                  type="monotone"
                  dataKey="rolling_lap_time"
                  stroke="#f5a623"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {performance && timelineEvents.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.9rem', paddingTop: '0.7rem' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', marginBottom: '0.45rem' }}>SESSION TIMELINE</p>
          <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
            {timelineEvents.map((event) => (
              <div key={`${event.lap_number}-${event.clip_id || 'lap'}`} style={{ flex: '0 0 142px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.45rem', fontSize: '0.68rem' }}>
                <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>LAP {event.lap_number} · {event.delta_from_median != null && `${event.delta_from_median >= 0 ? '+' : ''}${event.delta_from_median.toFixed(2)}s`}</p>
                {event.clip_id && <p style={{ color: getMoodColor(event.mood_label || undefined), marginTop: '0.25rem' }}>RADIO · {event.mood_label || 'unclassified'}{event.fatigue_label && event.fatigue_label !== 'no_signal' ? ` · fatigue ${event.fatigue_label}` : ''}</p>}
                {event.race_context.length > 0 && <p style={{ color: '#f5a623', marginTop: '0.25rem' }}>{event.race_context.join(' · ')}</p>}
                {!event.clip_id && event.race_context.length === 0 && <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>pace {event.pace_trend}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {!lapTimes?.length && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.9rem', paddingTop: '0.7rem' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', marginBottom: '0.45rem' }}>COMPARE DRIVER OR SESSION</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <input aria-label="Comparison driver" value={comparisonDriver} onChange={(event) => setComparisonDriver(event.target.value)} placeholder="DRIVER (e.g. HAM)" style={{ flex: '1 1 130px', ...comparisonInputStyle }} />
            <input aria-label="Comparison session" value={comparisonSession} onChange={(event) => setComparisonSession(event.target.value)} placeholder={`SESSION (default ${session})`} style={{ flex: '1 1 180px', ...comparisonInputStyle }} />
            <button type="button" onClick={fetchComparison} disabled={loadingComparison} style={{ border: '1px solid var(--accent-f1)', background: 'transparent', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.7rem', fontFamily: 'var(--font-mono)', cursor: loadingComparison ? 'wait' : 'pointer' }}>{loadingComparison ? 'LOADING…' : 'COMPARE'}</button>
          </div>
          {comparisonError && <p role="alert" style={{ color: 'var(--mood-frustrated)', fontSize: '0.72rem', marginTop: '0.45rem' }}>{comparisonError}</p>}
          {comparison && performance && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.55rem' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{comparison.driver} · {comparison.session}</strong>: median {comparison.performance.baseline_lap_time?.toFixed(3) ?? '—'}s vs {driver} {performance.baseline_lap_time?.toFixed(3) ?? '—'}s; concerns {comparison.performance.concerning_events} vs {performance.concerning_events}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
