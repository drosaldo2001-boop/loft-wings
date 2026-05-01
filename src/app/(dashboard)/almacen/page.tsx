'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Insumo = Database['public']['Tables']['inventario']['Row']
type Vista = 'inventario' | 'gastos' | 'oracle'

interface Movimiento {
  id: string
  inventario_id: string
  tipo: string
  cantidad: number
  motivo: string
  costo_total: number
  created_at: string
  inventario: { nombre: string; unidad: string } | null
}

interface MensajeOracle { role: 'user' | 'assistant'; content: string }

const UNIDADES = ['kg', 'g', 'L', 'ml', 'piezas', 'paquetes', 'cajas', 'bolsas', 'latas', 'botellas', 'docenas']

const FORM_VACIO = {
  nombre: '', unidad: 'kg', cantidad_actual: '', cantidad_minima: '',
  cantidad_optima: '', costo_unitario: '', proveedor: '',
}

export default function AlmacenPage() {
  const [inventario, setInventario] = useState<Insumo[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('inventario')
  const [busqueda, setBusqueda] = useState('')

  // Modal compra/entrada
  const [modalCompra, setModalCompra] = useState<Insumo | null>(null)
  const [cantidadCompra, setCantidadCompra] = useState('')
  const [costoCompra, setCostoCompra] = useState('')
  const [guardandoCompra, setGuardandoCompra] = useState(false)

  // Modal nuevo producto
  const [modalNuevo, setModalNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState(FORM_VACIO)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  // Modal editar
  const [modalEditar, setModalEditar] = useState<Insumo | null>(null)
  const [formEditar, setFormEditar] = useState(FORM_VACIO)

  // Oracle IA
  const [mensajesOracle, setMensajesOracle] = useState<MensajeOracle[]>([
    { role: 'assistant', content: '¡Hola! Soy el Oracle de Inventario. Analizo tus patrones de venta para predecir qué necesitas comprar y cuándo. ¿Quieres que genere el reporte de compras para esta semana?' }
  ])
  const [inputOracle, setInputOracle] = useState('')
  const [cargandoOracle, setCargandoOracle] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const fetchInventario = useCallback(async () => {
    const { data } = await supabase.from('inventario').select('*').order('nombre')
    if (data) setInventario(data)
    setLoading(false)
  }, [])

  const fetchMovimientos = useCallback(async () => {
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('movimientos_inventario')
      .select('*, inventario!movimientos_inventario_inventario_id_fkey(nombre, unidad)')
      .eq('tipo', 'entrada')
      .gte('created_at', hace30)
      .order('created_at', { ascending: false })
    if (data) setMovimientos(data as unknown as Movimiento[])
  }, [])

  useEffect(() => { fetchInventario() }, [fetchInventario])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajesOracle])

  useEffect(() => {
    if (vista === 'gastos') fetchMovimientos()
  }, [vista, fetchMovimientos])

  async function registrarCompra() {
    if (!modalCompra || !cantidadCompra) return
    setGuardandoCompra(true)
    const cantidad = parseFloat(cantidadCompra)
    const costoUnit = costoCompra ? parseFloat(costoCompra) : modalCompra.costo_unitario
    const costoTotal = costoUnit * cantidad

    await Promise.all([
      supabase.from('inventario').update({
        cantidad_actual: modalCompra.cantidad_actual + cantidad,
        costo_unitario: costoUnit,
        updated_at: new Date().toISOString(),
      }).eq('id', modalCompra.id),
      supabase.from('movimientos_inventario').insert({
        inventario_id: modalCompra.id,
        tipo: 'entrada',
        cantidad,
        motivo: `Compra: ${cantidad} ${modalCompra.unidad} a $${costoUnit}/${modalCompra.unidad}`,
        costo_total: costoTotal,
        usuario_id: '00000000-0000-0000-0000-000000000000',
      }),
    ])
    setModalCompra(null)
    setCantidadCompra('')
    setCostoCompra('')
    setGuardandoCompra(false)
    fetchInventario()
  }

  async function agregarProducto() {
    if (!formNuevo.nombre.trim()) return
    setGuardandoNuevo(true)
    await supabase.from('inventario').insert({
      nombre: formNuevo.nombre.trim(),
      unidad: formNuevo.unidad,
      cantidad_actual: parseFloat(formNuevo.cantidad_actual) || 0,
      cantidad_minima: parseFloat(formNuevo.cantidad_minima) || 0,
      cantidad_optima: parseFloat(formNuevo.cantidad_optima) || 1,
      costo_unitario: parseFloat(formNuevo.costo_unitario) || 0,
      proveedor: formNuevo.proveedor.trim() || null,
    })
    setFormNuevo(FORM_VACIO)
    setModalNuevo(false)
    setGuardandoNuevo(false)
    fetchInventario()
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    await supabase.from('inventario').update({
      nombre: formEditar.nombre.trim(),
      unidad: formEditar.unidad,
      cantidad_actual: parseFloat(formEditar.cantidad_actual) || 0,
      cantidad_minima: parseFloat(formEditar.cantidad_minima) || 0,
      cantidad_optima: parseFloat(formEditar.cantidad_optima) || 1,
      costo_unitario: parseFloat(formEditar.costo_unitario) || 0,
      proveedor: formEditar.proveedor.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', modalEditar.id)
    setModalEditar(null)
    fetchInventario()
  }

  async function eliminarInsumo(id: string) {
    await supabase.from('inventario').delete().eq('id', id)
    fetchInventario()
  }

  async function preguntarOracle(mensaje: string) {
    if (!mensaje.trim() || cargandoOracle) return
    const nuevos: MensajeOracle[] = [...mensajesOracle, { role: 'user', content: mensaje }]
    setMensajesOracle(nuevos)
    setInputOracle('')
    setCargandoOracle(true)
    try {
      const res = await fetch('/api/ai/oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nuevos.slice(-8),
          inventario: inventario.map(i => ({
            nombre: i.nombre, unidad: i.unidad,
            actual: i.cantidad_actual, minimo: i.cantidad_minima,
            optimo: i.cantidad_optima, costo: i.costo_unitario, proveedor: i.proveedor,
          })),
        }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let respuesta = ''
      setMensajesOracle(prev => [...prev, { role: 'assistant', content: '' }])
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        respuesta += decoder.decode(value)
        setMensajesOracle(prev => {
          const copia = [...prev]; copia[copia.length - 1] = { role: 'assistant', content: respuesta }; return copia
        })
      }
    } catch {
      setMensajesOracle(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el Oracle.' }])
    } finally { setCargandoOracle(false) }
  }

  const criticos = inventario.filter(i => i.cantidad_actual <= i.cantidad_minima)
  const insumosFiltrados = inventario.filter(i =>
    busqueda === '' || i.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Cálculos gastos
  const totalGastado30 = movimientos.reduce((s, m) => s + (m.costo_total ?? 0), 0)
  const gastoPorInsumo = movimientos.reduce<Record<string, { nombre: string; total: number; compras: number }>>((acc, m) => {
    const nombre = m.inventario?.nombre ?? 'Desconocido'
    if (!acc[nombre]) acc[nombre] = { nombre, total: 0, compras: 0 }
    acc[nombre].total += m.costo_total ?? 0
    acc[nombre].compras += 1
    return acc
  }, {})
  const topGastos = Object.values(gastoPorInsumo).sort((a, b) => b.total - a.total).slice(0, 10)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">📦 Almacén</h1>
          <p className="text-gray-400 text-sm">{inventario.length} insumos · {criticos.length} críticos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['inventario', 'gastos', 'oracle'] as Vista[]).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition relative ${
                vista === v
                  ? v === 'oracle' ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white'
                  : v === 'oracle' ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {v === 'inventario' ? '📋 Inventario' : v === 'gastos' ? '💸 Gastos' : '🔮 Oracle IA'}
              {v === 'oracle' && criticos.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">{criticos.length}</span>
              )}
            </button>
          ))}
          {vista === 'inventario' && (
            <button
              onClick={() => { setModalNuevo(true); setFormNuevo(FORM_VACIO) }}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition flex items-center gap-1"
            >
              ＋ Agregar
            </button>
          )}
        </div>
      </div>

      {/* Alertas críticos */}
      {criticos.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 font-medium text-sm mb-2">🚨 Stock crítico — Compra urgente</p>
          <div className="flex flex-wrap gap-2">
            {criticos.map(i => (
              <button key={i.id} onClick={() => { setModalCompra(i); setCantidadCompra(''); setCostoCompra(String(i.costo_unitario)) }}
                className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/30 transition">
                {i.nombre}: {i.cantidad_actual} {i.unidad} · 🛒 Comprar
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ───── VISTA INVENTARIO ───── */}
      {vista === 'inventario' && (
        <div className="space-y-3">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar insumo..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />

          {/* Resumen costos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-orange-400">
                ${inventario.reduce((s, i) => s + i.costo_unitario * i.cantidad_actual, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">Valor en stock</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-red-400">{criticos.length}</p>
              <p className="text-xs text-gray-500 mt-1">Críticos</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-green-400">{inventario.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total insumos</p>
            </div>
          </div>

          <div className="space-y-2">
            {insumosFiltrados.map(insumo => {
              const porcentaje = Math.min((insumo.cantidad_actual / (insumo.cantidad_optima || 1)) * 100, 100)
              const esCritico = insumo.cantidad_actual <= insumo.cantidad_minima
              const esBajo = !esCritico && insumo.cantidad_actual <= insumo.cantidad_optima * 0.5
              const valorStock = insumo.costo_unitario * insumo.cantidad_actual

              return (
                <div key={insumo.id} className={`bg-gray-900 border rounded-2xl p-4 ${esCritico ? 'border-red-500/40' : esBajo ? 'border-yellow-500/30' : 'border-gray-800'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white text-sm">{insumo.nombre}</p>
                        {esCritico && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">🚨 Crítico</span>}
                        {esBajo && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⚠️ Bajo</span>}
                        {insumo.proveedor && <span className="text-xs text-gray-600">{insumo.proveedor}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-sm font-bold text-white">{insumo.cantidad_actual} {insumo.unidad}</span>
                        <span className="text-xs text-gray-500">Mín: {insumo.cantidad_minima} · Óptimo: {insumo.cantidad_optima}</span>
                        <span className="text-xs text-orange-400 font-medium">${insumo.costo_unitario}/{insumo.unidad}</span>
                        <span className="text-xs text-gray-600">Valor: ${valorStock.toFixed(0)}</span>
                      </div>
                      <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${esCritico ? 'bg-red-500' : esBajo ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${porcentaje}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => { setModalCompra(insumo); setCantidadCompra(''); setCostoCompra(String(insumo.costo_unitario)) }}
                        className="text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                      >
                        🛒 Comprar
                      </button>
                      <button
                        onClick={() => { setModalEditar(insumo); setFormEditar({ nombre: insumo.nombre, unidad: insumo.unidad, cantidad_actual: String(insumo.cantidad_actual), cantidad_minima: String(insumo.cantidad_minima), cantidad_optima: String(insumo.cantidad_optima), costo_unitario: String(insumo.costo_unitario), proveedor: insumo.proveedor ?? '' }) }}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-lg transition"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {insumosFiltrados.length === 0 && (
              <p className="text-gray-500 text-center py-12">No se encontraron insumos</p>
            )}
          </div>
        </div>
      )}

      {/* ───── VISTA GASTOS ───── */}
      {vista === 'gastos' && (
        <div className="space-y-4">
          {/* KPIs gastos */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">${totalGastado30.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500 mt-1">Gastado últimos 30 días</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{movimientos.length}</p>
              <p className="text-xs text-gray-500 mt-1">Compras registradas</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center col-span-2 lg:col-span-1">
              <p className="text-2xl font-bold text-green-400">
                ${movimientos.length ? (totalGastado30 / movimientos.length).toFixed(0) : 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Gasto promedio por compra</p>
            </div>
          </div>

          {/* Top gastos por insumo */}
          {topGastos.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-4">🏆 Mayor gasto por insumo (30 días)</h3>
              <div className="space-y-3">
                {topGastos.map((g, i) => (
                  <div key={g.nombre} className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-white text-sm font-medium truncate">{g.nombre}</span>
                        <span className="text-red-400 font-bold text-sm">${g.total.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mr-3">
                          <div className="h-1.5 rounded-full bg-red-500 transition-all"
                            style={{ width: `${(g.total / topGastos[0].total) * 100}%` }} />
                        </div>
                        <span className="text-gray-500 text-xs whitespace-nowrap">{g.compras} compra{g.compras !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de compras */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold text-white">📋 Historial de compras</h3>
            </div>
            {movimientos.length === 0 ? (
              <p className="text-gray-500 text-center py-12 text-sm">Sin compras registradas en los últimos 30 días</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {movimientos.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{m.inventario?.nombre ?? '—'}</p>
                      <p className="text-xs text-gray-500">{m.motivo}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-sm text-gray-300">+{m.cantidad} {m.inventario?.unidad}</p>
                      <p className="text-sm font-bold text-red-400">${(m.costo_total ?? 0).toFixed(0)}</p>
                    </div>
                    <p className="text-xs text-gray-600 whitespace-nowrap hidden sm:block">
                      {new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───── VISTA ORACLE ───── */}
      {vista === 'oracle' && (
        <div className="bg-gray-900 border border-purple-600/20 rounded-2xl flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
          <div className="p-4 border-b border-purple-600/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-lg">🔮</div>
            <div>
              <p className="font-bold text-white">Oracle de Inventario</p>
              <p className="text-xs text-purple-400">Powered by Claude Opus 4.7 · Extended Thinking</p>
            </div>
          </div>
          <div ref={chatRef} className="flex-1 overflow-auto p-4 space-y-4">
            {mensajesOracle.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0">🔮</div>
                )}
                <div className={`max-w-sm lg:max-w-lg px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm'}`}>
                  {msg.content || <span className="animate-pulse">Analizando inventario...</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-800">
            {['¿Qué debo comprar?', 'Genera orden de compra', '¿Cuánto presupuestar?', 'Insumos críticos'].map(s => (
              <button key={s} onClick={() => preguntarOracle(s)}
                className="whitespace-nowrap text-xs bg-purple-600/20 text-purple-300 px-3 py-2 rounded-xl hover:bg-purple-600/30 transition border border-purple-600/20">{s}</button>
            ))}
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input value={inputOracle} onChange={e => setInputOracle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && preguntarOracle(inputOracle)}
              placeholder="Pregunta al Oracle sobre tu inventario..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <button onClick={() => preguntarOracle(inputOracle)} disabled={cargandoOracle || !inputOracle.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-medium transition">
              {cargandoOracle ? '...' : '🔮'}
            </button>
          </div>
        </div>
      )}

      {/* ───── MODAL: Registrar Compra ───── */}
      {modalCompra && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">🛒 Registrar Compra</h3>
              <p className="text-gray-400 text-sm">{modalCompra.nombre} · Stock actual: {modalCompra.cantidad_actual} {modalCompra.unidad}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Cantidad comprada ({modalCompra.unidad})</label>
                <input type="number" value={cantidadCompra} onChange={e => setCantidadCompra(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Costo por {modalCompra.unidad} ($)</label>
                <input type="number" value={costoCompra} onChange={e => setCostoCompra(e.target.value)}
                  placeholder={String(modalCompra.costo_unitario)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              {cantidadCompra && costoCompra && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                  <p className="text-green-400 font-bold text-lg">
                    Total: ${(parseFloat(cantidadCompra) * parseFloat(costoCompra)).toFixed(2)}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Nuevo stock: {modalCompra.cantidad_actual + parseFloat(cantidadCompra)} {modalCompra.unidad}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalCompra(null); setCantidadCompra(''); setCostoCompra('') }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button onClick={registrarCompra} disabled={!cantidadCompra || guardandoCompra}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold transition active:scale-95">
                {guardandoCompra ? 'Guardando...' : '✓ Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MODAL: Agregar Producto ───── */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4 overflow-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 my-4">
            <h3 className="text-lg font-bold text-white">＋ Nuevo Insumo</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input value={formNuevo.nombre} onChange={e => setFormNuevo(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Alitas de pollo, Aceite, Queso gouda..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Unidad de medida</label>
                <div className="flex flex-wrap gap-2">
                  {UNIDADES.map(u => (
                    <button key={u} onClick={() => setFormNuevo(f => ({ ...f, unidad: u }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${formNuevo.unidad === u ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cantidad actual</label>
                  <input type="number" value={formNuevo.cantidad_actual} onChange={e => setFormNuevo(f => ({ ...f, cantidad_actual: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Costo unitario ($)</label>
                  <input type="number" value={formNuevo.costo_unitario} onChange={e => setFormNuevo(f => ({ ...f, costo_unitario: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cantidad mínima</label>
                  <input type="number" value={formNuevo.cantidad_minima} onChange={e => setFormNuevo(f => ({ ...f, cantidad_minima: e.target.value }))}
                    placeholder="alerta crítica"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cantidad óptima</label>
                  <input type="number" value={formNuevo.cantidad_optima} onChange={e => setFormNuevo(f => ({ ...f, cantidad_optima: e.target.value }))}
                    placeholder="stock ideal"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Proveedor (opcional)</label>
                <input value={formNuevo.proveedor} onChange={e => setFormNuevo(f => ({ ...f, proveedor: e.target.value }))}
                  placeholder="Nombre del proveedor"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            {formNuevo.cantidad_actual && formNuevo.costo_unitario && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                <p className="text-orange-400 text-sm font-bold">
                  Valor inicial en stock: ${(parseFloat(formNuevo.cantidad_actual) * parseFloat(formNuevo.costo_unitario)).toFixed(2)}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setModalNuevo(false); setFormNuevo(FORM_VACIO) }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button onClick={agregarProducto} disabled={!formNuevo.nombre.trim() || guardandoNuevo}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold transition active:scale-95">
                {guardandoNuevo ? 'Guardando...' : '✓ Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MODAL: Editar Insumo ───── */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4 overflow-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 my-4">
            <h3 className="text-lg font-bold text-white">✏️ Editar: {modalEditar.nombre}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre</label>
                <input value={formEditar.nombre} onChange={e => setFormEditar(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cantidad actual</label>
                  <input type="number" value={formEditar.cantidad_actual} onChange={e => setFormEditar(f => ({ ...f, cantidad_actual: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Costo unitario ($)</label>
                  <input type="number" value={formEditar.costo_unitario} onChange={e => setFormEditar(f => ({ ...f, costo_unitario: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cantidad mínima</label>
                  <input type="number" value={formEditar.cantidad_minima} onChange={e => setFormEditar(f => ({ ...f, cantidad_minima: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cantidad óptima</label>
                  <input type="number" value={formEditar.cantidad_optima} onChange={e => setFormEditar(f => ({ ...f, cantidad_optima: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Proveedor</label>
                <input value={formEditar.proveedor} onChange={e => setFormEditar(f => ({ ...f, proveedor: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { if (confirm('¿Eliminar este insumo del inventario?')) { eliminarInsumo(modalEditar.id); setModalEditar(null) } }}
                className="px-4 py-3 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm transition">
                🗑 Eliminar
              </button>
              <button onClick={() => setModalEditar(null)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button onClick={guardarEdicion}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition active:scale-95">
                ✓ Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
