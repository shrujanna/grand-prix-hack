import React, { useRef, useState, type ChangeEvent } from 'react';
import { Card } from './ui/Card';

type ServiceName = 'transcription' | 'audio' | 'text';
type ServiceStatus = 'completed' | 'provided' | 'no_speech' | 'unavailable' | 'failed' | 'skipped';

export interface AnalysisResult {
  transcript?: string | null;
  audio_model_label: string;
  audio_model_confidence: number;
  text_model_label?: string | null;
  text_model_intensity?: number | null;
  transcription_status: ServiceStatus;
  transcription_error?: string | null;
  audio_analysis_status: ServiceStatus;
  audio_analysis_error?: string | null;
  text_analysis_status: ServiceStatus;
  text_analysis_error?: string | null;
  audio_duration_seconds?: number | null;
}

interface AudioUploaderProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
  onError: (error: string) => void;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const serviceDetails: Array<{ name: ServiceName; label: string; statusKey: keyof AnalysisResult; errorKey: keyof AnalysisResult }> = [
  { name: 'transcription', label: 'Speech to text', statusKey: 'transcription_status', errorKey: 'transcription_error' },
  { name: 'audio', label: 'Voice tone', statusKey: 'audio_analysis_status', errorKey: 'audio_analysis_error' },
  { name: 'text', label: 'Text sentiment', statusKey: 'text_analysis_status', errorKey: 'text_analysis_error' },
];

const statusColor = (status: ServiceStatus) => {
  if (status === 'completed' || status === 'provided') return 'var(--mood-happy)';
  if (status === 'skipped') return 'var(--text-muted)';
  return 'var(--mood-frustrated)';
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

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAnalysisComplete, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const analyzeFile = async (file: File, retryServices?: ServiceName[]) => {
    try {
      validateFile(file);
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
        : next;
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

  const failedServices = analysis
    ? serviceDetails
      .filter(({ statusKey }) => {
        const status = analysis[statusKey] as ServiceStatus;
        return !['completed', 'provided', 'skipped'].includes(status);
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
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>MP3, WAV, M4A, AAC, OGG, OPUS, FLAC, or WebM · 20 MB max</p>
      </div>

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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Playback</p>
          <audio controls src={audioUrl} style={{ width: '100%', height: '40px', outline: 'none' }} />
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
