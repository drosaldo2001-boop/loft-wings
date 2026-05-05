'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ESTADO_PEDIDO_CONFIG } from '@/lib/constants'
import type { EstadoPedido } from '@/types/database'

interface PedidoConDetalles {
  id: string
  cantidad: number
  notas: string | null
  modificaciones: string[]
  estado: EstadoPedido
  tiempo_inicio: string | null
  created_at: string
  productos: { nombre: string; categoria: string; tiempo_prep_min: number } | null
  cuentas: { mesa_id: string | null; mesas: { nombre: string } | null } | null
}

function usarTiempo(inicio: string | null) {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    if (!inicio) return
    const calcular = () => setSegundos(Math.floor((Date.now() - new Date(inicio).getTime()) / 1000))
    calcular()
    const id = setInterval(calcular, 1000)
    return () => clearInterval(id)
  }, [inicio])
  return segundos
}

function TiempoPedido({ inicio, tiempoObjetivo }: { inicio: string | null; tiempoObjetivo: number }) {
  const segundos = usarTiempo(inicio)
  const minutos = Math.floor(segundos / 60)
  const segs = segundos % 60
  const porcentaje = Math.min((segundos / (tiempoObjetivo * 60)) * 100, 100)
  const urgente = porcentaje >= 80
  const critico = porcentaje >= 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={`font-mono font-bold text-lg ${critico ? 'text-red-400' : urgente ? 'text-yellow-400' : 'text-green-400'}`}>
          {String(minutos).padStart(2, '0')}:{String(segs).padStart(2, '0')}
        </span>
        <span className="text-gray-500">{tiempoObjetivo} min objetivo</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${critico ? 'bg-red-500' : urgente ? 'bg-yellow-500' : 'bg-green-500'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  )
}

export default function CocinaPage() {
  const [pedidos, setPedidos] = useState<PedidoConDetalles[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'nuevo' | 'en_preparacion'>('todos')

  const fetchPedidos = useCallback(async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, cantidad, notas, modificaciones, estado, tiempo_inicio, created_at,
        productos (nombre, categoria, tiempo_prep_min),
        cuentas!pedidos_cuenta_id_fkey (mesa_id, mesas!cuentas_mesa_id_fkey (nombre))
      `)
      .in('estado', ['nuevo', 'en_preparacion'])
      .order('created_at', { ascending: true })

    if (error) console.error('Cocina fetch error:', error.message)
    if (data) setPedidos(data as unknown as PedidoConDetalles[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPedidos()
    const channel = supabase
      .channel('cocina_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidos()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchPedidos])

  async function avanzarEstado(id: string, estadoActual: EstadoPedido) {
    const siguiente: Partial<Record<EstadoPedido, EstadoPedido>> = {
      nuevo: 'en_preparacion',
      en_preparacion: 'listo',
    }
    const nuevoEstado = siguiente[estadoActual]
    if (!nuevoEstado) return

    await supabase.from('pedidos').update({
      estado: nuevoEstado,
      ...(nuevoEstado === 'en_preparacion' ? { tiempo_inicio: new Date().toISOString() } : {}),
      ...(nuevoEstado === 'listo' ? { tiempo_listo: new Date().toISOString() } : {}),
    }).eq('id', id)
  }

  const pedidosFiltrados = pedidos.filter(p =>
    filtro === 'todos' ? true : p.estado === filtro
  )

  const stats = {
    nuevos: pedidos.filter(p => p.estado === 'nuevo').length,
    enPrep: pedidos.filter(p => p.estado === 'en_preparacion').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-4">
      {/* Header KDS */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">👨‍🍳 Cocina — KDS</h1>
          <p className="text-gray-400 text-sm">Kitchen Display System · Tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm font-medium">En vivo</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{stats.nuevos}</p>
          <p className="text-gray-400 text-sm">🆕 Nuevos</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{stats.enPrep}</p>
          <p className="text-gray-400 text-sm">👨‍🍳 En prep.</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{pedidos.length}</p>
          <p className="text-gray-400 text-sm">📋 Total</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'todos', label: 'Todos', count: pedidos.length },
          { key: 'nuevo', label: '🆕 Nuevos', count: stats.nuevos },
          { key: 'en_preparacion', label: '👨‍🍳 En prep.', count: stats.enPrep },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key as typeof filtro)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              filtro === f.key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f.label}
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Tickets de cocina */}
      {pedidosFiltrados.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">✅</p>
          <p className="text-gray-400 text-xl font-medium">¡Todo al día!</p>
          <p className="text-gray-600">No hay pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {pedidosFiltrados.map(pedido => {
            const config = ESTADO_PEDIDO_CONFIG[pedido.estado]
            const esNuevo = pedido.estado === 'nuevo'
            const tiempoPrep = pedido.productos?.tiempo_prep_min ?? 15
            return (
              <div
                key={pedido.id}
                className={`bg-gray-900 border-2 rounded-2xl p-4 space-y-3 transition ${
                  esNuevo ? 'border-blue-500/50 animate-pulse-border' : 'border-yellow-500/40'
                }`}
              >
                {/* Mesa + estado */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-lg">
                      {pedido.cuentas?.mesas?.nombre ?? 'Sin mesa'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(pedido.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${config.color} text-white`}>
                    {config.emoji} {config.label}
                  </span>
                </div>

                {/* Producto */}
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="bg-orange-500 text-white text-sm font-bold px-2 py-0.5 rounded-lg">
                      ×{pedido.cantidad}
                    </span>
                    <p className="text-white font-medium text-sm flex-1">
                      {pedido.productos?.nombre ?? pedido.notas?.replace('[Promo] ', '') ?? 'Pedido especial'}
                    </p>
                  </div>
                  {pedido.modificaciones.length > 0 && (
                    <p className="text-xs text-blue-400 mt-1">
                      Modificaciones: {pedido.modificaciones.join(', ')}
                    </p>
                  )}
                  {pedido.notas && (
                    <p className="text-xs text-yellow-400 mt-1 bg-yellow-500/10 rounded-lg px-2 py-1">
                      📝 {pedido.notas}
                    </p>
                  )}
                </div>

                {/* Temporizador */}
                <TiempoPedido
                  inicio={pedido.estado === 'en_preparacion' ? pedido.tiempo_inicio : pedido.created_at}
                  tiempoObjetivo={tiempoPrep}
                />

                {/* Botón de acción */}
                <button
                  onClick={() => avanzarEstado(pedido.id, pedido.estado)}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition active:scale-95 ${
                    esNuevo
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {esNuevo ? '👨‍🍳 Iniciar Preparación' : '✅ Marcar como Listo'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
