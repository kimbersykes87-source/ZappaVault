import { useEffect } from 'react';
import { usePlayerStore } from '../store/player.ts';

export function useKeyboardShortcuts() {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const play = usePlayerStore((state) => state.play);
  const pause = usePlayerStore((state) => state.pause);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar - Play/Pause
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;
        case 'ArrowLeft': // Previous track
          e.preventDefault();
          previous();
          break;
        case 'ArrowRight': // Next track
          e.preventDefault();
          next();
          break;
        case '/': // Focus search
          e.preventDefault();
          const searchInput = document.querySelector('.search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;
        case 'Escape': // Clear search
          const activeSearchInput = document.activeElement as HTMLInputElement;
          if (activeSearchInput?.classList.contains('search-input')) {
            activeSearchInput.blur();
            activeSearchInput.value = '';
            activeSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, play, pause, next, previous]);
}

