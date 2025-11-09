import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../theme/theme';

export const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  style,
}) => {
  const buttonStyles = [
    styles.base,
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text${size.charAt(0).toUpperCase() + size.slice(1)}`],
    styles[`text${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    disabled && styles.textDisabled,
  ];

  const renderContent = () => (
    <>
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.white : theme.colors.primary}
          style={styles.loader}
        />
      )}
      <Text style={textStyles}>{title}</Text>
    </>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={buttonStyles}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[theme.colors.gradient.start, theme.colors.gradient.end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, disabled && styles.gradientDisabled]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[buttonStyles, styles[variant]]}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...theme.shadows.md,
  },
  sm: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    minHeight: 36,
  },
  md: {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
    minHeight: 44,
  },
  lg: {
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[6],
    minHeight: 52,
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    flex: 1,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[6],
  },
  gradientDisabled: {
    opacity: 0.5,
  },
  secondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...theme.typography.button,
    textAlign: 'center',
  },
  textSm: {
    fontSize: 14,
  },
  textMd: {
    fontSize: 16,
  },
  textLg: {
    fontSize: 18,
  },
  textPrimary: {
    color: theme.colors.white,
  },
  textSecondary: {
    color: theme.colors.primary,
  },
  textGhost: {
    color: theme.colors.primary,
  },
  textDisabled: {
    opacity: 0.7,
  },
  loader: {
    marginRight: theme.spacing[2],
  },
});