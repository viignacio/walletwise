/**
 * WalletWise Spacing & Layout System
 *
 * Based on a 4pt grid. All spacing values are multiples of 4.
 * Use Layout.* for semantic values in component StyleSheets.
 */

import { Platform } from 'react-native'

// ─── Base Grid ───────────────────────────────────────────────────────────────

export const Spacing = {
  0:  0,
  1:  4,   // xs  — icon padding, badge gaps
  2:  8,   // sm  — tight inline spacing
  3:  12,  //     — list item inner gap
  4:  16,  // md  — default padding, card content
  5:  20,  //     — screen horizontal inset
  6:  24,  // lg  — section gap, form field gap
  8:  32,  // xl  — between major sections
  10: 40,  //     — top of screen content
  12: 48,  // 2xl — large vertical rhythm
  16: 64,  //     — hero spacing
  20: 80,  //     — bottom safe area allowance
} as const

// ─── Border Radius ───────────────────────────────────────────────────────────

export const Radius = {
  xs:   4,    // tags, chips, small badges
  sm:   8,    // buttons (secondary), small cards
  md:   12,   // inputs, standard cards
  lg:   16,   // bottom sheets, modal cards
  xl:   24,   // large feature cards
  full: 9999, // pills, avatars, circular buttons
} as const

// ─── Semantic Layout Tokens ───────────────────────────────────────────────────

export const Layout = {
  // Screen insets — apply to all ScrollView/View containers
  screenPaddingH:     Spacing[5],   // 20 — horizontal screen margin
  screenPaddingV:     Spacing[5],   // 20 — top/bottom screen margin
  screenPaddingHSm:   Spacing[4],   // 16 — compact screens

  // Cards & containers
  cardPadding:        Spacing[4],   // 16 — internal card padding
  cardPaddingV:       Spacing[4],   // 16 — card vertical padding
  cardRadius:         Radius.md,    // 12 — card corner radius
  cardRadiusLg:       Radius.lg,    // 16 — large feature cards

  // Section & list rhythm
  sectionGap:         Spacing[6],   // 24 — gap between page sections
  listItemGap:        Spacing[3],   // 12 — gap between list rows
  listItemPaddingV:   Spacing[3],   // 12 — list item vertical padding

  // Touch targets (MUST meet 44pt iOS / 48dp Android minimum)
  touchTarget:        48,           // 48pt — universal safe minimum
  inputHeight:        52,           // 52pt — inputs, selects
  buttonHeight:       52,           // 52pt — primary/secondary buttons
  buttonHeightSm:     40,           // 40pt — compact buttons
  chipHeight:         32,           // 32pt — tags, filter chips

  // Navigation
  tabBarHeight:       Platform.OS === 'ios' ? 56 : 60,
  headerHeight:       Platform.OS === 'ios' ? 44 : 56,

  // Icon sizes
  iconXs:   14,
  iconSm:   16,
  icon:     20,   // default
  iconMd:   24,   // nav, header
  iconLg:   32,   // feature icons
  iconXl:   48,   // empty state illustrations

  // Avatar / thumbnail
  avatarSm:   28,
  avatar:     36,
  avatarMd:   44,
  avatarLg:   56,

  // Dividers
  divider:    StyleSheet_hairlineWidth(),   // 1px or hairline
  dividerMd:  1,
} as const

// Returns StyleSheet.hairlineWidth equivalent (platform-safe)
function StyleSheet_hairlineWidth(): number {
  return 1
}
