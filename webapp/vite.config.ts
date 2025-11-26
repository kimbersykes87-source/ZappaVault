import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Copy data files to dist during build
    {
      name: 'copy-data-files',
      closeBundle() {
        const dataDir = join(__dirname, 'data')
        const distDataDir = join(__dirname, 'dist', 'data')
        
        if (existsSync(dataDir)) {
          mkdirSync(distDataDir, { recursive: true })
          
          // Copy track_durations.json
          const trackDurationsSrc = join(dataDir, 'track_durations.json')
          const trackDurationsDest = join(distDataDir, 'track_durations.json')
          if (existsSync(trackDurationsSrc)) {
            copyFileSync(trackDurationsSrc, trackDurationsDest)
            console.log('✅ Copied track_durations.json to dist/data/')
          }
        }
      },
    },
  ],
  build: {
    sourcemap: false,
    minify: 'esbuild',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
