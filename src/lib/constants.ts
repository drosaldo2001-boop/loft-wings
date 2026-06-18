export const APP_NAME = 'Loft Wings'
export const IVA = 0 // IVA incluido en precio

export const ZONAS_MESAS = ['Terraza', 'Interior', 'Bar', 'VIP', 'Delivery']

export const CATEGORIAS = [
  { id: 'alitas', label: 'Alitas', emoji: '🍗' },
  { id: 'boneless', label: 'Boneless', emoji: '🔥' },
  { id: 'hamburguesas', label: 'Burgers', emoji: '🍔' },
  { id: 'ensaladas', label: 'Ensaladas', emoji: '🥗' },
  { id: 'antojitos', label: 'Antojitos', emoji: '🌮' },
  { id: 'desayunos', label: 'Desayunos', emoji: '🍳' },
  { id: 'bebidas', label: 'Bebidas', emoji: '🥤' },
  { id: 'extras', label: 'Extras', emoji: '➕' },
] as const

export const SALSAS_ALITAS = [
  'Parmesano',
  'Salsa BBQ',
  'Lemon Pepper',
  'Buffalo Suave',
  'Buffalo Hot',
  'Mango Habanero',
  'Hot Habanero',
  'Sonora Hot',
]

export const PLATAFORMAS_DELIVERY = [
  { id: 'didi_food', label: 'DiDi Food', color: 'bg-orange-500', comision: 0.30 },
  { id: 'uber_eats', label: 'Uber Eats', color: 'bg-green-600', comision: 0.30 },
  { id: 'rappi', label: 'Rappi', color: 'bg-yellow-500', comision: 0.25 },
  { id: 'local', label: 'Local', color: 'bg-blue-600', comision: 0 },
] as const

export const ESTADO_MESA_CONFIG = {
  disponible: { label: 'Disponible', color: 'bg-green-500', text: 'text-green-700' },
  ocupada: { label: 'Ocupada', color: 'bg-red-500', text: 'text-red-700' },
  reservada: { label: 'Reservada', color: 'bg-yellow-500', text: 'text-yellow-700' },
  limpieza: { label: 'En limpieza', color: 'bg-blue-400', text: 'text-blue-700' },
} as const

export const ESTADO_PEDIDO_CONFIG = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-500', emoji: '🆕' },
  en_preparacion: { label: 'En preparación', color: 'bg-yellow-500', emoji: '👨‍🍳' },
  listo: { label: 'Listo', color: 'bg-green-500', emoji: '✅' },
  entregado: { label: 'Entregado', color: 'bg-gray-400', emoji: '🛎️' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', emoji: '❌' },
} as const
