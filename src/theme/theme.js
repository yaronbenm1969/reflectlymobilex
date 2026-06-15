export const fonts = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semiBold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
};

export const theme = {
  colors: {
    primary: '#7c3aed',
    secondary: '#4f46e5',
    accent: '#06b6d4',
    bg: '#faf5ff',
    card: '#ffffff',
    border: '#ede9fe',
    white: '#FFFFFF',
    text: '#1a1523',
    subtext: '#6b7280',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    gradient: {
      start: '#7c3aed',
      end: '#4f46e5',
    },
  },
  fonts,
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    xxl: 28,
    pill: 9999,
  },
  typography: {
    h1: {
      fontSize: 28,
      fontFamily: fonts.bold,
      fontWeight: '700',
      lineHeight: 36,
      letterSpacing: 0.2,
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
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 5,
    },
    lg: {
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

export default theme;
