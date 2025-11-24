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
          <div>
            <p className="meta">Frank Zappa Vault</p>
            <h1>Extended Discography</h1>
            <p>
              Stream, search, and download curated recordings sourced from the family archive.
            </p>
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
