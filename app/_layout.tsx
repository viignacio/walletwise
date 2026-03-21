import React, { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Text, View, ActivityIndicator, Pressable, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans'
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono'
import * as Updates from 'expo-updates'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { Colors } from '../constants/colors'
import { TextStyles } from '../constants/typography'
import { Spacing } from '../constants/spacing'
import { activatePendingTransactions } from '../lib/recurring'

// The config plugin (app.json) embeds fonts at native build time for fast availability.
// useFonts registers them under our key names — required on iOS, which uses PostScript
// names otherwise (e.g. "IBMPlexSans-Regular" ≠ "IBMPlexSans_400Regular").

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleReload = async () => {
    if (!__DEV__) {
      try {
        await Updates.reloadAsync()
      } catch {
        // If reload fails, just clear error state to retry render
        this.setState({ hasError: false, error: null })
      }
    } else {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <StatusBar style="dark" />
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            The app encountered an unexpected error.
            {!__DEV__ && Updates.updateId
              ? ' This may have been caused by a recent update.'
              : ''}
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={errorStyles.detail}>{this.state.error.message}</Text>
          )}
          <Pressable style={errorStyles.button} onPress={this.handleReload}>
            <Text style={errorStyles.buttonText}>
              {__DEV__ ? 'Retry' : 'Reload App'}
            </Text>
          </Pressable>
        </View>
      )
    }

    return this.props.children
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  title: {
    ...TextStyles.h2,
    marginBottom: Spacing.sm,
  },
  message: {
    ...TextStyles.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  detail: {
    ...TextStyles.caption,
    color: Colors.expense,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },
  buttonText: {
    ...TextStyles.bodyMedium,
    color: '#FFFFFF',
  },
})

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
  })
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setSession(null)
      } else {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session)
        })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Silently activate any pending recurring transactions on app open.
  // Runs in the background — does not block the UI or affect the loading state.
  useEffect(() => {
    if (!session?.user.id) return
    activatePendingTransactions(session.user.id).catch(() => {})
  }, [session?.user.id])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(app)/(tabs)/dashboard')
    }
  }, [session, loading, segments])

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <KeyboardProvider>
        <StatusBar style="dark" />
        <Slot />
      </KeyboardProvider>
    </ErrorBoundary>
  )
}
