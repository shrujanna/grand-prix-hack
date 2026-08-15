import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';

interface AiControlCenterProps {
    activeData: any | null;
    onUpdateActiveData?: (newData: any) => void;
}

export const AiControlCenter: React.FC<AiControlCenterProps> = ({ activeData, onUpdateActiveData }) => {
    const [isRetraining, setIsRetraining] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const [editTranscript, setEditTranscript] = useState('');
    const [editMood, setEditMood] = useState('');
    const [editIntensity, setEditIntensity] = useState(3);

    useEffect(() => {
        if (activeData) {
            setEditTranscript(activeData.transcript || activeData.text || '');
            setEditMood(activeData.human_label || activeData.mood_label || 'unknown');
            setEditIntensity(activeData.human_label_intensity || activeData.text_model_intensity || (activeData.mood_confidence ? Math.max(1, Math.round(activeData.mood_confidence * 5)) : 3));
        } else {
            setEditTranscript('');
            setEditMood('unknown');
            setEditIntensity(3);
        }
    }, [activeData]);

    const handleSaveEdits = async () => {
        if (!activeData) return;
        setIsSaving(true);
        setMessage(null);
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
            
            const updatedData = {
                ...activeData,
                transcript: editTranscript,
                human_label: editMood,
                mood_label: editMood,
                human_label_intensity: editIntensity,
                text_model_intensity: editIntensity
            };

            const response = await fetch(`${baseUrl}/api/analyze/save-to-dataset?overwrite=true`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData) 
            });
            if (!response.ok) throw new Error('Failed to save edits to dataset');
            
            if (onUpdateActiveData) {
                onUpdateActiveData(updatedData);
            }
            
            setMessage({ text: 'Edits saved to dataset successfully. Ready to retrain!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRetrain = async () => {
        setIsRetraining(true);
        setMessage(null);
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${baseUrl}/api/analyze/admin/retrain`, { method: 'POST' });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'Retraining failed');
            }
            setMessage({ text: data.message || 'Model retrained successfully!', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setIsRetraining(false);
        }
    };

    return (
        <Card variant="glass" style={{ padding: '0.7rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }} aria-label="AI Control Center">
            <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>⚑ AI TRAINING STUDIO (ADMIN)</span>
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                Edit the AI's transcription or mood label below. Once you save your edits to the dataset, click Retrain to instantly update your local machine learning model.
            </p>

            {activeData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                    <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>EDIT TRANSCRIPTION</label>
                        <textarea 
                            value={editTranscript}
                            onChange={(e) => setEditTranscript(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', resize: 'vertical', minHeight: '60px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>EDIT MOOD LABEL</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select 
                                value={editMood}
                                onChange={(e) => setEditMood(e.target.value)}
                                style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                            >
                                <option value="unknown">Unknown</option>
                                <option value="neutral">Neutral</option>
                                <option value="frustrated">Frustrated</option>
                                <option value="happy">Happy</option>
                                <option value="dejected">Dejected</option>
                            </select>
                            <select
                                value={editIntensity}
                                onChange={(e) => setEditIntensity(parseInt(e.target.value))}
                                style={{ width: '80px', padding: '0.5rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                            >
                                <option value={1}>Lvl 1</option>
                                <option value={2}>Lvl 2</option>
                                <option value={3}>Lvl 3</option>
                                <option value={4}>Lvl 4</option>
                                <option value={5}>Lvl 5</option>
                            </select>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleSaveEdits}
                        disabled={isSaving}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            color: 'var(--accent-f1)',
                            border: '1px solid var(--accent-f1)',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            cursor: isSaving ? 'wait' : 'pointer',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            marginTop: '0.3rem'
                        }}
                    >
                        {isSaving ? 'SAVING...' : '1. SAVE EDITS TO DATASET'}
                    </button>
                </div>
            ) : (
                <div style={{ padding: '1rem', background: 'var(--bg-app)', borderRadius: '4px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>Select a radio clip first to edit it.</p>
                </div>
            )}

            <button
                onClick={handleRetrain}
                disabled={isRetraining}
                style={{
                    padding: '0.6rem 1rem',
                    background: isRetraining ? 'var(--bg-panel-solid)' : 'var(--accent-f1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    cursor: isRetraining ? 'wait' : 'pointer',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginTop: '0.5rem'
                }}
            >
                {isRetraining ? 'RETRAINING...' : '2. RETRAIN LOCAL MODEL'}
            </button>

            {message && (
                <div style={{
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    background: message.type === 'success' ? 'rgba(46, 213, 115, 0.15)' : 'var(--mood-frustrated-glow)',
                    color: message.type === 'success' ? '#2ed573' : 'var(--mood-frustrated)',
                    border: `1px solid ${message.type === 'success' ? '#2ed573' : 'var(--mood-frustrated)'}`
                }}>
                    {message.text}
                </div>
            )}
        </Card>
    );
};
