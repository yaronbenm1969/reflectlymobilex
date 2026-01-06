import React, { useCallback } from 'react';
import { View, Dimensions, StyleSheet, Image, Text } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import theme from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEMO_COLORS = [
  '#FF6B9D',
  '#C06FBB', 
  '#8B7ED8',
  '#6B9FFF',
  '#4ECDC4',
  '#FFE66D',
];

const withAnchorPoint = (transform, anchorPoint, size) => {
  'worklet';
  if (!anchorPoint || !size) return transform;
  
  const { x, y } = anchorPoint;
  const { width, height } = size;
  const translateX = -width * x + width / 2;
  const translateY = -height * y + height / 2;
  
  return {
    transform: [
      { translateX },
      { translateY },
      ...transform.transform,
      { translateX: -translateX },
      { translateY: -translateY },
    ]
  };
};

export const ANIMATION_TYPES = {
  'cube-3d': {
    name: 'קוביה תלת מימד',
    icon: 'cube',
    description: 'סיבוב דינמי על קוביה'
  },
  'carousel-3d': {
    name: 'קרוסלה תלת מימד',
    icon: 'albums',
    description: 'מעבר חלק בין קטעים'
  },
  'flip-pages': {
    name: 'דפים מתהפכים',
    icon: 'book',
    description: 'כמו אלבום תמונות'
  },
  'standard': {
    name: 'רגיל',
    icon: 'film',
    description: 'וידאו ליניארי קלאסי'
  },
  'stack-cards': {
    name: 'כרטיסים נערמים',
    icon: 'layers',
    description: 'ערימת כרטיסים'
  },
  'tinder': {
    name: 'החלקת טינדר',
    icon: 'heart',
    description: 'החלק ימינה או שמאלה'
  },
  'fold': {
    name: 'קיפול נייר',
    icon: 'document',
    description: 'קיפול כמו נייר'
  },
  'circular': {
    name: 'מעגלי',
    icon: 'sync',
    description: 'סיבוב במעגל'
  },
  'flow': {
    name: 'זרימה',
    icon: 'water',
    description: 'זרימה חלקה'
  },
  'parallax': {
    name: 'עומק פרלקס',
    icon: 'git-branch',
    description: 'אפקט עומק תלת מימדי'
  },
  'blur-rotate': {
    name: 'טשטוש וסיבוב',
    icon: 'aperture',
    description: 'סיבוב עם טשטוש'
  },
  'scale-fade': {
    name: 'הגדלה ועמעום',
    icon: 'expand',
    description: 'הגדלה והעלמות חלקה'
  },
};

