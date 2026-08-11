import React, { useState } from 'react';
import { AudioUploader, type AnalysisResult } from '../components/AudioUploader';
import { ClipLibrary } from '../components/ClipLibrary';
import { MoodDisplay } from '../components/MoodDisplay';
import { LapChart } from '../components/LapChart';
import { Card } from '../components/ui/Card';
import '../theme/index.css';

export const MainView: React.FC = () => {
  // State for the currently active data to display on the right
  const [activeData, setActiveData] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Distinguish if the active data came from a live upload or the library
  // Library data has FastF1 lap context; live uploads do not.
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

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh', 
      padding: '2rem',
      maxWidth: '1600px',
      margin: '0 auto',
      gap: '2rem'
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

      {/* Main Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '400px 1fr', 
        gap: '2rem',
        flex: 1,
        minHeight: 0 // Allows children to scroll
      }}>
        
        {/* Left Column: Inputs & Library */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: 0 }}>
          <div style={{ flexShrink: 0 }}>
            <AudioUploader onAnalysisComplete={handleLiveUpload} onError={setAnalysisError} />
          </div>
          {analysisError && (
            <div role="alert" style={{ border: '1px solid var(--mood-frustrated)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.8rem', background: 'var(--mood-frustrated-glow)', fontSize: '0.875rem' }}>
              {analysisError}
            </div>
          )}
          
          <Card variant="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '1rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              RADIO ARCHIVE
            </h2>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ClipLibrary 
                onClipSelect={handleLibrarySelect} 
                selectedClipId={!isLiveUpload && activeData ? activeData.clip_id : undefined}
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Visualization */}
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
              </div>

              {/* Bottom Right: Telemetry Chart */}
              {!isLiveUpload && activeData.gp && activeData.session && activeData.driver_code ? (
                <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                  <LapChart 
                    gp={activeData.gp} 
                    session={activeData.session} 
                    driver={activeData.driver_code} 
                  />
                </div>
              ) : (
                <Card variant="glass" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    LAP TELEMETRY UNAVAILABLE FOR LIVE UPLOADS.<br/>SELECT AN ARCHIVED CLIP TO VIEW FASTF1 DATA.
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
