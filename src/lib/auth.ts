import { supabase } from './supabase'
import type { UserRole } from '@/types/database'

export interface SessionUser {
  id: string
  nombre: string
  username: string
  rol: UserRole
}

const SESSION_KEY = 'loft_wings_session'

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(user: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, username, rol')
    .eq('username', username.toLowerCase().trim())
    .eq('password_hash', password)
    .eq('activo', true)
    .single()

  if (error || !data) throw new Error('Usuario o contraseña incorrectos')
  return data as SessionUser
}

export const ROL_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  cajero: 'Cajero',
  mesero: 'Mesero',
  cocina: 'Cocina',
  almacen: 'Almacén',
}

export const ROL_COLOR: Record<UserRole, string> = {
  admin: 'bg-purple-600',
  gerente: 'bg-blue-600',
  cajero: 'bg-green-600',
  mesero: 'bg-orange-500',
  cocina: 'bg-red-600',
  almacen: 'bg-yellow-600',
}
