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
        <span className="text-gray-500">{tiempoObjetivo} min</span>
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

function TarjetaPedido({ pedido, onAvanzar }: { pedido: PedidoConDetalles; onAvanzar: (id: string, estado: EstadoPedido) => void }) {
  const config = ESTADO_PEDIDO_CONFIG[pedido.estado]
  const esNuevo = pedido.estado === 'nuevo'
  const tiempoPrep = pedido.productos?.tiempo_prep_min ?? 5
  return (
    <div className={`bg-gray-900 border-2 rounded-2xl p-4 space-y-3 transition ${esNuevo ? 'border-blue-500/50' : 'border-yellow-500/40'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-white">{pedido.cuentas?.mesas?.nombre ?? 'Sin mesa'}</p>
          <p className="text-xs text-gray-500">{new Date(pedido.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${config.color} text-white`}>
          {config.emoji} {config.label}
        </span>
      </div>
      <div className="bg-gray-800 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <span className="bg-orange-500 text-white text-sm font-bold px-2 py-0.5 rounded-lg">×{pedido.cantidad}</span>
          <p className="text-white font-medium text-sm flex-1">
            {pedido.productos?.nombre ?? pedido.notas?.replace('[Promo] ', '')?.replace('[Manual] ', '') ?? 'Pedido especial'}
          </p>
        </div>
        {pedido.modificaciones.length > 0 && (
          <p className="text-xs text-blue-400 mt-1">🔥 {pedido.modificaciones.join(', ')}</p>
        )}
        {pedido.notas && !pedido.notas.startsWith('[Promo]') && !pedido.notas.startsWith('[Manual]') && (
          <p className="text-xs text-yellow-400 mt-1 bg-yellow-500/10 rounded-lg px-2 py-1">📝 {pedido.notas}</p>
        )}
      </div>
      <TiempoPedido
        inicio={pedido.estado === 'en_preparacion' ? pedido.tiempo_inicio : pedido.created_at}
        tiempoObjetivo={tiempoPrep}
      />
      <button
        onClick={() => onAvanzar(pedido.id, pedido.estado)}
        className={`w-full py-3 rounded-xl font-bold text-sm transition active:scale-95 ${esNuevo ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
      >
        {esNuevo ? '👨‍🍳 Iniciar' : '✅ Listo'}
      </button>
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchPedidos)
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

  // Separar bebidas del resto
  const pedidosFiltrados = pedidos.filter(p =>
    filtro === 'todos' ? true : p.estado === filtro
  )
  const esBebida = (p: PedidoConDetalles) => {
    const cat = p.productos?.categoria ?? ''
    const nombre = (p.productos?.nombre ?? '').toLowerCase()
    return cat === 'bebidas' || nombre.includes('caguama') || nombre.includes('cerveza') || nombre.includes('bebida')
  }

  const pedidosCocina  = pedidosFiltrados.filter(p => !esBebida(p))
  const pedidosBebidas = pedidosFiltrados.filter(p => esBebida(p))

  const stats = {
    nuevos:  pedidos.filter(p => p.estado === 'nuevo').length,
    enPrep:  pedidos.filter(p => p.estado === 'en_preparacion').length,
    bebidas: pedidos.filter(p => esBebida(p)).length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-4">
      {/* Header */}
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
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.nuevos}</p>
          <p className="text-gray-400 text-xs">🆕 Nuevos</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.enPrep}</p>
          <p className="text-gray-400 text-xs">👨‍🍳 En prep.</p>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-cyan-400">{stats.bebidas}</p>
          <p className="text-gray-400 text-xs">🥤 Bebidas</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{pedidos.length}</p>
          <p className="text-gray-400 text-xs">📋 Total</p>
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${filtro === f.key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {f.label}
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{f.count}</span>
          </button>
        ))}
      </div>

      {/* DOS COLUMNAS: Cocina | Bebidas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">

        {/* ── Sección Cocina ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-800">
            <h2 className="text-white font-bold text-lg">🍳 Cocina</h2>
            <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {pedidosCocina.length}
            </span>
          </div>

          {pedidosCocina.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-gray-400">¡Todo al día en cocina!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pedidosCocina.map(pedido => (
                <TarjetaPedido key={pedido.id} pedido={pedido} onAvanzar={avanzarEstado} />
              ))}
            </div>
          )}
        </div>

        {/* ── Sección Bebidas ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-cyan-800">
            <h2 className="text-cyan-400 font-bold text-lg">🥤 Bebidas</h2>
            <span className="bg-cyan-500/20 text-cyan-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {pedidosBebidas.length}
            </span>
          </div>

          {pedidosBebidas.length === 0 ? (
            <div className="text-center py-10 bg-gray-900/50 rounded-2xl border border-cyan-900/30">
              <p className="text-3xl mb-2">🥤</p>
              <p className="text-gray-500 text-sm">Sin bebidas pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosBebidas.map(pedido => (
                <TarjetaPedido key={pedido.id} pedido={pedido} onAvanzar={avanzarEstado} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
