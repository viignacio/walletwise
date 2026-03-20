import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      // Try to extract the auth code from the URL that opened the app
      const url = await Linking.getInitialURL()

      if (url) {
        // PKCE flow: code in query params
        const parsed = Linking.parse(url)
        const code = parsed.queryParams?.code as string | undefined
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) {
            router.replace('/(app)/(tabs)/dashboard')
            return
          }
        }

        // Implicit flow: tokens in hash fragment
        const hashIndex = url.indexOf('#')
        if (hashIndex !== -1) {
          const params = new URLSearchParams(url.slice(hashIndex + 1))
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (!error) {
              router.replace('/(app)/(tabs)/dashboard')
              return
            }
          }
        }
      }

      // Fallback: check if a session already exists (e.g. handled inline by openAuthSessionAsync)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/(app)/(tabs)/dashboard')
      } else {
        router.replace('/(auth)/login')
      }
    }

    handleCallback()
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )
}
