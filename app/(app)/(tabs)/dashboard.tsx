import { View, StyleSheet } from 'react-native'
import { Text } from '../../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius } from '../../../constants'

export default function DashboardScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.placeholder}>
        <View style={styles.iconRing}>
          <Ionicons name="grid-outline" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.body}>
          Coming in Phase 6 — will show household balance, upcoming card due dates, and recent activity across both modules.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing[8],
  },
  placeholder: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing[5],
  },
  title: {
    ...TextStyles.h3,
    color: Colors.text.primary,
    marginBottom: Spacing[3] - 2, // 10
  },
  body: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
})
