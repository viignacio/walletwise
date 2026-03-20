import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { Colors } from '../../constants/colors'
import { ToastProvider, useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { registerPushToken } from '../../lib/notifications'
import { formatAmount } from '../../lib/wallet'
import { getProfile } from '../../lib/profile'
import { RealtimeChannel } from '@supabase/supabase-js'

function AppShell() {
  const { showToast } = useToast()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userRef = useRef<{ id: string; name: string; household_id: string } | null>(null)

  useEffect(() => {
    let mounted = true

    async function setup() {
      let profile: { id: string; name: string; household_id: string }
      try {
        profile = await getProfile()
      } catch {
        return // Not authed or profile creation failed — root layout will redirect
      }
      if (!mounted) return
      userRef.current = profile

      // Register push token (non-blocking)
      registerPushToken(profile.id)

      // Subscribe to household transactions via Realtime
      channelRef.current = supabase
        .channel(`household-txns-${profile.household_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `household_id=eq.${profile.household_id}`,
          },
          async (payload) => {
            if (!mounted) return
            const record = (payload.new ?? payload.old) as Record<string, unknown>
            const senderId = record?.user_id as string | undefined

            // Only show in-app notification for OTHER members' changes
            if (!senderId || senderId === profile.id) return

            // Fetch sender name
            const { data: sender } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', senderId)
              .single()

            const name = sender?.name ?? 'Someone'
            const amount = formatAmount(Number(record.amount ?? 0))
            const desc = String(record.description ?? '')
            const type = record.type as string

            let msg = ''
            if (payload.eventType === 'INSERT') {
              msg =
                type === 'income'
                  ? `${name} added ${desc} for +${amount}`
                  : `${name} added ${desc} for -${amount}`
            } else if (payload.eventType === 'UPDATE') {
              msg = `${name} updated ${desc}`
            } else if (payload.eventType === 'DELETE') {
              msg = `${name} removed ${desc}`
            }

            if (msg) showToast(msg, type === 'income' ? 'income' : 'expense')
          }
        )
        .subscribe()
    }

    setup()

    return () => {
      mounted = false
      channelRef.current?.unsubscribe()
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
