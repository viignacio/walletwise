import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { db } from './db'
import { pushTokens, profiles } from './schema'
import { eq, inArray, ne, and } from 'drizzle-orm'

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
    
    await db.insert(pushTokens)
      .values({ userId, token })
      .onConflictDoUpdate({ 
        target: [pushTokens.userId, pushTokens.token], 
        set: { updatedAt: new Date().toISOString() }
      })
      
    console.log('Push token registered:', token)
  } catch (e) {
    console.warn('Push token registration failed:', e)
  }
}

// ── Push delivery ────────────────────────────────────────────

interface PushMessage {
  to: string
  title: string
  body: string
  sound?: 'default'
}

async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (!messages.length) return
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })
    const json = await res.json()
    // Log any per-ticket errors (e.g. DeviceNotRegistered for stale tokens)
    if (json?.data) {
      const errors = (json.data as Array<{ status: string; message?: string }>).filter(
        (t) => t.status === 'error'
      )
      if (errors.length) console.warn('Push ticket errors:', errors)
    }
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
  const members = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.householdId, householdId),
        ne(profiles.id, excludeUserId)
      )
    )

  if (!members?.length) { console.log('Push: no other household members found'); return }

  const memberIds = members.map((m) => m.id)
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, memberIds))

  if (!tokens?.length) { console.warn('Push: no push tokens found for members', memberIds); return }

  console.log(`Push: sending to ${tokens.length} token(s)`)
  await sendExpoPush(tokens.map(({ token }) => ({ to: token, title: 'WalletWise', body, sound: 'default' })))
}

/** Send a push to ALL household members (e.g. low balance alert). */
export async function sendAllHouseholdPush(
  householdId: string,
  body: string
): Promise<void> {
  const members = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.householdId, householdId))

  if (!members?.length) return

  const memberIds = members.map((m) => m.id)
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, memberIds))

  if (!tokens?.length) return

  await sendExpoPush(tokens.map(({ token }) => ({ to: token, title: 'WalletWise', body, sound: 'default' })))
}

// ── Throttled low balance push ──────────────────────────────

const LOW_BALANCE_THROTTLE_KEY = 'low_balance_last_sent'
const LOW_BALANCE_COOLDOWN_MS = 12 * 60 * 60 * 1000 // 12 hours

/** Send low balance push at most once per 12 hours. */
export async function sendThrottledLowBalancePush(
  householdId: string,
  body: string
): Promise<void> {
  try {
    const lastSent = await AsyncStorage.getItem(LOW_BALANCE_THROTTLE_KEY)
    if (lastSent && Date.now() - Number(lastSent) < LOW_BALANCE_COOLDOWN_MS) {
      console.log('Low balance push throttled — sent less than 12h ago')
      return
    }
    await sendAllHouseholdPush(householdId, body)
    await AsyncStorage.setItem(LOW_BALANCE_THROTTLE_KEY, String(Date.now()))
  } catch (e) {
    console.warn('Throttled low balance push failed:', e)
  }
}
