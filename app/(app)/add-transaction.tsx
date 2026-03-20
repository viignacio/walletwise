import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { Text } from '../../components/ui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout } from '../../constants'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, suggestCategory } from '../../constants/categories'
import { addTransaction, formatAmount, isBalanceBelowThreshold } from '../../lib/wallet'
import { getProfile } from '../../lib/profile'
import { sendHouseholdPush, sendAllHouseholdPush } from '../../lib/notifications'
import { useToast } from '../../contexts/ToastContext'
import { TransactionType } from '../../types/database'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export default function AddTransactionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { showToast } = useToast()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  // Track whether the user manually picked a category so we don't override their choice
  const [categoryManuallySet, setCategoryManuallySet] = useState(false)

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  // Reset category when type changes if it's not valid for the new type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    const validCats = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!validCats.includes(category as never)) {
      setCategory('')
      setCategoryManuallySet(false)
    }
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
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.')
      return
    }
    if (!category) {
      Alert.alert('Category required', 'Please select a category.')
      return
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please enter a description.')
      return
    }

    setSaving(true)
    try {
      const profile = await getProfile()

      const amountNum = parseFloat(parseFloat(amount).toFixed(2))
      const tx = await addTransaction({
        household_id: profile.household_id,
        user_id: profile.id,
        type,
        amount: amountNum,
        category,
        description: description.trim(),
        date,
        notes: notes.trim() || undefined,
      })

      // Compute new balance for notification messages
      const { balance } = await isBalanceBelowThreshold(profile.household_id)
      const balanceStr = formatAmount(balance)
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
          sendAllHouseholdPush(
            profile.household_id,
            `Household balance is running low. Current balance: ${balanceStr}`
          ).catch(() => {})
        }
      }

      router.back()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      Alert.alert('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={Colors.text.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            autoFocus
          />
        </View>

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
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.text.muted}
          keyboardType="default"
          returnKeyType="done"
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
      </ScrollView>
    </KeyboardAvoidingView>
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
})
