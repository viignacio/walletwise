import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { Text } from '../../../components/ui'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout, Shadows } from '../../../constants'
import { supabase } from '../../../lib/supabase'
import { getProfile } from '../../../lib/profile'
import {
  fetchMonthTransactions,
  fetchMonthlyBalance,
  fetchYTDRows,
  computeCategoryBreakdown,
  formatAmount,
  MonthlyBalance,
  CategoryTotal,
  YTDMonthRow,
  Transaction,
} from '../../../lib/wallet'

type ViewMode = 'monthly' | 'ytd'

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Sub-components ────────────────────────────────────────────

function BalanceSummaryCard({ balance }: { balance: MonthlyBalance }) {
  return (
    <Animated.View entering={FadeInDown.duration(350).easing(Easing.out(Easing.cubic))} style={styles.balanceCard}>
      <BalanceRow label="Opening Balance" amount={balance.openingBalance} neutral />
      <View style={styles.balanceDivider} />
      <BalanceRow label="+ Income" amount={balance.income} positive />
      <BalanceRow label="− Expenses" amount={balance.expenses} negative />
      <View style={styles.balanceDivider} />
      <BalanceRow label="Net Movement" amount={balance.netMovement} colored />
      <View style={[styles.balanceDivider, { backgroundColor: Colors.border }]} />
      <BalanceRow label="Closing Balance" amount={balance.closingBalance} neutral large />
    </Animated.View>
  )
}

function BalanceRow({
  label,
  amount,
  neutral,
  positive,
  negative,
  colored,
  large,
}: {
  label: string
  amount: number
  neutral?: boolean
  positive?: boolean
  negative?: boolean
  colored?: boolean
  large?: boolean
}) {
  const color = neutral
    ? Colors.text.primary
    : positive
      ? Colors.income
      : negative
        ? Colors.expense
        : amount >= 0
          ? Colors.income
          : Colors.expense

  return (
    <View style={styles.balanceRow}>
      <Text style={[styles.balanceLabel, large && styles.balanceLabelLarge]}>{label}</Text>
      <Text style={[styles.balanceAmount, large && styles.balanceAmountLarge, { color }]}>
        {formatAmount(amount)}
      </Text>
    </View>
  )
}

const TransactionItem = memo(function TransactionItem({
  transaction,
  authorName,
  onPress,
}: {
  transaction: Transaction
  authorName: string
  onPress: () => void
}) {
  const isIncome = transaction.type === 'income'
  return (
    <Pressable style={({ pressed }) => [styles.txItem, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.txIcon, { backgroundColor: isIncome ? `${Colors.income}14` : `${Colors.expense}14` }]}>
        <Ionicons
          name={isIncome ? 'arrow-up-outline' : 'arrow-down-outline'}
          size={18}
          color={isIncome ? Colors.income : Colors.expense}
        />
      </View>
      <View style={styles.txMeta}>
        <Text style={styles.txDescription} numberOfLines={1}>
          {transaction.description}
        </Text>
        <Text style={styles.txSub}>
          {transaction.category} · {authorName} · {formatDate(transaction.date)}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? Colors.income : Colors.expense }]}>
        {isIncome ? '+' : '−'}{formatAmount(transaction.amount)}
      </Text>
    </Pressable>
  )
})

function AnimatedCatBar({ percentage }: { percentage: number }) {
  const [containerWidth, setContainerWidth] = useState(0)
  const animWidth = useSharedValue(0)

  useEffect(() => {
    if (containerWidth > 0) {
      animWidth.value = withTiming(containerWidth * (percentage / 100), {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      })
    }
  }, [containerWidth, percentage])

  const barStyle = useAnimatedStyle(() => ({ width: animWidth.value }))

  return (
    <View
      style={styles.catBarBg}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.catBarFill, barStyle]} />
    </View>
  )
}

function CategoryBreakdownSection({ categories }: { categories: CategoryTotal[] }) {
  if (!categories.length) return null

  const total = categories.reduce((s, c) => s + c.amount, 0)

  return (
    <View style={styles.categorySection}>
      <Text style={styles.sectionTitle}>Expense Breakdown</Text>
      {categories.map((cat) => (
        <Animated.View key={cat.category} entering={FadeIn.duration(300)} style={styles.catRow}>
          <View style={styles.catLabelRow}>
            <Text style={styles.catName}>{cat.category}</Text>
            <Text style={styles.catAmount}>{formatAmount(cat.amount)}</Text>
          </View>
          <AnimatedCatBar percentage={Math.min(100, (cat.amount / total) * 100)} />
        </Animated.View>
      ))}
    </View>
  )
}

