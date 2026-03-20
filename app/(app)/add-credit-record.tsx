import { useEffect, useMemo, useState } from 'react'
import {
  InputAccessoryView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { Text, useAlertModal } from '../../components/ui'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  Colors,
  FontFamily,
  FontWeight,
  Layout,
  Radius,
  Spacing,
  TextStyles,
} from '../../constants'
import { getCards } from '../../lib/cards'
import { addInstallment, getInstallments } from '../../lib/installments'
import { createRecord } from '../../lib/creditRecords'
import { deriveBillingInfo } from '../../lib/billing'
import { Card, Installment } from '../../types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Picker row ───────────────────────────────────────────────────────────────

interface PickerRowProps {
  label: string
  value: string
  placeholder: string
  onPress: () => void
}
function PickerRow({ label, value, placeholder, onPress }: PickerRowProps) {
  return (
    <>
      <FormLabel>{label}</FormLabel>
      <Pressable
        style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
        onPress={onPress}
      >
        <Text style={value ? styles.pickerValue : styles.pickerPlaceholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.text.muted} />
      </Pressable>
    </>
  )
}

// ─── Inline picker sheet ──────────────────────────────────────────────────────

interface InlinePickerProps<T> {
  items: T[]
  keyExtractor: (item: T) => string
  labelExtractor: (item: T) => string
  sublabelExtractor?: (item: T) => string
  onSelect: (item: T) => void
  onClose: () => void
}
function InlinePicker<T>({
  items,
  keyExtractor,
  labelExtractor,
  sublabelExtractor,
  onSelect,
  onClose,
}: InlinePickerProps<T>) {
  return (
    <View style={styles.inlinePicker}>
      <View style={styles.inlinePickerHeader}>
        <Text style={styles.inlinePickerTitle}>Select</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>
      {items.map((item) => (
        <Pressable
          key={keyExtractor(item)}
          style={({ pressed }) => [styles.inlinePickerItem, pressed && styles.pressed]}
          onPress={() => { onSelect(item); onClose() }}
        >
          <Text style={styles.inlinePickerItemLabel}>{labelExtractor(item)}</Text>
          {sublabelExtractor && (
            <Text style={styles.inlinePickerItemSub}>{sublabelExtractor(item)}</Text>
          )}
        </Pressable>
      ))}
      {items.length === 0 && (
        <Text style={styles.inlinePickerEmpty}>No items yet.</Text>
      )}
    </View>
  )
}

// ─── Installment picker with inline creation ───────────────────────────────

