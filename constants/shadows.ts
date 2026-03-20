/**
 * WalletWise Elevation / Shadow System
 *
 * Cross-platform shadow scale using iOS shadowProps + Android elevation.
 * Always spread the object: <View style={[styles.card, Shadows.card]} />
 *
 * Levels:
 *   none   — flat, no depth
 *   xs     — subtle lift (tags, chips)
 *   sm     — light cards on white backgrounds
 *   card   — standard card — use for most surfaces
 *   md     — floating action buttons, dropdowns
 *   lg     — bottom sheets, sticky headers
 *   modal  — modals, full-screen sheets
 */

import { Platform, ViewStyle } from 'react-native'

type Shadow = Pick<ViewStyle,
  | 'shadowColor'
  | 'shadowOffset'
  | 'shadowOpacity'
  | 'shadowRadius'
  | 'elevation'
>

function shadow(
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number,
): Shadow {
  return Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: {},
  }) as Shadow
}

export const Shadows = {
  none:  {} as Shadow,
  xs:    shadow(1,  2,  0.04,  1),   // tags, chips
  sm:    shadow(1,  4,  0.06,  2),   // list items on gray bg
  card:  shadow(2,  8,  0.08,  3),   // standard cards
  md:    shadow(4,  12, 0.10,  6),   // FABs, popovers
  lg:    shadow(8,  20, 0.12,  10),  // bottom sheets, sticky bars
  modal: shadow(16, 32, 0.16,  20),  // modals, full sheets
} as const
