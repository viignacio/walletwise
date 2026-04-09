import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { ConfirmModal, Text, useAlertModal } from '../../components/ui'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
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
  deleteRecord,
  getRecordWithPayments,
  LendingRecordWithPayments,
} from '../../lib/creditRecords'
import { Payment, PaymentStatus } from '../../types/database'

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
    case 'paid':      return 'Paid'
    case 'underpaid': return 'Underpaid'
    case 'overdue':   return 'Overdue'
    default:          return 'Upcoming'
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  record: LendingRecordWithPayments
}
function SummaryCard({ record }: SummaryCardProps) {
  const paidTotal = record.payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.actual_amount ?? 0), 0)
  const remaining = Number(record.total_amount) - paidTotal

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total</Text>
        <Text style={styles.summaryAmount}>{formatAmount(Number(record.total_amount))}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Paid</Text>
        <Text style={[styles.summaryAmount, { color: Colors.income }]}>
          {formatAmount(paidTotal)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Remaining</Text>
        <Text style={[styles.summaryAmount, remaining > 0 ? { color: Colors.expense } : {}]}>
          {formatAmount(remaining)}
        </Text>
      </View>
      {record.payment_scheme === 'installment' && record.installment_months && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Scheme</Text>
          <Text style={styles.summaryValue}>
            {record.installment_months}× {formatAmount(Number(record.monthly_amount ?? 0))} / mo
          </Text>
        </View>
      )}
      {record.payment_scheme === 'direct' && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Scheme</Text>
          <Text style={styles.summaryValue}>Direct payment</Text>
        </View>
      )}
      {record.expected_card_charge_month && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>First charge</Text>
          <Text style={styles.summaryValue}>{record.expected_card_charge_month}</Text>
        </View>
      )}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Status</Text>
        <Text
          style={[
            styles.summaryValue,
            {
              color:
                record.status === 'settled'
                  ? Colors.income
                  : record.status === 'overdue'
                  ? Colors.expense
                  : Colors.text.secondary,
            },
          ]}
        >
          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
        </Text>
      </View>
    </View>
  )
}

interface PaymentRowProps {
  payment: Payment
  index: number
  recordId: string
}
function PaymentRow({ payment, index, recordId }: PaymentRowProps) {
  const color = statusColor(payment.status)
  const router = useRouter()

  const content = (
    <>
      <View style={[styles.paymentIndex, { backgroundColor: Colors.primaryMuted }]}>
        <Text style={styles.paymentIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.paymentBody}>
        <View style={styles.paymentTop}>
          <Text style={styles.paymentDue}>Due {formatDate(payment.due_date)}</Text>
          <Text style={[styles.paymentStatus, { color }]}>{statusLabel(payment.status)}</Text>
        </View>
        <View style={styles.paymentBottom}>
          <Text style={styles.paymentExpected}>
            Expected: {formatAmount(Number(payment.expected_amount))}
          </Text>
          {payment.actual_amount !== null && (
            <Text style={[styles.paymentActual, { color }]}>
              Paid: {formatAmount(Number(payment.actual_amount))}
            </Text>
          )}
        </View>
        {payment.paid_date && (
          <Text style={styles.paymentPaidDate}>on {formatDate(payment.paid_date)}</Text>
        )}
      </View>
    </>
  )

  if (payment.actual_amount !== null) {
    return (
      <Pressable 
        style={({ pressed }) => [styles.paymentRow, pressed && styles.pressed, { flexDirection: 'row', alignItems: 'center' }]} 
        onPress={() => router.push({ pathname: '/(app)/edit-payment', params: { id: recordId, paymentId: payment.id } })}
      >
        <View style={{ flex: 1, flexDirection: 'row', gap: Spacing[3] }}>
          {content}
        </View>
        <Ionicons name="pencil-outline" size={16} color={Colors.text.muted} />
      </Pressable>
    )
  }

  return (
    <View style={styles.paymentRow}>
      {content}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RecordDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [data, setData] = useState<LendingRecordWithPayments | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      getRecordWithPayments(id)
        .then((r) => { if (active) setData(r) })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false) })
      return () => { active = false }
    }, [id]),
  )

  const handleDelete = () => setConfirmDelete(true)

  const confirmDeleteRecord = async () => {
    setDeleting(true)
    try {
      await deleteRecord(id)
      router.back()
    } catch (e: unknown) {
      setDeleting(false)
      setConfirmDelete(false)
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const canLogPayment =
    data &&
    data.status !== 'settled' &&
    data.payments.some((p) => p.status === 'upcoming' || p.status === 'underpaid')

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing[6] },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: data?.description ?? 'Record',
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : !data ? (
        <Text style={styles.emptyText}>Record not found.</Text>
      ) : (
        <>
          <SummaryCard record={data} />

          {/* ── Log Payment button ── */}
          {canLogPayment && (
            <Pressable
              style={({ pressed }) => [styles.logBtn, pressed && styles.pressed]}
              onPress={() =>
                router.push({ pathname: '/(app)/log-payment', params: { id } })
              }
            >
              <Ionicons name="cash-outline" size={18} color={Colors.white} />
              <Text style={styles.logBtnLabel}>Log Payment</Text>
            </Pressable>
          )}

          {/* ── Payment timeline ── */}
          <Text style={styles.sectionTitle}>Payment Schedule</Text>
          <View style={styles.listCard}>
            {data.payments.length === 0 ? (
              <Text style={styles.emptyText}>No payments generated.</Text>
            ) : (
              data.payments.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <PaymentRow payment={p} index={i} recordId={data.id} />
                </View>
              ))
            )}
          </View>

          {/* ── Delete ── */}
          {data.status !== 'settled' && (
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              onPress={handleDelete}
            >
              <Text style={styles.deleteBtnLabel}>Delete Record</Text>
            </Pressable>
          )}
        </>
      )}
      <ConfirmModal
        visible={confirmDelete}
        title="Delete Record"
        message="This will also delete all payment rows. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDeleteRecord}
        onCancel={() => setConfirmDelete(false)}
      />
      {alertModal}
    </ScrollView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: Spacing[5],
    paddingHorizontal: Layout.screenPaddingH,
    gap: 0,
  },
  loader: {
    marginTop: Spacing[10],
  },
  pressed: { opacity: 0.6 },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadows.card,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    gap: Spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
  },
  summaryAmount: {
    ...TextStyles.amountMd,
    color: Colors.text.primary,
  },
  summaryValue: {
    ...TextStyles.bodySm,
    fontFamily: FontFamily.semiBold,
    color: Colors.text.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // ── Log button ──
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginBottom: Spacing[6],
  },
  logBtnLabel: {
    ...TextStyles.labelLg,
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },

  // ── Section title ──
  sectionTitle: {
    ...TextStyles.h4,
    color: Colors.text.primary,
    marginBottom: Spacing[3],
  },

  // ── Payment list ──
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadows.card,
    overflow: 'hidden',
    marginBottom: Spacing[6],
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  paymentIndex: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  paymentIndexText: {
    ...TextStyles.labelSm,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },
  paymentBody: {
    flex: 1,
    gap: 2,
  },
  paymentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDue: {
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  paymentStatus: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
  },
  paymentBottom: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  paymentExpected: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  paymentActual: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
  },
  paymentPaidDate: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing[4],
  },

  // ── Empty ──
  emptyText: {
    ...TextStyles.bodySm,
    color: Colors.text.muted,
    textAlign: 'center',
    padding: Spacing[5],
  },

  // ── Delete ──
  deleteBtn: {
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteBtnLabel: {
    ...TextStyles.labelLg,
    color: Colors.expense,
  },
})
