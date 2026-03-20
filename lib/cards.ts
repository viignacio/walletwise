import { supabase } from './supabase'
import { Card } from '../types/database'

export async function getCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function addCard(
  card: Omit<Card, 'id' | 'user_id' | 'created_at'>,
): Promise<Card> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('cards')
    .insert({ ...card, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'user_id' | 'created_at'>>,
): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCard(id: string): Promise<void> {
  const { count, error: checkError } = await supabase
    .from('lending_records')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', id)
    .neq('status', 'settled')
  if (checkError) throw checkError
  if (count && count > 0) {
    throw new Error(
      'This card has active installment records. Settle or delete them before removing the card.',
    )
  }
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}
