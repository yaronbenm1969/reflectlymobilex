import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CubeWebView from '../cube3d/CubeWebView';
import { FlipPagesWebView } from './FlipPagesWebView';

const AnimationPlayer = ({
  format = 'cube-3d',
  faces = [],
  onFaceChange,
  onVideoStart,
  onVideoEnd,
  onPlaybackStart,
  onPlaybackComplete,
  onReadyToPlay,
  isFullscreen = false,
  currentPlayingFaceIndex = -1,
  storyName = '',
  triggerAutoPlay = false,
}) => {
  console.log('🎬 AnimationPlayer rendering format:', format);
  
  switch (format) {
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
          isFullscreen={isFullscreen}
          triggerAutoPlay={triggerAutoPlay}
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
          isFullscreen={isFullscreen}
          currentPlayingFaceIndex={currentPlayingFaceIndex}
          triggerAutoPlay={triggerAutoPlay}
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
