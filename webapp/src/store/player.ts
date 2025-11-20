import { create } from 'zustand';
import type { Track } from '../../shared/library.ts';

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  nowPlayingAlbum?: string;
  setQueue: (tracks: Track[], albumTitle?: string) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  playTrackAt: (index: number) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  nowPlayingAlbum: undefined,
  setQueue: (tracks, albumTitle) =>
    set({
      queue: tracks,
      currentIndex: 0,
      isPlaying: tracks.length > 0,
      nowPlayingAlbum: albumTitle,
    }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  next: () => {
    const { currentIndex, queue } = get();
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1, isPlaying: true });
    }
  },
  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, isPlaying: true });
    }
  },
  playTrackAt: (index) => {
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
      set({ currentIndex: index, isPlaying: true });
    }
  },
  clear: () =>
    set({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      nowPlayingAlbum: undefined,
    }),
}));

export const selectCurrentTrack = (state: PlayerState) =>
  state.queue[state.currentIndex];

