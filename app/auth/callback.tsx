import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

function parseParams(paramString: string): Record<string, string> {
  const params: Record<string, string> = {}
  paramString.split('&').forEach(pair => {
    const eqIndex = pair.indexOf('=')
    if (eqIndex !== -1) {
      const key = decodeURIComponent(pair.slice(0, eqIndex))
      const value = decodeURIComponent(pair.slice(eqIndex + 1))
      params[key] = value
    }
  })
  return params
}

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const url = await Linking.getInitialURL()

      if (url) {
        const queryIndex = url.indexOf('?')
        const hashIndex = url.indexOf('#')

        // PKCE: code in query params
        if (queryIndex !== -1) {
          const queryString = hashIndex !== -1
            ? url.slice(queryIndex + 1, hashIndex)
            : url.slice(queryIndex + 1)
          const params = parseParams(queryString)
          if (params.code) {
            const { error } = await supabase.auth.exchangeCodeForSession(params.code)
            if (!error) {
              router.replace('/(app)/(tabs)/dashboard')
              return
            }
          }
        }

        // Implicit: tokens in hash fragment
        if (hashIndex !== -1) {
          const params = parseParams(url.slice(hashIndex + 1))
          if (params.access_token && params.refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            })
            if (!error) {
              router.replace('/(app)/(tabs)/dashboard')
              return
            }
          }
        }
      }

      // Fallback: session may already exist
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
