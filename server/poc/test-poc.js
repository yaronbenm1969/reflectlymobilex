'use strict';
/**
 * test-poc.js — Automated test runner for the server-side Cube render POC.
 *
 * Usage:
 *   node server/poc/test-poc.js <storyId> [serverUrl]
 *
 * Examples:
 *   node server/poc/test-poc.js abc123xyz
 *   node server/poc/test-poc.js abc123xyz https://reflectlymobilex.onrender.com
 *
 * Env vars read from root .env (or already set in shell):
 *   ACCESS_CODE            — server access code (same as x-app-access-code header)
 *   EXPO_PUBLIC_ACCESS_CODE — fallback if ACCESS_CODE is absent
 *   POC_SERVER_URL         — override server URL
 *
 * No extra npm packages required — uses Node built-ins only.
 */

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

// ─── Load .env from root or server directory ──────────────────────────────────
function loadDotenv() {
  const candidates = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) {
        // Strip surrounding quotes if present
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
    return p;
  }
  return null;
}

const envFile = loadDotenv();

// ─── Config ───────────────────────────────────────────────────────────────────
const storyId   = process.argv[2];
const SERVER_URL = (process.argv[3] || process.env.POC_SERVER_URL || 'https://reflectlymobilex.onrender.com').replace(/\/$/, '');
const ACCESS_CODE = process.env.ACCESS_CODE || process.env.EXPO_PUBLIC_ACCESS_CODE || '';
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS      = 10 * 60 * 1000; // 10 minutes

if (!storyId) {
  console.error('');
  console.error('Usage: node server/poc/test-poc.js <storyId> [serverUrl]');
  console.error('');
  console.error('How to find a suitable storyId (≤20s total clip duration):');
  console.error('  1. Firebase Console → Firestore → stories collection');
  console.error('  2. Pick a story where you are the creator (videoUri exists)');
  console.error('  3. Choose one with a single short clip — no reflections yet');
  console.error('  4. Copy the document ID — that is the storyId');
  console.error('');
  process.exit(1);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(urlStr);
    const lib  = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':       'application/json',
        'x-app-access-code':  ACCESS_CODE,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
function elapsed(startMs) {
  const s = Math.floor((Date.now() - startMs) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function hr() { console.log('══════════════════════════════════════════════'); }

function printSuccess(d, startMs) {
  console.log('');
  hr();
  console.log('  ✅  POC RENDER COMPLETED');
  hr();
  console.log(`  Job ID         : ${d.jobId}`);
  console.log(`  Total time     : ${((d.totalDurationMs      || 0) / 1000).toFixed(1)}s`);
  console.log(`  Render+encode  : ${((d.renderAndEncodeDurationMs || 0) / 1000).toFixed(1)}s`);
  console.log(`  Frames         : ${d.frameCount}`);
  console.log(`  Output size    : ${d.outputSizeMb} MB`);
  console.log(`  Resolution     : ${d.outputResolution} @ ${d.outputFps}fps`);
  console.log(`  Wall clock     : ${elapsed(startMs)}`);
  console.log('');
  console.log('  Output URL (open in browser to play/download):');
  console.log(`  ${d.outputUrl}`);
  console.log('');
  hr();
}

function printFailure(d, startMs) {
  console.log('');
  hr();
  console.log('  ❌  POC RENDER FAILED');
  hr();
  console.log(`  Job ID     : ${d.jobId}`);
  console.log(`  Error code : ${d.errorCode || '(none)'}`);
  console.log(`  Error msg  : ${d.errorMessage || '(none)'}`);
  console.log(`  Wall clock : ${elapsed(startMs)}`);
  console.log('');
  console.log('  Next steps:');
  console.log('  • Open Render dashboard → Logs and search for [POC][MEM]');
  console.log('  • The last [POC][MEM] line before the crash = peak memory stage');
  console.log('  • errorCode DURATION_EXCEEDED → use a story with ≤20s of clips');
  console.log('  • errorCode NO_CHROMIUM       → Chromium not found on instance');
  console.log('  • errorCode DISK_FULL         → less than 700 MB free on /tmp');
  console.log('');
  hr();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  hr();
  console.log('  Cube Render POC — Automated Test Runner');
  hr();
  console.log(`  Env file  : ${envFile || '(none found — using shell env)'}`);
  console.log(`  Server    : ${SERVER_URL}`);
  console.log(`  Story ID  : ${storyId}`);
  console.log(`  Auth      : ${ACCESS_CODE ? 'ACCESS_CODE set ✓' : '⚠️  ACCESS_CODE empty — request will likely be rejected'}`);
  console.log('');

  // ── Step 1: Trigger render ─────────────────────────────────────────────────
  console.log('▶  Triggering POC render...');
  let triggerRes;
  try {
    triggerRes = await request('POST', `${SERVER_URL}/api/poc/render-cube`, { storyId });
  } catch (e) {
    console.error(`✗  Network error: ${e.message}`);
    process.exit(1);
  }

  if (triggerRes.status === 403) {
    console.error('✗  403 Access denied — check ACCESS_CODE / EXPO_PUBLIC_ACCESS_CODE in .env');
    process.exit(1);
  }
  if (triggerRes.status !== 200) {
    console.error(`✗  Trigger failed — HTTP ${triggerRes.status}: ${JSON.stringify(triggerRes.body)}`);
    process.exit(1);
  }

  const { jobId } = triggerRes.body;
  if (!jobId) {
    console.error('✗  Server did not return a jobId in the trigger response.');
    console.error('   Raw response:', JSON.stringify(triggerRes.body));
    process.exit(1);
  }

  console.log(`✓  Render accepted`);
  console.log(`   Job ID : ${jobId}`);
  console.log(`   Status endpoint: GET ${SERVER_URL}/api/poc/render-cube/${jobId}`);
  console.log('');
  console.log('   Polling every 5 seconds (max 10 min)...');
  console.log('');

  // ── Step 2: Poll ───────────────────────────────────────────────────────────
  const startMs  = Date.now();
  let lastStatus = '';

  while (true) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes;
    try {
      pollRes = await request('GET', `${SERVER_URL}/api/poc/render-cube/${jobId}`);
    } catch (e) {
      console.log(`  [${elapsed(startMs)}] Network error: ${e.message} — retrying...`);
      continue;
    }

    if (pollRes.status !== 200) {
      console.log(`  [${elapsed(startMs)}] Poll HTTP ${pollRes.status} — retrying...`);
      continue;
    }

    const d = pollRes.body;

    if (d.status !== lastStatus) {
      const extras = [];
      if (d.frameCount)              extras.push(`frames=${d.frameCount}`);
      if (d.renderAndEncodeDurationMs) extras.push(`render=${(d.renderAndEncodeDurationMs/1000).toFixed(0)}s`);
      const suffix = extras.length ? `  (${extras.join(', ')})` : '';
      console.log(`  [${elapsed(startMs)}] ${d.status}${suffix}`);
      lastStatus = d.status;
    }

    if (d.status === 'completed') { printSuccess(d, startMs); process.exit(0); }
    if (d.status === 'failed')    { printFailure(d, startMs); process.exit(1); }

    if (Date.now() - startMs > MAX_WAIT_MS) {
      console.error('✗  Timed out after 10 minutes — check Render logs.');
      process.exit(1);
    }
  }
}

main().catch(e => {
  console.error('Unhandled error:', e.message);
  process.exit(1);
});
