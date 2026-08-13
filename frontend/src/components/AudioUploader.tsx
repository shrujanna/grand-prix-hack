import React, { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Card } from './ui/Card';
import { AudioPlayback } from './AudioPlayback';

type ServiceName = 'transcription' | 'audio' | 'text';
type ServiceStatus = 'completed' | 'provided' | 'estimated' | 'no_speech' | 'unavailable' | 'failed' | 'skipped';

export interface AnalysisResult {
  transcript: string | null;
  chunks?: { text: string; timestamp: [number, number | null] }[] | null;
  audio_model_label: string;
  audio_model_confidence: number;
  text_model_label: string | null;
  text_model_intensity: number | null;
  transcription_status: ServiceStatus;
  transcription_error?: string | null;
  audio_analysis_status: ServiceStatus;
  audio_analysis_error?: string | null;
  text_analysis_status: ServiceStatus;
  text_analysis_error?: string | null;
  audio_duration_seconds?: number | null;
  clip_id?: string | null;
  gp?: string | null;
  session?: string | null;
  driver_code?: string | null;
  driver_name?: string | null;
  lap_number?: number | null;
  audio_url?: string | null;
  source?: 'live';
  uploaded_at?: string | null;
  lap_times?: number[];
  audio_fallback?: boolean;
  mood_label?: 'frustrated' | 'neutral' | 'happy' | 'dejected' | 'unknown';
  mood_confidence?: number;
  mood_source?: 'combined' | 'voice' | 'transcript' | 'unknown';
  fatigue_label?: 'high' | 'watch' | 'no_signal' | 'unknown';
  fatigue_confidence?: number;
  fatigue_evidence?: string[];
  fatigue_status?: 'screened' | 'skipped';
}

interface AudioUploaderProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
  onError: (error: string) => void;
  onTelemetryChange?: (telemetry: { lapTimes: number[]; lapNumber: number | null }) => void;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

interface LiveContext {
  driverCode: string;
  driverName: string;
  gp: string;
  session: string;
  lapNumber: string;
  lapTimes: string;
}

const defaultContext: LiveContext = {
  driverCode: '',
  driverName: '',
  gp: '',
  session: 'Race',
  lapNumber: '',
  lapTimes: '',
};

const serviceDetails: Array<{ name: ServiceName; label: string; statusKey: keyof AnalysisResult; errorKey: keyof AnalysisResult }> = [
  { name: 'transcription', label: 'Speech to text', statusKey: 'transcription_status', errorKey: 'transcription_error' },
  { name: 'audio', label: 'Voice tone', statusKey: 'audio_analysis_status', errorKey: 'audio_analysis_error' },
  { name: 'text', label: 'Text sentiment', statusKey: 'text_analysis_status', errorKey: 'text_analysis_error' },
];

const statusColor = (status: ServiceStatus) => {
  if (status === 'completed' || status === 'provided') return 'var(--mood-happy)';
  if (status === 'estimated') return 'var(--mood-neutral)';
  if (status === 'skipped') return 'var(--text-muted)';
  return 'var(--mood-frustrated)';
};

const parseLapTimes = (value: string): number[] => {
  if (!value.trim()) return [];
  return value.split(/[\s,;]+/).filter(Boolean).map((entry) => {
    const parts = entry.split(':');
    let seconds = 0;
    if (parts.length === 3) {
      seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    } else if (parts.length === 2) {
      seconds = Number(parts[0]) * 60 + Number(parts[1]);
    } else {
      seconds = Number(entry);
    }
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 36000) {
      throw new Error(`"${entry}" is not a valid lap time. Use seconds (91.677), m:ss.sss (1:31.677), or h:mm:ss.sss (1:01:31.677).`);
    }
    return seconds;
  });
};

