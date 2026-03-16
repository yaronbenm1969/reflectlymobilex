import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../theme/theme';

export const Card = ({ children, style }) => {
  return (
    <View style={[styles.wrapper, style]} collapsable={false}>
      <LinearGradient
        colors={['#EEE0F7', '#DCF1F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  gradient: {
    flex: 1,
  },
});
