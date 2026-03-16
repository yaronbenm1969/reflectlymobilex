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
  icon,
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

  const loaderColor = (variant === 'primary' || variant === 'accent')
    ? theme.colors.white
    : variant === 'secondary'
      ? theme.colors.secondary
      : theme.colors.primary;

  const renderContent = () => (
    <>
      {loading && (
        <ActivityIndicator
          size="small"
          color={loaderColor}
          style={styles.loader}
        />
      )}
      {icon && !loading && typeof icon !== 'string' && icon}
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
          style={[styles.gradient, styles[`gradient${size.charAt(0).toUpperCase() + size.slice(1)}`], disabled && styles.gradientDisabled]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'accent') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[buttonStyles, styles.accent]}
        activeOpacity={0.8}
      >
        {renderContent()}
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
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sm: {
    minHeight: 36,
  },
  md: {
    minHeight: 48,
  },
  lg: {
    minHeight: 56,
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...theme.shadows.md,
  },
  gradientSm: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[5],
  },
  gradientMd: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[6],
  },
  gradientLg: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[7],
  },
  gradientDisabled: {
    opacity: 0.5,
  },
  secondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[6],
    ...theme.shadows.sm,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[6],
  },
  accent: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[6],
    ...theme.shadows.md,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[6],
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
    fontFamily: theme.fonts.medium,
  },
  textMd: {
    fontSize: 16,
    fontFamily: theme.fonts.semiBold,
  },
  textLg: {
    fontSize: 18,
    fontFamily: theme.fonts.semiBold,
  },
  textPrimary: {
    color: theme.colors.white,
  },
  textSecondary: {
    color: theme.colors.secondary,
  },
  textOutline: {
    color: theme.colors.primary,
  },
  textAccent: {
    color: theme.colors.white,
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
