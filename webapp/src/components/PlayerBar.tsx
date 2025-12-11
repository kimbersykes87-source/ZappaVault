import { useEffect, useRef, useState } from 'react';
import { selectCurrentTrack, usePlayerStore } from '../store/player.ts';
import { formatDuration } from '../utils/format.ts';
import { getProxyUrl } from '../lib/api.ts';

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const nowPlayingAlbum = usePlayerStore((state) => state.nowPlayingAlbum);
  const nowPlayingCoverUrl = usePlayerStore((state) => state.nowPlayingCoverUrl);
  const play = usePlayerStore((state) => state.play);
  const pause = usePlayerStore((state) => state.pause);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const setLoading = usePlayerStore((state) => state.setLoading);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Load audio source when track changes (but don't play yet)
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
      setLoading(false);
    };
    
    const handleCanPlay = () => {
      console.log('Audio can play:', currentTrack.streamingUrl);
      setLoading(false);
    };
    
    const handleLoadStart = () => {
      console.log('Audio loading started:', currentTrack.streamingUrl);
      setLoading(true);
    };
    
    const handleLoadedData = () => {
      console.log('Audio data loaded:', currentTrack.streamingUrl);
      setLoading(false);
    };
    
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);
    
    // Proxy the URL through our API to avoid CORS issues
    const proxiedUrl = currentTrack.streamingUrl?.startsWith('http') 
      ? getProxyUrl(currentTrack.streamingUrl)
      : currentTrack.streamingUrl;
    
    // Set crossOrigin to handle CORS (for proxied content)
    audio.crossOrigin = 'anonymous';
    // Set preload to help with streaming
    audio.preload = 'auto';
    
    // Only update src if it's different to avoid unnecessary reloads
    if (audio.src !== proxiedUrl) {
      audio.src = proxiedUrl;
      // Load the audio source
      audio.load();
    }
    
    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [currentTrack, setLoading]);

  // Control play/pause when isPlaying changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.streamingUrl) {
      return;
    }
    
    // Only control play/pause, don't load audio here
    if (isPlaying) {
      // Wait a bit to ensure audio is loaded, then play
      const playWhenReady = () => {
        if (audio.readyState >= audio.HAVE_FUTURE_DATA) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              // Ignore AbortError - it's expected when switching tracks quickly
              if (err.name !== 'AbortError') {
                console.error('Audio play failed:', err);
              }
            });
          }
        } else {
          // Wait for audio to be ready
          const handleCanPlay = () => {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                if (err.name !== 'AbortError') {
                  console.error('Audio play failed:', err);
                }
              });
            }
          };
          audio.addEventListener('canplay', handleCanPlay, { once: true });
          return () => {
            audio.removeEventListener('canplay', handleCanPlay);
          };
        }
      };
      
      // Small delay to avoid race condition with audio loading
      const timeoutId = setTimeout(playWhenReady, 100);
      return () => clearTimeout(timeoutId);
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

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

  // Track time for progress bar and display
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }

    const updateTime = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const totalDuration = audio.duration * 1000;
        const current = audio.currentTime * 1000;
        const remaining = Math.max(0, totalDuration - current);
        setDuration(totalDuration);
        setCurrentTime(current);
        setTimeRemaining(remaining);
      } else {
        // If duration not loaded yet, use track duration
        const trackDuration = currentTrack.durationMs || 0;
        setDuration(trackDuration);
        setTimeRemaining(trackDuration);
        setCurrentTime(0);
      }
    };

    const handleTimeUpdate = () => {
      updateTime();
    };

    const handleLoadedMetadata = () => {
      updateTime();
    };

    const handleDurationChange = () => {
      updateTime();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    
    // Initial update
    updateTime();

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
  }, [currentTrack]);

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

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = parseFloat(e.target.value);
    }
  };

  return (
    <footer className="player-bar">
      <audio ref={audioRef} hidden />
      <div className="player-bar-content">
        {nowPlayingCoverUrl && (
          <div className="player-cover">
            <img 
              src={getProxyUrl(nowPlayingCoverUrl)} 
              alt={nowPlayingAlbum ?? 'Album cover'} 
              crossOrigin="anonymous"
            />
          </div>
        )}
        <div className="player-track">
          <strong>{currentTrack.title}</strong>
          <span>{nowPlayingAlbum ?? 'Unknown album'}</span>
        </div>
        <div className="player-controls">
          <button type="button" onClick={previous} title="Previous track" aria-label="Previous track">
            ⏮
          </button>
          <button type="button" onClick={handleToggle} title={isPlaying ? "Pause" : "Play"} disabled={isLoading} aria-label={isPlaying ? "Pause" : "Play"}>
            {isLoading ? (
              <span className="loading-spinner-small">⟳</span>
            ) : isPlaying ? '⏸' : '▶'}
          </button>
          <button type="button" onClick={next} title="Next track" aria-label="Next track">
            ⏭
          </button>
        </div>
        <div className="player-time">
          <span>{formatDuration(currentTime)}</span>
          <span className="player-time-separator">/</span>
          <span>{formatDuration(duration || currentTrack.durationMs || 0)}</span>
        </div>
        <div className="player-meta">
          <span>{currentTrack.format}</span>
        </div>
      </div>
      <div className="player-progress">
        <input
          type="range"
          className="player-progress-bar"
          min="0"
          max={duration || currentTrack.durationMs || 0}
          value={currentTime}
          onChange={handleProgressChange}
          step="0.1"
          aria-label="Seek"
        />
      </div>
    </footer>
  );
}

