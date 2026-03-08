import { useState } from 'react';
import { CaptureProvider } from '@/context/CaptureContext';
import { FieldCaptureDashboard } from '@/components/FieldCaptureDashboard';
import { SocialMediaKit } from '@/components/SocialMediaKit';
import { SlideStudio } from '@/components/SlideStudio';
import { MasterNewsletter } from '@/components/MasterNewsletter';
import { Settings } from '@/components/Settings';
import './App.css';

type ViewId = 'field-capture' | 'social-kit' | 'slide-studio' | 'newsletter' | 'settings';

const VIEWS: { id: ViewId; label: string; short: string }[] = [
  { id: 'field-capture', label: 'Field Capture Dashboard', short: 'Field Capture' },
  { id: 'social-kit', label: 'Social Media Kit', short: 'Social Kit' },
  { id: 'slide-studio', label: 'Slide Studio', short: 'Slide Studio' },
  { id: 'newsletter', label: 'Master Newsletter', short: 'Newsletter' },
  { id: 'settings', label: 'Settings', short: 'Settings' },
];

function AppContent() {
  const [view, setView] = useState<ViewId>('field-capture');

  return (
    <div className="app-layout">
      <aside className="sidebar" aria-label="Suite navigation">
        <div className="sidebar-brand">
          <h1 className="sidebar-title">Deputy Mayor 2.0</h1>
          <p className="sidebar-tagline">Municipal suite</p>
        </div>
        <nav className="sidebar-nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`sidebar-btn ${view === v.id ? 'active' : ''}`}
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? 'page' : undefined}
            >
              <span className="sidebar-btn-label">{v.short}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content" id="main-content">
        {view === 'field-capture' && <FieldCaptureDashboard />}
        {view === 'social-kit' && <SocialMediaKit />}
        {view === 'slide-studio' && <SlideStudio />}
        {view === 'newsletter' && <MasterNewsletter />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}

function App() {
  return (
    <CaptureProvider>
      <AppContent />
    </CaptureProvider>
  );
}

export default App;
