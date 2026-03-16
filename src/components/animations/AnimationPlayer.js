import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CubeWebView from '../cube3d/CubeWebView';
import { FlipPagesWebView } from './FlipPagesWebView';
import { CarouselWebView } from './CarouselWebView';
import { FilmStripWebView } from './FilmStripWebView';

const AnimationPlayer = ({
  format = 'cube-3d',
  faces = [],
  onFaceChange,
  onVideoStart,
  onVideoEnd,
  onPlaybackStart,
  onPlaybackComplete,
  onReadyToPlay,
  onRecordingSupport,
  onRecordingComplete,
  onRecordingProgress,
  isFullscreen = false,
  currentPlayingFaceIndex = -1,
  storyName = '',
  triggerAutoPlay = false,
  recordNextPlayback = false,
}) => {
  console.log('🎬 AnimationPlayer rendering format:', format);
  
  switch (format) {
    case 'film-strip':
      return (
        <FilmStripWebView
          faces={faces}
          storyName={storyName}
          onFaceChange={onFaceChange}
          onVideoStart={onVideoStart}
          onVideoEnd={onVideoEnd}
          onPlaybackStart={onPlaybackStart}
          onPlaybackComplete={onPlaybackComplete}
          onReadyToPlay={onReadyToPlay}
          onRecordingSupport={onRecordingSupport}
          onRecordingComplete={onRecordingComplete}
          onRecordingProgress={onRecordingProgress}
          isFullscreen={isFullscreen}
          triggerAutoPlay={triggerAutoPlay}
          recordNextPlayback={recordNextPlayback}
        />
      );

    case 'carousel-3d':
      return (
        <CarouselWebView
          faces={faces}
          onFaceChange={onFaceChange}
          onVideoStart={onVideoStart}
          onVideoEnd={onVideoEnd}
          onPlaybackStart={onPlaybackStart}
          onPlaybackComplete={onPlaybackComplete}
          onReadyToPlay={onReadyToPlay}
          onRecordingSupport={onRecordingSupport}
          onRecordingComplete={onRecordingComplete}
          onRecordingProgress={onRecordingProgress}
          isFullscreen={isFullscreen}
          triggerAutoPlay={triggerAutoPlay}
          recordNextPlayback={recordNextPlayback}
        />
      );

    case 'flip-pages':
      return (
        <FlipPagesWebView
          faces={faces}
          storyName={storyName}
          onFaceChange={onFaceChange}
          onVideoStart={onVideoStart}
          onVideoEnd={onVideoEnd}
          onPlaybackStart={onPlaybackStart}
          onPlaybackComplete={onPlaybackComplete}
          onReadyToPlay={onReadyToPlay}
          onRecordingSupport={onRecordingSupport}
          onRecordingComplete={onRecordingComplete}
          onRecordingProgress={onRecordingProgress}
          isFullscreen={isFullscreen}
          triggerAutoPlay={triggerAutoPlay}
          recordNextPlayback={recordNextPlayback}
        />
      );
    
    case 'cube-3d':
    default:
      return (
        <CubeWebView
          faces={faces}
          onFaceChange={onFaceChange}
          onVideoStart={onVideoStart}
          onVideoEnd={onVideoEnd}
          onPlaybackStart={onPlaybackStart}
          onPlaybackComplete={onPlaybackComplete}
          onReadyToPlay={onReadyToPlay}
          onRecordingSupport={onRecordingSupport}
          onRecordingComplete={onRecordingComplete}
          onRecordingProgress={onRecordingProgress}
          isFullscreen={isFullscreen}
          currentPlayingFaceIndex={currentPlayingFaceIndex}
          triggerAutoPlay={triggerAutoPlay}
          recordNextPlayback={recordNextPlayback}
        />
      );
  }
};

const styles = StyleSheet.create({
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  unsupportedText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});

export { AnimationPlayer };
