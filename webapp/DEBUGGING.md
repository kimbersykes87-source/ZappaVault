# Debugging Tools Guide

This project includes several debugging and testing utilities powered by Playwright and Chromium.

## Available Scripts

### Basic Debugging
```bash
npm run debug [url]
```
Opens Chromium and captures all console errors, page errors, and network failures in real-time. Default URL: `http://localhost:5173`

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

Saves screenshots to `test-screenshots/` and results to `test-results.json`

### Screenshot Utility
```bash
npm run test:screenshot [url] [output-dir]
```
Captures screenshots of the app in different viewports:
- Home page (desktop, tablet, mobile)
- Album pages (if available)
- Search results

Saves screenshots to `screenshots/` by default

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

Saves detailed report to `network-reports/`

### End-to-End Tests
```bash
npm run test:e2e
```
Runs Playwright test suite (see `tests/example.spec.ts`)

```bash
npm run test:e2e:ui
```
Runs tests with Playwright's interactive UI mode

## Quick Start

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. In another terminal, run any debugging tool:
   ```bash
   npm run debug
   ```

## Output Directories

- `test-screenshots/` - Screenshots from route tests
- `screenshots/` - Screenshots from screenshot utility
- `network-reports/` - Network monitoring reports
- `test-results.json` - Route test results

