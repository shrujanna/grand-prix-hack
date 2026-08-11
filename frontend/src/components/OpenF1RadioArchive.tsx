import React, { useEffect, useMemo, useState } from 'react';
import { LoadingState } from './ui/LoadingState';

type OpenF1Session = {
  session_key: number;
  meeting_key: number;
  meeting_name?: string;
  location?: string;
  session_name: string;
  date_start?: string;
  year: number;
};

type OpenF1Driver = {
  driver_number: number;
  name_acronym?: string;
  full_name?: string;
  team_name?: string;
};

type OpenF1Radio = {
  clip_id: string;
  session_key: number;
  driver_number: number;
  date: string;
  driver_code: string;
  driver_name: string;
  team_name?: string;
  audio_url: string;
  source: 'openf1';
};

interface OpenF1RadioArchiveProps {
  onClipSelect: (clip: any) => void;
  selectedClipId?: string;
  compact?: boolean;
}

const apiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const selectStyle: React.CSSProperties = {
  background: 'var(--bg-panel-solid)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  padding: '0.55rem 0.6rem',
  borderRadius: 'var(--radius-sm)',
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
};

export const OpenF1RadioArchive: React.FC<OpenF1RadioArchiveProps> = ({ onClipSelect, selectedClipId, compact = false }) => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(Math.min(currentYear, 2025));
  const [sessions, setSessions] = useState<OpenF1Session[]>([]);
  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [radios, setRadios] = useState<OpenF1Radio[]>([]);
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [driverNumber, setDriverNumber] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRadios, setLoadingRadios] = useState(false);
  const [resolvingClipId, setResolvingClipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meetings = useMemo(() => {
    const byKey = new Map<number, OpenF1Session>();
    sessions.forEach((session) => {
      if (!byKey.has(session.meeting_key)) byKey.set(session.meeting_key, session);
    });
    return Array.from(byKey.values());
  }, [sessions]);

  const availableSessions = useMemo(
    () => sessions.filter((session) => session.meeting_key === meetingKey),
    [sessions, meetingKey],
  );

  const filteredRadios = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return radios;
    return radios.filter((radio) => [radio.driver_code, radio.driver_name, radio.team_name, radio.date]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [radios, search]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    setError(null);
    setSessions([]);
    setDrivers([]);
    setRadios([]);
    setMeetingKey(null);
    setSessionKey(null);
    setDriverNumber(null);
    fetch(`${apiBaseUrl()}/api/openf1/sessions?year=${year}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load OpenF1 sessions.');
        return response.json();
      })
      .then((nextSessions: OpenF1Session[]) => {
        if (cancelled) return;
        setSessions(nextSessions);
        const firstMeeting = nextSessions[0]?.meeting_key ?? null;
        setMeetingKey(firstMeeting);
        const firstSession = nextSessions.find((item) => item.meeting_key === firstMeeting && item.session_name === 'Race')
          ?? nextSessions.find((item) => item.meeting_key === firstMeeting);
        setSessionKey(firstSession?.session_key ?? null);
      })
      .catch((requestError: Error) => !cancelled && setError(requestError.message))
      .finally(() => !cancelled && setLoadingSessions(false));
    return () => { cancelled = true; };
  }, [year]);

  useEffect(() => {
    if (!meetingKey) return;
    const preferred = sessions.find((item) => item.meeting_key === meetingKey && item.session_name === 'Race')
      ?? sessions.find((item) => item.meeting_key === meetingKey);
    setSessionKey(preferred?.session_key ?? null);
    setDriverNumber(null);
  }, [meetingKey, sessions]);

  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;
    setDrivers([]);
    setDriverNumber(null);
    fetch(`${apiBaseUrl()}/api/openf1/drivers?session_key=${sessionKey}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load drivers.');
        return response.json();
      })
      .then((nextDrivers: OpenF1Driver[]) => !cancelled && setDrivers(nextDrivers))
      .catch((requestError: Error) => !cancelled && setError(requestError.message));
    return () => { cancelled = true; };
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;
    setLoadingRadios(true);
    setError(null);
    const query = driverNumber ? `&driver_number=${driverNumber}` : '';
    fetch(`${apiBaseUrl()}/api/openf1/radio?session_key=${sessionKey}${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).detail || 'Unable to load team radio.');
        return response.json();
      })
      .then((nextRadios: OpenF1Radio[]) => !cancelled && setRadios(nextRadios))
      .catch((requestError: Error) => !cancelled && setError(requestError.message))
      .finally(() => !cancelled && setLoadingRadios(false));
    return () => { cancelled = true; };
  }, [sessionKey, driverNumber]);

  const selectRadio = async (radio: OpenF1Radio) => {
    setResolvingClipId(radio.clip_id);
    setError(null);
    try {
      const params = new URLSearchParams({
        session_key: String(radio.session_key),
        driver_number: String(radio.driver_number),
        date: radio.date,
      });
      const response = await fetch(`${apiBaseUrl()}/api/openf1/radio-context?${params}`);
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to match this radio to telemetry.');
      const context = await response.json();
      onClipSelect({ ...radio, ...context, text: null, transcript: null, is_audio_only: true });
    } catch (requestError: any) {
      // Playback remains useful even if FastF1 cannot match a timestamp.
      onClipSelect({ ...radio, year, text: null, transcript: null, is_audio_only: true });
      setError(`${requestError.message} The recording is still available to play.`);
    } finally {
      setResolvingClipId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
        {!compact && <div>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>RADIO ARCHIVE</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>OPENF1 RADIO • FASTF1 LAP CONTEXT</p>
        </div>}
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{filteredRadios.length} SIGNALS</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.65fr 1.35fr', gap: '0.5rem' }}>
        <select aria-label="Season" value={year} onChange={(event) => setYear(Number(event.target.value))} style={selectStyle}>
          {Array.from({ length: Math.max(1, currentYear - 2022) }, (_, index) => currentYear - index).map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Grand Prix" value={meetingKey ?? ''} onChange={(event) => setMeetingKey(Number(event.target.value))} style={selectStyle} disabled={!meetings.length}>
          {meetings.map((meeting) => <option key={meeting.meeting_key} value={meeting.meeting_key}>{meeting.meeting_name || meeting.location || 'Grand Prix'}</option>)}
        </select>
        <select aria-label="Session" value={sessionKey ?? ''} onChange={(event) => setSessionKey(Number(event.target.value))} style={selectStyle} disabled={!availableSessions.length}>
          {availableSessions.map((session) => <option key={session.session_key} value={session.session_key}>{session.session_name}</option>)}
        </select>
        <select aria-label="Driver" value={driverNumber ?? ''} onChange={(event) => setDriverNumber(event.target.value ? Number(event.target.value) : null)} style={selectStyle} disabled={!drivers.length}>
          <option value="">All drivers</option>
          {drivers.map((driver) => <option key={driver.driver_number} value={driver.driver_number}>{driver.name_acronym || driver.full_name || driver.driver_number}{driver.team_name ? ` · ${driver.team_name}` : ''}</option>)}
        </select>
      </div>

      <input
        aria-label="Search team radio"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="SEARCH DRIVER, TEAM, OR TIME"
        style={{ ...selectStyle, textTransform: 'uppercase' }}
      />

      {error && <p role="alert" style={{ color: 'var(--mood-frustrated)', fontSize: '0.75rem' }}>{error}</p>}

      <div style={{ height: compact ? 236 : undefined, flex: compact ? '0 0 auto' : 1, minHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.25rem' }}>
        {loadingSessions || loadingRadios ? <LoadingState message={loadingSessions ? 'LOADING OPENF1 ARCHIVE...' : 'TUNING RADIO CHANNEL...'} /> : filteredRadios.length === 0 ? (
          <p style={{ padding: '1.5rem 0.5rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>No radio recordings for these filters.</p>
        ) : filteredRadios.map((radio) => {
          const selected = radio.clip_id === selectedClipId;
          const time = radio.date ? new Date(radio.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
          return (
            <button
              key={radio.clip_id}
              type="button"
              onClick={() => selectRadio(radio)}
              disabled={Boolean(resolvingClipId)}
              style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-primary)', background: selected ? 'rgba(225, 6, 0, 0.12)' : 'var(--bg-panel-solid)', border: `1px solid ${selected ? 'var(--accent-f1)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-sm)', cursor: resolvingClipId ? 'wait' : 'pointer', font: 'inherit' }}
            >
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                <strong>{radio.driver_code}</strong>
                <span style={{ color: 'var(--text-muted)' }}>{resolvingClipId === radio.clip_id ? 'MATCHING LAP…' : time}</span>
              </span>
              <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>{radio.driver_name}{radio.team_name ? ` · ${radio.team_name}` : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
