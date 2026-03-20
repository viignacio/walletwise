import { useCallback, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { Colors, Layout, Radius, Shadows, Spacing, TextStyles } from '../../constants'

interface AlertModalProps {
  visible: boolean
  title: string
  message: string
  onDismiss: () => void
}

export function AlertModal({ visible, title, message, onDismiss }: AlertModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            onPress={onDismiss}
          >
            <Text style={styles.okLabel}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function useAlertModal() {
  const [visible, setVisible] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const dismissCallbackRef = useRef<(() => void) | undefined>(undefined)

  const showAlert = useCallback(
    (alertTitle: string, alertMessage: string, onDismiss?: () => void) => {
      dismissCallbackRef.current = onDismiss
      setTitle(alertTitle)
      setMessage(alertMessage)
      setVisible(true)
    },
    [],
  )

  const dismiss = useCallback(() => {
    setVisible(false)
    const cb = dismissCallbackRef.current
    dismissCallbackRef.current = undefined
    cb?.()
  }, [])

  const alertModal = (
    <AlertModal visible={visible} title={title} message={message} onDismiss={dismiss} />
  )

  return { showAlert, alertModal }
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
  btn: {
    height: Layout.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  pressed: {
    backgroundColor: Colors.surfaceMuted,
  },
  okLabel: {
    ...TextStyles.labelLg,
    color: Colors.primary,
  },
})
