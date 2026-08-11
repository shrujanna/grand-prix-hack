import React, { useState } from 'react';
import { AudioUploader, type AnalysisResult } from '../components/AudioUploader';
import { OpenF1RadioArchive } from '../components/OpenF1RadioArchive';
import { MoodDisplay } from '../components/MoodDisplay';
import { LapChart } from '../components/LapChart';
import { AudioPlayback } from '../components/AudioPlayback';
import { Card } from '../components/ui/Card';
import '../theme/index.css';

export const MainView: React.FC = () => {
  // State for the currently active data to display on the right
  const [activeData, setActiveData] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingOpenF1, setAnalyzingOpenF1] = useState(false);
  
  const [isLiveUpload, setIsLiveUpload] = useState(false);

  const handleLibrarySelect = (clip: any) => {
    setIsLiveUpload(false);
    setActiveData(clip);
  };

  const handleLiveUpload = (result: AnalysisResult) => {
    setIsLiveUpload(true);
    setActiveData(result);
    setAnalysisError(null);
  };

  const handleLiveTelemetryChange = (telemetry: { lapTimes: number[]; lapNumber: number | null }) => {
    if (!isLiveUpload) return;
    setActiveData((current: any) => current ? {
      ...current,
      lap_times: telemetry.lapTimes,
      lap_number: telemetry.lapNumber ?? current.lap_number,
    } : current);
  };

  const hasEnteredLapTimes = Array.isArray(activeData?.lap_times) && activeData.lap_times.length > 0;

  const analyzeSelectedOpenF1Radio = async () => {
    if (!activeData?.session_key || !activeData?.driver_number || !activeData?.date) return;
    setAnalyzingOpenF1(true);
    setAnalysisError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const form = new FormData();
      form.set('session_key', String(activeData.session_key));
      form.set('driver_number', String(activeData.driver_number));
      form.set('date', activeData.date);
      if (activeData.lap_number != null) form.set('lap_number', String(activeData.lap_number));
      const response = await fetch(`${baseUrl}/api/analyze/openf1`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'Unable to analyze this team radio.');
      setActiveData({ ...activeData, ...payload, year: activeData.year, source: 'openf1' });
    } catch (error: any) {
      setAnalysisError(error.message);
    } finally {
      setAnalyzingOpenF1(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '100vh',
      padding: '2rem',
      maxWidth: '1600px',
      margin: '0 auto',
      gap: '1.25rem'
    }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--accent-f1)', marginRight: '12px' }}>|</span>
            PIT WALL TELEMETRY
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', marginTop: '4px' }}>
            AUDIO VIBRATION & NLP SENTIMENT ANALYSIS
          </p>
        </div>
      </header>

      <div className="telemetry-main-grid">
        
        {/* Radio discovery is the primary surface. Live input is available without squeezing it out. */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: '0.85rem' }}>
          <details style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)', padding: '0.8rem 1rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              LIVE TELEMETRY INPUT <span style={{ color: 'var(--text-muted)' }}>— upload or record a new radio</span>
            </summary>
            <div style={{ marginTop: '1rem' }}>
              <AudioUploader onAnalysisComplete={handleLiveUpload} onError={setAnalysisError} onTelemetryChange={handleLiveTelemetryChange} />
            </div>
          </details>
          {analysisError && (
            <div role="alert" style={{ border: '1px solid var(--mood-frustrated)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.8rem', background: 'var(--mood-frustrated-glow)', fontSize: '0.875rem' }}>
              {analysisError}
            </div>
          )}
          
          <details style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)', padding: '0.8rem 1rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              RADIO ARCHIVE <span style={{ color: 'var(--text-muted)' }}>— OpenF1 recordings and FastF1 lap context</span>
            </summary>
            <div style={{ marginTop: '0.85rem' }}>
              <OpenF1RadioArchive
                compact
                onClipSelect={handleLibrarySelect}
                selectedClipId={!isLiveUpload && activeData ? activeData.clip_id : undefined}
              />
            </div>
          </details>
        </div>

        {/* Selected radio detail and matching FastF1 timing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: 0 }}>
          {activeData ? (
            <>
              {/* Top Right: Emotion Display */}
              <div style={{ flexShrink: 0 }}>
                <MoodDisplay 
                  transcript={activeData.transcript || activeData.text}
                  audioLabel={activeData.audio_model_label || activeData.human_label}
                  audioConfidence={activeData.audio_model_confidence}
                  textLabel={activeData.text_model_label || activeData.human_label}
                  textIntensity={activeData.text_model_intensity || activeData.human_label_intensity}
                  transcriptionStatus={activeData.transcription_status}
                  audioStatus={activeData.audio_analysis_status}
                  textStatus={activeData.text_analysis_status}
                />
                {activeData.audio_url && (
                  <AudioPlayback audioUrl={activeData.audio_url} title="Selected team radio" />
                )}
                {activeData.source === 'openf1' && (
                  <button
                    type="button"
                    onClick={analyzeSelectedOpenF1Radio}
                    disabled={analyzingOpenF1}
                    style={{ marginTop: '0.9rem', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-f1)', background: analyzingOpenF1 ? 'var(--bg-panel-solid)' : 'var(--accent-f1)', color: 'white', cursor: analyzingOpenF1 ? 'wait' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  >
                    {analyzingOpenF1 ? 'ANALYZING RADIO…' : 'TRANSCRIBE + ANALYZE THIS RADIO'}
                  </button>
                )}
              </div>

              {/* Bottom Right: Telemetry Chart */}
              {hasEnteredLapTimes || (activeData.gp && activeData.session && activeData.driver_code && activeData.driver_code !== 'LIVE' && activeData.gp !== 'Live uploads') ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                  <LapChart 
                    gp={activeData.gp || ''}
                    session={activeData.session || ''}
                    driver={activeData.driver_code || 'LIVE'}
                    year={activeData.year}
                    selectedClipId={activeData.clip_id}
                    selectedLapNumber={activeData.lap_number}
                    lapTimes={activeData.lap_times}
                  />
                </div>
              ) : (
                <Card variant="glass" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    PASTE LAP TIMES IN LIVE TELEMETRY INPUT TO DRAW A CHART, OR SELECT AN ARCHIVED RADIO FOR FASTF1 DATA.
                  </p>
                </Card>
              )}
            </>
          ) : (
            <Card variant="glass" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                 AWAITING SIGNAL...
               </p>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
};