const getAnimationStyle = (type, pageWidth, pageHeight) => {
  switch (type) {
    case 'cube-3d':
      return (value) => {
        'worklet';
        const zIndex = interpolate(value, [-1, 0, 1], [-1000, 0, -1000]);
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth, 0, pageWidth], Extrapolation.CLAMP);
        const scale = interpolate(value, [-1, 0, 1], [0.7, 1, 0.7], Extrapolation.CLAMP);
        const rotateY = `${interpolate(value, [-1, 0, 1], [-90, 0, 90], Extrapolation.CLAMP)}deg`;
        
        return {
          transform: [
            { perspective: 1000 },
            { scale },
            { translateX },
            { rotateY },
          ],
          zIndex,
        };
      };
      
    case 'carousel-3d':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth * 0.5, 0, pageWidth * 0.5]);
        const scale = interpolate(value, [-1, 0, 1], [0.8, 1, 0.8], Extrapolation.CLAMP);
        const rotateY = `${interpolate(value, [-1, 0, 1], [45, 0, -45], Extrapolation.CLAMP)}deg`;
        const zIndex = interpolate(value, [-1, 0, 1], [0, 1, 0]);
        
        return {
          transform: [
            { perspective: 800 },
            { translateX },
            { scale },
            { rotateY },
          ],
          zIndex,
          opacity: interpolate(value, [-1, 0, 1], [0.7, 1, 0.7]),
        };
      };
      
    case 'flip-pages':
      return (value) => {
        'worklet';
        const rotateY = `${interpolate(value, [-1, 0, 1], [180, 0, -180], Extrapolation.CLAMP)}deg`;
        const opacity = interpolate(value, [-0.5, 0, 0.5], [0, 1, 0], Extrapolation.CLAMP);
        
        return {
          transform: [
            { perspective: 1200 },
            { rotateY },
          ],
          opacity,
          backfaceVisibility: 'hidden',
        };
      };
      
    case 'stack-cards':
      return (value) => {
        'worklet';
        const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP);
        const translateY = interpolate(value, [-1, 0, 1], [-30, 0, 30], Extrapolation.CLAMP);
        const zIndex = interpolate(value, [-1, 0, 1], [0, 1, 0]);
        
        return {
          transform: [
            { scale },
            { translateY },
          ],
          zIndex,
          opacity: interpolate(value, [-1, 0, 1], [0.5, 1, 0.5]),
        };
      };
      
    case 'tinder':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth, 0, pageWidth]);
        const rotate = `${interpolate(value, [-1, 0, 1], [-15, 0, 15], Extrapolation.CLAMP)}deg`;
        const scale = interpolate(value, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP);
        
        return {
          transform: [
            { translateX },
            { rotate },
            { scale },
          ],
          opacity: interpolate(value, [-1, 0, 1], [0.5, 1, 0.5]),
        };
      };
      
    case 'fold':
      return (value) => {
        'worklet';
        const rotateX = `${interpolate(value, [-1, 0, 1], [90, 0, -90], Extrapolation.CLAMP)}deg`;
        const translateY = interpolate(value, [-1, 0, 1], [-pageHeight * 0.5, 0, pageHeight * 0.5]);
        
        return {
          transform: [
            { perspective: 1000 },
            { rotateX },
            { translateY },
          ],
          opacity: interpolate(value, [-0.5, 0, 0.5], [0, 1, 0], Extrapolation.CLAMP),
        };
      };
      
    case 'circular':
      return (value) => {
        'worklet';
        const rotate = `${interpolate(value, [-1, 0, 1], [-360, 0, 360], Extrapolation.CLAMP)}deg`;
        const scale = interpolate(value, [-1, 0, 1], [0.5, 1, 0.5], Extrapolation.CLAMP);
        
        return {
          transform: [
            { rotate },
            { scale },
          ],
          opacity: interpolate(value, [-0.5, 0, 0.5], [0.3, 1, 0.3], Extrapolation.CLAMP),
        };
      };
      
    case 'flow':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth * 0.3, 0, pageWidth * 0.3]);
        const scale = interpolate(value, [-1, 0, 1], [0.85, 1, 0.85], Extrapolation.CLAMP);
        
        return {
          transform: [
            { translateX },
            { scale },
          ],
          opacity: interpolate(value, [-1, 0, 1], [0.6, 1, 0.6]),
        };
      };
      
    case 'parallax':
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth * 0.5, 0, pageWidth * 0.5]);
        const scale = interpolate(value, [-1, 0, 1], [0.7, 1, 0.7], Extrapolation.CLAMP);
        const zIndex = interpolate(value, [-1, 0, 1], [-100, 0, -100]);
        
        return {
          transform: [
            { translateX },
            { scale },
          ],
          zIndex,
          opacity: interpolate(value, [-1, 0, 1], [0.4, 1, 0.4]),
        };
      };
      
    case 'blur-rotate':
      return (value) => {
        'worklet';
        const rotate = `${interpolate(value, [-1, 0, 1], [30, 0, -30], Extrapolation.CLAMP)}deg`;
        const scale = interpolate(value, [-1, 0, 1], [0.8, 1, 0.8], Extrapolation.CLAMP);
        
        return {
          transform: [
            { rotate },
            { scale },
          ],
          opacity: interpolate(value, [-0.8, 0, 0.8], [0.2, 1, 0.2], Extrapolation.CLAMP),
        };
      };
      
    case 'scale-fade':
      return (value) => {
        'worklet';
        const scale = interpolate(value, [-1, 0, 1], [0.5, 1, 0.5], Extrapolation.CLAMP);
        
        return {
          transform: [{ scale }],
          opacity: interpolate(value, [-0.5, 0, 0.5], [0, 1, 0], Extrapolation.CLAMP),
        };
      };
      
    default: // standard
      return (value) => {
        'worklet';
        const translateX = interpolate(value, [-1, 0, 1], [-pageWidth, 0, pageWidth]);
        return {
          transform: [{ translateX }],
        };
      };
  }
};

const DemoItem = ({ index, color, size }) => (
  <View style={[styles.demoItem, { backgroundColor: color, width: size, height: size }]}>
    <Text style={styles.demoText}>{index + 1}</Text>
  </View>
);

export const VideoCarouselDemo = ({ 
  type = 'standard', 
  size = 80,
  autoPlay = true,
}) => {
  const pageWidth = size;
  const pageHeight = size;
  
  const animationStyle = useCallback(
    getAnimationStyle(type, pageWidth, pageHeight),
    [type, pageWidth, pageHeight]
  );

  return (
    <View style={[styles.demoContainer, { width: size, height: size }]}>
      <Carousel
        loop
        width={pageWidth}
        height={pageHeight}
        data={DEMO_COLORS}
        autoPlay={autoPlay}
        autoPlayInterval={1500}
        scrollAnimationDuration={800}
        customAnimation={animationStyle}
        renderItem={({ index, item }) => (
          <DemoItem index={index} color={item} size={size} />
        )}
      />
    </View>
  );
};

export const VideoCarousel = ({
  data = [],
  type = 'standard',
  width = SCREEN_WIDTH,
  height = 300,
  autoPlay = false,
  loop = true,
  renderItem,
}) => {
  const animationStyle = useCallback(
    getAnimationStyle(type, width, height),
    [type, width, height]
  );

  const defaultRenderItem = ({ index, item }) => (
    <View style={[styles.videoItem, { width, height }]}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: DEMO_COLORS[index % DEMO_COLORS.length] }]}>
          <Text style={styles.placeholderText}>{item.title || `וידאו ${index + 1}`}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { width, height }]}>
      <Carousel
        loop={loop}
        width={width}
        height={height}
        data={data.length > 0 ? data : DEMO_COLORS.map((c, i) => ({ color: c, title: `דוגמה ${i + 1}` }))}
        autoPlay={autoPlay}
        autoPlayInterval={2500}
        scrollAnimationDuration={1000}
        customAnimation={animationStyle}
        renderItem={renderItem || defaultRenderItem}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  demoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
  demoItem: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  demoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  videoItem: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default VideoCarousel;
