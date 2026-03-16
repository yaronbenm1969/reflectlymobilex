#!/usr/bin/env python3
"""
separate_vocals.py — Extract clean vocals from audio using local Demucs.

Usage:
  python3 separate_vocals.py <input_audio_path> <output_dir> [model]

Output: JSON to stdout
  Success: { "success": true, "vocalsPath": "...", "noVocalsPath": "..." }
  Failure: { "success": false, "error": "..." }

Install:
  pip install demucs
"""

import sys
import os
import json
import subprocess


def main():
    if len(sys.argv) < 3:
        print(json.dumps({'success': False, 'error': 'Usage: separate_vocals.py <input_audio> <output_dir> [model]'}))
        sys.exit(1)

    audio_path = sys.argv[1]
    output_dir = sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else 'htdemucs'

    if not os.path.exists(audio_path):
        print(json.dumps({'success': False, 'error': f'Input file not found: {audio_path}'}))
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    # Run demucs with --two-stems=vocals
    # Output structure: output_dir/{model}/{audio_filename_no_ext}/vocals.wav + no_vocals.wav
    result = subprocess.run(
        [sys.executable, '-m', 'demucs',
         '--two-stems', 'vocals',
         '-n', model,
         '-o', output_dir,
         audio_path],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        error_msg = result.stderr or result.stdout or 'Unknown Demucs error'
        print(json.dumps({'success': False, 'error': error_msg[:500]}))
        sys.exit(1)

    audio_name = os.path.splitext(os.path.basename(audio_path))[0]
    vocals_path = os.path.join(output_dir, model, audio_name, 'vocals.wav')
    no_vocals_path = os.path.join(output_dir, model, audio_name, 'no_vocals.wav')

    if not os.path.exists(vocals_path):
        print(json.dumps({
            'success': False,
            'error': f'Vocals file not found at expected path: {vocals_path}. Demucs stdout: {result.stdout[:200]}'
        }))
        sys.exit(1)

    print(json.dumps({
        'success': True,
        'vocalsPath': vocals_path,
        'noVocalsPath': no_vocals_path if os.path.exists(no_vocals_path) else None
    }))


if __name__ == '__main__':
    main()
