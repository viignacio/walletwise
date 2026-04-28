import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { Colors } from '../../constants/colors'
import { ToastProvider, useToast } from '../../contexts/ToastContext'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { registerPushToken } from '../../lib/notifications'
import { formatAmount } from '../../lib/wallet'
import { getProfile } from '../../lib/profile'
import { scheduleReminders } from '../../lib/reminderScheduler'
import { markOverduePayments } from '../../lib/creditRecords'

function AppShell() {
  const { showToast } = useToast()
  const { user } = useUser()
  const { userId } = useAuth()
  const userRef = useRef<{ id: string; name: string; household_id: string } | null>(null)

  useEffect(() => {
    let mounted = true

    async function setup() {
      if (!userId) return
      let profile: { id: string; name: string; household_id: string }
      try {
        profile = await getProfile(userId, user?.fullName ?? null)
      } catch (e) {
        console.error("Profile setup failed:", e)
        return // Not authed or profile creation failed — root layout will redirect
      }
      if (!mounted) return
      userRef.current = profile

      // Register push token (non-blocking)
      registerPushToken(profile.id)

      // Schedule local reminders for card dues and borrower payments (non-blocking)
      scheduleReminders(userId).catch(() => {})

      // Transition any past-due payments to overdue (non-blocking)
      markOverduePayments().catch(() => {})
    }

    setup()

    return () => {
      mounted = false
    }
  }, [showToast])

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-transaction"
        options={{
          presentation: 'modal',
          title: 'Add Transaction',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="edit-transaction"
        options={{
          presentation: 'modal',
          title: 'Edit Transaction',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="add-card"
        options={{
          presentation: 'modal',
          title: 'Add Card',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="add-installment"
        options={{
          presentation: 'modal',
          title: 'Edit User',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="add-credit-record"
        options={{
          presentation: 'modal',
          title: 'Add Installment Record',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="record-detail"
        options={{
          title: 'Record',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="log-payment"
        options={{
          presentation: 'modal',
          title: 'Log Payment',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="edit-payment"
        options={{
          presentation: 'modal',
          title: 'Edit Payment',
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.text.primary, fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  )
}

export default function AppLayout() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}
