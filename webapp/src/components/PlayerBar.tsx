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
    
    // Set up error handling for audio loading
    const handleError = (e: Event) => {
      console.error('Audio playback error:', e);
      const error = (e.target as HTMLAudioElement)?.error;
      if (error) {
        console.error('Audio error code:', error.code);
        console.error('Audio error message:', error.message);
        console.error('Streaming URL:', currentTrack.streamingUrl);
      }
    };
    
    const handleCanPlay = () => {
      console.log('Audio can play:', currentTrack.streamingUrl);
    };
    
    const handleLoadStart = () => {
      console.log('Audio loading started:', currentTrack.streamingUrl);
    };
    
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    
    // Set crossOrigin to handle CORS
    audio.crossOrigin = 'anonymous';
    // Set preload to help with streaming
    audio.preload = 'auto';
    audio.src = currentTrack.streamingUrl;
    
    // Load the audio source
    audio.load();
    
    if (isPlaying) {
      // Use a small delay to ensure the audio element is ready
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error('Audio play failed:', err);
          console.error('URL:', currentTrack.streamingUrl);
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
          // If autoplay was prevented, try to play on user interaction
          if (err.name === 'NotAllowedError') {
            console.warn('Autoplay prevented. User interaction required.');
          }
        });
      }
    }
    
    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
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

