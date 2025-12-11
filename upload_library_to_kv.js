#!/usr/bin/env node
/**
 * Upload library.generated.json to Cloudflare KV
 * This script is used after durations are merged into the library file
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import process from 'node:process';

const accountId = process.env.CF_ACCOUNT_ID;
const namespaceId = process.env.CF_KV_NAMESPACE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
// Prefer comprehensive library, fallback to generated library
const comprehensivePath = 'webapp/data/library.comprehensive.json';
const generatedPath = 'webapp/data/library.generated.json';
const libraryPath = process.argv[2] || (require('fs').existsSync(comprehensivePath) ? comprehensivePath : generatedPath);

// Cloudflare KV limits
const MAX_VALUE_SIZE = 25 * 1024 * 1024; // 25MB per value
const MAX_REQUEST_SIZE = 100 * 1024 * 1024; // 100MB total request

if (!accountId || !namespaceId || !apiToken) {
  console.warn('⚠️  Cloudflare KV credentials not provided. Skipping KV upload.');
  console.warn('   Set CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, and CLOUDFLARE_API_TOKEN to enable.');
  process.exit(0);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 60000)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt, baseDelay = 1000, maxDelay = 60000) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Add jitter (random 0-30% of delay) to prevent synchronized retries
  const jitter = Math.random() * 0.3 * exponentialDelay;
  
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 5)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 60000)
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 60000,
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if error is retryable (429 or 500-599)
      const isRetryable = error.status === 429 || 
                         (error.status >= 500 && error.status < 600);
      
      if (!isRetryable) {
        // Not a retryable error, throw immediately
        throw error;
      }
      
      // Calculate delay
      let delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);
      
      // Check if error has Retry-After header (for 429 errors)
      if (error.retryAfter) {
        delay = Math.max(delay, error.retryAfter * 1000); // Convert seconds to ms
        console.log(`   ⏳ Rate limited. Waiting ${error.retryAfter} seconds (as specified by Retry-After header)...`);
      } else if (error.status === 429) {
        console.log(`   ⏳ Rate limited (429). Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
      } else {
        console.log(`   ⏳ Server error (${error.status}). Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
      }
      
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  throw lastError;
}

async function uploadToKV() {
  try {
    console.log(`📤 Reading library file: ${libraryPath}`);
    
    // Check file size before reading
    const fileStats = await stat(libraryPath);
    const fileSizeBytes = fileStats.size;
    console.log(`   File size: ${formatBytes(fileSizeBytes)}`);
    
    if (fileSizeBytes > MAX_VALUE_SIZE) {
      console.error('❌ Library file is too large for Cloudflare KV!');
      console.error(`   File size: ${formatBytes(fileSizeBytes)}`);
      console.error(`   KV limit: ${formatBytes(MAX_VALUE_SIZE)}`);
      console.error(`   Exceeds limit by: ${formatBytes(fileSizeBytes - MAX_VALUE_SIZE)}`);
      console.error('\n💡 Solutions:');
      console.error('   1. Remove unnecessary data (e.g., pre-generated links can be generated on-demand)');
      console.error('   2. Split the library into multiple KV keys');
      console.error('   3. Use Cloudflare R2 or another storage solution for large files');
      throw new Error(`Library file exceeds KV size limit: ${formatBytes(fileSizeBytes)} > ${formatBytes(MAX_VALUE_SIZE)}`);
    }
    
    if (fileSizeBytes > MAX_VALUE_SIZE * 0.9) {
      console.warn('⚠️  Warning: File size is close to KV limit (90%+)');
    }
    
    const libraryContent = await readFile(libraryPath, 'utf-8');
    const library = JSON.parse(libraryContent);
    
    // Extract links to separate file (stored in GitHub as static asset)
    // This keeps KV payload small while preserving all pre-generated links
    const linksMap = {};
    let linksExtracted = 0;
    
    for (const album of library.albums || []) {
      for (const track of album.tracks || []) {
        if (track.streamingUrl || track.downloadUrl) {
          linksMap[track.id] = {
            streamingUrl: track.streamingUrl || null,
            downloadUrl: track.downloadUrl || null,
          };
          linksExtracted++;
          
          // Remove from library to reduce KV payload size
          delete track.streamingUrl;
          delete track.downloadUrl;
        }
      }
    }
    
    // Write links to separate JSON file (will be committed to repo)
    if (linksExtracted > 0) {
      const linksFilePath = libraryPath.replace(/\.json$/, '.links.json');
      const linksData = {
        generatedAt: library.generatedAt || new Date().toISOString(),
        trackCount: linksExtracted,
        links: linksMap,
      };
      
      await writeFile(linksFilePath, JSON.stringify(linksData, null, 2), 'utf-8');
      const linksFileSize = (await stat(linksFilePath)).size;
      console.log(`   Extracted ${linksExtracted} track links to: ${linksFilePath}`);
      console.log(`   Links file size: ${formatBytes(linksFileSize)}`);
      console.log(`   (Links will be served as static asset and merged at runtime)`);
    }
    
    // Minify JSON to reduce payload size
    const minifiedContent = JSON.stringify(library);
    const minifiedSize = Buffer.byteLength(minifiedContent, 'utf8');
    
    console.log(`📤 Uploading library snapshot to Cloudflare KV...`);
    console.log(`   Albums: ${library.albumCount}, Tracks: ${library.trackCount}`);
    
    // Count tracks with durations
    const tracksWithDurations = library.albums.reduce((sum, album) => 
      sum + album.tracks.filter(t => t.durationMs > 0).length, 0
    );
    console.log(`   Tracks with durations: ${tracksWithDurations}/${library.trackCount}`);
    console.log(`   Payload size: ${formatBytes(minifiedSize)}`);
    
    // Build request payload
    const requestBody = JSON.stringify([
      {
        key: 'library-snapshot',
        value: minifiedContent,
      },
    ]);
    
    const requestSize = Buffer.byteLength(requestBody, 'utf8');
    if (requestSize > MAX_REQUEST_SIZE) {
      console.error('❌ Request payload is too large!');
      console.error(`   Request size: ${formatBytes(requestSize)}`);
      console.error(`   Request limit: ${formatBytes(MAX_REQUEST_SIZE)}`);
      throw new Error(`Request payload exceeds limit: ${formatBytes(requestSize)} > ${formatBytes(MAX_REQUEST_SIZE)}`);
    }
    
    // Upload with retry logic for rate limiting and transient errors
    const result = await retryWithBackoff(async () => {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: requestBody,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Cloudflare KV bulk write failed: ${response.status} ${errorText}`);
        error.status = response.status;
        error.responseText = errorText;
        
        // Check for Retry-After header (for 429 errors)
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          error.retryAfter = parseInt(retryAfter, 10);
        }
        
        // Provide helpful diagnostics (only on first attempt or final failure)
        if (response.status === 429) {
          console.error('❌ Cloudflare KV rate limited (429 Too Many Requests):');
          console.error(`   Request size: ${formatBytes(requestSize)}`);
          console.error(`   Error: ${errorText.substring(0, 500)}`);
          if (retryAfter) {
            console.error(`   Retry-After: ${retryAfter} seconds`);
          }
          console.error('\n💡 Rate limiting typically occurs when:');
          console.error('   - Too many requests in a short time (Cloudflare limit: 1,200 requests per 5 minutes)');
          console.error('   - Multiple workflows running simultaneously');
          console.error('   - Previous uploads still processing');
          console.error('\n   The script will automatically retry with exponential backoff...');
        } else if (response.status === 500) {
          console.error('❌ Cloudflare KV server error (500):');
          console.error(`   Request size: ${formatBytes(requestSize)}`);
          console.error(`   Error: ${errorText.substring(0, 500)}`);
          console.error('\n💡 500 Internal Server Error typically indicates:');
          console.error('   - Payload too large (exceeds Cloudflare limits)');
          console.error('   - Invalid request format');
          console.error('   - Temporary Cloudflare service issue');
          console.error('\n   The script will automatically retry...');
        } else {
          // Non-retryable errors (4xx except 429)
          console.error('❌ Cloudflare KV upload failed:');
          console.error(`   Status: ${response.status} ${response.statusText}`);
          console.error(`   Request size: ${formatBytes(requestSize)}`);
          console.error(`   Error: ${errorText.substring(0, 500)}`);
        }
        
        throw error;
      }

      return await response.json();
    }, {
      maxRetries: 5,
      baseDelay: 2000, // Start with 2 seconds
      maxDelay: 120000, // Max 2 minutes between retries
    });

    console.log('✅ Cloudflare KV updated successfully with library (including durations)!');
    if (result.success !== undefined) {
      console.log(`   Success: ${result.success}`);
    }
  } catch (error) {
    console.error('❌ Error uploading to Cloudflare KV:', error);
    throw error;
  }
}

uploadToKV().catch((error) => {
  console.error('❌ Cloudflare KV update failed:', error);
  process.exit(1);
});

