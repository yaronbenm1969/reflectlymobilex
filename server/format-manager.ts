import fs from 'fs';
import path from 'path';

export interface VideoFormat {
  extension: string;
  mimeType: string;
  displayName: string;
  isSupported: boolean;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  compressionRatio: number;
  mobileFriendly: boolean;
}

export interface ClipMetadata {
  filename: string;
  format: VideoFormat;
  size: number;
  duration?: number;
  resolution?: string;
  createdAt: Date;
  isCorrupted: boolean;
}

export class FormatManager {
  private static supportedFormats: VideoFormat[] = [
    {
      extension: 'mp4',
      mimeType: 'video/mp4',
      displayName: 'MP4',
      isSupported: true,
      quality: 'high',
      compressionRatio: 0.8,
      mobileFriendly: true
    },
    {
      extension: 'webm',
      mimeType: 'video/webm',
      displayName: 'WebM',
      isSupported: true,
      quality: 'high',
      compressionRatio: 0.7,
      mobileFriendly: true
    },
    {
      extension: 'mov',
      mimeType: 'video/quicktime',
      displayName: 'MOV',
      isSupported: true,
      quality: 'ultra',
      compressionRatio: 0.9,
      mobileFriendly: false
    },
    {
      extension: 'avi',
      mimeType: 'video/x-msvideo',
      displayName: 'AVI',
      isSupported: true,
      quality: 'medium',
      compressionRatio: 0.6,
      mobileFriendly: false
    },
    {
      extension: 'mkv',
      mimeType: 'video/x-matroska',
      displayName: 'MKV',
      isSupported: true,
      quality: 'ultra',
      compressionRatio: 0.8,
      mobileFriendly: false
    }
  ];

  private static futureFormats: VideoFormat[] = [
    {
      extension: 'hevc',
      mimeType: 'video/hevc',
      displayName: 'HEVC/H.265',
      isSupported: false,
      quality: 'ultra',
      compressionRatio: 0.5,
      mobileFriendly: true
    },
    {
      extension: 'av1',
      mimeType: 'video/av1',
      displayName: 'AV1',
      isSupported: false,
      quality: 'ultra',
      compressionRatio: 0.4,
      mobileFriendly: true
    }
  ];

  static getAllFormats(): VideoFormat[] {
    return [...this.supportedFormats, ...this.futureFormats];
  }

  static getSupportedFormats(): VideoFormat[] {
    return this.supportedFormats.filter(f => f.isSupported);
  }

  static getFormatByExtension(extension: string): VideoFormat | undefined {
    return this.supportedFormats.find(f => f.extension === extension.toLowerCase());
  }

  static isFormatSupported(extension: string): boolean {
    const format = this.getFormatByExtension(extension);
    return format ? format.isSupported : false;
  }

  static getMimeType(extension: string): string {
    const format = this.getFormatByExtension(extension);
    return format ? format.mimeType : 'video/mp4';
  }

  static getOptimalFormat(mobileFriendly: boolean = true): VideoFormat {
    const formats = this.getSupportedFormats();
    if (mobileFriendly) {
      return formats.find(f => f.mobileFriendly && f.quality === 'high') || formats[0];
    }
    return formats.find(f => f.quality === 'ultra') || formats[0];
  }

  static analyzeClip(filePath: string): ClipMetadata {
    try {
      const stats = fs.statSync(filePath);
      const extension = path.extname(filePath).substring(1);
      const format = this.getFormatByExtension(extension);

      return {
        filename: path.basename(filePath),
        format: format || this.supportedFormats[0],
        size: stats.size,
        createdAt: stats.birthtime,
        isCorrupted: stats.size === 0
      };
    } catch (error) {
      console.error('Error analyzing clip:', error);
      return {
        filename: path.basename(filePath),
        format: this.supportedFormats[0],
        size: 0,
        createdAt: new Date(),
        isCorrupted: true
      };
    }
  }

  static getConversionPlan(clips: ClipMetadata[], targetFormat: string = 'mp4'): {
    readyClips: ClipMetadata[];
    conversionNeeded: ClipMetadata[];
    unsupportedClips: ClipMetadata[];
  } {
    const readyClips = clips.filter(c => c.format.extension === targetFormat);
    const conversionNeeded = clips.filter(c =>
      c.format.extension !== targetFormat && c.format.isSupported && !c.isCorrupted
    );
    const unsupportedClips = clips.filter(c => !c.format.isSupported || c.isCorrupted);

    return {
      readyClips,
      conversionNeeded,
      unsupportedClips
    };
  }

  static needsConversion(mimeType: string): boolean {
    const incompatibleTypes = [
      'video/quicktime',
      'video/hevc',
      'video/x-m4v'
    ];
    return incompatibleTypes.includes(mimeType);
  }

  static enableFutureFormat(extension: string): boolean {
    const futureFormat = this.futureFormats.find(f => f.extension === extension);
    if (futureFormat) {
      futureFormat.isSupported = true;
      this.supportedFormats.push(futureFormat);
      return true;
    }
    return false;
  }

  static addCustomFormat(format: VideoFormat): void {
    this.supportedFormats.push(format);
  }
}
