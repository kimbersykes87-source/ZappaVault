import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { AlbumPage } from './pages/AlbumPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { PlayerBar } from './components/PlayerBar.tsx';
import { Footer } from './components/Footer.tsx';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.ts';
import { useAnalytics } from './hooks/useAnalytics.ts';

function AppContent() {
  useKeyboardShortcuts();
  useAnalytics();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header-brand" aria-label="Return to the library homepage">
          <img src="/Zappa-Logo.svg" alt="Frank Zappa Vault" className="app-header-logo" />
          <h1>Frank Zappa Vault</h1>
        </Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/album/:albumId" element={<AlbumPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </main>
      <Footer />
      <PlayerBar />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
