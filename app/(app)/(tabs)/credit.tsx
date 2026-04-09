import { useCallback, memo, useState, useRef } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../../../components/ui'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  Colors,
  FontFamily,
  Layout,
  Radius,
  Shadows,
  Spacing,
  TextStyles,
} from '../../../constants'
import { getCards } from '../../../lib/cards'
import { getInstallments } from '../../../lib/installments'
import { getRecordsByInstallment, RecordsByInstallment } from '../../../lib/creditRecords'
import { ordinal } from '../../../lib/billing'
import { Card, Installment, LendingRecord } from '../../../types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return (
    '₱' +
    n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

function formatLimit(amount: number): string {
  if (amount === 0) return 'No limit set'
  return formatAmount(amount)
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function formatNextDue(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Section header ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string
  onAdd: () => void
}
const SectionHeader = memo(function SectionHeader({ title, onAdd }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        onPress={onAdd}
        hitSlop={8}
      >
        <Ionicons name="add" size={18} color={Colors.primary} />
        <Text style={styles.addBtnLabel}>Add</Text>
      </Pressable>
    </View>
  )
})

// ─── Card item ────────────────────────────────────────────────────────────────

interface CardItemProps {
  card: Card
  onPress: () => void
}
const CardItem = memo(function CardItem({ card, onPress }: CardItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.cardColorBar, { backgroundColor: card.color }]} />
      <View style={styles.listItemBody}>
        <View style={styles.listItemRow}>
          <Text style={styles.listItemTitle} numberOfLines={1}>{card.name}</Text>
          <Text style={styles.cardLimit}>{formatLimit(card.credit_limit)}</Text>
        </View>
        <Text style={styles.listItemSub}>
          Cutoff: {ordinal(card.billing_cutoff_day)} · Due: {ordinal(card.due_date_day)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
    </Pressable>
  )
})

// ─── Installment group item ────────────────────────────────────────────────────

interface InstallmentGroupProps {
  group: RecordsByInstallment
  onViewRecord: (record: LendingRecord) => void
  onEditInstallment: (id: string) => void
}
const InstallmentGroup = memo(function InstallmentGroup({
  group,
  onViewRecord,
  onEditInstallment,
}: InstallmentGroupProps) {
  return (
    <View style={styles.installmentGroup}>
      {/* Group header */}
      <Pressable
        style={({ pressed }) => [styles.installmentHeader, pressed && styles.pressed]}
        onPress={() => onEditInstallment(group.installment_id)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(group.installment_name)}</Text>
        </View>
        <View style={styles.installmentHeaderBody}>
          <Text style={styles.installmentName}>{group.installment_name}</Text>
          <Text style={styles.installmentOwed}>
            Total owed: {formatAmount(group.total_owed)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </Pressable>

      {/* Record rows */}
      {group.records.map((record, index) => (
        <View key={record.id}>
          <View style={styles.recordDivider} />
          <Pressable
            style={({ pressed }) => [styles.recordRow, pressed && styles.pressed]}
            onPress={() => onViewRecord(record)}
          >
            <View style={styles.recordBody}>
              <Text style={styles.recordDescription} numberOfLines={1}>
                {record.description}
              </Text>
              <Text style={styles.recordMeta}>
                {record.payment_scheme === 'installment'
                  ? `${record.payments_remaining ?? record.installment_months}×`
                  : 'Direct'}
                {record.next_due_date
                  ? ` · Next due: ${formatNextDue(record.next_due_date)}`
                  : ''}
              </Text>
            </View>
            <Text style={styles.recordAmount}>
              {formatAmount(Number(record.total_amount))}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.text.muted} />
          </Pressable>
        </View>
      ))}
    </View>
  )
})

// ─── Empty row ────────────────────────────────────────────────────────────────

interface EmptyRowProps {
  message: string
  onAdd: () => void
  addLabel: string
}
function EmptyRow({ message, onAdd, addLabel }: EmptyRowProps) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{message}</Text>
      <Pressable
        style={({ pressed }) => [styles.emptyAddBtn, pressed && styles.pressed]}
        onPress={onAdd}
      >
        <Text style={styles.emptyAddBtnLabel}>{addLabel}</Text>
      </Pressable>
    </View>
  )
}

// ─── Installment item (no active records) ─────────────────────────────────────

interface InstallmentItemProps {
  installment: Installment
  onEdit: () => void
}
const InstallmentItem = memo(function InstallmentItem({
  installment,
  onEdit,
}: InstallmentItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
      onPress={onEdit}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(installment.name)}</Text>
      </View>
      <View style={styles.listItemBody}>
        <Text style={styles.listItemTitle} numberOfLines={1}>{installment.name}</Text>
        {installment.notes ? (
          <Text style={styles.listItemSub} numberOfLines={1}>{installment.notes}</Text>
        ) : (
          <Text style={styles.listItemSub}>No active records</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
    </Pressable>
  )
})

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreditScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [cards, setCards] = useState<Card[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [groups, setGroups] = useState<RecordsByInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      if (!initialized.current) setLoading(true)
      Promise.all([getCards(), getInstallments(), getRecordsByInstallment()])
        .then(([c, i, g]) => {
          if (!active) return
          initialized.current = true
          setCards(c)
          setInstallments(i)
          setGroups(g)
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false) })
      return () => { active = false }
    }, []),
  )

  // ── Callbacks ──
  const openAddCard = useCallback(() => router.push('/(app)/add-card'), [router])
  const openEditCard = useCallback(
    (id: string) => router.push({ pathname: '/(app)/add-card', params: { id } }),
    [router],
  )
  const openAddInstallment = useCallback(
    () => router.push('/(app)/add-credit-record'),
    [router],
  )
  const openEditInstallment = useCallback(
    (id: string) => router.push({ pathname: '/(app)/add-installment', params: { id } }),
    [router],
  )
