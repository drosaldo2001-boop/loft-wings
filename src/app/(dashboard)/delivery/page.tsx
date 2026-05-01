'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PLATAFORMAS_DELIVERY } from '@/lib/constants'
import type { Database, PlataformaDelivery, EstadoPedido } from '@/types/database'

type PedidoDelivery = Database['public']['Tables']['pedidos_delivery']['Row']
type Vista = 'activos' | 'historial'

interface ItemForm { nombre: string; cantidad: string; precio: string }

const FORM_VACIO = {
  plataforma: 'didi_food' as PlataformaDelivery,
  cliente_nombre: '',
  direccion_entrega: '',
  notas: '',
}

const ESTADO_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  nuevo:          { label: 'Nuevo',          emoji: '🆕', color: 'bg-blue-500'   },
  en_preparacion: { label: 'En preparación', emoji: '👨‍🍳', color: 'bg-yellow-500' },
  listo:          { label: 'Listo',          emoji: '✅', color: 'bg-green-500'  },
  entregado:      { label: 'Entregado',      emoji: '🛵', color: 'bg-gray-500'   },
  cancelado:      { label: 'Cancelado',      emoji: '❌', color: 'bg-red-500'    },
}

export default function DeliveryPage() {
  const [pedidos, setPedidos] = useState<PedidoDelivery[]>([])
  const [historial, setHistorial] = useState<PedidoDelivery[]>([])
  const [vista, setVista] = useState<Vista>('activos')
  const [plataformaFiltro, setPlataformaFiltro] = useState<string>('todos')
  const [loading, setLoading] = useState(true)

  // Form nuevo pedido
  const [modalNuevo, setModalNuevo] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [items, setItems] = useState<ItemForm[]>([{ nombre: '', cantidad: '1', precio: '' }])
  const [guardando, setGuardando] = useState(false)

  const fetchActivos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos_delivery')
      .select('*')
      .not('estado', 'in', '(entregado,cancelado)')
      .order('created_at', { ascending: false })
    if (data) setPedidos(data)
    setLoading(false)
  }, [])

  const fetchHistorial = useCallback(async () => {
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('pedidos_delivery')
      .select('*')
      .in('estado', ['entregado', 'cancelado'])
      .gte('created_at', hace30)
      .order('created_at', { ascending: false })
    if (data) setHistorial(data)
  }, [])

  useEffect(() => {
    fetchActivos()
    const channel = supabase.channel('delivery_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_delivery' }, fetchActivos)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchActivos])

  useEffect(() => {
    if (vista === 'historial') fetchHistorial()
  }, [vista, fetchHistorial])

  async function avanzarEstado(id: string, estadoActual: EstadoPedido) {
    const sig: Partial<Record<EstadoPedido, EstadoPedido>> = {
      nuevo: 'en_preparacion', en_preparacion: 'listo', listo: 'entregado',
    }
    const nuevo = sig[estadoActual]
    if (!nuevo) return
    await supabase.from('pedidos_delivery').update({
      estado: nuevo,
      ...(nuevo === 'entregado' ? { entregado_at: new Date().toISOString() } : {}),
    }).eq('id', id)
  }

  async function cancelarPedido(id: string) {
    if (!confirm('¿Cancelar este pedido?')) return
    await supabase.from('pedidos_delivery').update({ estado: 'cancelado' }).eq('id', id)
  }

  function agregarItem() {
    setItems(prev => [...prev, { nombre: '', cantidad: '1', precio: '' }])
  }

  function quitarItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function actualizarItem(idx: number, campo: keyof ItemForm, valor: string) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [campo]: valor } : item))
  }

  function comisionDePlataforma(plat: PlataformaDelivery): number {
    return PLATAFORMAS_DELIVERY.find(p => p.id === plat)?.comision ?? 0
  }

  const subtotalForm = items.reduce((s, i) => {
    const cant = parseFloat(i.cantidad) || 0
    const precio = parseFloat(i.precio) || 0
    return s + cant * precio
  }, 0)
  const comisionForm = subtotalForm * comisionDePlataforma(form.plataforma)
  const gananciaForm = subtotalForm - comisionForm

  async function guardarPedido() {
    const itemsValidos = items.filter(i => i.nombre.trim() && parseFloat(i.precio) > 0)
    if (itemsValidos.length === 0) return
    setGuardando(true)

    const itemsFinal = itemsValidos.map(i => ({
      nombre: i.nombre.trim(),
      cantidad: parseFloat(i.cantidad) || 1,
      precio: parseFloat(i.precio) || 0,
    }))
    const subtotal = itemsFinal.reduce((s, i) => s + i.cantidad * i.precio, 0)
    const comision = subtotal * comisionDePlataforma(form.plataforma)

    await supabase.from('pedidos_delivery').insert({
      plataforma: form.plataforma,
      id_externo: `MAN-${Date.now().toString().slice(-6)}`,
      cliente_nombre: form.cliente_nombre.trim() || 'Cliente',
      items: itemsFinal,
      subtotal,
      comision_plataforma: comision,
      total: subtotal,
      estado: 'nuevo',
      direccion_entrega: form.direccion_entrega.trim() || null,
      notas: form.notas.trim() || null,
    })

    setForm(FORM_VACIO)
    setItems([{ nombre: '', cantidad: '1', precio: '' }])
    setModalNuevo(false)
    setGuardando(false)
    fetchActivos()
  }

  // Stats generales
  const pedidosFiltrados = pedidos.filter(p =>
    plataformaFiltro === 'todos' ? true : p.plataforma === plataformaFiltro
  )
  const totalActivoVentas = pedidos.reduce((s, p) => s + p.total, 0)
  const totalActivoGanancia = pedidos.reduce((s, p) => s + (p.total - p.comision_plataforma), 0)

  // Stats historial
  const totalHistorialVentas = historial.filter(p => p.estado === 'entregado').reduce((s, p) => s + p.total, 0)
  const totalHistorialGanancia = historial.filter(p => p.estado === 'entregado').reduce((s, p) => s + (p.total - p.comision_plataforma), 0)
  const totalHistorialComisiones = historial.filter(p => p.estado === 'entregado').reduce((s, p) => s + p.comision_plataforma, 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">🛵 Delivery</h1>
          <p className="text-gray-400 text-sm">{pedidos.length} pedidos activos · ${totalActivoVentas.toFixed(0)} en camino</p>
        </div>
        <button
          onClick={() => { setModalNuevo(true); setForm(FORM_VACIO); setItems([{ nombre: '', cantidad: '1', precio: '' }]) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition active:scale-95"
        >
          ＋ Nuevo Pedido
        </button>
      </div>

      {/* Stats por plataforma */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PLATAFORMAS_DELIVERY.map(plat => {
          const platPedidos = pedidos.filter(p => p.plataforma === plat.id)
          const ventas = platPedidos.reduce((s, p) => s + p.total, 0)
          const ganancia = platPedidos.reduce((s, p) => s + (p.total - p.comision_plataforma), 0)
          return (
            <div key={plat.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${plat.color} inline-block mb-2`}>{plat.label}</span>
              <p className="text-2xl font-bold text-white">{platPedidos.length}</p>
              <p className="text-green-400 text-xs font-medium">${ventas.toFixed(0)} ventas</p>
              {plat.comision > 0
                ? <p className="text-yellow-400 text-xs">${ganancia.toFixed(0)} neto (-{Math.round(plat.comision * 100)}%)</p>
                : <p className="text-gray-500 text-xs">Sin comisión</p>
              }
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'activos', label: `📦 Activos (${pedidos.length})` },
          { key: 'historial', label: '📋 Historial 30 días' },
        ] as { key: Vista; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setVista(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${vista === t.key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── VISTA ACTIVOS ─── */}
      {vista === 'activos' && (
        <>
          {/* Filtros plataforma */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setPlataformaFiltro('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${plataformaFiltro === 'todos' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
              Todos
            </button>
            {PLATAFORMAS_DELIVERY.map(plat => (
              <button key={plat.id} onClick={() => setPlataformaFiltro(plat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${plataformaFiltro === plat.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {plat.label}
              </button>
            ))}
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-3">🛵</p>
              <p className="text-gray-400 text-lg">No hay pedidos activos</p>
              <p className="text-gray-600 text-sm mt-1">Usa el botón "+ Nuevo Pedido" para registrar uno</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pedidosFiltrados.map(pedido => {
                const plat = PLATAFORMAS_DELIVERY.find(p => p.id === pedido.plataforma)
                const cfg = ESTADO_CONFIG[pedido.estado] ?? ESTADO_CONFIG.nuevo
                const items = pedido.items as { nombre: string; cantidad: number; precio: number }[]
                const ganancia = pedido.total - pedido.comision_plataforma
                return (
                  <div key={pedido.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${plat?.color}`}>{plat?.label}</span>
                        <span className="text-xs text-gray-500">{pedido.id_externo}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{pedido.cliente_nombre}</p>
                      {pedido.direccion_entrega && <p className="text-xs text-gray-500 mt-0.5">📍 {pedido.direccion_entrega}</p>}
                      <p className="text-xs text-gray-600">{new Date(pedido.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 space-y-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-300">{item.cantidad}× {item.nombre}</span>
                          <span className="text-white">${(item.precio * item.cantidad).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    {pedido.notas && <p className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-xl">📝 {pedido.notas}</p>}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-800 rounded-xl p-2">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-white font-bold text-sm">${pedido.total.toFixed(0)}</p>
                      </div>
                      <div className="bg-red-500/10 rounded-xl p-2">
                        <p className="text-xs text-gray-500">Comisión</p>
                        <p className="text-red-400 font-bold text-sm">-${pedido.comision_plataforma.toFixed(0)}</p>
                      </div>
                      <div className="bg-green-500/10 rounded-xl p-2">
                        <p className="text-xs text-gray-500">Ganancia</p>
                        <p className="text-green-400 font-bold text-sm">${ganancia.toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && (
                        <button onClick={() => avanzarEstado(pedido.id, pedido.estado as EstadoPedido)}
                          className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-orange-500 hover:bg-orange-600 text-white transition active:scale-95">
                          {pedido.estado === 'nuevo' ? '👨‍🍳 Preparar' : pedido.estado === 'en_preparacion' ? '✅ Listo' : '🛵 Entregado'}
                        </button>
                      )}
                      <button onClick={() => cancelarPedido(pedido.id)}
                        className="px-3 py-2.5 rounded-xl text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ─── VISTA HISTORIAL ─── */}
      {vista === 'historial' && (
        <div className="space-y-4">
          {/* Resumen 30 días */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">${totalHistorialVentas.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Ventas 30 días</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">${totalHistorialGanancia.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Ganancia neta</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">${totalHistorialComisiones.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Comisiones pagadas</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{historial.filter(p => p.estado === 'entregado').length}</p>
              <p className="text-xs text-gray-500 mt-1">Pedidos entregados</p>
            </div>
          </div>

          {/* Resumen por plataforma */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">Por plataforma (30 días)</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {PLATAFORMAS_DELIVERY.map(plat => {
                const platH = historial.filter(p => p.plataforma === plat.id && p.estado === 'entregado')
                if (platH.length === 0) return null
                const ventas = platH.reduce((s, p) => s + p.total, 0)
                const comisiones = platH.reduce((s, p) => s + p.comision_plataforma, 0)
                const ganancia = ventas - comisiones
                return (
                  <div key={plat.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${plat.color} whitespace-nowrap`}>{plat.label}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                      <div><p className="text-xs text-gray-500">Pedidos</p><p className="text-white font-bold">{platH.length}</p></div>
                      <div><p className="text-xs text-gray-500">Ventas</p><p className="text-white font-bold">${ventas.toFixed(0)}</p></div>
                      <div><p className="text-xs text-gray-500">Ganancia</p><p className="text-green-400 font-bold">${ganancia.toFixed(0)}</p></div>
                    </div>
                    <p className="text-xs text-red-400 whitespace-nowrap">-${comisiones.toFixed(0)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lista historial */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">Historial de pedidos</h3>
            </div>
            {historial.length === 0 ? (
              <p className="text-gray-500 text-center py-12 text-sm">Sin historial en los últimos 30 días</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {historial.map(pedido => {
                  const plat = PLATAFORMAS_DELIVERY.find(p => p.id === pedido.plataforma)
                  const cfg = ESTADO_CONFIG[pedido.estado] ?? ESTADO_CONFIG.entregado
                  const ganancia = pedido.total - pedido.comision_plataforma
                  return (
                    <div key={pedido.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${plat?.color} whitespace-nowrap hidden sm:inline`}>{plat?.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{pedido.cliente_nombre}</p>
                        <p className="text-gray-500 text-xs">{new Date(pedido.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm font-bold">${pedido.total.toFixed(0)}</p>
                        <p className={`text-xs font-medium ${pedido.estado === 'cancelado' ? 'text-red-400' : 'text-green-400'}`}>
                          {pedido.estado === 'cancelado' ? 'Cancelado' : `+$${ganancia.toFixed(0)}`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full text-white ${cfg.color} whitespace-nowrap`}>{cfg.emoji}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Nuevo Pedido ─── */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4 overflow-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
            <h3 className="text-lg font-bold text-white">🛵 Nuevo Pedido Delivery</h3>

            {/* Plataforma */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Plataforma</label>
              <div className="grid grid-cols-4 gap-2">
                {PLATAFORMAS_DELIVERY.map(plat => (
                  <button key={plat.id} onClick={() => setForm(f => ({ ...f, plataforma: plat.id }))}
                    className={`py-2.5 rounded-xl text-xs font-bold transition border-2 ${form.plataforma === plat.id ? `${plat.color} text-white border-transparent` : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}>
                    {plat.label}
                  </button>
                ))}
              </div>
              {form.plataforma !== 'local' && (
                <p className="text-xs text-gray-500 mt-1.5">
                  Comisión: {Math.round(comisionDePlataforma(form.plataforma) * 100)}% · Ganancia estimada: <span className="text-green-400 font-medium">${gananciaForm.toFixed(0)}</span>
                </p>
              )}
            </div>

            {/* Cliente y dirección */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Cliente</label>
                <input value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))}
                  placeholder="Nombre del cliente"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Dirección</label>
                <input value={form.direccion_entrega} onChange={e => setForm(f => ({ ...f, direccion_entrega: e.target.value }))}
                  placeholder="Dirección de entrega"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            {/* Items */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Productos del pedido</label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input value={item.nombre} onChange={e => actualizarItem(idx, 'nombre', e.target.value)}
                      placeholder="Nombre del producto"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <input type="number" value={item.cantidad} onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                      placeholder="Cant"
                      className="w-16 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input type="number" value={item.precio} onChange={e => actualizarItem(idx, 'precio', e.target.value)}
                        placeholder="0"
                        className="w-24 bg-gray-800 border border-gray-700 rounded-xl pl-6 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => quitarItem(idx)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center flex-shrink-0">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={agregarItem} className="mt-2 text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition">
                ＋ Agregar otro producto
              </button>
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notas</label>
              <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Instrucciones especiales, salsas, etc."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {/* Resumen de totales */}
            {subtotalForm > 0 && (
              <div className="bg-gray-800 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-gray-500">Subtotal</p><p className="text-white font-bold">${subtotalForm.toFixed(0)}</p></div>
                <div><p className="text-xs text-gray-500">Comisión</p><p className="text-red-400 font-bold">-${comisionForm.toFixed(0)}</p></div>
                <div><p className="text-xs text-gray-500">Ganancia</p><p className="text-green-400 font-bold">${gananciaForm.toFixed(0)}</p></div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModalNuevo(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button onClick={guardarPedido} disabled={items.every(i => !i.nombre.trim()) || guardando}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold transition active:scale-95">
                {guardando ? 'Guardando...' : '✓ Registrar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
