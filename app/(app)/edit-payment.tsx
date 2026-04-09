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
import { Text, useAlertModal } from '../../components/ui'
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
  editPaymentLocal,
  getRecordWithPayments,
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditPaymentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id, paymentId } = useLocalSearchParams<{ id: string, paymentId: string }>()

  const [recordDescription, setRecordDescription] = useState('')
  const [expectedAmount, setExpectedAmount] = useState(0)
  const [amountInput, setAmountInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paidDate, setPaidDate] = useState('')
  const [preview, setPreview] = useState<{ applied: number, status: PaymentStatus } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      getRecordWithPayments(id)
        .then((r) => {
          if (!active) return
          setRecordDescription(r.description)
          const payment = r.payments.find(p => p.id === paymentId)
          if (payment) {
             setExpectedAmount(Number(payment.expected_amount))
             setAmountInput(formatAmountInput((payment.actual_amount ?? 0).toFixed(2)))
             setDueDate(payment.due_date)
             setPaidDate(payment.paid_date ?? new Date().toISOString().split('T')[0])
          } else {
             showAlert('Error', 'Payment not found.')
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false)
        })
      return () => { active = false }
    }, [id, paymentId]),
  )

  const handlePreview = () => {
    const amount = parseFloat(parseAmountInput(amountInput))
    if (isNaN(amount) || amount <= 0) {
      showAlert('Invalid amount', 'Please enter a valid payment amount.')
      return
    }
    if (amount > expectedAmount) {
      showAlert('Invalid amount', 'Amount cannot exceed the expected amount for edits. Please use the Log Payment feature to handle overpayments.')
      return
    }
    const status = amount >= expectedAmount ? 'paid' : 'underpaid'
    setPreview({ applied: amount, status })
  }

  const handleConfirm = async () => {
    if (!preview) return
    setConfirming(true)
    try {
      await editPaymentLocal(paymentId, preview.applied)
      router.back()
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setConfirming(false)
    }
  }

  const handleAmountChange = (text: string) => {
    setAmountInput(formatAmountInput(text))
    setPreview(null)
  }

  if (loading) {
     return (
       <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
         <ActivityIndicator size="large" color={Colors.primary} />
       </View>
     )
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Edit Payment',
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

        {/* ── Date ── */}
        <FormLabel>Payment Date</FormLabel>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={paidDate}
          editable={false}
        />

        {/* ── Preview button ── */}
        {!preview && (
          <Pressable
            style={({ pressed }) => [
              styles.previewBtn,
              pressed && styles.pressed,
            ]}
            onPress={handlePreview}
          >
            <Text style={styles.previewBtnLabel}>Preview Edit</Text>
          </Pressable>
        )}

        {/* ── Preview results ── */}
        {preview && (
          <>
            <Text style={styles.sectionTitle}>Edit Preview</Text>
            <View style={styles.listCard}>
               <View style={styles.previewRow}>
                 <View style={styles.rowBody}>
                   <View style={styles.rowTop}>
                     <Text style={styles.rowDue}>Due {formatDate(dueDate)}</Text>
                     <Text style={[styles.rowStatus, { color: statusColor(preview.status) }]}>{statusLabel(preview.status)}</Text>
                   </View>
                   <View style={styles.rowBottom}>
                     <Text style={styles.rowExpected}>Expected {formatAmount(expectedAmount)}</Text>
                     <Text style={[styles.rowApplied, { color: statusColor(preview.status) }]}>
                       Will apply {formatAmount(preview.applied)}
                     </Text>
                   </View>
                 </View>
               </View>
            </View>

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
                {confirming ? 'Applying…' : 'Save Changes'}
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
  inputDisabled: {
    backgroundColor: Colors.background,
    color: Colors.text.muted,
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

  // ── Preview button ──
  previewBtn: {
    marginTop: Spacing[8],
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.warning,
    backgroundColor: Colors.warningLight,
  },
  previewBtnLabel: {
    ...TextStyles.labelLg,
    fontFamily: FontFamily.semiBold,
    color: Colors.warning,
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
    marginBottom: Spacing[5],
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    gap: Spacing[3],
  },
  rowBody: {
    flex: 1,
    gap: 4,
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
    justifyContent: 'space-between',
  },
  rowExpected: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  rowApplied: {
    ...TextStyles.caption,
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
