import { useEffect, useState } from 'react'
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
import {
  addInstallment,
  deleteInstallment,
  getInstallments,
  updateInstallment,
} from '../../lib/installments'

export default function AddInstallmentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const isEdit = Boolean(id)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    getInstallments()
      .then((installments) => {
        const installment = installments.find((b) => b.id === id)
        if (!installment) return
        setName(installment.name)
        setNotes(installment.notes ?? '')
      })
      .catch(() => {})
  }, [id])

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        notes: notes.trim() || null,
      }
      if (isEdit && id) {
        await updateInstallment(id, payload)
      } else {
        await addInstallment(payload)
      }
      router.back()
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    Alert.alert('Delete User', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInstallment(id!)
            router.back()
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
          }
        },
      },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: isEdit ? 'Edit User' : 'Add User',
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
        <FormLabel>Name</FormLabel>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Juan dela Cruz"
          placeholderTextColor={Colors.text.muted}
          returnKeyType="next"
          autoFocus={!isEdit}
        />

        <FormLabel>Notes (optional)</FormLabel>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional context…"
          placeholderTextColor={Colors.text.muted}
          multiline
          returnKeyType="default"
          textAlignVertical="top"
        />

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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
          </Text>
        </Pressable>

        {isEdit && (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteBtnLabel}>Delete User</Text>
          </Pressable>
        )}
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
  notesInput: {
    minHeight: 80,
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
