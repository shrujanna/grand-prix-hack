import React, { useCallback, useState } from 'react';
import { AudioUploader, type AnalysisResult } from '../components/AudioUploader';
import { OpenF1RadioArchive } from '../components/OpenF1RadioArchive';
import { MoodDisplay } from '../components/MoodDisplay';
import { LapChart } from '../components/LapChart';
import { TrackMap } from '../components/TrackMap';
import { AudioPlayback } from '../components/AudioPlayback';
import { PriorityQueue } from '../components/PriorityQueue';
import { Card } from '../components/ui/Card';
import { formatTrackTime } from '../utils/timeUtils';
import '../theme/index.css';

export const MainView: React.FC = () => {
  const [activeData, setActiveData] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingArchiveRadio, setAnalyzingArchiveRadio] = useState(false);
  const [useDenoiser, setUseDenoiser] = useState(false);
  
  const [showAiInsight, setShowAiInsight] = useState(false);
  const [isLiveUpload, setIsLiveUpload] = useState(false);
  const [selectedLapInsight, setSelectedLapInsight] = useState<any | null>(null);
  const [latestRadio, setLatestRadio] = useState<any | null>(null);
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);

  const handleLibrarySelect = (clip: any) => {
    setIsLiveUpload(false);
    setActiveData(clip);
    setShowAiInsight(false);
    setPlaybackTime(null);
  };

  const handleSelectedLapInsight = useCallback((lap: any | null) => {
    setSelectedLapInsight(lap);
  }, []);

  const statusColor = activeData?.fatigue_label === 'high' || ['frustrated', 'dejected'].includes(activeData?.mood_label)
    ? 'var(--mood-frustrated)'
    : activeData?.fatigue_label === 'watch' ? '#f5a623' : 'var(--mood-happy)';

  const handleLiveUpload = (result: AnalysisResult) => {
    setIsLiveUpload(true);
    setActiveData(result);
    setAnalysisError(null);
    setLatestRadio(result);
    setShowAiInsight(true);
    setPlaybackTime(null);
  };

  const handleLiveTelemetryChange = (telemetry: { lapTimes: number[]; lapNumber: number | null }) => {
    setActiveData((current: any) => current?.source === 'live' ? {
      ...current,
      lap_times: telemetry.lapTimes,
      lap_number: telemetry.lapNumber ?? current.lap_number,
    } : current);
  };

  const hasEnteredLapTimes = Array.isArray(activeData?.lap_times) && activeData.lap_times.length > 0;
  const statusText = activeData?.fatigue_label === 'high' ? '⚑ CHECK DRIVER' : activeData?.fatigue_label === 'watch' ? '△ WATCH CUES' : ['frustrated', 'dejected'].includes(activeData?.mood_label || activeData?.human_label) ? '⚑ REVIEW SIGNAL' : '✓ NO ACTIVE CONCERN';
  const labelExplanation = activeData?.fatigue_label === 'high'
    ? 'Explicit tiredness or focus wording was found in the transcript. Confirm directly with the driver.'
    : activeData?.fatigue_label === 'watch'
      ? 'A weaker tiredness or focus cue was found. Monitor it with race context.'
      : ['frustrated', 'dejected'].includes(activeData?.mood_label || activeData?.human_label)
        ? 'The radio tone or words indicate a concerning mood signal. It is a prompt to review, not a diagnosis.'
        : 'No concerning mood or fatigue cue is currently associated with this radio.';

  const analyzeSelectedArchiveRadio = async (overwrite: boolean = false) => {
    const isLocal = activeData?.source === 'local';
    if (!activeData?.date || (isLocal ? !activeData?.clip_id : (!activeData?.session_key || !activeData?.driver_number))) return;
    setAnalyzingArchiveRadio(true);
    setAnalysisError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const form = new FormData();
      if (isLocal) form.set('clip_id', activeData.clip_id);
      else {
        form.set('session_key', String(activeData.session_key));
        form.set('driver_number', String(activeData.driver_number));
        form.set('date', activeData.date);
      }
      if (activeData.lap_number != null) form.set('lap_number', String(activeData.lap_number));
      if (useDenoiser) form.set('use_denoiser', 'true');
      if (overwrite) form.set('overwrite', 'true');
      const response = await fetch(`${baseUrl}${isLocal ? '/api/analyze/local-archive' : '/api/analyze/openf1'}`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'Unable to analyze this team radio.');
      setActiveData({ ...activeData, ...payload, year: activeData.year, source: isLocal ? 'local' : 'openf1' });
      setShowAiInsight(true);
    } catch (error: any) {
      setAnalysisError(error.message);
    } finally {
      setAnalyzingArchiveRadio(false);
    }
  };

  const saveToDataset = async () => {
    if (!activeData) return;
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${baseUrl}/api/analyze/save-to-dataset?overwrite=true`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeData) 
      });
      if (!response.ok) throw new Error('Failed to save to dataset');
      // Briefly show a success message or just let the continuous learning tab update
    } catch (e) {
      console.error(e);
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
      


      {activeData && (
        <Card variant="glass" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', alignItems: 'start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>CURRENT DRIVER STATE</p>
              <p style={{ color: statusColor, fontWeight: 700, marginTop: '0.2rem', textTransform: 'uppercase' }}>{statusText}</p>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.1rem', textTransform: 'uppercase', fontSize: '0.78rem' }}>{activeData.mood_label || activeData.human_label || 'Awaiting analysis'}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{activeData.mood_confidence ? `${Math.round(activeData.mood_confidence * 100)}% confidence` : activeData.mood_source ? activeData.mood_source : 'Analysis pending'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>DRIVER / TEAM</p>
              <p style={{ color: 'var(--text-primary)', marginTop: '0.2rem' }}>{activeData.driver_code || '—'} {activeData.driver_name ? `· ${activeData.driver_name}` : ''}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{activeData.gp || 'Live radio'} · {activeData.session || '—'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>LATEST RADIO</p>
              <p style={{ color: 'var(--text-primary)', marginTop: '0.2rem', fontSize: '0.78rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{activeData.transcript || activeData.text || 'No transcript yet.'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>ASSOCIATED LAP</p>
              <p style={{ color: 'var(--text-primary)', marginTop: '0.2rem' }}>L{activeData.lap_number ?? '—'} {selectedLapInsight?.delta_from_median != null ? `· ${selectedLapInsight.delta_from_median >= 0 ? '+' : ''}${selectedLapInsight.delta_from_median.toFixed(3)}s` : ''}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{selectedLapInsight?.concern_reason || 'Compared with session median when timing loads.'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>WHAT THIS MEANS</p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', fontSize: '0.72rem', lineHeight: 1.4 }}>{labelExplanation}</p>
            </div>
          </div>
        </Card>
      )}

      <div 
        className="telemetry-main-grid"
        style={!activeData ? { gridTemplateColumns: 'minmax(400px, 1fr) minmax(400px, 1fr)' } : undefined}
      >
        
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
              RADIO ARCHIVE <span style={{ color: 'var(--text-muted)' }}>— local 2026 audio / OpenF1 recordings and FastF1 lap context</span>
            </summary>
            <div style={{ marginTop: '0.85rem' }}>
              <OpenF1RadioArchive
                compact
                onClipSelect={handleLibrarySelect}
                onLatestRadio={setLatestRadio}
                selectedClipId={!isLiveUpload && activeData ? activeData.clip_id : undefined}
              />
            </div>
          </details>
          <details style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)', padding: '0.7rem 0.8rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              PRIORITY RADIO QUEUE <span style={{ color: 'var(--text-muted)' }}>— up to 3 clips</span>
            </summary>
            <div style={{ marginTop: '0.6rem' }}>
              <PriorityQueue onClipSelect={handleLibrarySelect} refreshKey={activeData?.clip_id} maxItems={3} />
            </div>
          </details>
          {latestRadio && !activeData && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '0 0.2rem' }}>
              LATEST ARCHIVE RADIO · {latestRadio.driver_code} · {latestRadio.date ? formatTrackTime(latestRadio.date, latestRadio.gp) : '—'}
            </p>
          )}
        </div>

        {/* Selected radio detail and matching FastF1 timing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: 0 }}>
          {activeData ? (
            <>
              {/* Top Right: Emotion Display */}
              <div style={{ flexShrink: 0 }}>
                <MoodDisplay 
                  transcript={activeData.transcript || activeData.text}
                  chunks={activeData.chunks}
                  playbackTime={playbackTime}
                  audioLabel={activeData.audio_model_label || activeData.human_label}
                  audioConfidence={activeData.audio_model_confidence}
                  textLabel={activeData.text_model_label || activeData.human_label}
                  textIntensity={activeData.text_model_intensity || activeData.human_label_intensity}
                  transcriptionStatus={activeData.transcription_status}
                  audioStatus={activeData.audio_analysis_status}
                  textStatus={activeData.text_analysis_status}
                  audioFallback={activeData.audio_fallback}
                  moodLabel={activeData.mood_label}
                  moodConfidence={activeData.mood_confidence}
                  moodSource={activeData.mood_source}
                  fatigueLabel={activeData.fatigue_label}
                  fatigueConfidence={activeData.fatigue_confidence}
                  fatigueEvidence={activeData.fatigue_evidence}
                  fatigueStatus={activeData.fatigue_status}
                />
                {activeData.audio_url && (
                  <AudioPlayback audioUrl={activeData.audio_url} title="Selected team radio" onTimeUpdate={setPlaybackTime} />
                )}
                {['openf1', 'local'].includes(activeData.source) && (
                  <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={useDenoiser}
                        onChange={(e) => setUseDenoiser(e.target.checked)}
                        style={{ accentColor: 'var(--accent-f1)' }}
                      />
                      USE AI DENOISER (SPEECHBRAIN)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => analyzeSelectedArchiveRadio(false)}
                        disabled={analyzingArchiveRadio}
                        style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-f1)', background: analyzingArchiveRadio ? 'var(--bg-panel-solid)' : 'var(--accent-f1)', color: 'white', cursor: analyzingArchiveRadio ? 'wait' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                      >
                        {analyzingArchiveRadio ? 'ANALYZING RADIO…' : 'TRANSCRIBE + ANALYZE THIS RADIO'}
                      </button>
                      <button
                        type="button"
                        onClick={saveToDataset}
                        title="Instantly save the current analysis displayed above into the training dataset without re-running models."
                        style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--mood-frustrated)', background: 'transparent', color: 'var(--mood-frustrated)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                      >
                        SAVE CURRENT TO DATASET (OVERWRITE)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Right: Telemetry Chart and Track Map */}
              {hasEnteredLapTimes || (activeData.gp && activeData.session && activeData.driver_code && activeData.driver_code !== 'LIVE' && activeData.gp !== 'Live uploads') ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '1.25rem', flexDirection: 'row' }}>
                  <div style={{ flex: 2, display: 'flex', minWidth: 0, minHeight: 0 }}>
                    <LapChart 
                      gp={activeData.gp || ''}
                      session={activeData.session || ''}
                      driver={activeData.driver_code || 'LIVE'}
                      year={activeData.year}
                      selectedClipId={activeData.clip_id}
                      selectedLapNumber={activeData.lap_number}
                      selectedMoodLabel={activeData.mood_label || activeData.human_label}
                      lapTimes={activeData.lap_times}
                      onSelectedLapInsight={handleSelectedLapInsight}
                      showAiInsight={showAiInsight}
                    />
                  </div>
                  {/* Track map is only available for FastF1 archive sessions, not manual live uploads with just lap times */}
                  {!hasEnteredLapTimes && (
                    <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
                      <TrackMap
                        gp={activeData.gp || ''}
                        session={activeData.session || ''}
                        driver={activeData.driver_code || 'LIVE'}
                        year={activeData.year}
                        selectedLapNumber={activeData.lap_number}
                        selectedMoodLabel={activeData.mood_label || activeData.human_label}
                        selectedClipId={activeData.clip_id}
                      />
                    </div>
                  )}
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