const openRecord = useCallback(
    (record: LendingRecord) =>
      router.push({ pathname: '/(app)/record-detail', params: { id: record.id } }),
    [router],
  )

  // Which installment ids have active records
  const activeInstallmentIds = new Set(groups.map((g) => g.installment_id))
  const idleInstallments = installments.filter((i) => !activeInstallmentIds.has(i.id))

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing[6] },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cards ── */}
      <View style={styles.section}>
        <SectionHeader title="Cards" onAdd={openAddCard} />
        <View style={styles.listCard}>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
          ) : cards.length === 0 ? (
            <EmptyRow
              message="No cards yet."
              addLabel="Add your first card"
              onAdd={openAddCard}
            />
          ) : (
            cards.map((card, index) => (
              <View key={card.id}>
                {index > 0 && <View style={styles.divider} />}
                <CardItem card={card} onPress={() => openEditCard(card.id)} />
              </View>
            ))
          )}
        </View>
      </View>

      {/* ── Installments ── */}
      <View style={styles.section}>
        <SectionHeader title="Installments" onAdd={openAddInstallment} />

        {loading ? (
          <View style={styles.listCard}>
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loader} />
          </View>
        ) : installments.length === 0 ? (
          <View style={styles.listCard}>
            <EmptyRow
              message="No installments yet."
              addLabel="Add your first installment"
              onAdd={openAddInstallment}
            />
          </View>
        ) : (
          <>
            {/* Groups with active records */}
            {groups.map((group) => (
              <View key={group.installment_id} style={[styles.listCard, styles.groupCard]}>
                <InstallmentGroup
                  group={group}
                  onViewRecord={openRecord}
                  onEditInstallment={openEditInstallment}
                />
              </View>
            ))}

            {/* Installments without active records */}
            {idleInstallments.length > 0 && (
              <View style={styles.listCard}>
                {idleInstallments.map((inst, index) => (
                  <View key={inst.id}>
                    {index > 0 && <View style={styles.divider} />}
                    <InstallmentItem
                      installment={inst}
                      onEdit={() => openEditInstallment(inst.id)}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
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
  pressed: { opacity: 0.6 },

  // ── Section ──
  section: {
    marginBottom: Spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    ...TextStyles.h4,
    color: Colors.text.primary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[2],
  },
  addBtnLabel: {
    ...TextStyles.label,
    color: Colors.primary,
    fontFamily: FontFamily.semiBold,
  },

  // ── List card surface ──
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadows.card,
    overflow: 'hidden',
    marginBottom: Spacing[3],
  },
  groupCard: {
    overflow: 'visible', // allow shadows to breathe
  },
  loader: {
    paddingVertical: Spacing[5],
  },

  // ── Shared list items ──
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
    minHeight: Layout.touchTarget,
  },
  listItemBody: {
    flex: 1,
    gap: 2,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  listItemTitle: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
    flex: 1,
  },
  listItemSub: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing[4],
  },

  // ── Card-specific ──
  cardColorBar: {
    width: 4,
    height: 36,
    borderRadius: Radius.xs,
  },
  cardLimit: {
    ...TextStyles.caption,
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
  },

  // ── Installment avatar ──
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...TextStyles.labelSm,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },

  // ── Installment group ──
  installmentGroup: {
    overflow: 'hidden',
    borderRadius: Radius.md,
  },
  installmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[3],
    minHeight: Layout.touchTarget,
  },
  installmentHeaderBody: {
    flex: 1,
    gap: 2,
  },
  installmentName: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  installmentOwed: {
    ...TextStyles.caption,
    fontFamily: FontFamily.mono,
    color: Colors.expense,
  },

  // ── Add record button (inside group) ──
  addRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[2],
  },
  addRecordBtnLabel: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },

  // ── Record row (inside group) ──
  recordDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing[4],
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    paddingLeft: Spacing[4] + 36 + Spacing[3], // indent to align with header content
    gap: Spacing[2],
  },
  recordBody: {
    flex: 1,
    gap: 2,
  },
  recordDescription: {
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  recordMeta: {
    ...TextStyles.caption,
    color: Colors.text.muted,
  },
  recordAmount: {
    ...TextStyles.caption,
    fontFamily: FontFamily.mono,
    color: Colors.text.secondary,
  },

  // ── Empty state ──
  emptyRow: {
    paddingVertical: Spacing[5],
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    gap: Spacing[3],
  },
  emptyText: {
    ...TextStyles.bodySm,
    color: Colors.text.muted,
  },
  emptyAddBtn: {
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryMuted,
  },
  emptyAddBtnLabel: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },
})
