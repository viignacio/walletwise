import { useEffect, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { Text } from '../../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout, Shadows } from '../../../constants'
import { supabase } from '../../../lib/supabase'
import { formatAmount } from '../../../lib/wallet'

type RowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  badge?: string
  onPress?: () => void
  destructive?: boolean
  disabled?: boolean
}

function SettingsRow({ icon, label, badge, onPress, destructive, disabled }: RowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Ionicons name={icon} size={18} color={destructive ? Colors.expense : Colors.primary} />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      <View style={styles.rowRight}>
        {badge ? <Text style={styles.rowBadge}>{badge}</Text> : null}
        {!destructive && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={disabled ? Colors.text.muted : Colors.text.muted}
          />
        )}
      </View>
    </TouchableOpacity>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

export default function SettingsScreen() {
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [threshold, setThreshold] = useState<number>(5000)
  const [thresholdEnabled, setThresholdEnabled] = useState(true)
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')
  const insets = useSafeAreaInsets()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? null)
      setDisplayName(user.user_metadata?.full_name ?? null)

      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()
      if (!profile) return
      setHouseholdId(profile.household_id)

      const { data: settings } = await supabase
        .from('household_settings')
        .select('low_balance_threshold, low_balance_notification_enabled')
        .eq('household_id', profile.household_id)
        .single()
      if (settings) {
        setThreshold(settings.low_balance_threshold)
        setThresholdEnabled(settings.low_balance_notification_enabled)
      }
    })
  }, [])

  const openThresholdEdit = () => {
    setThresholdInput(String(threshold))
    setEditingThreshold(true)
  }

  const saveThreshold = async () => {
    if (!householdId) return
    const value = parseFloat(thresholdInput)
    if (isNaN(value) || value < 0) {
      Alert.alert('Invalid amount', 'Please enter a valid threshold amount.')
      return
    }
    const { error } = await supabase
      .from('household_settings')
      .update({ low_balance_threshold: value })
      .eq('household_id', householdId)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    setThreshold(value)
    setEditingThreshold(false)
  }

  const toggleThresholdEnabled = async () => {
    if (!householdId) return
    const newValue = !thresholdEnabled
    const { error } = await supabase
      .from('household_settings')
      .update({ low_balance_notification_enabled: newValue })
      .eq('household_id', householdId)
    if (!error) setThresholdEnabled(newValue)
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ])
  }

  const comingSoon = () =>
    Alert.alert('Coming soon', 'This setting will be available in a future phase.')

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {displayName ? displayName.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName ?? 'Your Name'}</Text>
          <Text style={styles.profileEmail}>{email ?? '—'}</Text>
        </View>
      </View>

      {/* General */}
      <SectionHeader title="General" />
      <View style={styles.section}>
        <SettingsRow
          icon="person-outline"
          label="Profile"
          badge="Phase 6"
          onPress={comingSoon}
          disabled
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="people-outline"
          label="Household"
          badge="Phase 6"
          onPress={comingSoon}
          disabled
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="notifications-outline"
          label="Notification Preferences"
          badge="Phase 5"
          onPress={comingSoon}
          disabled
        />
      </View>

      {/* Wallet */}
      <SectionHeader title="Household Wallet" />
      <View style={styles.section}>
        <SettingsRow
          icon="warning-outline"
          label="Low Balance Threshold"
          badge={thresholdEnabled ? formatAmount(threshold) : 'Off'}
          onPress={openThresholdEdit}
        />
        <View style={styles.separator} />
        <TouchableOpacity
          style={styles.row}
          onPress={toggleThresholdEnabled}
          activeOpacity={0.7}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Low Balance Alerts</Text>
          <View style={[styles.toggle, thresholdEnabled && styles.toggleActive]}>
            <View style={[styles.toggleKnob, thresholdEnabled && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Threshold edit modal */}
      <Modal visible={editingThreshold} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Low Balance Threshold</Text>
            <Text style={styles.modalSubtitle}>
              Get notified when the household balance drops below this amount.
            </Text>
            <View style={styles.modalAmountRow}>
              <Text style={styles.modalPeso}>₱</Text>
              <TextInput
                style={styles.modalInput}
                value={thresholdInput}
                onChangeText={setThresholdInput}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditingThreshold(false)}
              >
                <Text style={styles.modalBtnCancelLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveThreshold}>
                <Text style={styles.modalBtnSaveLabel}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Credit */}
      <SectionHeader title="Credit Tracker" />
      <View style={styles.section}>
        <SettingsRow
          icon="calendar-outline"
          label="Card Due Date Reminders"
          badge="Phase 5"
          onPress={comingSoon}
          disabled
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="time-outline"
          label="Borrower Payment Reminders"
          badge="Phase 5"
          onPress={comingSoon}
          disabled
        />
      </View>

      {/* Account */}
      <SectionHeader title="Account" />
      <View style={styles.section}>
        <SettingsRow
          icon="log-out-outline"
          label="Sign Out"
          onPress={handleSignOut}
          destructive
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Layout.screenPaddingH,
    gap: 0,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Layout.cardPadding,
    marginBottom: Spacing[8] - 4, // 28
    gap: 14,
    ...Shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    ...TextStyles.h3,
    color: Colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...TextStyles.labelLg,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  profileEmail: {
    ...TextStyles.label,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  sectionHeader: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
    marginBottom: Spacing[2],
    marginLeft: Spacing[1],
    marginTop: Spacing[1],
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: Layout.sectionGap,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Layout.cardPadding,
    gap: Spacing[3],
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: `${Colors.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowIconDestructive: {
    backgroundColor: `${Colors.expense}14`,
  },
  rowLabel: {
    flex: 1,
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  rowLabelDestructive: {
    color: Colors.expense,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowBadge: {
    ...TextStyles.labelSm,
    color: Colors.text.muted,
    backgroundColor: Colors.border,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  // Toggle switch
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: Spacing[3] - 2, // 10
    backgroundColor: Colors.white,
    ...Shadows.xs,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: Layout.sectionGap,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderRadius: Spacing[5], // 20
    padding: Layout.sectionGap,
    gap: Spacing[3],
  },
  modalTitle: {
    ...TextStyles.h4,
    color: Colors.text.primary,
  },
  modalSubtitle: {
    ...TextStyles.label,
    color: Colors.text.secondary,
  },
  modalAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    gap: Spacing[1],
    marginTop: Spacing[1],
  },
  modalPeso: {
    ...TextStyles.h3,
    color: Colors.text.secondary,
  },
  modalInput: {
    flex: 1,
    ...TextStyles.h2,
    color: Colors.text.primary,
    paddingVertical: Spacing[3],
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing[3] - 2, // 10
    marginTop: Spacing[1],
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnSave: {
    backgroundColor: Colors.primary,
  },
  modalBtnCancelLabel: {
    ...TextStyles.labelLg,
    color: Colors.text.secondary,
  },
  modalBtnSaveLabel: {
    ...TextStyles.labelLg,
    fontWeight: '700' as const,
    color: Colors.white,
  },
})
