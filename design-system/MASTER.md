# WalletWise Design System — MASTER

> Source of truth for all UI decisions. Read this before building any screen.
> Page-specific overrides live in `design-system/pages/`.

---

## Design Language

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| **Personality** | Trustworthy, clear, calm | Household finance — users handle real money |
| **Style** | Clean light, minimal | High readability in all lighting conditions |
| **Palette** | Banking / Traditional Finance | Trust navy + semantic green/red |
| **Typography** | IBM Plex Sans + IBM Plex Mono | Designed for financial data; excellent tabular figures |
| **Density** | Comfortable (not dense) | Multi-age household use; reduce mis-taps |
| **Branding** | Deferred | Visual identity not yet finalized — use tokens only |

---

## Color Tokens

All colors are in `constants/colors.ts`. **Never use raw hex in components.**

### Brand
| Token | Value | Use |
|-------|-------|-----|
| `Colors.primary` | `#2563EB` | Buttons, links, active nav, focused inputs |
| `Colors.primaryDark` | `#1E3A8A` | Headers, emphasis, dark banners |
| `Colors.primaryLight` | `#DBEAFE` | Tinted backgrounds, selected state fills |
| `Colors.primaryMuted` | `#EFF6FF` | Subtle highlights, hover/pressed washes |

### Financial Indicators
| Token | Value | Use |
|-------|-------|-----|
| `Colors.income` | `#16A34A` | Income amounts, positive balances |
| `Colors.incomeLight` | `#DCFCE7` | Income category badge background |
| `Colors.expense` | `#DC2626` | Expense amounts, negative balances |
| `Colors.expenseLight` | `#FEE2E2` | Expense category badge background |
| `Colors.warning` | `#D97706` | Low balance alerts, overdue states |
| `Colors.warningLight` | `#FEF3C7` | Warning banner backgrounds |

### Surfaces
| Token | Value | Use |
|-------|-------|-----|
| `Colors.background` | `#F9FAFB` | App/screen background |
| `Colors.surface` | `#FFFFFF` | Cards, sheets, inputs, modals |
| `Colors.surfaceMuted` | `#F3F4F6` | Disabled areas, tab bar bg, skeleton shimmer |
| `Colors.surfaceInverse` | `#111827` | Dark section headers, inverse banners |

### Text
| Token | Value | Use |
|-------|-------|-----|
| `Colors.text.primary` | `#111827` | Headings, amounts, primary content |
| `Colors.text.secondary` | `#6B7280` | Supporting text, descriptions |
| `Colors.text.muted` | `#9CA3AF` | Placeholders, disabled labels, timestamps |
| `Colors.text.inverse` | `#FFFFFF` | Text on dark surfaces |
| `Colors.text.link` | `#2563EB` | Tappable labels, inline links |
| `Colors.text.disabled` | `#D1D5DB` | Disabled input text |

### Borders & Overlays
| Token | Value | Use |
|-------|-------|-----|
| `Colors.border` | `#E5E7EB` | Default dividers, input borders |
| `Colors.borderStrong` | `#D1D5DB` | Stronger separators, pressed states |
| `Colors.borderFocus` | `#3B82F6` | Focused input ring |
| `Colors.overlay` | `rgba(0,0,0,0.50)` | Modal scrim (meets 40–60% guideline) |
| `Colors.overlayLight` | `rgba(0,0,0,0.08)` | Pressed/hover state wash on surfaces |

---

## Typography

All tokens in `constants/typography.ts`. Always use `TextStyles.*` for composed styles.

### Font Families
| Token | Font | Use |
|-------|------|-----|
| `FontFamily.regular` | IBMPlexSans_400Regular | Body, descriptions |
| `FontFamily.medium` | IBMPlexSans_500Medium | Labels, nav, form labels |
| `FontFamily.semiBold` | IBMPlexSans_600SemiBold | Subheadings, card titles |
| `FontFamily.bold` | IBMPlexSans_700Bold | Headings, emphasis |
| `FontFamily.mono` | IBMPlexMono_400Regular | Amounts, secondary numeric |
| `FontFamily.monoSemiBold` | IBMPlexMono_600SemiBold | **All PHP amounts** — hero, card totals |

