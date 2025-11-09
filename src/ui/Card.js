import React from 'react';
import { View, StyleSheet } from 'react-native';
import theme from '../theme/theme';

export const Card = ({ children, style }) => {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    ...theme.shadows.md,
  },
});