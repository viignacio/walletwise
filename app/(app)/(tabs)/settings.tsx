import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Colors } from '../../../constants/colors'
import { supabase } from '../../../lib/supabase'

export default function SettingsScreen() {
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings</Text>
      <Text style={styles.sub}>More options coming soon</Text>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
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
  signOutButton: {
    marginTop: 40,
    backgroundColor: Colors.expense,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  signOutText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
})