function YTDTable({
  rows,
  year,
  onMonthPress,
}: {
  rows: YTDMonthRow[]
  year: number
  onMonthPress: (month: number) => void
}) {
  return (
    <View style={styles.ytdTable}>
      <View style={styles.ytdHeader}>
        <Text style={[styles.ytdHeaderCell, { flex: 2 }]}>Month</Text>
        <Text style={[styles.ytdHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Expenses</Text>
        <Text style={[styles.ytdHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Balance</Text>
      </View>
      {rows.map((row) => (
        <Pressable
          key={row.month}
          style={({ pressed }) => [styles.ytdRow, pressed && styles.pressed]}
          onPress={() => onMonthPress(row.month)}
        >
          <Text style={[styles.ytdCell, { flex: 2 }]}>{row.label}</Text>
          <Text style={[styles.ytdCell, { flex: 1.5, textAlign: 'right', color: Colors.expense }]}>
            {row.expenses > 0 ? formatAmount(row.expenses) : '—'}
          </Text>
          <Text
            style={[
              styles.ytdCell,
              { flex: 1.5, textAlign: 'right', color: row.balance < 0 ? Colors.expense : Colors.text.primary, fontWeight: '600' },
            ]}
          >
            {formatAmount(row.balance)}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

// ── Main screen ───────────────────────────────────────────────

export default function WalletScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const now = useRef(new Date()).current

  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})

  const [monthBalance, setMonthBalance] = useState<MonthlyBalance | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<CategoryTotal[]>([])
  const [ytdRows, setYtdRows] = useState<YTDMonthRow[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // FAB press animation
  const fabScale = useSharedValue(1)
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }))

  const loadMonthly = useCallback(async (hid: string, y: number, m: number) => {
    const [bal, txns] = await Promise.all([
      fetchMonthlyBalance(hid, y, m),
      fetchMonthTransactions(hid, y, m),
    ])
    setMonthBalance(bal)
    setTransactions(txns)
    setCategories(computeCategoryBreakdown(txns))
  }, [])

  const loadYTD = useCallback(async (hid: string, y: number) => {
    const rows = await fetchYTDRows(hid, y, now.getFullYear(), now.getMonth() + 1)
    setYtdRows(rows)
  }, [now])

  const loadData = useCallback(async () => {
    try {
      let hid = householdId
      if (!hid) {
        const profile = await getProfile()
        hid = profile.household_id
        setHouseholdId(hid)

        const { data: members } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('household_id', hid)
        const map: Record<string, string> = {}
        for (const m of members ?? []) map[m.id] = m.name
        setProfileMap(map)
      }

      if (viewMode === 'monthly') {
        await loadMonthly(hid, year, month)
      } else {
        await loadYTD(hid, year)
      }
    } catch (e) {
      console.warn('Wallet load error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [householdId, viewMode, year, month, loadMonthly, loadYTD])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      loadData()
    }, [loadData])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  const prevMonth = useCallback(() => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }, [month])

  const prevYear = useCallback(() => setYear(y => y - 1), [])
  const nextYear = useCallback(() => setYear(y => y + 1), [])
  const isCurrentYear = year === now.getFullYear()

  const switchToYTD = useCallback(() => {
    setYear(now.getFullYear())
    setViewMode('ytd')
  }, [now])

  const switchToMonthly = useCallback(() => {
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    setViewMode('monthly')
  }, [now])

  const onYTDMonthPress = useCallback((m: number) => {
    setMonth(m)
    setViewMode('monthly')
  }, [])

  const openAddTransaction = useCallback(() => router.push('/(app)/add-transaction'), [router])
  const openEditTransaction = useCallback(
    (id: string) => router.push({ pathname: '/(app)/edit-transaction', params: { id } }),
    [router]
  )

  const navTitle = viewMode === 'monthly' ? `${MONTH_FULL[month - 1]} ${year}` : String(year)
  const navTitleKey = viewMode === 'monthly' ? `${year}-${month}` : String(year)

  // ── Render ──────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      {/* Toggle bar */}
      <View style={styles.toggleBar}>
        <Pressable
          style={[styles.toggleBtn, viewMode === 'monthly' && styles.toggleBtnActive]}
          onPress={switchToMonthly}
        >
          <Text style={[styles.toggleLabel, viewMode === 'monthly' && styles.toggleLabelActive]}>
            Monthly
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, viewMode === 'ytd' && styles.toggleBtnActive]}
          onPress={switchToYTD}
        >
          <Text style={[styles.toggleLabel, viewMode === 'ytd' && styles.toggleLabelActive]}>
            Year to Date
          </Text>
        </Pressable>
      </View>

      {/* Nav header */}
      <View style={styles.navHeader}>
        <Pressable
          onPress={viewMode === 'monthly' ? prevMonth : prevYear}
          style={({ pressed }) => [styles.navArrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </Pressable>

        <Animated.Text key={navTitleKey} entering={FadeIn.duration(200)} style={styles.navTitle}>
          {navTitle}
        </Animated.Text>

        <Pressable
          onPress={viewMode === 'monthly' ? nextMonth : nextYear}
          style={({ pressed }) => [
            styles.navArrow,
            pressed && styles.pressed,
            viewMode === 'ytd' && isCurrentYear && styles.navArrowDisabled,
          ]}
          disabled={viewMode === 'ytd' && isCurrentYear}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={viewMode === 'ytd' && isCurrentYear ? Colors.text.muted : Colors.primary}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : viewMode === 'monthly' ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {monthBalance && <BalanceSummaryCard balance={monthBalance} />}

          <Text style={styles.sectionTitle}>Transactions</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No transactions this month</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {transactions.map((tx, i) => (
                <View key={tx.id}>
                  <TransactionItem
                    transaction={tx}
                    authorName={profileMap[tx.user_id] ?? 'Unknown'}
                    onPress={() => openEditTransaction(tx.id)}
                  />
                  {i < transactions.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </View>
          )}

          <CategoryBreakdownSection categories={categories} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {ytdRows.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No data for {year}</Text>
            </View>
          ) : (
            <YTDTable rows={ytdRows} year={year} onMonthPress={onYTDMonthPress} />
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        onPressIn={() => { fabScale.value = withSpring(0.88, { damping: 15, stiffness: 300 }) }}
        onPressOut={() => { fabScale.value = withSpring(1, { damping: 15, stiffness: 300 }) }}
        onPress={openAddTransaction}
        style={styles.fabContainer}
      >
        <Animated.View style={[styles.fab, fabAnimatedStyle]}>
          <Ionicons name="add" size={28} color={Colors.white} />
        </Animated.View>
      </Pressable>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pressed: {
    opacity: 0.6,
  },
  toggleBar: {
    flexDirection: 'row',
    margin: Spacing[4],
    marginBottom: Spacing[1],
    backgroundColor: Colors.border,
    borderRadius: Spacing[3] - 2, // 10 — nearest non-token value kept
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing[2],
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  toggleLabel: {
    ...TextStyles.label,
    color: Colors.text.secondary,
  },
  toggleLabelActive: {
    color: Colors.text.primary,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[2],
  },
  navArrow: {
    padding: Spacing[2],
  },
  navArrowDisabled: {
    opacity: 0.3,
  },
  navTitle: {
    ...TextStyles.h4,
    color: Colors.text.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Layout.cardPadding,
    paddingTop: Spacing[1],
  },
  // Balance card
  balanceCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Layout.cardPadding,
    marginBottom: Spacing[5],
    ...Shadows.sm,
    gap: 2,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: Colors.background,
    marginVertical: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  balanceLabel: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
  },
  balanceLabelLarge: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  balanceAmount: {
    ...TextStyles.amountXs,
  },
  balanceAmountLarge: {
    ...TextStyles.amountSm,
  },
  // Transactions
  sectionTitle: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
    marginBottom: Spacing[2],
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: Spacing[5],
    overflow: 'hidden',
    ...Shadows.sm,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    gap: Spacing[3],
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: Spacing[3] - 2, // 10
    justifyContent: 'center',
    alignItems: 'center',
  },
  txMeta: {
    flex: 1,
    gap: 2,
  },
  txDescription: {
    ...TextStyles.bodySm,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  txSub: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
  },
  txAmount: {
    ...TextStyles.amountXs,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 62,
  },
  emptyBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing[8],
    alignItems: 'center',
    marginBottom: Spacing[5],
  },
  emptyText: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
  },
  // Category breakdown
  categorySection: {
    marginBottom: Spacing[5],
  },
  catRow: {
    backgroundColor: Colors.white,
    borderRadius: Spacing[3] - 2, // 10
    padding: Spacing[3],
    marginBottom: Spacing[2],
    gap: Spacing[2],
    ...Shadows.xs,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  catAmount: {
    ...TextStyles.label,
    color: Colors.expense,
  },
  catBarBg: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: {
    height: 4,
    backgroundColor: Colors.expense,
    borderRadius: 2,
    opacity: 0.6,
  },
  // YTD table
  ytdTable: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  ytdHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: Spacing[3] - 2, // 10
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  ytdHeaderCell: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
  },
  ytdRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: Layout.listItemPaddingV,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ytdCell: {
    ...TextStyles.bodySm,
    color: Colors.text.primary,
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    right: Layout.screenPaddingH,
    bottom: Spacing[6],
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
})
