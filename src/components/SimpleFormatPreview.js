import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import theme from '../theme/theme';

const COLORS = ['#8446b0', '#464fb0', '#469bb0', '#5a73b0'];

export const SimpleFormatPreview = ({ type = 'standard', size = 50 }) => {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim1, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(anim1, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const createAnimation2 = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim2, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(anim2, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const animation1 = createAnimation();
    const animation2 = createAnimation2();
    animation1.start();
    animation2.start();

    return () => {
      animation1.stop();
      animation2.stop();
    };
  }, []);

  const renderPreview = () => {
    const boxSize = size * 0.35;
    
    switch (type) {
      case 'cube-3d':
        const cubeRotate = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '45deg'],
        });
        return (
          <Animated.View style={[styles.cube, { 
            width: boxSize, 
            height: boxSize,
            transform: [{ rotate: cubeRotate }],
            backgroundColor: COLORS[0],
          }]} />
        );

      case 'carousel-3d':
        const carousel1 = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: [-boxSize * 0.3, boxSize * 0.3],
        });
        const carousel2 = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: [boxSize * 0.3, -boxSize * 0.3],
        });
        return (
          <View style={styles.carouselContainer}>
            <Animated.View style={[styles.carouselItem, { 
              width: boxSize * 0.8, 
              height: boxSize,
              backgroundColor: COLORS[0],
              transform: [{ translateX: carousel1 }],
              opacity: 0.7,
            }]} />
            <Animated.View style={[styles.carouselItem, { 
              width: boxSize * 0.8, 
              height: boxSize,
              backgroundColor: COLORS[1],
              transform: [{ translateX: carousel2 }],
              position: 'absolute',
            }]} />
          </View>
        );

      case 'flip-pages':
        const flipRotate = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['0deg', '90deg', '0deg'],
        });
        const flipColor = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [COLORS[0], COLORS[1], COLORS[2]],
        });
        return (
          <Animated.View style={[styles.flipPage, { 
            width: boxSize, 
            height: boxSize * 1.2,
            backgroundColor: flipColor,
            transform: [{ rotateY: flipRotate }],
          }]} />
        );

      case 'stack-cards':
        return (
          <View style={styles.stackContainer}>
            <View style={[styles.stackCard, { 
              width: boxSize, 
              height: boxSize * 0.7,
              backgroundColor: COLORS[2],
              top: 0,
            }]} />
            <Animated.View style={[styles.stackCard, { 
              width: boxSize, 
              height: boxSize * 0.7,
              backgroundColor: COLORS[1],
              top: 4,
              transform: [{ translateY: anim1.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              })}],
            }]} />
            <View style={[styles.stackCard, { 
              width: boxSize, 
              height: boxSize * 0.7,
              backgroundColor: COLORS[0],
              top: 8,
            }]} />
          </View>
        );

      case 'tinder':
        const tinderX = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, boxSize * 0.5, 0],
        });
        const tinderRotate = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['0deg', '15deg', '0deg'],
        });
        return (
          <Animated.View style={[styles.tinderCard, { 
            width: boxSize, 
            height: boxSize * 1.2,
            backgroundColor: COLORS[0],
            transform: [
              { translateX: tinderX },
              { rotate: tinderRotate },
            ],
          }]} />
        );

      case 'fold':
        const foldScale = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 0.5, 1],
        });
        return (
          <Animated.View style={[styles.foldPage, { 
            width: boxSize, 
            height: boxSize * 1.2,
            backgroundColor: COLORS[0],
            transform: [{ scaleY: foldScale }],
          }]} />
        );

      case 'circular':
        const circularRotate = anim2.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        });
        return (
          <Animated.View style={[styles.circularContainer, {
            transform: [{ rotate: circularRotate }],
          }]}>
            <View style={[styles.circularDot, { backgroundColor: COLORS[0], top: 0 }]} />
            <View style={[styles.circularDot, { backgroundColor: COLORS[1], right: 0 }]} />
            <View style={[styles.circularDot, { backgroundColor: COLORS[2], bottom: 0 }]} />
            <View style={[styles.circularDot, { backgroundColor: COLORS[3], left: 0 }]} />
          </Animated.View>
        );

      case 'flow':
        const flowX = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: [-boxSize * 0.3, boxSize * 0.3],
        });
        return (
          <View style={styles.flowContainer}>
            <Animated.View style={[styles.flowItem, { 
              backgroundColor: COLORS[0],
              transform: [{ translateX: flowX }],
            }]} />
            <Animated.View style={[styles.flowItem, { 
              backgroundColor: COLORS[1],
              transform: [{ translateX: Animated.multiply(flowX, -1) }],
            }]} />
          </View>
        );

      case 'parallax':
        const parallax1 = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: [0, boxSize * 0.2],
        });
        const parallax2 = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: [0, boxSize * 0.4],
        });
        return (
          <View style={styles.parallaxContainer}>
            <Animated.View style={[styles.parallaxLayer, { 
              backgroundColor: COLORS[2],
              opacity: 0.5,
              transform: [{ translateX: parallax2 }],
            }]} />
            <Animated.View style={[styles.parallaxLayer, { 
              backgroundColor: COLORS[0],
              transform: [{ translateX: parallax1 }],
            }]} />
          </View>
        );

      case 'blur-rotate':
        const blurRotate = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '30deg'],
        });
        const blurOpacity = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 0.5, 1],
        });
        return (
          <Animated.View style={[styles.blurItem, { 
            width: boxSize, 
            height: boxSize,
            backgroundColor: COLORS[0],
            transform: [{ rotate: blurRotate }],
            opacity: blurOpacity,
          }]} />
        );

      case 'scale-fade':
        const scale = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 1, 0.6],
        });
        const opacity = anim1.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.3, 1, 0.3],
        });
        return (
          <Animated.View style={[styles.scaleItem, { 
            width: boxSize, 
            height: boxSize,
            backgroundColor: COLORS[0],
            transform: [{ scale }],
            opacity,
          }]} />
        );

      default: // standard
        const standardX = anim1.interpolate({
          inputRange: [0, 1],
          outputRange: [-boxSize * 0.5, boxSize * 0.5],
        });
        return (
          <Animated.View style={[styles.standardItem, { 
            width: boxSize, 
            height: boxSize * 0.6,
            backgroundColor: COLORS[0],
            transform: [{ translateX: standardX }],
          }]} />
        );
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {renderPreview()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  cube: {
    borderRadius: 4,
  },
  carouselContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselItem: {
    borderRadius: 4,
  },
  flipPage: {
    borderRadius: 4,
  },
  stackContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackCard: {
    position: 'absolute',
    borderRadius: 4,
  },
  tinderCard: {
    borderRadius: 8,
  },
  foldPage: {
    borderRadius: 4,
  },
  circularContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowItem: {
    width: 30,
    height: 12,
    borderRadius: 3,
    marginVertical: 2,
  },
  parallaxContainer: {
    position: 'relative',
    width: 40,
    height: 30,
  },
  parallaxLayer: {
    position: 'absolute',
    width: 25,
    height: 30,
    borderRadius: 4,
  },
  blurItem: {
    borderRadius: 8,
  },
  scaleItem: {
    borderRadius: 8,
  },
  standardItem: {
    borderRadius: 4,
  },
});

export default SimpleFormatPreview;
