import { create } from 'zustand';
import type { Track } from '../../../shared/library.ts';

interface PlayerState {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  nowPlayingAlbum?: string;
  nowPlayingCoverUrl?: string;
  setQueue: (tracks: Track[], albumTitle?: string, coverUrl?: string) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  playTrackAt: (index: number) => void;
  clear: () => void;
  setLoading: (loading: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  isLoading: false,
  nowPlayingAlbum: undefined,
  setQueue: (tracks, albumTitle, coverUrl) =>
    set({
      queue: tracks,
      currentIndex: 0,
      isPlaying: tracks.length > 0,
      isLoading: tracks.length > 0,
      nowPlayingAlbum: albumTitle,
      nowPlayingCoverUrl: coverUrl,
    }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  next: () => {
    const { currentIndex, queue } = get();
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1, isPlaying: true, isLoading: true });
    }
  },
  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, isPlaying: true, isLoading: true });
    }
  },
  playTrackAt: (index) => {
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
      set({ currentIndex: index, isPlaying: true, isLoading: true });
    }
  },
  clear: () =>
    set({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      isLoading: false,
      nowPlayingAlbum: undefined,
      nowPlayingCoverUrl: undefined,
    }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

export const selectCurrentTrack = (state: PlayerState) =>
  state.queue[state.currentIndex];

