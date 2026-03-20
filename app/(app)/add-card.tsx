import { useEffect, useState } from 'react'
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
import { ConfirmModal, Text, useAlertModal } from '../../components/ui'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Colors,
  FontFamily,
  FontWeight,
  Layout,
  Radius,
  Spacing,
  TextStyles,
} from '../../constants'
import { addCard, deleteCard, getCards, updateCard } from '../../lib/cards'

const CARD_COLORS = [
  '#2563EB', // Blue (primary)
  '#7C3AED', // Purple
  '#DB2777', // Pink
  '#DC2626', // Red
  '#D97706', // Amber
  '#059669', // Green
  '#0891B2', // Cyan
  '#374151', // Slate
] as const

export default function AddCardScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const isEdit = Boolean(id)

  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [cutoffDay, setCutoffDay] = useState('')
  const [dueDateDay, setDueDateDay] = useState('')
  const [color, setColor] = useState<string>(CARD_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { showAlert, alertModal } = useAlertModal()

  useEffect(() => {
    if (!id) return
    getCards()
      .then((cards) => {
        const card = cards.find((c) => c.id === id)
        if (!card) return
        setName(card.name)
        setCreditLimit(card.credit_limit > 0 ? String(card.credit_limit) : '')
        setCutoffDay(String(card.billing_cutoff_day))
        setDueDateDay(String(card.due_date_day))
        setColor(card.color)
      })
      .catch(() => {})
  }, [id])

  const validateDay = (val: string, label: string): number | null => {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 1 || n > 31) {
      showAlert('Invalid day', `${label} must be a number between 1 and 31.`)
      return null
    }
    return n
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Name required', 'Please enter a card name.')
      return
    }
    const cutoff = validateDay(cutoffDay, 'Billing cutoff day')
    if (cutoff === null) return
    const dueDay = validateDay(dueDateDay, 'Payment due day')
    if (dueDay === null) return

    const limit = parseFloat(creditLimit) || 0

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        credit_limit: limit,
        billing_cutoff_day: cutoff,
        due_date_day: dueDay,
        color,
      }
      if (isEdit && id) {
        await updateCard(id, payload)
      } else {
        await addCard(payload)
      }
      router.back()
    } catch (e: unknown) {
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => setConfirmDelete(true)

  const confirmDeleteCard = async () => {
    setDeleting(true)
    try {
      await deleteCard(id!)
      router.back()
    } catch (e: unknown) {
      setDeleting(false)
      setConfirmDelete(false)
      showAlert('Error', e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: isEdit ? 'Edit Card' : 'Add Card',
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
        <FormLabel>Card Name</FormLabel>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. BPI Mastercard"
          placeholderTextColor={Colors.text.muted}
          returnKeyType="next"
          autoFocus={!isEdit}
        />

        <FormLabel>Credit Limit (optional)</FormLabel>
        <View style={styles.amountRow}>
          <Text style={styles.pesoSign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            value={creditLimit}
            onChangeText={setCreditLimit}
            placeholder="0.00"
            placeholderTextColor={Colors.text.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            inputAccessoryViewID="no-toolbar"
          />
        </View>

        <FormLabel>Billing Cutoff Day</FormLabel>
        <TextInput
          style={styles.input}
          value={cutoffDay}
          onChangeText={setCutoffDay}
          placeholder="e.g. 25"
          placeholderTextColor={Colors.text.muted}
          keyboardType="number-pad"
          returnKeyType="next"
          inputAccessoryViewID="no-toolbar"
        />
        <Text style={styles.hint}>
          Day of month when the billing cycle closes (1–31).
        </Text>

        <FormLabel>Payment Due Day</FormLabel>
        <TextInput
          style={styles.input}
          value={dueDateDay}
          onChangeText={setDueDateDay}
          placeholder="e.g. 20"
          placeholderTextColor={Colors.text.muted}
          keyboardType="number-pad"
          returnKeyType="done"
          inputAccessoryViewID="no-toolbar"
        />
        <Text style={styles.hint}>
          Day of the following month when payment is due (1–31).
        </Text>

        <FormLabel>Card Color</FormLabel>
        <View style={styles.colorRow}>
          {CARD_COLORS.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && styles.colorSwatchSelected,
              ]}
              onPress={() => setColor(c)}
              hitSlop={8}
            />
          ))}
        </View>

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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Card'}
          </Text>
        </Pressable>

        {isEdit && (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteBtnLabel}>Delete Card</Text>
          </Pressable>
        )}
      </ScrollView>
      {Platform.OS === 'ios' && <InputAccessoryView nativeID="no-toolbar" />}
      <ConfirmModal
        visible={confirmDelete}
        title="Delete Card"
        message="Are you sure? This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDeleteCard}
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
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[3],
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: Colors.text.primary,
  },
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
  deleteBtn: {
    marginTop: Spacing[3],
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
