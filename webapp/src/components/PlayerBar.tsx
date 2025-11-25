import { useEffect, useRef } from 'react';
import { selectCurrentTrack, usePlayerStore } from '../store/player.ts';
import { formatDuration } from '../utils/format.ts';

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const nowPlayingAlbum = usePlayerStore((state) => state.nowPlayingAlbum);
  const nowPlayingCoverUrl = usePlayerStore((state) => state.nowPlayingCoverUrl);
  const play = usePlayerStore((state) => state.play);
  const pause = usePlayerStore((state) => state.pause);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.streamingUrl) {
      return;
    }
    audio.src = currentTrack.streamingUrl;
    if (isPlaying) {
      void audio.play().catch(() => undefined);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (isPlaying) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const handleEnded = () => next();
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [next]);

  if (!currentTrack) {
    return (
      <footer className="player-bar">
        <audio ref={audioRef} hidden />
        <p>Select an album to start playing.</p>
      </footer>
    );
  }

  const handleToggle = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <footer className="player-bar">
      <audio ref={audioRef} hidden />
      {nowPlayingCoverUrl && (
        <div className="player-cover">
          <img src={nowPlayingCoverUrl} alt={nowPlayingAlbum ?? 'Album cover'} />
        </div>
      )}
      <div className="player-track">
        <strong>{currentTrack.title}</strong>
        <span>{nowPlayingAlbum ?? 'Unknown album'}</span>
      </div>
      <div className="player-controls">
        <button type="button" onClick={previous} title="Previous track">
          ⏮
        </button>
        <button type="button" onClick={handleToggle} title="Toggle play">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button type="button" onClick={next} title="Next track">
          ⏭
        </button>
      </div>
      <div className="player-meta">
        <span>{currentTrack.format}</span>
        <span>{formatDuration(currentTrack.durationMs)}</span>
      </div>
    </footer>
  );
}

