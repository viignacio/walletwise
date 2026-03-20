import { useState } from 'react'
import {
  View, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native'
import { Text, useAlertModal } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { supabase } from '../../lib/supabase'
import { Colors, TextStyles, Spacing, Radius, Shadows } from '../../constants'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { showAlert, alertModal } = useAlertModal()

  const handleEmailLogin = async () => {
    if (!email || !password) {
      showAlert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) showAlert('Sign in failed', error.message)
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const redirectTo = 'walletwise://auth/callback'

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      })

      if (error || !data?.url) {
        showAlert('Google sign in failed', error?.message ?? 'Could not initiate sign in.')
        return
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type === 'success') {
        const url = result.url

        // Implicit flow: tokens in hash fragment (#access_token=...&refresh_token=...)
        const hashIndex = url.indexOf('#')
        if (hashIndex !== -1) {
          const fragment = url.slice(hashIndex + 1)
          const params: Record<string, string> = {}
          fragment.split('&').forEach(pair => {
            const eq = pair.indexOf('=')
            if (eq !== -1) params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1))
          })
          if (params.access_token && params.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            })
            if (sessionError) showAlert('Sign in failed', sessionError.message)
            return
          }
        }

        // PKCE flow: code in query params (?code=...)
        const queryIndex = url.indexOf('?')
        if (queryIndex !== -1) {
          const query = url.slice(queryIndex + 1)
          const params: Record<string, string> = {}
          query.split('&').forEach(pair => {
            const eq = pair.indexOf('=')
            if (eq !== -1) params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1))
          })
          if (params.code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code)
            if (exchangeError) showAlert('Sign in failed', exchangeError.message)
            return
          }
        }

        showAlert('Sign in failed', 'No authorization code received.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Ionicons name="wallet" size={32} color={Colors.white} />
          </View>
          <Text style={styles.title}>WalletWise</Text>
          <Text style={styles.subtitle}>Household & Credit Finance</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.text.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.text.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleEmailLogin}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleEmailLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={18} color={Colors.text.primary} />
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.footerLink}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.footerLinkText}>
            Don't have an account?{' '}
            <Text style={styles.footerLinkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
      {alertModal}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing[8],
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing[4],
    ...Shadows.md,
  },
  title: {
    ...TextStyles.h1,
    color: Colors.text.primary,
  },
  subtitle: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
    marginTop: Spacing[1],
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[6],
    ...Shadows.sm,
    gap: 0,
  },
  cardTitle: {
    ...TextStyles.h3,
    color: Colors.text.primary,
    marginBottom: Spacing[5],
  },
  fieldGroup: {
    marginBottom: Spacing[4],
  },
  label: {
    ...TextStyles.label,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  primaryButtonText: {
    ...TextStyles.labelLg,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing[5],
    gap: Spacing[3],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...TextStyles.bodySm,
    color: Colors.text.muted,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  footerLink: {
    alignItems: 'center',
    marginTop: Spacing[6],
    paddingVertical: Spacing[1],
  },
  footerLinkText: {
    ...TextStyles.bodySm,
    color: Colors.text.secondary,
  },
  footerLinkBold: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
})
