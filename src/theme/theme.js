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
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64],
  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    h1: {
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 34,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 30,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 26,
    },
    body: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 22,
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

export default theme;
