export const colors = {
  primary: '#e74c3c',
  primaryDark: '#c0392b',
  primaryLight: '#ec7063',
  secondary: '#9b59b6',
  accent: '#3498db',
  success: '#2ecc71',
  warning: '#f39c12',
  danger: '#e74c3c',
  info: '#3498db',

  bg: '#0d0d0d',
  bgSecondary: '#1a1a1a',
  bgTertiary: '#222222',
  bgHover: '#2a2a2a',
  bgActive: '#333333',

  border: '#333333',
  borderLight: '#444444',
  borderDark: '#222222',

  text: '#e0e0e0',
  textSecondary: '#aaaaaa',
  textMuted: '#888888',
  textDim: '#666666',
  textFaint: '#555555',
  textInverse: '#ffffff',

  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.3)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  xxxxl: 28,
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.4)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.5)',
} as const;

export const zIndex = {
  base: 1,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
} as const;

export const breakpoints = {
  xs: '0px',
  sm: '480px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  xxl: '1536px',
} as const;

export const mediaQueries = {
  mobile: `@media (max-width: ${breakpoints.md})`,
  tablet: `@media (min-width: ${breakpoints.md}) and (max-width: ${breakpoints.lg})`,
  desktop: `@media (min-width: ${breakpoints.lg})`,
  desktopLarge: `@media (min-width: ${breakpoints.xl})`,
  touch: '@media (hover: none) and (pointer: coarse)',
  noTouch: '@media (hover: hover) and (pointer: fine)',
  landscape: '@media (orientation: landscape)',
  portrait: '@media (orientation: portrait)',
  dark: '@media (prefers-color-scheme: dark)',
  light: '@media (prefers-color-scheme: light)',
} as const;

export const transitions = {
  fast: '0.15s ease',
  base: '0.2s ease',
  slow: '0.3s ease',
  slower: '0.4s ease',
} as const;

export function createResponsiveStyles(
  mobile: React.CSSProperties,
  tablet?: React.CSSProperties,
  desktop?: React.CSSProperties
): any {
  const styles: any = {};

  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) {
      return { ...mobile };
    } else if (width < 1024 && tablet) {
      return { ...tablet };
    } else if (desktop) {
      return { ...desktop };
    }
  }

  return { ...mobile };
}

export const layoutStyles = {
  pageContainer: {
    padding: 24,
  },
  pageContainerMobile: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    background: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    padding: spacing.lg,
  },
  cardMobile: {
    background: colors.bgSecondary,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    padding: spacing.md,
  },
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gapSm: {
    display: 'flex',
    gap: spacing.sm,
  },
  gapMd: {
    display: 'flex',
    gap: spacing.md,
  },
  gapLg: {
    display: 'flex',
    gap: spacing.lg,
  },
  stackSm: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  stackMd: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  stackLg: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
  },
} as const;

export const buttonStyles = {
  primary: {
    background: colors.primary,
    border: 'none',
    borderRadius: radius.md,
    color: colors.textInverse,
    padding: `${spacing.md}px ${spacing.lg}px`,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    transition: transitions.base,
  },
  secondary: {
    background: 'transparent',
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.textSecondary,
    padding: `${spacing.md}px ${spacing.lg}px`,
    fontSize: fontSize.md,
    transition: transitions.base,
  },
  outline: (color: string) => ({
    background: `${color}15`,
    border: `1px solid ${color}`,
    borderRadius: radius.md,
    color,
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: fontSize.sm,
    transition: transitions.base,
  }),
  ghost: {
    background: 'transparent',
    border: 'none',
    borderRadius: radius.md,
    color: colors.textSecondary,
    padding: spacing.md,
    fontSize: fontSize.md,
    transition: transitions.base,
  },
} as const;

export const inputStyles = {
  base: {
    width: '100%',
    padding: `${spacing.md}px ${spacing.md}px`,
    background: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fontSize.md,
    outline: 'none',
    transition: transitions.base,
    boxSizing: 'border-box' as const,
  },
  focus: {
    borderColor: colors.primary,
    boxShadow: `0 0 0 2px ${colors.primary}20`,
  },
  label: {
    display: 'block' as const,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.medium,
  },
} as const;
