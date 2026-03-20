import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { Colors, Layout, Radius, Shadows, Spacing, TextStyles } from '../../constants'

interface ConfirmModalProps {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
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
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.divider} />
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]}
              onPress={onCancel}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <View style={styles.btnDivider} />
            <Pressable
              style={({ pressed }) => [styles.btn, styles.confirmBtn, pressed && styles.pressed]}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmLabel, destructive && styles.destructiveLabel]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing[8],
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    width: '100%',
    ...Shadows.modal,
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
  actions: {
    flexDirection: 'row',
    height: Layout.buttonHeight,
  },
  btn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderBottomLeftRadius: Radius.lg,
  },
  confirmBtn: {
    borderBottomRightRadius: Radius.lg,
  },
  pressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  btnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
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
