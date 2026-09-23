import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { DataProvider, useData } from './lib/DataContext.jsx';
import { UIProvider } from './components/ui.jsx';
import { applySettings, loadLocalSettings } from './lib/settings.js';
import AuthScreen from './components/AuthScreen.jsx';
import Dashboard from './components/Dashboard.jsx';
import ProjectShell from './components/ProjectShell.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';

function Loading() {
  return <div className="auth"><p className="pencil">Opening your manuscripts…</p></div>;
}

function Main() {
  const { status } = useData();
  const [projectId, setProjectId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="auth"><p>Something went wrong loading your novels. Try reloading the page.</p></div>;

  if (settingsOpen) {
    return (
      <div className="app">
        <div className="shellHead">
          <button className="back" type="button" onClick={() => setSettingsOpen(false)}>‹ Back</button>
          <h2>Settings</h2>
        </div>
        <SettingsPanel />
      </div>
    );
  }
  if (projectId) return <ProjectShell projectId={projectId} onBack={() => setProjectId(null)} />;
  return <Dashboard onOpen={setProjectId} onSettings={() => setSettingsOpen(true)} />;
}

function Gate() {
  const { user, isLocal } = useAuth();
  if (!isLocal && user === undefined) return <Loading />;
  if (!isLocal && !user) return <AuthScreen />;
  return (
    <DataProvider>
      <Main />
    </DataProvider>
  );
}

export default function App() {
  useEffect(() => { applySettings(loadLocalSettings()); }, []);
  return (
    <AuthProvider>
      <UIProvider>
        <Gate />
      </UIProvider>
    </AuthProvider>
  );
}
