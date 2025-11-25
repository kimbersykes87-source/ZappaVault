# Debugging Tools Guide

This project includes several debugging and testing utilities powered by Playwright and Chromium.

## Installation

Chromium and Playwright are already installed. If you need to reinstall browsers:
```bash
npx playwright install chromium
```

## Available Scripts

### Basic Debugging
```bash
npm run debug [url]
```
Opens Chromium and captures all console errors, page errors, and network failures in real-time. Default URL: `http://localhost:5173`

**Features:**
- Real-time console error capture
- Page error detection
- Network request failure tracking
- HTTP error response monitoring (4xx, 5xx)
- React error boundary detection
- Browser stays open for 30 seconds for manual inspection

### Route Testing
```bash
npm run test:routes [url]
```
Comprehensive test suite that checks:
- Home page loads correctly
- Library page displays albums
- Search functionality
- Album page navigation
- Player bar component
- Broken images
- Console errors
- Responsive design (mobile & desktop)

**Output:**
- Screenshots saved to `test-screenshots/`
- Test results saved to `test-results.json`
- Detailed pass/fail report in console

### Screenshot Utility
```bash
npm run test:screenshot [url] [output-dir]
```
Captures screenshots of the app in different viewports:
- Home page (desktop, tablet, mobile)
- Album pages (if available)
- Search results

**Output:**
- Screenshots saved to `screenshots/` by default (or custom directory)
- JSON report with all captured screenshots

### Network Monitoring
```bash
npm run test:network [url]
```
Monitors all network requests and provides:
- Request/response details
- Performance metrics (response times)
- Data transfer statistics
- API endpoint analysis
- Error detection

**Output:**
- Real-time request logging
- Detailed JSON report in `network-reports/`
- Performance statistics (avg, min, max response times)
- Total data transferred
- List of all API requests

### Unit Tests (Vitest)
```bash
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:ui       # Run tests with UI
```

### End-to-End Tests (Playwright)
```bash
npm run test:e2e      # Run Playwright test suite
npm run test:e2e:ui  # Run tests with Playwright's interactive UI mode
```

The Playwright test suite is located in `tests/example.spec.ts` and includes:
- Home page loading tests
- Library page content tests
- Search bar visibility tests
- Player bar component tests
- Navigation tests
- Console error detection

## Quick Start

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. In another terminal, run any debugging tool:
   ```bash
   npm run debug              # Basic debugging
   npm run test:routes        # Full route testing
   npm run test:network       # Network monitoring
   npm run test:screenshot    # Capture screenshots
   ```

## Output Directories

- `test-screenshots/` - Screenshots from route tests
- `screenshots/` - Screenshots from screenshot utility
- `network-reports/` - Network monitoring reports (JSON)
- `test-results.json` - Route test results (JSON)

## File Structure

```
webapp/
├── scripts/
│   ├── debug.ts              # Basic debugging script
│   ├── test-routes.ts        # Comprehensive route testing
│   ├── screenshot.ts         # Screenshot utility
│   └── network-monitor.ts    # Network monitoring
├── tests/
│   └── example.spec.ts       # Playwright E2E tests
├── playwright.config.ts     # Playwright configuration
└── DEBUGGING.md             # This file
```

## Tips

- All scripts use TypeScript with proper type imports (`import type`)
- Screenshots are full-page captures by default
- Network monitoring includes timing information for performance analysis
- Route tests automatically handle missing albums gracefully
- All tools support custom URLs via command-line arguments

## Troubleshooting

If Chromium fails to launch:
```bash
npx playwright install chromium
```

If you see import errors, ensure all dependencies are installed:
```bash
npm install
```

