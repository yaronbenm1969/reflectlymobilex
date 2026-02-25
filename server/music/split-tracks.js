const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TRACKS = [
  { id: 'reflective-space', num: 1, file: 'מס_1_1772043855138.mp3', name: 'Reflective Space', key: 'D', bpm: 60 },
  { id: 'gentle-warmth', num: 2, file: 'Soft_Wallpaper_in_G_2_1772043789698.mp3', name: 'Gentle Warmth', key: 'G', bpm: 65 },
  { id: 'soft-hope', num: 3, file: 'Warm_Hands_on_Wood_3_1772043818768.mp3', name: 'Soft Hope', key: 'C', bpm: 70 },
  { id: 'tender-vulnerability', num: 4, file: 'Almost_Not_There_4_1772043053181.mp3', name: 'Tender Vulnerability', key: 'Am', bpm: 58 },
  { id: 'quiet-strength', num: 5, file: 'Low_Horizon_5_1772043541864.mp3', name: 'Quiet Strength', key: 'E', bpm: 62 },
  { id: 'light-movement', num: 6, file: 'Quiet_Corners_of_Wood_and_String_6_1772043700908.mp3', name: 'Light Movement', key: 'A', bpm: 80 },
  { id: 'floating-memory', num: 7, file: 'Hazy_Brass_Horizon_7_טרומבון_1772043111635.mp3', name: 'Floating Memory', key: 'Dm', bpm: 55 },
  { id: 'subtle-uplift', num: 9, file: 'Quiet_Wood_and_Wire_9ב_1772043734841.mp3', name: 'Subtle Uplift', key: 'Bb', bpm: 72 },
  { id: 'open-horizon', num: 10, file: 'Open_Field_in_D_10_עד_1772043666205.mp3', name: 'Open Horizon', key: 'D', bpm: 75 },
  { id: 'electric-pulse', num: 11, file: 'Midnight_Circuit_Bloom11_טכנו_1772043595892.mp3', name: 'Electric Pulse', key: 'Fm', bpm: 122 },
  { id: 'world-celebration', num: 12, file: 'Desert_Carnival_12_1772043092545.mp3', name: 'World Celebration', key: 'G', bpm: 110 },
];

const ASSETS_DIR = path.join(process.cwd(), 'attached_assets');
const OUTPUT_DIR = path.join(process.cwd(), 'temp', 'music', 'library', 'split');
const PHASE_DURATION = 60;
const FADE_DURATION = 2;

function getDuration(filePath) {
  const result = execSync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: 'utf-8' });
  return parseFloat(result.trim());
}

function splitTrack(track) {
  const inputPath = path.join(ASSETS_DIR, track.file);

  if (!fs.existsSync(inputPath)) {
    console.error(`  File not found: ${track.file}`);
    return null;
  }

  const totalDuration = getDuration(inputPath);
  console.log(`\n${track.num}. ${track.name} (${track.id}) - ${totalDuration.toFixed(0)}s`);

  let starts;
  if (totalDuration >= 180) {
    starts = [0, 60, totalDuration - 60];
  } else if (totalDuration >= 120) {
    const mid = (totalDuration - 60) / 2;
    starts = [0, mid, totalDuration - 60];
  } else {
    const third = totalDuration / 3;
    const phaseDur = Math.min(60, third + 10);
    starts = [0, third, totalDuration - phaseDur];
  }

  const phases = ['phase1', 'phase2', 'phase3'];
  const outputs = [];

  for (let i = 0; i < 3; i++) {
    const start = Math.max(0, starts[i]);
    const available = totalDuration - start;
    const dur = Math.min(PHASE_DURATION, available);
    const outputFile = `${track.id}_${phases[i]}.mp3`;
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    const fadeOutStart = Math.max(0, dur - FADE_DURATION);

    const cmd = `ffmpeg -y -i "${inputPath}" -ss ${start.toFixed(2)} -t ${dur.toFixed(2)} -af "afade=t=in:st=0:d=${FADE_DURATION},afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${FADE_DURATION}" -codec:a libmp3lame -b:a 192k "${outputPath}"`;

    try {
      execSync(cmd, { stdio: 'pipe' });
      const outDur = getDuration(outputPath);
      console.log(`  ${phases[i]}: ${start.toFixed(0)}s-${(start + dur).toFixed(0)}s -> ${outputFile} (${outDur.toFixed(0)}s)`);
      outputs.push({ phase: phases[i], file: outputFile, start, duration: outDur });
    } catch (err) {
      console.error(`  Failed ${phases[i]}: ${err.message}`);
    }
  }

  return { ...track, phases: outputs };
}

function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('=== Splitting ambient tracks into 3 phases ===');
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const results = [];
  for (const track of TRACKS) {
    const result = splitTrack(track);
    if (result) results.push(result);
  }

  console.log(`\n=== Done! ${results.length} tracks split into ${results.length * 3} files ===`);

  const manifest = {};
  for (const r of results) {
    manifest[r.id] = {
      name: r.name,
      key: r.key,
      bpm: r.bpm,
      phases: {}
    };
    for (const p of r.phases) {
      manifest[r.id].phases[p.phase] = { file: p.file, duration: p.duration };
    }
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${manifestPath}`);
}

main();
