import { useState } from 'react';
import { MainView } from './pages/MainView';
import { ModelInsights } from './components/ModelInsights';
import './theme/index.css';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'insights'>('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-app)' }}>
      <nav style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '1rem', background: 'var(--bg-panel)', alignItems: 'center' }}>
        <h1 style={{ margin: 0, marginRight: '2rem', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--accent-f1)', marginRight: '8px' }}>|</span>
          <span className="live-gradient-text" style={{ fontSize: '1.2rem' }}>
            Radio Talk
          </span>
        </h1>
        <button 
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'dashboard' ? 'var(--accent-f1)' : 'transparent', color: activeTab === 'dashboard' ? 'white' : 'var(--text-primary)', border: '1px solid var(--accent-f1)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
        >
          ANALYTICS DASHBOARD
        </button>
        <button 
          onClick={() => setActiveTab('insights')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'insights' ? 'var(--accent-f1)' : 'transparent', color: activeTab === 'insights' ? 'white' : 'var(--text-primary)', border: '1px solid var(--accent-f1)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
        >
          CONTINUOUS LEARNING
        </button>
      </nav>
      {activeTab === 'dashboard' ? <MainView /> : <ModelInsights />}
    </div>
  )
}

export default App;
