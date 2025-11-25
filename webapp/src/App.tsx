import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { AlbumPage } from './pages/AlbumPage.tsx';
import { PlayerBar } from './components/PlayerBar.tsx';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-brand">
            <img src="/Zappa-Logo.svg" alt="Frank Zappa Vault" className="app-header-logo" />
            <h1>Frank Zappa Vault</h1>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/album/:albumId" element={<AlbumPage />} />
          </Routes>
        </main>
        <PlayerBar />
      </div>
    </BrowserRouter>
  );
}

export default App;
