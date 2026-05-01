export type UserRole = 'admin' | 'gerente' | 'cajero' | 'mesero' | 'cocina' | 'almacen'
export type EstadoMesa = 'disponible' | 'ocupada' | 'reservada' | 'limpieza'
export type EstadoPedido = 'nuevo' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
export type EstadoCuenta = 'abierta' | 'cerrada' | 'cancelada'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'didi' | 'uber' | 'rappi'
export type PlataformaDelivery = 'didi_food' | 'uber_eats' | 'rappi' | 'local'
export type CategoriaProducto = 'alitas' | 'hamburguesas' | 'papas' | 'bebidas' | 'postres' | 'extras'

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          nombre: string
          username: string
          password_hash: string
          rol: UserRole
          activo: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>
      }
      mesas: {
        Row: {
          id: string
          numero: number
          nombre: string
          capacidad: number
          zona: string
          estado: EstadoMesa
          mesero_id: string | null
          cuenta_id: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['mesas']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['mesas']['Insert']>
      }
      productos: {
        Row: {
          id: string
          nombre: string
          descripcion: string
          categoria: CategoriaProducto
          precio: number
          costo: number
          imagen_url: string | null
          activo: boolean
          tiempo_prep_min: number
          ingredientes: string[]
          alergenos: string[]
          es_popular: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['productos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['productos']['Insert']>
      }
      cuentas: {
        Row: {
          id: string
          mesa_id: string | null
          mesero_id: string
          estado: EstadoCuenta
          subtotal: number
          descuento: number
          impuesto: number
          total: number
          metodo_pago: MetodoPago | null
          plataforma: PlataformaDelivery
          notas: string | null
          factura_id: string | null
          created_at: string
          cerrada_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['cuentas']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cuentas']['Insert']>
      }
      pedidos: {
        Row: {
          id: string
          cuenta_id: string
          producto_id: string
          cantidad: number
          precio_unitario: number
          modificaciones: string[]
          notas: string | null
          estado: EstadoPedido
          tiempo_inicio: string | null
          tiempo_listo: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['pedidos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['pedidos']['Insert']>
      }
      inventario: {
        Row: {
          id: string
          nombre: string
          unidad: string
          cantidad_actual: number
          cantidad_minima: number
          cantidad_optima: number
          costo_unitario: number
          proveedor: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventario']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inventario']['Insert']>
      }
      movimientos_inventario: {
        Row: {
          id: string
          inventario_id: string
          tipo: 'entrada' | 'salida' | 'ajuste' | 'merma'
          cantidad: number
          motivo: string
          usuario_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['movimientos_inventario']['Row'], 'id' | 'created_at'>
        Update: never
      }
      pedidos_delivery: {
        Row: {
          id: string
          plataforma: PlataformaDelivery
          id_externo: string
          cliente_nombre: string
          items: Array<{ nombre: string; cantidad: number; precio: number; notas?: string }>
          subtotal: number
          comision_plataforma: number
          total: number
          estado: EstadoPedido
          direccion_entrega: string | null
          notas: string | null
          created_at: string
          entregado_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['pedidos_delivery']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['pedidos_delivery']['Insert']>
      }
    }
  }
}
