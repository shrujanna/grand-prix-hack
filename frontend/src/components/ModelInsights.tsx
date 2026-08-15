import React, { useEffect, useState } from 'react';
import './ModelInsights.css';

interface RecentClip {
  clip_id: string;
  driver_code: string;
  lap_number: string;
  mood: string;
  text: string;
}

interface InsightsData {
  total_usable_samples: number;
  calm_slower_percentage: number;
  stressed_slower_percentage: number;
  recent_clips: RecentClip[];
}

const API_BASE_URL = 'http://localhost:8000';

export function ModelInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/training-insights`);
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error('Failed to fetch insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
    // Poll every 5 seconds to show the live flywheel effect
    const interval = setInterval(fetchInsights, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return <div className="insights-container">Loading model insights...</div>;
  }

  if (!data) {
    return <div className="insights-container">Failed to load insights.</div>;
  }



  return (
    <div className="insights-container">
      <div className="insights-header">
        <h2>Continuous Learning</h2>
        <p>Real-time machine learning pipeline monitoring</p>
      </div>

      <div className="insights-grid">
        <div className="metric-card">
          <div className="metric-value">{data.total_usable_samples}</div>
          <div className="metric-label">Total Data Points Ingested</div>
        </div>


      </div>

      <div className="feed-section">
        <h3>Live Data Ingestion Feed</h3>
        <div className="feed-list">
          {data.recent_clips.length === 0 ? (
            <p style={{ color: '#aaa' }}>No recent clips ingested.</p>
          ) : (
            data.recent_clips.map((clip, index) => {
              const isStressed = ['frustrated', 'dejected', 'angry'].includes(clip.mood.toLowerCase());
              const moodClass = isStressed ? 'stressed' : (['calm', 'neutral', 'happy'].includes(clip.mood.toLowerCase()) ? 'calm' : '');
              
              return (
                <div key={`${clip.clip_id}-${index}`} className={`feed-item ${moodClass}`}>
                  <div className="feed-meta">
                    <span className="feed-driver">{clip.driver_code || 'UNK'}</span>
                    <span className="feed-lap">Lap {clip.lap_number || '?'}</span>
                  </div>
                  <div className={`feed-mood ${moodClass}`}>
                    {clip.mood || 'Unlabeled'}
                  </div>
                  <div className="feed-text">
                    "{clip.text}"
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
