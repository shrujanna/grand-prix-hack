import React, { useState, useRef, type ChangeEvent } from 'react';
import { Card } from './ui/Card';
import { LoadingState } from './ui/LoadingState';

interface AudioUploaderProps {
  onAnalysisComplete: (data: any) => void;
  onError: (error: string) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAnalysisComplete, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      onError("Please upload a valid audio file.");
      return;
    }

    // Set audio preview URL
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', file);
      // We explicitly leave transcript blank to trigger the backend's "No transcript" fallback
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      onAnalysisComplete(data);
    } catch (err: any) {
      onError(err.message || "Failed to analyze audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card variant="glass" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Live Telemetry Input</h2>
      
      {isProcessing ? (
        <div style={{ padding: '2rem 0' }}>
          <LoadingState message="ANALYZING VOICE SIGNATURE..." />
        </div>
      ) : (
        <>
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent-f1)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragging ? 'var(--bg-glass)' : 'transparent',
              transition: 'var(--transition-fast)'
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInput} 
              accept="audio/*" 
              style={{ display: 'none' }} 
            />
            
            <p style={{ fontFamily: 'var(--font-mono)', color: isDragging ? 'var(--accent-f1)' : 'var(--text-secondary)' }}>
              {isDragging ? 'DROP TO UPLOAD' : 'DRAG AUDIO CLIP HERE OR CLICK TO BROWSE'}
            </p>
          </div>

          {audioUrl && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Playback</p>
              <audio 
                controls 
                src={audioUrl} 
                style={{ width: '100%', height: '40px', outline: 'none' }}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
};
