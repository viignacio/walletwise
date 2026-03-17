import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../../constants/colors'

export default function CreditScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Credit Tracker</Text>
      <Text style={styles.sub}>Coming in Phase 3</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  sub: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
})