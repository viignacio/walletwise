import { useState } from 'react'
import {
  View, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native'
import { Text, useAlertModal } from '../../components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Colors, TextStyles, Spacing, Radius, Shadows } from '../../constants'
import { useRouter } from 'expo-router'
import { useSignUp } from '@clerk/clerk-expo'

export default function RegisterScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { showAlert, alertModal } = useAlertModal()

  const handleRegister = async () => {
    if (!isLoaded) return
    if (!name || !email || !password) {
      showAlert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      showAlert('Weak password', 'Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await signUp.create({
        firstName: name, // assuming single field for first name or split
        emailAddress: email,
        password,
      })

      // Send verification email
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (err: any) {
      console.error(err)
      showAlert('Registration failed', err.errors?.[0]?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!isLoaded) return
    setLoading(true)
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      })
      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId })
        // router will automatically redirect via _layout.tsx
      } else {
        showAlert('Verification incomplete', 'Further action is required.')
      }
    } catch (err: any) {
      console.error(err)
      showAlert('Verification failed', err.errors?.[0]?.message || err.message)
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={Colors.text.primary} />
          <Text style={styles.backText}>Sign In</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join your household on WalletWise</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          {!pendingVerification ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.text.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

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
                    placeholder="Min. 6 characters"
                    placeholderTextColor={Colors.text.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
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
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter code sent to email"
                  placeholderTextColor={Colors.text.muted}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Verifying…' : 'Verify Email'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.footerLink} onPress={() => router.back()}>
          <Text style={styles.footerLinkText}>
            Already have an account?{' '}
            <Text style={styles.footerLinkBold}>Sign In</Text>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    marginBottom: Spacing[6],
    alignSelf: 'flex-start',
  },
  backText: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  header: {
    marginBottom: Spacing[8] - 4, // 28
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
