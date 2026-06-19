import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CubeWebView from '../cube3d/CubeWebView';
import { FlipPagesWebView } from './FlipPagesWebView';
import { CarouselWebView } from './CarouselWebView';
import { FilmStripWebView } from './FilmStripWebView';
import { SpotlightWebView } from './SpotlightWebView';

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
  backgroundUrl = null,
  backgroundMediaType = null,
  backgroundProxyUrl = null,
  musicUrl = null,
  autoRotate = true,
  rotationSpeed = 12000,
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
          backgroundUrl={backgroundUrl}
          backgroundMediaType={backgroundMediaType}
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
          backgroundUrl={backgroundUrl}
          backgroundMediaType={backgroundMediaType}
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
          backgroundUrl={backgroundUrl}
          backgroundMediaType={backgroundMediaType}
        />
      );

    case 'spotlight':
      return (
        <SpotlightWebView
          faces={faces}
          storyName={storyName}
          onPlaybackStart={onPlaybackStart}
          onPlaybackComplete={onPlaybackComplete}
          onReadyToPlay={onReadyToPlay}
          onRecordingSupport={onRecordingSupport}
          onRecordingComplete={onRecordingComplete}
          onRecordingProgress={onRecordingProgress}
          isFullscreen={isFullscreen}
          triggerAutoPlay={triggerAutoPlay}
          recordNextPlayback={recordNextPlayback}
          musicUrl={musicUrl}
        />
      );

    case 'cube-3d':
    default:
      return (
        <CubeWebView
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
          currentPlayingFaceIndex={currentPlayingFaceIndex}
          triggerAutoPlay={triggerAutoPlay}
          recordNextPlayback={recordNextPlayback}
          backgroundUrl={backgroundUrl}
          backgroundMediaType={backgroundMediaType}
          backgroundProxyUrl={backgroundProxyUrl}
          musicUrl={musicUrl}
          autoRotate={autoRotate}
          rotationSpeed={rotationSpeed}
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
