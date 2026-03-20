import { supabase } from './supabase'
import { Installment } from '../types/database'

export async function getInstallments(): Promise<Installment[]> {
  const { data, error } = await supabase
    .from('installments')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function addInstallment(
  installment: Omit<Installment, 'id' | 'user_id' | 'created_at'>,
): Promise<Installment> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('installments')
    .insert({ ...installment, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInstallment(
  id: string,
  updates: Partial<Omit<Installment, 'id' | 'user_id' | 'created_at'>>,
): Promise<Installment> {
  const { data, error } = await supabase
    .from('installments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInstallment(id: string): Promise<void> {
  const { error } = await supabase.from('installments').delete().eq('id', id)
  if (error) throw error
}
