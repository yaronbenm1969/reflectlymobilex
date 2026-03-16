/**
 * vocal-separator.js
 *
 * Separates clean vocals from a recorded audio/video clip.
 * Tries local Demucs (free, no API cost) first.
 * Falls back to Replicate API if Demucs is not installed locally.
 *
 * Local install (on server):
 *   pip install demucs
 */

const { execFile, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const PYTHON_SCRIPT = path.join(__dirname, 'separate_vocals.py');

/**
 * Check if local Python + Demucs is available.
 * Cached after first check.
 */
let _demucsAvailable = null;
async function isDemucsAvailable() {
  if (_demucsAvailable !== null) return _demucsAvailable;
  return new Promise((resolve) => {
    exec('python3 -c "import demucs; print(\'ok\')"', { timeout: 5000 }, (err, stdout) => {
      _demucsAvailable = !err && stdout.trim() === 'ok';
      console.log(`🎤 Local Demucs available: ${_demucsAvailable}`);
      resolve(_demucsAvailable);
    });
  });
}

/**
 * Separate vocals using local Demucs (free, runs on server).
 * @param {string} audioPath - Input audio file (WAV/MP3/M4A)
 * @param {string} outputDir - Directory to write separated stems
 * @returns {{ vocalsPath: string, noVocalsPath: string|null }}
 */
async function separateVocalsLocal(audioPath, outputDir) {
  return new Promise((resolve, reject) => {
    console.log(`🎤 Running local Demucs on: ${path.basename(audioPath)}`);
    execFile(
      'python3',
      [PYTHON_SCRIPT, audioPath, outputDir, 'htdemucs'],
      { timeout: 5 * 60 * 1000 }, // 5 min max
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Demucs process error: ${stderr || err.message}`));
          return;
        }
        const lastLine = stdout.trim().split('\n').pop();
        try {
          const result = JSON.parse(lastLine);
          if (!result.success) reject(new Error(result.error));
          else resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Demucs output: ${stdout.slice(-200)}`));
        }
      }
    );
  });
}

/**
 * Download a file from URL to local path.
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(outputPath); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      reject(err);
    });
  });
}

/**
 * Separate vocals using Replicate API (fallback — has per-use cost).
 * @param {string} audioPath - Input audio file
 * @param {string} outputDir - Directory to save downloaded vocals
 * @returns {{ vocalsPath: string, noVocalsPath: null }}
 */
async function separateVocalsReplicate(audioPath, outputDir) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not set and local Demucs unavailable');
  }
  const Replicate = require('replicate');
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  console.log('☁️ Falling back to Replicate Demucs API (has cost)');

  const audioData = fs.readFileSync(audioPath);
  const ext = path.extname(audioPath).slice(1) || 'wav';
  const dataUri = `data:audio/${ext};base64,${audioData.toString('base64')}`;

  const output = await replicate.run(
    'ardianfe/demucs-prod:3b8bf0e0aa0acbc689cbee5ba0e1eee3aee86b468b3e30e0d498a26832414a67',
    {
      input: {
        audio: dataUri,
        model: 'htdemucs',
        stem: 'vocals',
        shifts: 1,
        overlap: 0.25,
        jobs: 0,
        split: true
      }
    }
  );

  // Replicate returns an object with stem URLs
  const vocalsUrl = output?.vocals || (typeof output === 'string' ? output : null);
  if (!vocalsUrl) throw new Error('No vocals URL in Replicate Demucs response');

  const vocalsPath = path.join(outputDir, 'vocals_replicate.wav');
  await downloadFile(vocalsUrl, vocalsPath);
  return { vocalsPath, noVocalsPath: null };
}

/**
 * Main entry point: separate vocals from an audio file.
 * Uses local Demucs if available; falls back to Replicate API.
 *
 * @param {string} audioPath - Path to input audio (WAV preferred)
 * @param {string} outputDir - Directory for separated output files
 * @returns {{ vocalsPath: string, noVocalsPath: string|null }}
 */
async function separateVocals(audioPath, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const localAvailable = await isDemucsAvailable();
  if (localAvailable) {
    return separateVocalsLocal(audioPath, outputDir);
  }
  return separateVocalsReplicate(audioPath, outputDir);
}

module.exports = { separateVocals, isDemucsAvailable };
