import { View, StyleSheet } from 'react-native'
import { Text } from '../../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius } from '../../../constants'

export default function CreditScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.placeholder}>
        <View style={styles.iconRing}>
          <Ionicons name="card-outline" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Credit Tracker</Text>
        <Text style={styles.body}>
          Coming in Phases 3 & 4 — manage cards and borrowers, track installment schedules, and log payments with cascade logic.
        </Text>
        <View style={styles.featureList}>
          {['Card & borrower management', 'Installment schedules', 'Payment cascade logic', 'Due date reminders'].map(f => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.income} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
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
    marginBottom: Spacing[6],
  },
  featureList: {
    alignSelf: 'stretch',
    gap: Spacing[3] - 2, // 10
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3] - 2, // 10
  },
  featureText: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
  },
})
