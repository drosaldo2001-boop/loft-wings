import type { UserRole } from '@/types/database'

export const ROL_ROUTES: Record<UserRole, string> = {
  admin: '/dashboard',
  gerente: '/dashboard',
  cajero: '/caja',
  mesero: '/mesero',
  cocina: '/cocina',
  almacen: '/almacen',
}

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', emoji: '📊', roles: ['admin', 'gerente'] },
  { href: '/mesas', label: 'Mesas', emoji: '🪑', roles: ['admin', 'gerente', 'cajero', 'mesero'] },
  { href: '/mesero', label: 'Mesero', emoji: '🛎️', roles: ['admin', 'gerente', 'mesero'] },
  { href: '/cocina', label: 'Cocina', emoji: '👨‍🍳', roles: ['admin', 'gerente', 'cocina'] },
  { href: '/caja', label: 'Caja', emoji: '💳', roles: ['admin', 'gerente', 'cajero'] },
  { href: '/almacen', label: 'Almacén', emoji: '📦', roles: ['admin', 'gerente', 'almacen'] },
  { href: '/delivery', label: 'Delivery', emoji: '🛵', roles: ['admin', 'gerente', 'cajero'] },
  { href: '/menu', label: 'Editar Menú', emoji: '🍽️', roles: ['admin', 'gerente'] },
  { href: '/promociones', label: 'Promociones', emoji: '🎉', roles: ['admin', 'gerente'] },
  { href: '/cierre', label: 'Cierre del Día', emoji: '🌙', roles: ['admin', 'gerente', 'mesero', 'cocina', 'cajero'] },
] as const
