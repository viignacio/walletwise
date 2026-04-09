import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Text, useAlertModal, DatePickerField } from '../../components/ui'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout, FontFamily } from '../../constants'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, suggestCategory } from '../../constants/categories'
import { addTransaction, formatAmount, formatBalance, formatAmountInput, parseAmountInput, isBalanceBelowThreshold } from '../../lib/wallet'
import { getProfile } from '../../lib/profile'
import { sendHouseholdPush, sendThrottledLowBalancePush } from '../../lib/notifications'
import { useToast } from '../../contexts/ToastContext'
import { TransactionType } from '../../types/database'
import * as Crypto from 'expo-crypto'

function defaultDate(paramYear?: string, paramMonth?: string): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const y = paramYear ? Number(paramYear) : currentYear
  const m = paramMonth ? Number(paramMonth) : currentMonth

  // Current month → today's date; past month → 1st of that month
  if (y === currentYear && m === currentMonth) {
    return now.toISOString().split('T')[0]
  }
  return `${y}-${String(m).padStart(2, '0')}-01`
}

export default function AddTransactionScreen() {
  const router = useRouter()
  const { year: paramYear, month: paramMonth } = useLocalSearchParams<{ year?: string; month?: string }>()
  const insets = useSafeAreaInsets()
  const { showToast } = useToast()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => defaultDate(paramYear, paramMonth))
  const [notes, setNotes] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [saving, setSaving] = useState(false)
  const [baseAmount, setBaseAmount] = useState('')
  const [percentChip, setPercentChip] = useState<'full' | 80 | 50 | 20 | 'custom'>('full')
  const [customPct, setCustomPct] = useState('')
  // Track whether the user manually picked a category so we don't override their choice
  const [categoryManuallySet, setCategoryManuallySet] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  // Reset category when type changes if it's not valid for the new type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    const validCats = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!validCats.includes(category as never)) {
      setCategory('')
      setCategoryManuallySet(false)
    }
    // Recurring is only supported for expenses
    if (newType === 'income') setIsRecurring(false)
  }

  const handleCategoryPress = (cat: string) => {
    setCategory(cat)
    setCategoryManuallySet(true)
  }

  const handleDescriptionChange = (text: string) => {
    setDescription(text)
    // Only auto-suggest when user hasn't manually picked a category
    if (!categoryManuallySet) {
      const suggestion = suggestCategory(text, type)
      if (suggestion) setCategory(suggestion)
      else setCategory('')
    }
  }

  const handleSave = async () => {
    const rawAmount = parseAmountInput(amount)
    if (!rawAmount || isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
      showAlert('Invalid amount', 'Please enter a valid amount greater than 0.')
      return
    }
    if (!category) {
      showAlert('Category required', 'Please select a category.')
      return
    }
    if (!description.trim()) {
      showAlert('Description required', 'Please enter a description.')
      return
    }

    setSaving(true)
    try {
      const profile = await getProfile()

      const amountNum = parseFloat(parseFloat(rawAmount).toFixed(2))
      const recurringGroupId = isRecurring ? Crypto.randomUUID() : undefined

      await addTransaction({
        household_id: profile.household_id,
        user_id: profile.id,
        type,
        amount: amountNum,
        category,
        description: description.trim(),
        date,
        notes: notes.trim() || null,
        is_recurring: isRecurring,
        recurring_group_id: recurringGroupId,
        is_pending: false,
      })

      // If recurring, pre-generate next month's pending transaction (always on the 1st)
      if (isRecurring && recurringGroupId) {
        const [year, month] = date.split('-').map(Number)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const nextDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

        await addTransaction({
          household_id: profile.household_id,
          user_id: profile.id,
          type,
          amount: amountNum,
          category,
          description: description.trim(),
          date: nextDate,
          notes: notes.trim() || null,
          is_recurring: true,
          recurring_group_id: recurringGroupId,
          is_pending: true,
        })
      }

      // Compute new balance for notification messages
      const { balance } = await isBalanceBelowThreshold(profile.household_id)
      const balanceStr = formatBalance(balance)
      const amountStr = formatAmount(amountNum)
      const desc = description.trim()

      // Toast for self
      const selfMsg =
        type === 'income'
          ? `You added ${desc} for +${amountStr}. Balance: ${balanceStr}`
          : `You added ${desc} for -${amountStr}. Balance: ${balanceStr}`
      showToast(selfMsg, type)

      // Push to other household members
      const pushMsg =
        type === 'income'
          ? `${profile.name} added ${desc} for +${amountStr}. Balance: ${balanceStr}`
          : `${profile.name} added ${desc} for -${amountStr}. Balance: ${balanceStr}`
      sendHouseholdPush(profile.household_id, profile.id, pushMsg).catch(() => {})

      // Low balance check — push to ALL members if below threshold
      if (type === 'expense') {
        const { below } = await isBalanceBelowThreshold(profile.household_id)
        if (below) {
          sendThrottledLowBalancePush(
            profile.household_id,
            `Household balance is running low. Current balance: ${balanceStr}`
          ).catch(() => {})
        }
      }

      router.back()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      showAlert('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const handleChipPress = (chip: 'full' | 80 | 50 | 20 | 'custom') => {
    setPercentChip(chip)
    if (chip === 'full') {
      setAmount(baseAmount)
    } else if (chip === 'custom') {
      setCustomPct('')
    } else {
      const base = parseAmountInput(baseAmount)
      if (base > 0) {
        const computed = ((base * chip) / 100).toFixed(2)
        setAmount(formatAmountInput(computed))
      }
    }
  }

  const handleCustomPctChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 3)
    const num = parseInt(clean, 10)
    if (clean === '' || (num >= 0 && num <= 100)) {
      setCustomPct(clean)
      const base = parseAmountInput(baseAmount)
      if (base > 0 && clean !== '') {
        const computed = ((base * (num || 0)) / 100).toFixed(2)
        setAmount(formatAmountInput(computed))
      }
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={62}
        extraKeyboardSpace={16}
      >
        {/* Type selector */}
        <View style={styles.typeRow}>
          <Pressable
            style={({ pressed }) => [styles.typeBtn, type === 'expense' && styles.typeBtnExpense, pressed && styles.pressed]}
            onPress={() => handleTypeChange('expense')}
          >
            <Ionicons
              name="arrow-down-outline"
              size={16}
              color={type === 'expense' ? Colors.white : Colors.text.secondary}
            />
            <Text style={[styles.typeBtnLabel, type === 'expense' && styles.typeBtnLabelActive]}>
              Expense
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.typeBtn, type === 'income' && styles.typeBtnIncome, pressed && styles.pressed]}
            onPress={() => handleTypeChange('income')}
          >
            <Ionicons
              name="arrow-up-outline"
              size={16}
              color={type === 'income' ? Colors.white : Colors.text.secondary}
            />
            <Text style={[styles.typeBtnLabel, type === 'income' && styles.typeBtnLabelActive]}>
              Income
            </Text>
          </Pressable>
        </View>

        {/* Amount */}
        <FormLabel>Amount (PHP)</FormLabel>
        <View style={styles.amountRow}>
          <Text style={styles.pesoSign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(text) => {
              const formatted = formatAmountInput(text)
              setAmount(formatted)
              setBaseAmount(formatted)
              setPercentChip('full')
              setCustomPct('')
            }}
            placeholder="0.00"
            placeholderTextColor={Colors.text.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoFocus
          />
        </View>

        {/* Percentage chips */}
        {parseAmountInput(baseAmount) > 0 && (
          <>
            <View style={styles.percentChips}>
              {(['full', 80, 50, 20, 'custom'] as const).map((chip) => {
                const isSelected = percentChip === chip
                const label = chip === 'full' ? 'Full' : chip === 'custom' ? 'Custom' : `${chip}%`
                return (
                  <Pressable
                    key={String(chip)}
                    style={({ pressed }) => [
                      styles.percentChip,
                      isSelected && (chip === 'full' ? styles.percentChipFull : styles.percentChipPct),
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleChipPress(chip)}
                  >
                    <Text
                      style={[
                        styles.percentChipLabel,
                        isSelected && (chip === 'full' ? styles.percentChipFullLabel : styles.percentChipPctLabel),
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {percentChip === 'custom' && (
              <View style={styles.customPctRow}>
                <TextInput
                  style={styles.customPctInput}
                  value={customPct}
                  onChangeText={handleCustomPctChange}
                  placeholder="0"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  maxLength={3}
                  autoFocus
                />
                <Text style={styles.customPctSuffix}>%</Text>
              </View>
            )}
          </>
        )}

        {/* Description */}
        <FormLabel>Description</FormLabel>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={handleDescriptionChange}
          placeholder="e.g. Grocery run"
          placeholderTextColor={Colors.text.muted}
          returnKeyType="done"
        />

        {/* Category */}
        <FormLabel>Category</FormLabel>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              style={({ pressed }) => [styles.catChip, category === cat && styles.catChipActive, pressed && styles.pressed]}
              onPress={() => handleCategoryPress(cat)}
            >
              <Text style={[styles.catChipLabel, category === cat && styles.catChipLabelActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Date */}
        <FormLabel>Date</FormLabel>
        <DatePickerField
          value={date}
          onChange={setDate}
        />

        {/* Notes */}
        <FormLabel>Notes (optional)</FormLabel>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional notes…"
          placeholderTextColor={Colors.text.muted}
          multiline
          returnKeyType="default"
        />

        {/* Recurring toggle — expenses only */}
        {type === 'expense' && (
          <Pressable
            style={({ pressed }) => [styles.recurringRow, pressed && styles.pressed]}
            onPress={() => setIsRecurring(r => !r)}
            hitSlop={8}
          >
            <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]}>
              {isRecurring && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
            <View style={styles.recurringTextGroup}>
              <Text style={styles.recurringLabel}>Repeat monthly</Text>
              <Text style={styles.recurringHint}>
                Auto-adds this expense on the following month
              </Text>
            </View>
          </Pressable>
        )}

        {/* Save button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            type === 'income' ? styles.saveBtnIncome : styles.saveBtnExpense,
            saving && styles.saveBtnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save Transaction'}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
      {alertModal}
    </View>
  )
}

function FormLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pressed: {
    opacity: 0.6,
  },
  content: {
    padding: Layout.screenPaddingH,
    gap: 0,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing[3] - 2, // 10
    marginBottom: Spacing[5],
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  typeBtnExpense: {
    backgroundColor: Colors.expense,
    borderColor: Colors.expense,
  },
  typeBtnIncome: {
    backgroundColor: Colors.income,
    borderColor: Colors.income,
  },
  typeBtnLabel: {
    ...TextStyles.bodySm,
    fontWeight: '700' as const,
    color: Colors.text.secondary,
  },
  typeBtnLabelActive: {
    color: Colors.white,
  },
  label: {
    ...TextStyles.labelSm,
    color: Colors.text.secondary,
    marginBottom: Spacing[2],
    marginTop: Layout.cardPadding,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
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
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: Spacing[2],
    borderRadius: Radius.xl,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catChipLabel: {
    ...TextStyles.label,
    color: Colors.text.secondary,
  },
  catChipLabelActive: {
    color: Colors.white,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginTop: Layout.cardPadding,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  recurringTextGroup: {
    flex: 1,
    gap: 2,
  },
  recurringLabel: {
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  recurringHint: {
    ...TextStyles.caption,
    color: Colors.text.secondary,
  },
  saveBtn: {
    marginTop: Spacing[8] - 4, // 28
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  saveBtnIncome: { backgroundColor: Colors.income },
  saveBtnExpense: { backgroundColor: Colors.expense },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnLabel: {
    ...TextStyles.labelLg,
    fontWeight: '700' as const,
    color: Colors.white,
  },

  // ── Percentage chips ──
  percentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  percentChip: {
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  percentChipFull: {
    backgroundColor: Colors.incomeLight,
    borderColor: Colors.incomeLight,
  },
  percentChipPct: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  percentChipLabel: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
    color: Colors.text.secondary,
  },
  percentChipFullLabel: {
    color: Colors.income,
  },
  percentChipPctLabel: {
    color: Colors.primary,
  },
  customPctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacing[2],
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    gap: Spacing[1],
  },
  customPctInput: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
    minWidth: 32,
    padding: 0,
  },
  customPctSuffix: {
    ...TextStyles.caption,
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },
})
