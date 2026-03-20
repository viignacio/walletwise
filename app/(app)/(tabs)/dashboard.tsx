import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout, Shadows, FontFamily } from '../../../constants'
import { supabase } from '../../../lib/supabase'
import { getProfile } from '../../../lib/profile'
import { fetchRunningBalance, formatAmount, Transaction } from '../../../lib/wallet'
import { getCards } from '../../../lib/cards'
import { Card } from '../../../types/database'

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingDue {
  cardId: string
  cardName: string
  cardColor: string
  dueDate: string        // YYYY-MM-DD
  dueDateDisplay: string // e.g. "Mar 25"
  daysAway: number
  collections: Array<{ name: string; amount: number }>
  totalExpected: number
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

function nextDueDate(dueDateDay: number, today: Date): Date {
  const y = today.getFullYear()
  const m = today.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const day = Math.min(dueDateDay, daysInMonth)
  const candidate = new Date(y, m, day)
  if (candidate >= today) return candidate
  const nextMonth = m + 1
  const nextYear  = nextMonth > 11 ? y + 1 : y
  const nm        = nextMonth % 12
  const daysInNext = new Date(nextYear, nm + 1, 0).getDate()
  return new Date(nextYear, nm, Math.min(dueDateDay, daysInNext))
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDueDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${MONTH_SHORT[m - 1]} ${d}`
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchUpcomingDues(cards: Card[], today: Date): Promise<UpcomingDue[]> {
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + 30)

  const dues: UpcomingDue[] = []

  for (const card of cards) {
    const due = nextDueDate(card.due_date_day, today)
    if (due > windowEnd) continue

    const dueDateStr = toISODate(due)
    const daysAway = daysBetween(today, due)

    // Collect expected payments for this card on this due date
    const { data } = await supabase
      .from('payments')
      .select('expected_amount, lending_records(card_id, installments(name))')
      .eq('status', 'upcoming')
      .eq('due_date', dueDateStr)

    const map = new Map<string, number>()
    for (const row of data ?? []) {
      const record = row.lending_records as { card_id: string; installments: { name: string } | null } | null
      if (!record || record.card_id !== card.id) continue
      const name = record.installments?.name ?? 'Unknown'
      map.set(name, (map.get(name) ?? 0) + Number(row.expected_amount))
    }

    const collections = Array.from(map.entries()).map(([name, amount]) => ({ name, amount }))
    const totalExpected = collections.reduce((s, c) => s + c.amount, 0)

    dues.push({
      cardId: card.id,
      cardName: card.name,
      cardColor: card.color,
      dueDate: dueDateStr,
      dueDateDisplay: formatDueDate(dueDateStr),
      daysAway,
      collections,
      totalExpected,
    })
  }

  return dues.sort((a, b) => a.daysAway - b.daysAway)
}

async function fetchRecentTransactions(householdId: string, limit: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Transaction[]
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BalanceHero({ balance }: { balance: number }) {
  const isPositive = balance >= 0
  const accentColor = isPositive ? Colors.income : Colors.expense
  return (
    <View style={[styles.balanceCard, Shadows.card]}>
      <View style={[styles.balanceAccentBar, { backgroundColor: accentColor }]} />
      <View style={styles.balanceCardInner}>
        <View style={styles.balanceLabelRow}>
          <Ionicons name="home-outline" size={13} color={Colors.text.secondary} />
          <Text style={styles.balanceLabel}>HOUSEHOLD BALANCE</Text>
        </View>
        <Text style={[styles.balanceAmount, { color: accentColor }]}>
          {isPositive ? '+' : '-'}{formatAmount(Math.abs(balance))}
        </Text>
      </View>
    </View>
  )
}

function DueCard({ due }: { due: UpcomingDue }) {
  const urgent = due.daysAway <= 3
  return (
    <View style={[styles.dueCard, Shadows.card]}>
      <View style={[styles.dueCardAccent, { backgroundColor: due.cardColor }]} />
      <View style={styles.dueCardInner}>
        <View style={styles.dueCardHeader}>
          <Text style={styles.dueCardName} numberOfLines={1}>{due.cardName}</Text>
          <View style={[styles.dueBadge, { backgroundColor: urgent ? Colors.expenseLight : Colors.primaryLight }]}>
            <Text style={[styles.dueBadgeText, { color: urgent ? Colors.expense : Colors.primary }]}>
              {due.daysAway === 0 ? 'Today' : due.daysAway === 1 ? 'Tomorrow' : `${due.daysAway}d`}
            </Text>
          </View>
        </View>
        <Text style={styles.dueDateText}>
          <Ionicons name="calendar-outline" size={11} color={Colors.text.muted} />{' '}Due {due.dueDateDisplay}
        </Text>
        {due.collections.length > 0 ? (
          <View style={styles.collectionsRow}>
            <Ionicons name="cash-outline" size={13} color={Colors.text.secondary} style={{ marginRight: 4 }} />
            <Text style={styles.collectionsText} numberOfLines={1}>
              {due.collections.map((c) => `${c.name} ${formatAmount(c.amount)}`).join(' + ')}
              {due.collections.length > 1 ? ` = ${formatAmount(due.totalExpected)}` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.noCollectionsText}>No active collections</Text>
        )}
      </View>
    </View>
  )
}

function ActivityRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === 'income'
  const sign = isIncome ? '+' : '-'
  const color = isIncome ? Colors.income : Colors.expense
  const iconBg = isIncome ? Colors.incomeLight : Colors.expenseLight

  // Date display: "Mar 20"
  const [, m, d] = tx.date.split('-').map(Number)
  const dateLabel = `${MONTH_SHORT[m - 1]} ${d}`

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
        <Ionicons
          name={isIncome ? 'arrow-up-outline' : 'arrow-down-outline'}
          size={14}
          color={color}
        />
      </View>
      <View style={styles.activityLeft}>
        <Text style={styles.activityDesc} numberOfLines={1}>{tx.description}</Text>
        <Text style={styles.activityMeta}>{tx.category} · {dateLabel}</Text>
      </View>
      <Text style={[styles.activityAmount, { color }]}>
        {sign}{formatAmount(Number(tx.amount))}
      </Text>
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const initialized = useRef(false)
  const [balance, setBalance] = useState(0)
  const [upcomingDues, setUpcomingDues] = useState<UpcomingDue[]>([])
  const [recentActivity, setRecentActivity] = useState<Transaction[]>([])

  const load = useCallback(async () => {
    try {
      const profile = await getProfile()
      const today = startOfDay(new Date())

      const [bal, cards, activity] = await Promise.all([
        fetchRunningBalance(profile.household_id),
        getCards(),
        fetchRecentTransactions(profile.household_id, 5),
      ])

      const dues = await fetchUpcomingDues(cards, today)

      setBalance(bal)
      setUpcomingDues(dues)
      setRecentActivity(activity)
    } catch (e) {
      console.warn('[Dashboard] load error:', e)
    } finally {
      initialized.current = true
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!initialized.current) setLoading(true)
      load()
    }, [load])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load()
  }, [load])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing[8] }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Balance hero */}
      <BalanceHero balance={balance} />

      {/* Upcoming dues */}
      <SectionHeader title="UPCOMING DUES" />
      {upcomingDues.length === 0 ? (
        <View style={[styles.emptyCard, Shadows.card]}>
          <Ionicons name="checkmark-circle-outline" size={28} color={Colors.income} style={{ marginBottom: Spacing[2] }} />
          <Text style={styles.emptyText}>No card dues in the next 30 days.</Text>
        </View>
      ) : (
        upcomingDues.map((due) => <DueCard key={due.cardId} due={due} />)
      )}

      {/* Recent activity */}
      <View style={styles.sectionHeaderRow}>
        <SectionHeader title="RECENT ACTIVITY" />
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/wallet')}
          hitSlop={12}
        >
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </View>
      {recentActivity.length === 0 ? (
        <View style={[styles.emptyCard, Shadows.card]}>
          <Ionicons name="receipt-outline" size={28} color={Colors.text.muted} style={{ marginBottom: Spacing[2] }} />
          <Text style={styles.emptyText}>No transactions yet.</Text>
        </View>
      ) : (
        <View style={[styles.activityCard, Shadows.card]}>
          {recentActivity.map((tx, i) => (
            <View key={tx.id}>
              <ActivityRow tx={tx} />
              {i < recentActivity.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Layout.screenPaddingH,
    paddingTop: Spacing[6],
    gap: Spacing[3],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // Balance hero
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing[2],
    overflow: 'hidden',
  },
  balanceAccentBar: {
    height: 4,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  balanceCardInner: {
    padding: Layout.cardPadding,
    paddingVertical: Spacing[6],
    alignItems: 'center',
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    marginBottom: Spacing[2],
  },
  balanceLabel: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  balanceAmount: {
    ...TextStyles.displayMd,
    letterSpacing: -1,
  },

  // Section header
  sectionHeader: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
    letterSpacing: 0.5,
    marginTop: Spacing[3],
    marginBottom: Spacing[1],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing[3],
    marginBottom: Spacing[1],
  },
  seeAllText: {
    ...TextStyles.label,
    color: Colors.primary,
  },

  // Due card
  dueCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing[2],
    overflow: 'hidden',
    flexDirection: 'row',
  },
  dueCardAccent: {
    width: 4,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
  dueCardInner: {
    flex: 1,
    padding: Layout.cardPadding,
  },
  dueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[1],
  },
  dueCardName: {
    ...TextStyles.bodyLg,
    color: Colors.text.primary,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  dueBadge: {
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  dueBadgeText: {
    ...TextStyles.label,
    fontFamily: FontFamily.semiBold,
  },
  dueDateText: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
    marginBottom: Spacing[1],
  },
  collectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  collectionsText: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
    flex: 1,
  },
  noCollectionsText: {
    ...TextStyles.bodySm,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // Activity
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityLeft: {
    flex: 1,
  },
  activityDesc: {
    ...TextStyles.bodySm,
    fontFamily: FontFamily.semiBold,
    color: Colors.text.primary,
  },
  activityMeta: {
    ...TextStyles.caption,
    color: Colors.text.muted,
    marginTop: 2,
  },
  activityAmount: {
    ...TextStyles.amountXs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Layout.cardPadding,
  },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing[6],
    paddingHorizontal: Layout.cardPadding,
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  emptyText: {
    ...TextStyles.bodySm,
    color: Colors.text.muted,
  },
})
