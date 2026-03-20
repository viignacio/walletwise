import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Expo Go does not support expo-notifications in SDK 53+.
// Use lazy require() so the module is never imported in Expo Go — a top-level
// import would throw at module evaluation time regardless of runtime guards.
const IS_EXPO_GO = Constants.appOwnership === 'expo'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const notifs = () => require('expo-notifications') as typeof import('expo-notifications')

// Show notifications when app is in the foreground (dev builds / production only)
if (!IS_EXPO_GO) {
  notifs().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

// ── Push token registration ──────────────────────────────────

export async function registerPushToken(userId: string): Promise<void> {
  if (IS_EXPO_GO) return // Remote push not supported in Expo Go (SDK 53+)
  if (!Device.isDevice) return // Push not available on simulator

  const N = notifs()

  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('default', {
      name: 'default',
      importance: N.AndroidImportance.DEFAULT,
    })
  }

  const { status } = await N.requestPermissionsAsync()
  if (status !== 'granted') return

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId

  if (!projectId) {
    console.warn('No EAS projectId found — push token registration skipped')
    return
  }

  try {
    const { data: token } = await N.getExpoPushTokenAsync({ projectId })
    await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' })
  } catch (e) {
    console.warn('Push token registration failed:', e)
  }
}

// ── Push delivery ────────────────────────────────────────────

interface PushMessage {
  to: string
  body: string
  sound?: 'default'
}

async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (!messages.length) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })
  } catch (e) {
    console.warn('Push delivery failed:', e)
  }
}

/** Send a push to all household members EXCEPT the sender. */
export async function sendHouseholdPush(
  householdId: string,
  excludeUserId: string,
  body: string
): Promise<void> {
  const { data: members } = await supabase
    .from('profiles')
    .select('id')
    .eq('household_id', householdId)
    .neq('id', excludeUserId)

  if (!members?.length) return

  const memberIds = members.map((m) => m.id)
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', memberIds)

  if (!tokens?.length) return

  await sendExpoPush(tokens.map(({ token }) => ({ to: token, body, sound: 'default' })))
}

/** Send a push to ALL household members (e.g. low balance alert). */
export async function sendAllHouseholdPush(
  householdId: string,
  body: string
): Promise<void> {
  const { data: members } = await supabase
    .from('profiles')
    .select('id')
    .eq('household_id', householdId)

  if (!members?.length) return

  const memberIds = members.map((m) => m.id)
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', memberIds)

  if (!tokens?.length) return

  await sendExpoPush(tokens.map(({ token }) => ({ to: token, body, sound: 'default' })))
}