**Install:**
```
npx expo install @expo-google-fonts/ibm-plex-sans @expo-google-fonts/ibm-plex-mono
```

### Type Scale
| Style | Size | Weight | Use |
|-------|------|--------|-----|
| `TextStyles.displayLg` | 40pt | Bold Mono | Dashboard hero balance |
| `TextStyles.displayMd` | 32pt | Bold Mono | Wallet closing balance |
| `TextStyles.h1` | 28pt | Bold | Screen titles |
| `TextStyles.h2` | 24pt | SemiBold | Section headers |
| `TextStyles.h3` | 20pt | SemiBold | Card titles |
| `TextStyles.h4` | 18pt | SemiBold | List group headers |
| `TextStyles.bodyLg` | 18pt | Regular | Prominent body text |
| `TextStyles.body` | 16pt | Regular | Default body (avoids iOS auto-zoom) |
| `TextStyles.bodySm` | 13pt | Regular | Secondary body, notes |
| `TextStyles.labelLg` | 16pt | Medium | Button labels, primary nav |
| `TextStyles.label` | 13pt | Medium | Tags, chips, form labels |
| `TextStyles.labelSm` | 11pt | Medium + UPPERCASE | Section eyebrows |
| `TextStyles.caption` | 11pt | Regular | Timestamps, metadata |
| `TextStyles.amountLg` | 28pt | Mono SemiBold | Card totals, borrower owed |
| `TextStyles.amount` | 24pt | Mono SemiBold | Transaction amounts |
| `TextStyles.amountSm` | 16pt | Mono | List row amounts |
| `TextStyles.amountXs` | 13pt | Mono | Compact amount cells |

> **Rule**: Always use monospace (`FontFamily.mono*`) for any PHP value to prevent layout shifts when digit count changes.

---

## Spacing & Layout

All tokens in `constants/spacing.ts`.

### Grid
4pt base grid. All spacing is a multiple of 4.

| Token | Value | Use |
|-------|-------|-----|
| `Spacing[1]` | 4pt | Icon gap, badge padding |
| `Spacing[2]` | 8pt | Tight inline spacing |
| `Spacing[3]` | 12pt | List item inner gap |
| `Spacing[4]` | 16pt | Default padding, card content |
| `Spacing[5]` | 20pt | Screen horizontal inset |
| `Spacing[6]` | 24pt | Section gap, form field spacing |
| `Spacing[8]` | 32pt | Major section separation |

### Semantic Layout
| Token | Value | Use |
|-------|-------|-----|
| `Layout.screenPaddingH` | 20pt | Horizontal inset on all screens |
| `Layout.screenPaddingV` | 20pt | Top/bottom screen margin |
| `Layout.cardPadding` | 16pt | Card internal padding |
| `Layout.sectionGap` | 24pt | Gap between page sections |
| `Layout.listItemGap` | 12pt | Gap between list rows |
| `Layout.touchTarget` | 48pt | Minimum hit area (exceeds Apple 44pt) |
| `Layout.inputHeight` | 52pt | Inputs, pickers |
| `Layout.buttonHeight` | 52pt | Primary/secondary buttons |
| `Layout.buttonHeightSm` | 40pt | Compact/inline buttons |

### Border Radius
| Token | Value | Use |
|-------|-------|-----|
| `Radius.xs` | 4pt | Tags, chips |
| `Radius.sm` | 8pt | Secondary buttons |
| `Radius.md` | 12pt | Inputs, standard cards |
| `Radius.lg` | 16pt | Bottom sheets, modal cards |
| `Radius.xl` | 24pt | Large feature cards |
| `Radius.full` | 9999pt | Pills, avatars, icon buttons |

