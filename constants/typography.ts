/**
 * WalletWise Typography System
 *
 * Font: IBM Plex Sans (Financial Trust — professional, readable, data-optimized)
 * Mono: IBM Plex Mono (currency amounts, account numbers)
 *
 * Install: npx expo install @expo-google-fonts/ibm-plex-sans @expo-google-fonts/ibm-plex-mono
 *
 * Usage in _layout.tsx:
 *   const [fontsLoaded] = useFonts({
 *     IBMPlexSans_400Regular,
 *     IBMPlexSans_500Medium,
 *     IBMPlexSans_600SemiBold,
 *     IBMPlexSans_700Bold,
 *     IBMPlexMono_400Regular,
 *     IBMPlexMono_600SemiBold,
 *   })
 *
 * Until fonts load, Expo falls back to system fonts (SF Pro / Roboto) —
 * the scale and weights remain the same.
 */

// ─── Font Families ───────────────────────────────────────────────────────────

export const FontFamily = {
  regular:      'IBMPlexSans_400Regular',
  medium:       'IBMPlexSans_500Medium',
  semiBold:     'IBMPlexSans_600SemiBold',
  bold:         'IBMPlexSans_700Bold',
  // Monospace — use for all PHP amounts and numeric data
  mono:         'IBMPlexMono_400Regular',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const

// ─── Font Size Scale (4pt grid, base = 16) ───────────────────────────────────

export const FontSize = {
  xs:   11,   // badges, micro-labels
  sm:   13,   // captions, helper text
  base: 16,   // body default (avoids iOS auto-zoom)
  md:   18,   // large body, card labels
  lg:   20,   // section headers
  xl:   24,   // screen titles, card totals
  '2xl': 28,  // hero amounts
  '3xl': 32,  // balance display
  '4xl': 40,  // dashboard hero balance
} as const

// ─── Line Heights (relative multipliers) ─────────────────────────────────────

export const LineHeight = {
  tight:   1.2,   // display, large numbers
  snug:    1.35,  // headings
  normal:  1.5,   // body text (WCAG AA baseline)
  relaxed: 1.625, // long-form descriptions
} as const

// ─── Font Weights ─────────────────────────────────────────────────────────────

export const FontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semiBold: '600' as const,
  bold:     '700' as const,
} as const

// ─── Type Scale — Pre-composed TextStyle objects ─────────────────────────────
//
// Use these directly in StyleSheet definitions.
// Import Colors separately for color values.

export const TextStyles = {
  // Display — hero amounts, dashboard balance
  displayLg: {
    fontSize: FontSize['4xl'],
    lineHeight: FontSize['4xl'] * LineHeight.tight,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.monoSemiBold,
    letterSpacing: -1,
  },
  displayMd: {
    fontSize: FontSize['3xl'],
    lineHeight: FontSize['3xl'] * LineHeight.tight,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.monoSemiBold,
    letterSpacing: -0.5,
  },

  // Headings — screen titles, section headers
  h1: {
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * LineHeight.snug,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * LineHeight.snug,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * LineHeight.snug,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },
  h4: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * LineHeight.normal,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },

  // Body — general readable content
  bodyLg: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * LineHeight.normal,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },
  body: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },
  bodySm: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },

  // Labels — buttons, tags, nav items, form labels
  labelLg: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.snug,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.medium,
  },
  label: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.snug,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.medium,
  },
  labelSm: {
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * LineHeight.snug,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },

  // Captions — timestamps, meta info
  caption: {
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * LineHeight.normal,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },

  // Amounts — tabular monospace for PHP values (prevents layout shift in lists)
  amountLg: {
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * LineHeight.tight,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.monoSemiBold,
    letterSpacing: -0.5,
  },
  amount: {
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * LineHeight.tight,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.monoSemiBold,
  },
  amountSm: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.tight,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.mono,
  },
  amountXs: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.tight,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.mono,
  },
} as const
