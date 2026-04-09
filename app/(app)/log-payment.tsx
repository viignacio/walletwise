import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  InputAccessoryView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { Text, useAlertModal, DatePickerField } from '../../components/ui'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Colors,
  FontFamily,
  FontWeight,
  Layout,
  Radius,
  Shadows,
  Spacing,
  TextStyles,
} from '../../constants'
import {
  applyPayment,
  CascadePreview,
  CascadePreviewEntry,
  getRecordWithPayments,
  previewCascade,
} from '../../lib/creditRecords'
import { formatAmountInput, parseAmountInput } from '../../lib/wallet'
import { PaymentStatus } from '../../types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusColor(status: PaymentStatus): string {
  switch (status) {
    case 'paid':      return Colors.income
    case 'underpaid': return Colors.warning
    case 'overdue':   return Colors.expense
    default:          return Colors.text.muted
  }
}

function statusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'paid':      return 'Will be marked Paid'
    case 'underpaid': return 'Partial — Underpaid'
    case 'overdue':   return 'Partial — Still Overdue'
    default:          return status
  }
}

// ─── Preview entry row ────────────────────────────────────────────────────────

function PreviewRow({ entry, index }: { entry: CascadePreviewEntry; index: number }) {
  const color = statusColor(entry.resulting_status)
  return (
    <View style={styles.previewRow}>
      <View style={[styles.rowIndex, { backgroundColor: Colors.primaryMuted }]}>
        <Text style={styles.rowIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowDue}>Due {formatDate(entry.due_date)}</Text>
          <Text style={[styles.rowStatus, { color }]}>{statusLabel(entry.resulting_status)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowExpected}>Expected {formatAmount(entry.expected_amount)}</Text>
          <Text style={[styles.rowApplied, { color }]}>
            Apply {formatAmount(entry.applied_amount)}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LogPaymentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [recordDescription, setRecordDescription] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState(0)
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [amountInput, setAmountInput] = useState('')
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().split('T')[0])
  const [preview, setPreview] = useState<CascadePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  useFocusEffect(
    useCallback(() => {
      let active = true
      getRecordWithPayments(id)
        .then((r) => {
          if (!active) return
          setRecordDescription(r.description)
          setMonthlyAmount(r.monthly_amount)
          const paidTotal = r.payments
            .filter((p) => p.status === 'paid')
            .reduce((sum, p) => sum + Number(p.actual_amount ?? 0), 0)
          setTotalOutstanding(Number(r.total_amount) - paidTotal)
        })
        .catch(() => {})
      return () => { active = false }
    }, [id]),
  )

  const handlePreview = async () => {
    const amount = parseFloat(parseAmountInput(amountInput))
    if (isNaN(amount) || amount <= 0) {
      showAlert('Invalid amount', 'Please enter a valid payment amount.')
      return
    }
    if (!paidDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      showAlert('Invalid date', 'Please enter the date as YYYY-MM-DD.')
      return
    }
    setPreviewing(true)
    try {
      const result = await previewCascade(id, amount)
      setPreview(result)
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPreviewing(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    const amount = parseFloat(parseAmountInput(amountInput))
    setConfirming(true)
    try {
      await applyPayment(id, amount, paidDate)
      router.back()
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setConfirming(false)
    }
  }

  // Reset preview when amount changes
  const handleAmountChange = (text: string) => {
    setAmountInput(formatAmountInput(text))
    setPreview(null)
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Log Payment',
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
        {/* ── Record name ── */}
        <View style={styles.recordBanner}>
          <Text style={styles.recordLabel}>Record</Text>
          <Text style={styles.recordName} numberOfLines={1}>{recordDescription}</Text>
        </View>

        {/* ── Amount ── */}
        <FormLabel>Amount Received</FormLabel>
        <View style={styles.amountRow}>
          <Text style={styles.pesoSign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            value={amountInput}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            placeholderTextColor={Colors.text.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            inputAccessoryViewID="no-toolbar"
          />
        </View>
        <View style={styles.amountShortcuts}>
          {totalOutstanding > 0 && (
            <Pressable
              style={({ pressed }) => [styles.shortcutBtn, styles.shortcutFull, pressed && styles.pressed]}
              onPress={() => {
                setAmountInput(formatAmountInput(totalOutstanding.toFixed(2)))
                setPreview(null)
              }}
            >
              <Text style={[styles.shortcutLabel, styles.shortcutFullLabel]}>
                Full Amount — {formatAmount(totalOutstanding)}
              </Text>
            </Pressable>
          )}
          {monthlyAmount > 0 && (
            <Pressable
              style={({ pressed }) => [styles.shortcutBtn, styles.shortcutInstallment, pressed && styles.pressed]}
              onPress={() => {
                setAmountInput(formatAmountInput(monthlyAmount.toFixed(2)))
                setPreview(null)
              }}
            >
              <Text style={[styles.shortcutLabel, styles.shortcutInstallmentLabel]}>
                Installment — {formatAmount(monthlyAmount)}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Date ── */}
        <FormLabel>Payment Date</FormLabel>
        <DatePickerField
          value={paidDate}
          onChange={(t) => { setPaidDate(t); setPreview(null) }}
        />

        {/* ── Preview button ── */}
        {!preview && (
          <Pressable
            style={({ pressed }) => [
              styles.previewBtn,
              previewing && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handlePreview}
            disabled={previewing}
          >
            {previewing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.previewBtnLabel}>Preview</Text>
            )}
          </Pressable>
        )}

        {/* ── Preview results ── */}
        {preview && (
          <>
            <Text style={styles.sectionTitle}>Cascade Preview</Text>
            <View style={styles.listCard}>
              {preview.entries.map((entry, i) => (
                <View key={entry.month_index}>
                  {i > 0 && <View style={styles.divider} />}
                  <PreviewRow entry={entry} index={i} />
                </View>
              ))}
            </View>

            {/* Remainder notice */}
            {preview.remainder > 0 && (
              <View style={styles.remainderBanner}>
                <Text style={styles.remainderText}>
                  Unallocated remainder: {formatAmount(preview.remainder)}
                </Text>
              </View>
            )}

            {/* Settlement notice */}
            {preview.settles_record && (
              <View style={styles.settleBanner}>
                <Text style={styles.settleText}>
                  This payment will fully settle the record.
                </Text>
              </View>
            )}

            {/* Confirm / change amount */}
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                confirming && styles.btnDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleConfirm}
              disabled={confirming}
            >
              <Text style={styles.confirmBtnLabel}>
                {confirming ? 'Applying…' : 'Confirm Payment'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.changeBtn, pressed && styles.pressed]}
              onPress={() => setPreview(null)}
            >
              <Text style={styles.changeBtnLabel}>Change Amount</Text>
            </Pressable>
          </>
        )}
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

  // ── Record banner ──
  recordBanner: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[4],
    marginBottom: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  recordLabel: {
    ...TextStyles.labelSm,
    color: Colors.text.muted,
  },
  recordName: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },

  // ── Form ──
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

  // ── Amount shortcuts ──
  amountShortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  shortcutBtn: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.full,
  },
  shortcutLabel: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
  },
  shortcutFull: {
    backgroundColor: Colors.incomeLight,
  },
  shortcutFullLabel: {
    color: Colors.income,
  },
  shortcutInstallment: {
    backgroundColor: Colors.primaryMuted,
  },
  shortcutInstallmentLabel: {
    color: Colors.primary,
  },

  // ── Preview button ──
  previewBtn: {
    marginTop: Spacing[8],
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  previewBtnLabel: {
    ...TextStyles.labelLg,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },

  // ── Section title ──
  sectionTitle: {
    ...TextStyles.h4,
    color: Colors.text.primary,
    marginTop: Spacing[6],
    marginBottom: Spacing[3],
  },

  // ── Preview list ──
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadows.card,
    overflow: 'hidden',
    marginBottom: Spacing[4],
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  rowIndex: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowIndexText: {
    ...TextStyles.labelSm,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDue: {
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  rowStatus: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
  },
  rowBottom: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  rowExpected: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  rowApplied: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing[4],
  },

  // ── Notices ──
  remainderBanner: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[3],
  },
  remainderText: {
    ...TextStyles.caption,
    color: Colors.warning,
  },
  settleBanner: {
    backgroundColor: Colors.incomeLight,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[3],
  },
  settleText: {
    ...TextStyles.caption,
    color: Colors.income,
    fontFamily: FontFamily.semiBold,
  },

  // ── Confirm ──
  confirmBtn: {
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginBottom: Spacing[3],
  },
  confirmBtnLabel: {
    ...TextStyles.labelLg,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  changeBtn: {
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeBtnLabel: {
    ...TextStyles.labelLg,
    color: Colors.text.secondary,
  },
  btnDisabled: { opacity: 0.6 },
})
