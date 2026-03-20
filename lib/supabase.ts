import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import 'react-native-url-polyfill/auto'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// SecureStore has a 2048-byte limit per entry. Supabase sessions exceed this,
// so we chunk large values across multiple SecureStore keys.
const CHUNK_SIZE = 1900 // stay well under the 2048-byte limit
const CHUNK_COUNT_SUFFIX = '__chunkCount'

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunkCountStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX)
    if (chunkCountStr !== null) {
      const chunkCount = parseInt(chunkCountStr, 10)
      const chunks: string[] = []
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`)
        if (chunk === null) return null
        chunks.push(chunk)
      }
      return chunks.join('')
    }
    return SecureStore.getItemAsync(key)
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      // Clean up any previous chunked entry for this key
      const oldCountStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX)
      if (oldCountStr !== null) {
        const oldCount = parseInt(oldCountStr, 10)
        for (let i = 0; i < oldCount; i++) {
          await SecureStore.deleteItemAsync(`${key}__chunk_${i}`)
        }
        await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX)
      }
      await SecureStore.setItemAsync(key, value)
      return
    }

    // Delete any unchunked entry for this key
    await SecureStore.deleteItemAsync(key)

    const chunks: string[] = []
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE))
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i])
    }
    await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(chunks.length))
  },

  removeItem: async (key: string): Promise<void> => {
    const chunkCountStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX)
    if (chunkCountStr !== null) {
      const chunkCount = parseInt(chunkCountStr, 10)
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk_${i}`)
      }
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX)
    } else {
      await SecureStore.deleteItemAsync(key)
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})