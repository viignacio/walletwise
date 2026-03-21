import { useCallback, useEffect, useState } from 'react'
import { View, Pressable, StyleSheet, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform, Linking, Share, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ConfirmModal, Text, useAlertModal } from '../../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout, Shadows, FontFamily } from '../../../constants'
import { supabase } from '../../../lib/supabase'
import { formatAmount } from '../../../lib/wallet'
import { getAllReminderSettings, setReminderSetting, ReminderSetting } from '../../../lib/notificationSettings'
import { scheduleReminders } from '../../../lib/reminderScheduler'
import * as Notifications from 'expo-notifications'
import * as Updates from 'expo-updates'
import Constants from 'expo-constants'

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
    <Pressable
      style={({ pressed }) => [styles.row, disabled && styles.rowDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled || !onPress}
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
    </Pressable>
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

  // Credit reminder settings
  const [cardDue, setCardDue] = useState<ReminderSetting>({ lead_days: 3, enabled: true })
  const [borrowerPayment, setBorrowerPayment] = useState<ReminderSetting>({ lead_days: 3, enabled: true })
  const [editingReminder, setEditingReminder] = useState<'card_due' | 'borrower_payment' | null>(null)
  const [reminderLeadInput, setReminderLeadInput] = useState('')
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  // Profile modal
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // Household modal
  const [householdModalOpen, setHouseholdModalOpen] = useState(false)
  const [householdName, setHouseholdName] = useState<string | null>(null)
  const [householdMembers, setHouseholdMembers] = useState<Array<{ id: string; name: string }>>([])
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [householdLoading, setHouseholdLoading] = useState(false)

  // Notification preferences modal
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [notifPermission, setNotifPermission] = useState<string | null>(null)

  // Join household modal
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

  // App updates
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateDownloading, setUpdateDownloading] = useState(false)

  const insets = useSafeAreaInsets()
  const { showAlert, alertModal } = useAlertModal()

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

      const [walletSettings, reminderSettings] = await Promise.all([
        supabase
          .from('household_settings')
          .select('low_balance_threshold, low_balance_notification_enabled')
          .eq('household_id', profile.household_id)
          .single(),
        getAllReminderSettings(),
      ])

      if (walletSettings.data) {
        setThreshold(walletSettings.data.low_balance_threshold)
        setThresholdEnabled(walletSettings.data.low_balance_notification_enabled)
      }
      setCardDue(reminderSettings.card_due)
      setBorrowerPayment(reminderSettings.borrower_payment)
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
      showAlert('Invalid amount', 'Please enter a valid threshold amount.')
      return
    }
    const { error } = await supabase
      .from('household_settings')
      .update({ low_balance_threshold: value })
      .eq('household_id', householdId)
    if (error) {
      showAlert('Error', error.message)
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

  const openReminderEdit = (type: 'card_due' | 'borrower_payment') => {
    const current = type === 'card_due' ? cardDue : borrowerPayment
    setReminderLeadInput(String(current.lead_days))
    setEditingReminder(type)
  }

  const saveReminder = async () => {
    if (!editingReminder) return
    const days = parseInt(reminderLeadInput, 10)
    if (isNaN(days) || days < 1 || days > 30) {
      showAlert('Invalid value', 'Please enter a number between 1 and 30.')
      return
    }
    const current = editingReminder === 'card_due' ? cardDue : borrowerPayment
    await setReminderSetting(editingReminder, days, current.enabled)
    if (editingReminder === 'card_due') setCardDue({ ...current, lead_days: days })
    else setBorrowerPayment({ ...current, lead_days: days })
    setEditingReminder(null)
    scheduleReminders().catch(() => {})
  }

  const toggleReminder = async (type: 'card_due' | 'borrower_payment') => {
    const current = type === 'card_due' ? cardDue : borrowerPayment
    const updated = { ...current, enabled: !current.enabled }
    await setReminderSetting(type, updated.lead_days, updated.enabled)
    if (type === 'card_due') setCardDue(updated)
    else setBorrowerPayment(updated)
    scheduleReminders().catch(() => {})
  }

  // ── Profile ──────────────────────────────────────────────────
  const openProfileModal = () => {
    setNameInput(displayName ?? '')
    setProfileModalOpen(true)
  }

  const saveProfile = async () => {
    const name = nameInput.trim()
    if (!name) {
      showAlert('Required', 'Please enter a display name.')
      return
    }
    setNameSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await Promise.all([
        supabase.from('profiles').update({ name }).eq('id', user.id),
        supabase.auth.updateUser({ data: { full_name: name } }),
      ])
      setDisplayName(name)
      setProfileModalOpen(false)
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not save name.')
    } finally {
      setNameSaving(false)
    }
  }

  // ── Household ─────────────────────────────────────────────────
  const openHouseholdModal = async () => {
    setHouseholdModalOpen(true)
    setInviteCode(null)
    if (!householdId) return
    setHouseholdLoading(true)
    try {
      const [hResult, mResult] = await Promise.all([
        supabase.from('households').select('name').eq('id', householdId).single(),
        supabase.from('profiles').select('id, name').eq('household_id', householdId),
      ])
      if (hResult.data) setHouseholdName(hResult.data.name)
      if (mResult.data) setHouseholdMembers(mResult.data)
    } finally {
      setHouseholdLoading(false)
    }
  }

  const generateInvite = async () => {
    if (!householdId) return
    setInviteLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Generate a readable 6-char code (no ambiguous chars)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      const { error } = await supabase.from('household_invites').insert({
        household_id: householdId,
        code,
        created_by: user.id,
        expires_at: expiresAt,
      })
      if (error) throw error
      setInviteCode(code)
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not generate invite.')
    } finally {
      setInviteLoading(false)
    }
  }

  const shareInviteCode = async () => {
    if (!inviteCode) return
    await Share.share({
      message: `Join my WalletWise household! Use invite code: ${inviteCode}`,
    })
  }

  // ── Join Household ────────────────────────────────────────────
  const joinHousehold = async () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) {
      showAlert('Invalid code', 'Please enter the 6-character invite code.')
      return
    }
    setJoinLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const now = new Date().toISOString()
      const { data: invite, error: ie } = await supabase
        .from('household_invites')
        .select('household_id, expires_at')
        .eq('code', code)
        .single()

      if (ie || !invite) {
        showAlert('Invalid code', 'This invite code was not found. Check that it was entered correctly.')
        return
      }
      if (invite.expires_at && invite.expires_at < now) {
        showAlert('Code expired', 'This invite code has expired. Ask the household owner to generate a new one.')
        return
      }

      const { error: pe } = await supabase
        .from('profiles')
        .update({ household_id: invite.household_id })
        .eq('id', user.id)
      if (pe) throw pe

      setHouseholdId(invite.household_id)
      setJoinModalOpen(false)
      setJoinCode('')
      showAlert('Joined!', 'You have joined the household. Pull to refresh on any screen to see shared data.')
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not join household.')
    } finally {
      setJoinLoading(false)
    }
  }

  // ── Notification preferences ──────────────────────────────────
  const openNotifModal = async () => {
    const { status } = await Notifications.getPermissionsAsync()
    setNotifPermission(status)
    setNotifModalOpen(true)
  }

  const appVersion = Constants.expoConfig?.version ?? '0.0.0'
  const updateId = Updates.updateId
  const updateDate = Updates.createdAt
  const versionDisplay = updateId
    ? `v${appVersion} · update ${updateId.slice(0, 8)} (${updateDate?.toLocaleDateString()})`
    : `v${appVersion}`

  const LAST_UPDATE_CHECK_KEY = 'walletwise_last_update_check'
  const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

  const checkForUpdate = useCallback(async (silent = false) => {
    if (__DEV__) {
      if (!silent) showAlert('Dev Mode', 'Updates are not available in development.')
      return
    }
    setUpdateChecking(true)
    try {
      const result = await Updates.checkForUpdateAsync()
      await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString())
      if (result.isAvailable) {
        setUpdateAvailable(true)
      } else if (!silent) {
        showAlert('Up to date', `You're on the latest version (${versionDisplay}).`)
      }
    } catch {
      if (!silent) showAlert('Error', 'Could not check for updates. Please try again later.')
    } finally {
      setUpdateChecking(false)
    }
  }, [versionDisplay, showAlert])

  useEffect(() => {
    (async () => {
      const last = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY)
      const elapsed = last ? Date.now() - parseInt(last, 10) : Infinity
      if (elapsed >= UPDATE_CHECK_INTERVAL) {
        checkForUpdate(true)
      }
    })()
  }, [checkForUpdate])

  const downloadAndApplyUpdate = async () => {
    setUpdateDownloading(true)
    try {
      await Updates.fetchUpdateAsync()
      showAlert('Update ready', 'The app will now restart to apply the update.', async () => {
        await Updates.reloadAsync()
      })
    } catch {
      showAlert('Error', 'Failed to download the update. Please try again.')
    } finally {
      setUpdateDownloading(false)
    }
  }

  const handleSignOut = () => setConfirmSignOut(true)

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
          onPress={openProfileModal}
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="people-outline"
          label="Household"
          onPress={openHouseholdModal}
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="enter-outline"
          label="Join a Household"
          onPress={() => { setJoinCode(''); setJoinModalOpen(true) }}
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="notifications-outline"
          label="Notification Preferences"
          onPress={openNotifModal}
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
        <Pressable
          style={styles.row}
          onPress={toggleThresholdEnabled}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.rowLabel}>Low Balance Alerts</Text>
          <View style={[styles.toggle, thresholdEnabled && styles.toggleActive]}>
            <View style={[styles.toggleKnob, thresholdEnabled && styles.toggleKnobActive]} />
          </View>
        </Pressable>
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
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditingThreshold(false)}
              >
                <Text style={styles.modalBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveThreshold}>
                <Text style={styles.modalBtnSaveLabel}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Credit Tracker reminders */}
      <SectionHeader title="Credit Tracker" />
      <View style={styles.section}>
        {/* Card due date reminder */}
        <Pressable
          style={styles.row}
          onPress={() => openReminderEdit('card_due')}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Card Due Date Reminder</Text>
            <Text style={styles.rowSublabel}>
              {cardDue.enabled ? `${cardDue.lead_days} day${cardDue.lead_days !== 1 ? 's' : ''} before` : 'Off'}
            </Text>
          </View>
          <View style={[styles.toggle, cardDue.enabled && styles.toggleActive]}
            // Toggle tapped separately — suppress row press on knob area
          >
            <Pressable
              onPress={() => toggleReminder('card_due')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={[styles.toggleKnob, cardDue.enabled && styles.toggleKnobActive]} />
            </Pressable>
          </View>
        </Pressable>

        <View style={styles.separator} />

        {/* Borrower payment reminder */}
        <Pressable
          style={styles.row}
          onPress={() => openReminderEdit('borrower_payment')}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Installment Payment Reminder</Text>
            <Text style={styles.rowSublabel}>
              {borrowerPayment.enabled ? `${borrowerPayment.lead_days} day${borrowerPayment.lead_days !== 1 ? 's' : ''} before` : 'Off'}
            </Text>
          </View>
          <View style={[styles.toggle, borrowerPayment.enabled && styles.toggleActive]}>
            <Pressable
              onPress={() => toggleReminder('borrower_payment')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={[styles.toggleKnob, borrowerPayment.enabled && styles.toggleKnobActive]} />
            </Pressable>
          </View>
        </Pressable>
      </View>

      {/* Reminder lead-days edit modal */}
      <Modal visible={editingReminder !== null} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingReminder === 'card_due' ? 'Card Due Date Reminder' : 'Installment Payment Reminder'}
            </Text>
            <Text style={styles.modalSubtitle}>
              How many days before the due date should we remind you?
            </Text>
            <View style={styles.modalAmountRow}>
              <TextInput
                style={[styles.modalInput, { textAlign: 'center' }]}
                value={reminderLeadInput}
                onChangeText={setReminderLeadInput}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                maxLength={2}
              />
              <Text style={[styles.modalPeso, { fontSize: 16 }]}> days</Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditingReminder(null)}
              >
                <Text style={styles.modalBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveReminder}>
                <Text style={styles.modalBtnSaveLabel}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* App Version & Updates */}
      <SectionHeader title="About" />
      <View style={styles.section}>
        {updateAvailable ? (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed, updateDownloading && styles.rowDisabled]}
            onPress={downloadAndApplyUpdate}
            disabled={updateDownloading}
          >
            <View style={[styles.rowIcon, { backgroundColor: `${Colors.income}14` }]}>
              {updateDownloading
                ? <ActivityIndicator color={Colors.income} size="small" />
                : <Ionicons name="download-outline" size={18} color={Colors.income} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { flex: 0, color: Colors.income }]}>
                {updateDownloading ? 'Downloading...' : 'Download & Restart'}
              </Text>
              <Text style={styles.rowSublabel}>WalletWise {versionDisplay}</Text>
            </View>
            <View style={styles.updateBadge}>
              <Text style={styles.updateBadgeText}>New</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed, updateChecking && styles.rowDisabled]}
            onPress={() => checkForUpdate()}
            disabled={updateChecking}
          >
            <View style={styles.rowIcon}>
              {updateChecking
                ? <ActivityIndicator color={Colors.primary} size="small" />
                : <Ionicons name="refresh-outline" size={18} color={Colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { flex: 0 }]}>Check for Updates</Text>
              <Text style={styles.rowSublabel}>WalletWise {versionDisplay}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
          </Pressable>
        )}
      </View>

      {/* ── Profile modal ── */}
      <Modal visible={profileModalOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalSubtitle}>Update your display name.</Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Display name"
              placeholderTextColor={Colors.text.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveProfile}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setProfileModalOpen(false)}
              >
                <Text style={styles.modalBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSave, nameSaving && styles.modalBtnDisabled]}
                onPress={saveProfile}
                disabled={nameSaving}
              >
                {nameSaving
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.modalBtnSaveLabel}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Household modal ── */}
      <Modal visible={householdModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Household</Text>
              <Pressable onPress={() => setHouseholdModalOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>
            {householdLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing[4] }} />
            ) : (
              <>
                {householdName ? (
                  <Text style={styles.householdName}>{householdName}</Text>
                ) : null}

                {/* Members */}
                {householdMembers.length > 0 && (
                  <>
                    <Text style={styles.householdSectionLabel}>MEMBERS</Text>
                    {householdMembers.map((m) => (
                      <View key={m.id} style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberInitial}>{m.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.memberName}>{m.name}</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Invite */}
                <Text style={styles.householdSectionLabel}>INVITE</Text>
                {inviteCode ? (
                  <>
                    <View style={styles.inviteCodeBox}>
                      <Text style={styles.inviteCode}>{inviteCode}</Text>
                      <Pressable
                        onPress={shareInviteCode}
                        style={styles.shareBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="share-outline" size={18} color={Colors.primary} />
                      </Pressable>
                    </View>
                    <Text style={styles.inviteExpiry}>Valid for 24 hours</Text>
                    <Pressable onPress={() => setInviteCode(null)} hitSlop={8}>
                      <Text style={styles.regenerateLink}>Generate new code</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.modalActions}>
                    <Pressable
                      style={[styles.modalBtn, styles.modalBtnSave, inviteLoading && styles.modalBtnDisabled]}
                      onPress={generateInvite}
                      disabled={inviteLoading}
                    >
                      {inviteLoading
                        ? <ActivityIndicator color={Colors.white} size="small" />
                        : <Text style={styles.modalBtnSaveLabel}>Generate Invite Code</Text>}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Join household modal ── */}
      <Modal visible={joinModalOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Join a Household</Text>
            <Text style={styles.modalSubtitle}>
              Enter the 6-character invite code shared by a household member.
            </Text>
            <TextInput
              style={[styles.nameInput, styles.codeInput]}
              value={joinCode}
              onChangeText={(v) => setJoinCode(v.toUpperCase())}
              placeholder="E.G. AB3X7K"
              placeholderTextColor={Colors.text.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={joinHousehold}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setJoinModalOpen(false)}
              >
                <Text style={styles.modalBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSave, joinLoading && styles.modalBtnDisabled]}
                onPress={joinHousehold}
                disabled={joinLoading}
              >
                {joinLoading
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.modalBtnSaveLabel}>Join</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Notification preferences modal ── */}
      <Modal visible={notifModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <Pressable onPress={() => setNotifModalOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>

            <View style={[
              styles.permissionBadge,
              { backgroundColor: notifPermission === 'granted' ? Colors.incomeLight : Colors.warningLight },
            ]}>
              <Ionicons
                name={notifPermission === 'granted' ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={notifPermission === 'granted' ? Colors.income : Colors.warning}
                style={{ marginRight: 6 }}
              />
              <Text style={[
                styles.permissionText,
                { color: notifPermission === 'granted' ? Colors.income : Colors.warning },
              ]}>
                {notifPermission === 'granted' ? 'Notifications enabled' : 'Notifications are off'}
              </Text>
            </View>

            <Text style={styles.modalSubtitle}>
              {notifPermission === 'granted'
                ? 'WalletWise can send reminders for card due dates and installment payments. Configure lead times in the Credit Tracker section below.'
                : 'Enable notifications in your device settings to receive card due date and installment payment reminders.'}
            </Text>

            <View style={[styles.modalActions, { flexDirection: 'column' }]}>
              {notifPermission !== 'granted' && (
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSave, { flex: 0 }]}
                  onPress={() => { setNotifModalOpen(false); Linking.openSettings() }}
                >
                  <Text style={styles.modalBtnSaveLabel}>Open Device Settings</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel, { flex: 0 }]}
                onPress={() => setNotifModalOpen(false)}
              >
                <Text style={styles.modalBtnCancelLabel}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ConfirmModal
        visible={confirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        destructive
        onConfirm={() => { setConfirmSignOut(false); supabase.auth.signOut() }}
        onCancel={() => setConfirmSignOut(false)}
      />
      {alertModal}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.65,
  },
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
  rowSublabel: {
    ...TextStyles.label,
    color: Colors.text.muted,
    marginTop: 1,
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
    fontFamily: FontFamily.semiBold,
    color: Colors.white,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  // Profile modal
  nameInput: {
    ...TextStyles.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: Layout.inputHeight,
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.surface,
  },
  codeInput: {
    textAlign: 'center',
    fontFamily: FontFamily.monoSemiBold,
    fontSize: 22,
    letterSpacing: 6,
  },
  // Household modal
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  householdName: {
    ...TextStyles.h4,
    color: Colors.text.primary,
    marginBottom: Spacing[3],
  },
  householdSectionLabel: {
    ...TextStyles.labelSm,
    color: Colors.text.muted,
    letterSpacing: 0.5,
    marginTop: Spacing[3],
    marginBottom: Spacing[2],
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[2],
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    ...TextStyles.label,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },
  memberName: {
    ...TextStyles.body,
    color: Colors.text.primary,
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  inviteCode: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize: 22,
    color: Colors.primary,
    letterSpacing: 4,
  },
  shareBtn: {
    padding: Spacing[2],
  },
  inviteExpiry: {
    ...TextStyles.caption,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  regenerateLink: {
    ...TextStyles.label,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  // Notification preferences modal
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
  },
  permissionText: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
  },
  // Version & updates
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    backgroundColor: Colors.incomeLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  updateBadgeText: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
    color: Colors.income,
    fontSize: 11,
  },
})
