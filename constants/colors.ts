/**
 * WalletWise Color System
 *
 * DO NOT use palette values directly in components.
 * Always reference semantic tokens (Colors.*).
 *
 * Palette: Banking / Traditional Finance
 * Style: Clean light, trust navy, semantic indicators
 */

// ─── Raw Palette (internal only) ────────────────────────────────────────────

const palette = {
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  green: {
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  red: {
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },
  amber: {
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },
  gray: {
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const

// ─── Semantic Tokens ────────────────────────────────────────────────────────

export const Colors = {
  // Brand
  primary:       palette.blue[600],   // #2563EB — primary interactive
  primaryDark:   palette.blue[900],   // #1E3A8A — headers, emphasis
  primaryLight:  palette.blue[100],   // #DBEAFE — tinted backgrounds
  primaryMuted:  palette.blue[50],    // #EFF6FF — subtle tints

  // Semantic — financial indicators
  income:        palette.green[600],  // #16A34A
  incomeLight:   palette.green[100],  // #DCFCE7
  incomeDark:    palette.green[700],  // #15803D

  expense:       palette.red[600],    // #DC2626
  expenseLight:  palette.red[100],    // #FEE2E2
  expenseDark:   palette.red[700],    // #B91C1C

  warning:       palette.amber[600],  // #D97706
  warningLight:  palette.amber[100],  // #FEF3C7
  warningDark:   palette.amber[700],  // #B45309

  // Surfaces
  background:    palette.gray[50],    // #F9FAFB — app background
  surface:       palette.white,       // #FFFFFF — cards, sheets, inputs
  surfaceMuted:  palette.gray[100],   // #F3F4F6 — subtle/disabled areas
  surfaceInverse: palette.gray[900],  // #111827 — dark banners

  // Text
  text: {
    primary:   palette.gray[900],     // #111827 — main content
    secondary: palette.gray[500],     // #6B7280 — supporting text
    muted:     palette.gray[400],     // #9CA3AF — placeholders, hints
    inverse:   palette.white,         // #FFFFFF — text on dark surfaces
    link:      palette.blue[600],     // #2563EB — links, tappable labels
    disabled:  palette.gray[300],     // #D1D5DB — disabled text
  },

  // Borders
  border:        palette.gray[200],   // #E5E7EB — default dividers
  borderStrong:  palette.gray[300],   // #D1D5DB — stronger separators
  borderFocus:   palette.blue[500],   // #3B82F6 — focused inputs

  // Overlays
  overlay:       'rgba(0, 0, 0, 0.50)',  // Modal scrim
  overlayLight:  'rgba(0, 0, 0, 0.08)',  // Pressed state wash

  // Utility
  white:         palette.white,
  black:         palette.black,
  transparent:   'transparent',
} as const

export type ColorToken = keyof typeof Colors
