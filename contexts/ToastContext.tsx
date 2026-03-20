import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Radius, Spacing, Shadows, TextStyles } from '../constants'

interface ToastContextValue {
  showToast: (message: string, type?: 'default' | 'income' | 'expense') => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [message, setMessage] = useState('')
  const [toastType, setToastType] = useState<'default' | 'income' | 'expense'>('default')
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current
  const animationRef = useRef<Animated.CompositeAnimation | null>(null)
  const insets = useSafeAreaInsets()

  const showToast = useCallback(
    (msg: string, type: 'default' | 'income' | 'expense' = 'default') => {
      if (animationRef.current) {
        animationRef.current.stop()
      }

      setMessage(msg)
      setToastType(type)

      opacity.setValue(0)
      translateY.setValue(-20)

      animationRef.current = Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
        Animated.delay(2800),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
        ]),
      ])

      animationRef.current.start()
    },
    [opacity, translateY]
  )

  const accentColor =
    toastType === 'income'
      ? Colors.income
      : toastType === 'expense'
        ? Colors.expense
        : Colors.primary

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.container,
          { top: insets.top + 8, opacity, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.toast, { borderLeftColor: accentColor }]}>
          <Text style={styles.text} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    zIndex: 9999,
  },
  toast: {
    backgroundColor: Colors.text.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderLeftWidth: 4,
    ...Shadows.md,
  },
  text: {
    ...TextStyles.label,
    color: Colors.white,
  },
})
