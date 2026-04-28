import React, { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
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
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import * as SecureStore from 'expo-secure-store'

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key)
      if (item) {
        console.log(`${key} was used 🔐 \n`)
      } else {
        console.log('No values stored under key: ' + key)
      }
      return item
    } catch (error) {
      console.error('SecureStore get item error: ', error)
      await SecureStore.deleteItemAsync(key)
      return null
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value)
    } catch (err) {
      return
    }
  },
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

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
    padding: Spacing[8],
  },
  title: {
    ...TextStyles.h2,
    marginBottom: Spacing[2],
  },
  message: {
    ...TextStyles.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing[6],
  },
  detail: {
    ...TextStyles.caption,
    color: Colors.expense,
    textAlign: 'center',
    marginBottom: Spacing[6],
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    borderRadius: 8,
  },
  buttonText: {
    ...TextStyles.label,
    color: '#FFFFFF',
  },
})

function InitialLayout() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (!userId) return
    activatePendingTransactions(userId).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!isLoaded) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/(app)/(tabs)/dashboard')
    }
  }, [isSignedIn, isLoaded, segments])

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return <Slot />
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
  })

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ErrorBoundary>
        <KeyboardProvider>
          <StatusBar style="dark" />
          <InitialLayout />
        </KeyboardProvider>
      </ErrorBoundary>
    </ClerkProvider>
  )
}
