import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useRef } from 'react'
import { Text } from './Text'
import { Colors, Layout, Radius, Shadows, Spacing, TextStyles } from '../../constants'

interface ConfirmModalProps {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmedRef = useRef(false)

  useEffect(() => {
    if (!visible) confirmedRef.current = false
  }, [visible])

  const handleConfirm = () => {
    if (confirmedRef.current || loading) return
    confirmedRef.current = true
    onConfirm()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <Pressable style={styles.scrim} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.divider} />
          <Pressable
            style={[styles.btn, styles.confirmBtn, loading && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={destructive ? Colors.expense : Colors.primary} />
            ) : (
              <Text style={[styles.confirmLabel, destructive && styles.destructiveLabel]}>
                {confirmLabel}
              </Text>
            )}
          </Pressable>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cancelSheet, loading && styles.btnDisabled, pressed && !loading && styles.pressed]}
          onPress={loading ? undefined : onCancel}
          disabled={loading}
        >
          <Text style={styles.cancelLabel}>{cancelLabel}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[8],
    gap: Spacing[2],
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadows.modal,
    overflow: 'hidden',
  },
  title: {
    ...TextStyles.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingTop: Spacing[6],
    paddingHorizontal: Spacing[5],
  },
  message: {
    ...TextStyles.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingTop: Spacing[2],
    paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[5],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  btn: {
    height: Layout.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtn: {},
  btnDisabled: { opacity: 0.6 },
  pressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  cancelSheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    height: Layout.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.modal,
  },
  cancelLabel: {
    ...TextStyles.labelLg,
    color: Colors.text.secondary,
  },
  confirmLabel: {
    ...TextStyles.labelLg,
    color: Colors.primary,
  },
  destructiveLabel: {
    color: Colors.expense,
  },
})
