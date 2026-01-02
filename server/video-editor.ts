import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { videoStorageService } from './video-storage-service';

export interface VideoEditingOptions {
  projectId: string;
  musicStyle: string;
  storyTitle: string;
}

export interface EditingResult {
  success: boolean;
  finalVideoUrl?: string;
  duration?: number;
  error?: string;
}

export class VideoEditor {
  private tempDir: string;
  private static processingProjects = new Set<string>();
  private static maxConcurrentProjects = 1;
  private static lastCleanupTime = 0;
  private static cleanupInterval = 5 * 60 * 1000;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'editing');
    this.ensureTempDirectory();
    this.periodicCleanup();
  }

  private async ensureTempDirectory() {
    try {
      await fsPromises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async periodicCleanup() {
    const now = Date.now();
    if (now - VideoEditor.lastCleanupTime < VideoEditor.cleanupInterval) {
      return;
    }

    VideoEditor.lastCleanupTime = now;

    try {
      const files = await fsPromises.readdir(this.tempDir);
      const oldFiles = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(this.tempDir, file);
          try {
            const stats = await fsPromises.stat(filePath);
            const ageInMinutes = (now - stats.mtime.getTime()) / (1000 * 60);
            return ageInMinutes > 30 ? filePath : null;
          } catch {
            return null;
          }
        })
      );

      const filesToDelete = oldFiles.filter(Boolean) as string[];
      if (filesToDelete.length > 0) {
        console.log(`Periodic cleanup: removing ${filesToDelete.length} old temp files`);
        await Promise.all(
          filesToDelete.map(filePath =>
            fsPromises.unlink(filePath).catch(err =>
              console.log(`Could not delete old file ${filePath}:`, err)
            )
          )
        );
      }
    } catch (error) {
      console.log('Periodic cleanup failed:', error);
    }
  }

  async convertToCompatibleFormat(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`Converting ${inputPath} to browser-compatible format...`);
      
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-crf', '23',
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Converting: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('Conversion completed successfully');
          resolve(outputPath);
        })
        .on('error', (error) => {
          console.error('Conversion error:', error);
          reject(error);
        })
        .run();
    });
  }

  async convertWebmToMp4(webmPath: string, mp4Path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(webmPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'ultrafast',
          '-crf', '30'
        ])
        .output(mp4Path)
        .on('start', (commandLine) => {
          console.log(`Converting ${path.basename(webmPath)} to MP4...`);
        })
        .on('end', () => {
          console.log(`Conversion completed: ${path.basename(mp4Path)}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`Conversion error for ${path.basename(webmPath)}:`, error);
          reject(error);
        })
        .run();
    });
  }

  async convertMovToMp4(movPath: string, mp4Path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Converting MOV/HEVC to MP4/H.264: ${path.basename(movPath)}`);
      
      ffmpeg(movPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-crf', '23',
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
        ])
        .output(mp4Path)
        .on('start', (commandLine) => {
          console.log('FFmpeg MOV->MP4 command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`MOV->MP4 Progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log(`MOV->MP4 Conversion completed: ${path.basename(mp4Path)}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`MOV->MP4 Conversion error:`, error);
          reject(error);
        })
        .run();
    });
  }

  async cleanupTempFiles(projectId: string): Promise<void> {
    try {
      const files = await fsPromises.readdir(this.tempDir);
      const projectFiles = files.filter(file => file.includes(projectId));

      console.log(`Cleaning up ${projectFiles.length} temp files for project ${projectId}`);

      const cleanupPromises = projectFiles.map(async (file) => {
        const filePath = path.join(this.tempDir, file);
        try {
          await fsPromises.unlink(filePath);
          console.log(`Cleaned: ${file}`);
        } catch (error) {
          console.log(`Could not clean ${file}:`, error);
        }
      });

      await Promise.all(cleanupPromises);
    } catch (error) {
      console.log(`Could not access temp directory for cleanup:`, error);
    }
  }

  getTempDir(): string {
    return this.tempDir;
  }
}

export const videoEditor = new VideoEditor();