---

## Elevation / Shadows

All tokens in `constants/shadows.ts`. Cross-platform (iOS shadow + Android elevation).

| Token | iOS Opacity | Android Elevation | Use |
|-------|-------------|-------------------|-----|
| `Shadows.none` | — | 0 | Flat items on colored backgrounds |
| `Shadows.xs` | 0.04 | 1 | Tags, filter chips |
| `Shadows.sm` | 0.06 | 2 | List items on gray bg |
| `Shadows.card` | 0.08 | 3 | **Standard cards** — default choice |
| `Shadows.md` | 0.10 | 6 | FABs, dropdowns, popovers |
| `Shadows.lg` | 0.12 | 10 | Bottom sheets, sticky headers |
| `Shadows.modal` | 0.16 | 20 | Modals, full-screen sheets |

---

## Component Patterns

### Cards
```tsx
<View style={[{
  backgroundColor: Colors.surface,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
}, Shadows.card]}>
```

### Amount Display
```tsx
// Always monospace, always colored by sign
<Text style={[TextStyles.amount, { color: isIncome ? Colors.income : Colors.expense }]}>
  {isIncome ? '+' : '-'}₱{amount.toLocaleString()}
</Text>
```

### Category Badges
```tsx
<View style={{ backgroundColor: Colors.expenseLight, borderRadius: Radius.xs, paddingH: Spacing[2] }}>
  <Text style={[TextStyles.label, { color: Colors.expense }]}>{category}</Text>
</View>
```

### Primary Button
```tsx
<Pressable style={{
  backgroundColor: Colors.primary,
  borderRadius: Radius.sm,
  height: Layout.buttonHeight,
  minWidth: Layout.touchTarget,
  paddingHorizontal: Spacing[6],
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Text style={[TextStyles.labelLg, { color: Colors.white }]}>Label</Text>
</Pressable>
```

### Section Header
```tsx
<Text style={[TextStyles.labelSm, { color: Colors.text.secondary, marginBottom: Spacing[2] }]}>
  SECTION TITLE
</Text>
```

### Input Field
```tsx
<View style={{
  backgroundColor: Colors.surface,
  borderWidth: 1,
  borderColor: Colors.border,   // → Colors.borderFocus when active
  borderRadius: Radius.md,
  height: Layout.inputHeight,
  paddingHorizontal: Spacing[4],
}}>
```

---

## Rules (Non-Negotiable)

1. **No raw hex values in components.** Always reference `Colors.*`.
2. **All PHP amounts use `FontFamily.mono*`.** No exceptions — tabular figures prevent layout shift.
3. **Income is always `Colors.income` (green). Expense is always `Colors.expense` (red).** Sign indicators (`+`/`-`) must accompany color — never rely on color alone.
4. **Touch targets minimum 48pt.** Use `hitSlop` to extend small icons.
5. **No emoji as icons.** Use `@expo/vector-icons` (Feather / Ionicons sets).
6. **Screen padding = `Layout.screenPaddingH` (20pt) horizontal.** Consistent across all screens.
7. **Cards always get `Shadows.card`.** Do not invent one-off shadow values.
8. **Modal scrims must use `Colors.overlay` (50% black).** Never less than 40%.

---

## Anti-Patterns to Avoid

- Mixing inline `style={{ color: '#2563EB' }}` with token references
- Using different border radii on visually similar cards
- Showing amounts without currency prefix (₱) or sign indicator
- Using regular font weight for amounts — always semi-bold or bold
- Placing interactive content behind the notch or home indicator
- Bottom tabs with more than 5 items
- Pure white (`#FFFFFF`) as the screen background — use `Colors.background` (`#F9FAFB`)

---

## Page-Specific Overrides

Check `design-system/pages/` for screen-level deviations from this master.
Current pages: _(none yet — add as screens are built)_
