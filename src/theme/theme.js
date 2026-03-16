export const fonts = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semiBold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
};

export const theme = {
  colors: {
    primary: '#8446b0',
    secondary: '#464fb0',
    accent: '#469bb0',
    bg: '#F5F0FA',
    white: '#FFFFFF',
    text: '#1e1e1e',
    subtext: '#666666',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    gradient: {
      start: '#8446b0',
      end: '#464fb0',
    },
  },
  fonts,
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    pill: 9999,
  },
  typography: {
    h1: {
      fontSize: 28,
      fontFamily: fonts.bold,
      fontWeight: '700',
      lineHeight: 36,
      letterSpacing: 0.3,
    },
    h2: {
      fontSize: 22,
      fontFamily: fonts.semiBold,
      fontWeight: '600',
      lineHeight: 28,
    },
    h3: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      fontWeight: '600',
      lineHeight: 24,
    },
    h4: {
      fontSize: 16,
      fontFamily: fonts.medium,
      fontWeight: '500',
      lineHeight: 22,
    },
    body: {
      fontSize: 15,
      fontFamily: fonts.regular,
      fontWeight: '400',
      lineHeight: 22,
    },
    button: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      fontWeight: '600',
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontFamily: fonts.medium,
      fontWeight: '500',
      lineHeight: 16,
    },
    small: {
      fontSize: 13,
      fontFamily: fonts.regular,
      fontWeight: '400',
      lineHeight: 18,
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};

export default theme;