const mergeRetryResult = (
  previous: AnalysisResult,
  next: AnalysisResult,
  services: ServiceName[],
): AnalysisResult => {
  const merged = { ...previous };
  if (services.includes('transcription')) {
    Object.assign(merged, {
      transcript: next.transcript,
      transcription_status: next.transcription_status,
      transcription_error: next.transcription_error,
    });
  }
  if (services.includes('audio')) {
    Object.assign(merged, {
      audio_model_label: next.audio_model_label,
      audio_model_confidence: next.audio_model_confidence,
      audio_analysis_status: next.audio_analysis_status,
      audio_analysis_error: next.audio_analysis_error,
    });
  }
  if (services.includes('text')) {
    Object.assign(merged, {
      text_model_label: next.text_model_label,
      text_model_intensity: next.text_model_intensity,
      text_analysis_status: next.text_analysis_status,
      text_analysis_error: next.text_analysis_error,
    });
  }
  return merged;
};

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAnalysisComplete, onError, onTelemetryChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [context, setContext] = useState<LiveContext>(defaultContext);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [useDenoiser, setUseDenoiser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const partialTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (partialTimerRef.current) window.clearInterval(partialTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File) => {
    if (!file.type.startsWith('audio/')) {
      throw new Error('Please upload a supported audio file.');
    }
    if (file.size === 0) {
      throw new Error('The audio file is empty.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Audio clips must be 20 MB or smaller.');
    }
  };

  const appendContext = (formData: FormData) => {
    formData.append('driver_code', context.driverCode);
    formData.append('driver_name', context.driverName);
    formData.append('gp', context.gp);
    formData.append('session', context.session);
    if (context.lapNumber) formData.append('lap_number', context.lapNumber);
  };

  const updateLapTimes = (lapTimes: string) => {
    const nextContext = { ...context, lapTimes };
    setContext(nextContext);
    try {
      onTelemetryChange?.({
        lapTimes: parseLapTimes(lapTimes),
        lapNumber: nextContext.lapNumber ? Number(nextContext.lapNumber) : null,
      });
    } catch {
      onTelemetryChange?.({ lapTimes: [], lapNumber: nextContext.lapNumber ? Number(nextContext.lapNumber) : null });
    }
  };

  const updateLapNumber = (lapNumber: string) => {
    const nextContext = { ...context, lapNumber };
    setContext(nextContext);
    try {
      onTelemetryChange?.({
        lapTimes: parseLapTimes(nextContext.lapTimes),
        lapNumber: lapNumber ? Number(lapNumber) : null,
      });
    } catch {
      onTelemetryChange?.({ lapTimes: [], lapNumber: lapNumber ? Number(lapNumber) : null });
    }
  };

  const analyzeFile = async (file: File, retryServices?: ServiceName[], saveClip = true) => {
    try {
      if (!retryServices && context.driverCode.trim().length !== 3) {
        throw new Error('Please enter a 3-letter driver code (e.g., HAM, VER) before analyzing.');
      }
      validateFile(file);
      const lapTimes = parseLapTimes(context.lapTimes);
      setIsProcessing(true);
      setProgress(10);
      setPhase(retryServices ? 'RETRYING FAILED ANALYSIS...' : 'VALIDATING RADIO CLIP...');

      if (!retryServices) {
        setLastFile(file);
        setAnalysis(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(file));
      }

      const formData = new FormData();
      formData.append('audio', file);
      appendContext(formData);
      formData.append('save_clip', String(saveClip && !retryServices));
      if (useDenoiser) formData.append('use_denoiser', 'true');
      if (retryServices?.length) {
        formData.append('retry_services', retryServices.join(','));
        if (analysis?.transcript && !retryServices.includes('transcription')) {
          formData.append('transcript', analysis.transcript);
        }
      }

      setProgress(45);
      setPhase('UPLOADING RADIO CLIP...');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: formData });
      setProgress(75);
      setPhase('ANALYZING VOICE AND LANGUAGE...');

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const detail = typeof errorBody?.detail === 'string' ? errorBody.detail : response.statusText;
        throw new Error(`API Error: ${detail}`);
      }

      const next = await response.json() as AnalysisResult;
      const result = retryServices && analysis
        ? mergeRetryResult(analysis, next, retryServices)
        : { ...next, lap_times: lapTimes };
      setAnalysis(result);
      onAnalysisComplete(result);
      setProgress(100);
      setPhase('ANALYSIS COMPLETE');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to analyze audio.');
      setPhase('ANALYSIS COULD NOT START');
    } finally {
      setIsProcessing(false);
      window.setTimeout(() => setProgress(null), 700);
    }
  };

  const requestPartialTranscript = async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });
    if (blob.size < 1024) return;
    const partialFile = new File([blob], 'live-radio.webm', { type: blob.type || 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', partialFile);
    formData.append('retry_services', 'transcription');
    formData.append('save_clip', 'false');
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: formData });
      if (!response.ok) return;
      const result = await response.json() as AnalysisResult;
      if (result.transcription_status === 'completed' && result.transcript) setLiveTranscript(result.transcript);
    } catch {
      // The final recording analysis still provides a clear error if ASR is unavailable.
    }
  };

  const stopRecording = () => recorderRef.current?.state === 'recording' && recorderRef.current.stop();

  const startRecording = async () => {
    if (context.driverCode.trim().length !== 3) {
      onError('Please enter a 3-letter driver code (e.g., HAM, VER) before recording.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError('This browser does not support microphone recording. Upload an audio clip instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      setLiveTranscript(null);
      setRecordingSeconds(0);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        if (partialTimerRef.current) window.clearInterval(partialTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const recording = new File([blob], `team-radio-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        void analyzeFile(recording);
      };
      recorder.start(1000);
      setIsRecording(true);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
      partialTimerRef.current = window.setInterval(() => { void requestPartialTranscript(); }, 6000);
    } catch {
      onError('Microphone access was not granted. Check browser permissions and try again.');
    }
  };

  const failedServices = analysis
    ? serviceDetails
      .filter(({ statusKey }) => {
        const status = analysis[statusKey] as ServiceStatus;
        return !['completed', 'provided', 'estimated', 'skipped'].includes(status);
      })
      .map(({ name }) => name)
    : [];

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await analyzeFile(file);
  };

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await analyzeFile(file);
    event.target.value = '';
  };

  return (
    <Card variant="glass" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Live Telemetry Input</h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--accent-f1)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '3rem 2rem',
          textAlign: 'center',
          cursor: isProcessing ? 'wait' : 'pointer',
          backgroundColor: isDragging ? 'var(--bg-glass)' : 'transparent',
          transition: 'var(--transition-fast)',
          opacity: isProcessing ? 0.7 : 1,
        }}
      >
        <input id="audio-file-input" aria-label="audio-file-input" type="file" ref={fileInputRef} onChange={handleFileInput} accept="audio/*" style={{ display: 'none' }} />
        <p style={{ fontFamily: 'var(--font-mono)', color: isDragging ? 'var(--accent-f1)' : 'var(--text-secondary)' }}>
          {isDragging ? 'DROP TO UPLOAD' : 'DRAG AUDIO CLIP HERE OR CLICK TO BROWSE'}
        </p>
        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={useDenoiser}
              onChange={(e) => setUseDenoiser(e.target.checked)}
              style={{ accentColor: 'var(--accent-f1)' }}
            />
            USE AI DENOISER (SPEECHBRAIN)
          </label>
        </div>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>MP3, WAV, M4A, AAC, OGG, OPUS, FLAC, or WebM · 20 MB max</p>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <input aria-label="Driver code" value={context.driverCode} maxLength={3} onChange={(event) => setContext({ ...context, driverCode: event.target.value.toUpperCase() })} placeholder="Driver code (HAM)" style={{ background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.55rem' }} />
        <input aria-label="Driver name" value={context.driverName} onChange={(event) => setContext({ ...context, driverName: event.target.value })} placeholder="Driver name" style={{ background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.55rem' }} />
        <input aria-label="Grand Prix" value={context.gp} onChange={(event) => setContext({ ...context, gp: event.target.value })} placeholder="Grand Prix" style={{ background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.55rem' }} />
        <select aria-label="Session" value={context.session} onChange={(event) => setContext({ ...context, session: event.target.value })} style={{ background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.55rem' }}>
          <option>Race</option><option>Qualifying</option><option>Sprint</option><option>Practice</option><option>Live</option>
        </select>
        <input aria-label="Lap number" type="number" min="1" step="1" value={context.lapNumber} onChange={(event) => updateLapNumber(event.target.value)} placeholder="Lap number (optional)" style={{ gridColumn: 'span 2', background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.55rem' }} />
        <textarea aria-label="Lap times" value={context.lapTimes} onChange={(event) => updateLapTimes(event.target.value)} placeholder="Lap times: 1:31.677, 1:30.442, 1:31.005 …" rows={3} style={{ gridColumn: 'span 2', resize: 'vertical', background: 'var(--bg-panel-solid)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.55rem', fontFamily: 'var(--font-mono)' }} />
        <p style={{ gridColumn: 'span 2', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '-0.2rem' }}>PASTE LAP TIMES IN ORDER. ACCEPTS SECONDS, M:SS.SSS, OR H:MM:SS; THIS POWERS THE LIVE CHART.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button type="button" onClick={() => void (isRecording ? stopRecording() : startRecording())} disabled={isProcessing} style={{ flex: 1, padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${isRecording ? 'var(--mood-frustrated)' : 'var(--accent-f1)'}`, background: isRecording ? 'var(--mood-frustrated-glow)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
          {isRecording ? `STOP RECORDING · ${recordingSeconds}s` : 'RECORD LIVE RADIO'}
        </button>
      </div>
      {isRecording && <p aria-live="polite" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>LIVE TRANSCRIPT: {liveTranscript || 'Listening for radio…'}</p>}

      {(isProcessing || progress !== null) && (
        <div role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            <span>{phase}</span><span>{progress ?? 0}%</span>
          </div>
          <div style={{ height: '6px', borderRadius: '999px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress ?? 0}%`, background: 'var(--accent-f1)', transition: 'width 180ms ease' }} />
          </div>
        </div>
      )}

      {audioUrl && (
        <div style={{ marginTop: '1.5rem' }}>
          {lastFile && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{lastFile.name} · {(lastFile.size / 1024 / 1024).toFixed(2)} MB{analysis?.audio_duration_seconds ? ` · ${analysis.audio_duration_seconds.toFixed(1)}s` : ''}</p>}
          <AudioPlayback audioUrl={audioUrl} title="Uploaded radio playback" />
        </div>
      )}

      {analysis && (
        <div aria-live="polite" style={{ marginTop: '1.25rem', display: 'grid', gap: '0.5rem' }}>
          {serviceDetails.map(({ label, statusKey, errorKey }) => {
            const status = analysis[statusKey] as ServiceStatus;
            const error = analysis[errorKey] as string | null | undefined;
            return (
              <div key={label} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ color: statusColor(status), fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{status.replace('_', ' ')}</span>
                </div>
                {error && <p style={{ marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{error}</p>}
              </div>
            );
          })}
          {failedServices.length > 0 && lastFile && (
            <button type="button" onClick={() => void analyzeFile(lastFile, failedServices)} disabled={isProcessing} style={{ marginTop: '0.25rem', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-f1)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
              RETRY FAILED ANALYSIS
            </button>
          )}
        </div>
      )}
    </Card>
  );
};