interface InstallmentPickerProps {
  items: Installment[]
  onSelect: (item: Installment) => void
  onClose: () => void
  onCreate: (name: string, notes: string | null) => Promise<void>
}
function InstallmentPicker({ items, onSelect, onClose, onCreate }: InstallmentPickerProps) {
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await onCreate(newName.trim(), newNotes.trim() || null)
      onClose()
    } catch {
      // error surfaced by parent via Alert
    } finally {
      setCreating(false)
    }
  }

  return (
    <View style={styles.inlinePicker}>
      <View style={styles.inlinePickerHeader}>
        <Text style={styles.inlinePickerTitle}>Select User</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>

      {items.map((item) => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [styles.inlinePickerItem, pressed && styles.pressed]}
          onPress={() => { onSelect(item); onClose() }}
        >
          <Text style={styles.inlinePickerItemLabel}>{item.name}</Text>
          {item.notes ? (
            <Text style={styles.inlinePickerItemSub}>{item.notes}</Text>
          ) : null}
        </Pressable>
      ))}

      {!showForm ? (
        <Pressable
          style={({ pressed }) => [styles.inlinePickerAddRow, pressed && styles.pressed]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.inlinePickerAddLabel}>Add new user</Text>
        </Pressable>
      ) : (
        <View style={styles.inlinePickerForm}>
          <TextInput
            style={styles.inlinePickerInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Name"
            placeholderTextColor={Colors.text.muted}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={[styles.inlinePickerInput, { marginTop: Spacing[2] }]}
            value={newNotes}
            onChangeText={setNewNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={Colors.text.muted}
            returnKeyType="done"
          />
          <Pressable
            style={({ pressed }) => [
              styles.inlinePickerCreateBtn,
              (creating || !newName.trim()) && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleCreate}
            disabled={creating || !newName.trim()}
          >
            <Text style={styles.inlinePickerCreateBtnLabel}>
              {creating ? 'Creating…' : 'Create & Select'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddCreditRecordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { installment_id } = useLocalSearchParams<{ installment_id?: string }>()

  const [cards, setCards] = useState<Card[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(
    () => new Date().toISOString().split('T')[0],  // YYYY-MM-DD
  )
  const [scheme, setScheme] = useState<'direct' | 'installment'>('direct')
  const [installmentMonths, setInstallmentMonths] = useState('')
  const [startPaymentMonth, setStartPaymentMonth] = useState('0')
  const [saving, setSaving] = useState(false)

  const [showCardPicker, setShowCardPicker] = useState(false)
  const [showInstallmentPicker, setShowInstallmentPicker] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  const handleCreateInstallment = async (name: string, notes: string | null) => {
    try {
      const created = await addInstallment({ name, notes })
      setInstallments((prev) => [...prev, created])
      setSelectedInstallment(created)
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not create user')
      throw e
    }
  }

  // Load cards + installments
  useEffect(() => {
    Promise.all([getCards(), getInstallments()])
      .then(([c, i]) => {
        setCards(c)
        setInstallments(i)
        // Pre-select installment if passed as param
        if (installment_id) {
          const found = i.find((x) => x.id === installment_id)
          if (found) setSelectedInstallment(found)
        }
      })
      .catch(() => {})
  }, [installment_id])

  // Derived billing info — recomputed when card or transaction date changes
  const billingInfo = useMemo(() => {
    if (!selectedCard || !transactionDate) return null
    try {
      return deriveBillingInfo(
        new Date(transactionDate),
        selectedCard.billing_cutoff_day,
        selectedCard.due_date_day,
      )
    } catch {
      return null
    }
  }, [selectedCard, transactionDate])

  // Estimated monthly amount preview
  const monthlyPreview = useMemo(() => {
    const total = parseFloat(totalAmount)
    const months = parseInt(installmentMonths, 10)
    if (scheme === 'installment' && !isNaN(total) && !isNaN(months) && months > 0) {
      return Math.round((total / months) * 100) / 100
    }
    return null
  }, [scheme, totalAmount, installmentMonths])

  const handleSave = async () => {
    if (!selectedCard) {
      showAlert('Card required', 'Please select a card.')
      return
    }
    if (!selectedInstallment) {
      showAlert('Installment required', 'Please select an installment.')
      return
    }
    if (!description.trim()) {
      showAlert('Description required', 'Please enter a description.')
      return
    }
    const amount = parseFloat(totalAmount)
    if (isNaN(amount) || amount <= 0) {
      showAlert('Invalid amount', 'Please enter a valid amount.')
      return
    }
    if (!transactionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      showAlert('Invalid date', 'Please enter the date as YYYY-MM-DD.')
      return
    }
    let months: number | undefined
    let startMonth = parseInt(startPaymentMonth, 10) || 0
    if (scheme === 'installment') {
      months = parseInt(installmentMonths, 10)
      if (isNaN(months) || months < 3 || months > 36) {
        showAlert('Invalid months', 'Installment period must be between 3 and 36 months.')
        return
      }
    }

    setSaving(true)
    try {
      await createRecord({
        card_id: selectedCard.id,
        installment_id: selectedInstallment.id,
        description: description.trim(),
        total_amount: amount,
        transaction_date: transactionDate,
        payment_scheme: scheme,
        installment_months: months,
        start_payment_month: startMonth,
        billing_cutoff_day: selectedCard.billing_cutoff_day,
        due_date_day: selectedCard.due_date_day,
      })
      router.back()
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Add Installment Record',
          headerRight: () => null,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={18} color={Colors.text.primary} />
              </View>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing[6] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card ── */}
        <PickerRow
          label="Card"
          value={selectedCard ? selectedCard.name : ''}
          placeholder="Select a card"
          onPress={() => { setShowCardPicker((v) => !v); setShowInstallmentPicker(false) }}
        />
        {showCardPicker && (
          <InlinePicker<Card>
            items={cards}
            keyExtractor={(c) => c.id}
            labelExtractor={(c) => c.name}
            sublabelExtractor={(c) =>
              c.credit_limit > 0 ? formatAmount(c.credit_limit) + ' limit' : 'No limit'
            }
            onSelect={(c) => setSelectedCard(c)}
            onClose={() => setShowCardPicker(false)}
          />
        )}

        {/* ── User ── */}
        {installment_id ? (
          <>
            <FormLabel>User</FormLabel>
            <View style={styles.lockedRow}>
              <Text style={styles.lockedValue} numberOfLines={1}>
                {selectedInstallment ? selectedInstallment.name : '…'}
              </Text>
            </View>
          </>
        ) : (
          <>
            <PickerRow
              label="User"
              value={selectedInstallment ? selectedInstallment.name : ''}
              placeholder="Select a user"
              onPress={() => { setShowInstallmentPicker((v) => !v); setShowCardPicker(false) }}
            />
            {showInstallmentPicker && (
              <InstallmentPicker
                items={installments}
                onSelect={(i) => setSelectedInstallment(i)}
                onClose={() => setShowInstallmentPicker(false)}
                onCreate={handleCreateInstallment}
              />
            )}
          </>
        )}

        {/* ── Description ── */}
        <FormLabel>Description</FormLabel>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. iPhone 16 Pro"
          placeholderTextColor={Colors.text.muted}
          returnKeyType="next"
        />

        {/* ── Total Amount ── */}
        <FormLabel>Total Amount</FormLabel>
        <View style={styles.amountRow}>
          <Text style={styles.pesoSign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            value={totalAmount}
            onChangeText={setTotalAmount}
            placeholder="0.00"
            placeholderTextColor={Colors.text.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            inputAccessoryViewID="no-toolbar"
          />
        </View>

        {/* ── Transaction Date ── */}
        <FormLabel>Transaction Date</FormLabel>
        <TextInput
          style={styles.input}
          value={transactionDate}
          onChangeText={setTransactionDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.text.muted}
          returnKeyType="next"
        />

        {/* ── Billing info disclosure ── */}
        {billingInfo && (
          <View style={styles.billingBanner}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.billingText}>{billingInfo.description}</Text>
          </View>
        )}

        {/* ── Payment scheme ── */}
        <FormLabel>Payment Scheme</FormLabel>
        <View style={styles.segmentRow}>
          {(['direct', 'installment'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.segment, scheme === s && styles.segmentActive]}
              onPress={() => setScheme(s)}
            >
              <Text style={[styles.segmentLabel, scheme === s && styles.segmentLabelActive]}>
                {s === 'direct' ? 'Direct' : 'Installment'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Installment fields ── */}
        {scheme === 'installment' && (
          <>
            <FormLabel>Number of Months (3–36)</FormLabel>
            <TextInput
              style={styles.input}
              value={installmentMonths}
              onChangeText={setInstallmentMonths}
              placeholder="e.g. 12"
              placeholderTextColor={Colors.text.muted}
              keyboardType="number-pad"
              returnKeyType="next"
              inputAccessoryViewID="no-toolbar"
            />
            {monthlyPreview !== null && (
              <Text style={styles.hint}>
                ≈ {formatAmount(monthlyPreview)} / month
              </Text>
            )}

            <FormLabel>Deferred Months (0 = start immediately)</FormLabel>
            <TextInput
              style={styles.input}
              value={startPaymentMonth}
              onChangeText={setStartPaymentMonth}
              placeholder="0"
              placeholderTextColor={Colors.text.muted}
              keyboardType="number-pad"
              returnKeyType="done"
              inputAccessoryViewID="no-toolbar"
            />
            <Text style={styles.hint}>
              Enter 0 to start paying on the first due date. Enter 1 to defer one month, etc.
            </Text>
          </>
        )}

        {/* ── Save ── */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            saving && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnLabel}>
            {saving ? 'Saving…' : 'Add Installment Record'}
          </Text>
        </Pressable>
      </ScrollView>
      {Platform.OS === 'ios' && <InputAccessoryView nativeID="no-toolbar" />}
      {alertModal}
    </KeyboardAvoidingView>
  )
}

function FormLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pressed: { opacity: 0.6 },
  content: {
    padding: Layout.screenPaddingH,
    gap: 0,
  },
  label: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
    marginTop: Layout.cardPadding,
    marginBottom: Spacing[2],
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: 13,
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  hint: {
    ...TextStyles.caption,
    color: Colors.text.muted,
    marginTop: Spacing[1],
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    gap: Spacing[1],
  },
  pesoSign: {
    ...TextStyles.h3,
    color: Colors.text.secondary,
  },
  amountInput: {
    flex: 1,
    ...TextStyles.amountLg,
    color: Colors.text.primary,
    paddingVertical: 14,
  },

  // ── Locked (pre-selected, non-interactive) row ──
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: 13,
  },
  lockedValue: {
    flex: 1,
    ...TextStyles.labelLg,
    color: Colors.text.secondary,
  },

  // ── Picker row ──
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: 13,
    gap: Spacing[2],
  },
  pickerValue: {
    flex: 1,
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  pickerPlaceholder: {
    flex: 1,
    ...TextStyles.labelLg,
    color: Colors.text.muted,
  },

  // ── Inline picker ──
  inlinePicker: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing[2],
    overflow: 'hidden',
  },
  inlinePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inlinePickerTitle: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
  },
  inlinePickerItem: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 2,
  },
  inlinePickerItemLabel: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  inlinePickerItemSub: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  inlinePickerEmpty: {
    ...TextStyles.bodySm,
    color: Colors.text.muted,
    textAlign: 'center',
    padding: Spacing[4],
  },
  inlinePickerAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inlinePickerAddLabel: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },
  inlinePickerForm: {
    padding: Spacing[3],
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inlinePickerInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[3],
    paddingVertical: 10,
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  inlinePickerCreateBtn: {
    marginTop: Spacing[2],
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  inlinePickerCreateBtnLabel: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
    color: Colors.white,
  },

  // ── Billing banner ──
  billingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[2],
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginTop: Spacing[2],
  },
  billingText: {
    flex: 1,
    ...TextStyles.caption,
    color: Colors.primary,
    lineHeight: 18,
  },

  // ── Scheme segment ──
  segmentRow: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentLabel: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
    color: Colors.text.secondary,
  },
  segmentLabelActive: {
    color: Colors.white,
  },

  // ── Buttons ──
  saveBtn: {
    marginTop: Spacing[8],
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnLabel: {
    ...TextStyles.labelLg,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
})
