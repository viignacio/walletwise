import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { ConfirmModal, Text, useAlertModal } from '../../components/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Layout } from '../../constants'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../constants/categories'
import { supabase } from '../../lib/supabase'
import {
  updateTransaction,
  deleteTransaction,
  formatAmount,
  isBalanceBelowThreshold,
} from '../../lib/wallet'
import { deleteFutureRecurrences } from '../../lib/recurring'
import { getProfile } from '../../lib/profile'
import { sendHouseholdPush, sendAllHouseholdPush } from '../../lib/notifications'
import { useToast } from '../../contexts/ToastContext'
import { Transaction, TransactionType } from '../../types/database'

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { showToast } = useToast()

  const [original, setOriginal] = useState<Transaction | null>(null)
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [loadingTx, setLoadingTx] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  // Load transaction
  useEffect(() => {
    if (!id) return
    supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          showAlert('Error', 'Transaction not found')
          router.back()
          return
        }
        const tx = data as Transaction
        setOriginal(tx)
        setType(tx.type)
        setAmount(String(tx.amount))
        setCategory(tx.category)
        setDescription(tx.description)
        setDate(tx.date)
        setNotes(tx.notes ?? '')
        setIsRecurring(tx.is_recurring ?? false)
        setLoadingTx(false)
      })
  }, [id])

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    const validCats = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!validCats.includes(category as never)) setCategory('')
  }

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
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
    if (!original) return

    setSaving(true)
    try {
      const profile = await getProfile()

      const amountNum = parseFloat(parseFloat(amount).toFixed(2))
      await updateTransaction(id, {
        type,
        amount: amountNum,
        category,
        description: description.trim(),
        date,
        notes: notes.trim() || null,
      })

      const { balance } = await isBalanceBelowThreshold(profile.household_id)
      const balanceStr = formatAmount(balance)
      const oldAmountStr = formatAmount(Number(original.amount))
      const newAmountStr = formatAmount(amountNum)
      const desc = description.trim()

      // Toast for self
      showToast(
        `You updated ${desc} from ${oldAmountStr} to ${newAmountStr}. Balance: ${balanceStr}`,
        type
      )

      // Push to other household members
      sendHouseholdPush(
        profile.household_id,
        profile.id,
        `${profile.name} updated ${desc} from ${oldAmountStr} to ${newAmountStr}. Balance: ${balanceStr}`
      ).catch(() => {})

      // Low balance check
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
      showAlert('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!original) return

    if (isRecurring && original.recurring_group_id) {
      Alert.alert(
        'Delete Recurring Expense',
        `Remove "${original.description}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'This month only',
            onPress: () => executeDelete(false),
          },
          {
            text: 'This and future',
            style: 'destructive',
            onPress: () => executeDelete(true),
          },
        ]
      )
    } else {
      setConfirmDelete(true)
    }
  }

  const executeDelete = async (includeFuture: boolean) => {
    if (!original) return
    setDeleting(true)
    try {
      const profile = await getProfile()

      if (includeFuture && original.recurring_group_id) {
        await deleteFutureRecurrences(original.recurring_group_id)
      }
      await deleteTransaction(id)

      const { balance } = await isBalanceBelowThreshold(profile.household_id)
      const balanceStr = formatAmount(balance)
      const amountStr = formatAmount(Number(original.amount))
      const desc = original.description

      showToast(`You removed ${desc} (${amountStr}). Balance: ${balanceStr}`)

      sendHouseholdPush(
        profile.household_id,
        profile.id,
        `${profile.name} removed ${desc} (${amountStr}). Balance: ${balanceStr}`
      ).catch(() => {})

      router.back()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      showAlert('Error', msg)
    } finally {
      setDeleting(false)
    }
  }

  const confirmDeleteTransaction = () => executeDelete(false)

  if (loadingTx) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
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

        {/* Recurring badge */}
        {isRecurring && (
          <View style={styles.recurringBadge}>
            <Ionicons name="repeat-outline" size={14} color={Colors.primary} />
            <Text style={styles.recurringBadgeLabel}>Recurring monthly expense</Text>
          </View>
        )}

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
          />
        </View>

        {/* Description */}
        <FormLabel>Description</FormLabel>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
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
              onPress={() => setCategory(cat)}
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

        {/* Save */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            type === 'income' ? styles.saveBtnIncome : styles.saveBtnExpense,
            saving && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handleSave}
          disabled={saving || deleting}
        >
          <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>

        {/* Delete */}
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, deleting && styles.btnDisabled, pressed && styles.pressed]}
          onPress={handleDelete}
          disabled={saving || deleting}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.expense} />
          <Text style={styles.deleteBtnLabel}>{deleting ? 'Deleting…' : 'Delete Transaction'}</Text>
        </Pressable>
      </ScrollView>
      <ConfirmModal
        visible={confirmDelete}
        title="Delete Transaction"
        message={original ? `Remove "${original.description}" (${formatAmount(Number(original.amount))})? This cannot be undone.` : 'This cannot be undone.'}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteTransaction}
        onCancel={() => setConfirmDelete(false)}
      />
      {alertModal}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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
  typeBtnExpense: { backgroundColor: Colors.expense, borderColor: Colors.expense },
  typeBtnIncome: { backgroundColor: Colors.income, borderColor: Colors.income },
  typeBtnLabel: {
    ...TextStyles.bodySm,
    fontWeight: '700' as const,
    color: Colors.text.secondary,
  },
  typeBtnLabelActive: { color: Colors.white },
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
  catChipLabelActive: { color: Colors.white },
  saveBtn: {
    marginTop: Spacing[8] - 4, // 28
    paddingVertical: 15,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  saveBtnIncome: { backgroundColor: Colors.income },
  saveBtnExpense: { backgroundColor: Colors.expense },
  btnDisabled: { opacity: 0.6 },
  saveBtnLabel: {
    ...TextStyles.labelLg,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  deleteBtn: {
    marginTop: Spacing[3],
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[2],
    borderWidth: 1.5,
    borderColor: Colors.expense,
    backgroundColor: `${Colors.expense}0d`,
  },
  deleteBtnLabel: {
    ...TextStyles.labelLg,
    fontWeight: '700' as const,
    color: Colors.expense,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: Spacing[1] + 2,
    borderRadius: Radius.xs,
    backgroundColor: `${Colors.primary}14`,
    marginBottom: Spacing[3],
  },
  recurringBadgeLabel: {
    ...TextStyles.caption,
    color: Colors.primary,
  },
})
