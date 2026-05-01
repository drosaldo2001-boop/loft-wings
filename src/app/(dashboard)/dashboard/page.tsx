'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, LabelList } from 'recharts'

interface KPIs {
  ventas_hoy: number
  propinas_hoy: number
  descuentos_hoy: number
  cuentas_cerradas_hoy: number
  cuentas_abiertas: number
  mesas_ocupadas: number
  mesas_limpieza: number
  ticket_promedio: number
  pedidos_cocina: number
  ventas_mes: number
}

interface AnalisisProducto {
  nombre: string
  categoria: string
  precio: number
  costo: number
  margen: number
  margen_pct: number
  tiempo_estimado: number
  tiempo_real: number | null
  unidades_7d: number
  ingreso_7d: number
  ganancia_7d: number
}

interface MensajeManager { role: 'user' | 'assistant'; content: string }

const COLORES = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6']
const COLORES_PAGO = { efectivo: '#22c55e', tarjeta: '#3b82f6', transferencia: '#8b5cf6' }

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({
    ventas_hoy: 0, propinas_hoy: 0, descuentos_hoy: 0,
    cuentas_cerradas_hoy: 0, cuentas_abiertas: 0,
    mesas_ocupadas: 0, mesas_limpieza: 0,
    ticket_promedio: 0, pedidos_cocina: 0, ventas_mes: 0,
  })
  const [ventasSemana, setVentasSemana] = useState<{ dia: string; total: number }[]>([])
  const [topProductos, setTopProductos] = useState<{ nombre: string; cantidad: number }[]>([])
  const [metodoPago, setMetodoPago] = useState<{ name: string; value: number }[]>([])
  const [topMeseros, setTopMeseros] = useState<{ nombre: string; ventas: number; propinas: number; cuentas: number }[]>([])
  const [analisisProductos, setAnalisisProductos] = useState<AnalisisProducto[]>([])
  const [loading, setLoading] = useState(true)
  const [mensajes, setMensajes] = useState<MensajeManager[]>([
    { role: 'assistant', content: '¡Hola! Soy tu Manager IA. Pregúntame sobre ventas, propinas, rendimiento por mesero, o cualquier métrica del restaurante.' }
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const fetchDatos = useCallback(async () => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      { data: cuentasHoy },
      { data: cuentasAbiertas },
      { data: mesas },
      { data: pedidosCocina },
      { data: pedidosSemana },
      { data: cuentasMes },
      { data: cuentasMeseros },
      { data: productosData },
      { data: pedidosTiempos },
    ] = await Promise.all([
      supabase.from('cuentas')
        .select('total, propina, descuento, impuesto, subtotal, metodo_pago')
        .eq('estado', 'cerrada')
        .gte('cerrada_at', hoy.toISOString())
        .lt('cerrada_at', manana.toISOString()),
      supabase.from('cuentas').select('id').eq('estado', 'abierta'),
      supabase.from('mesas').select('estado'),
      supabase.from('pedidos').select('id').in('estado', ['nuevo', 'en_preparacion']),
      supabase.from('pedidos')
        .select('created_at, precio_unitario, cantidad, productos!pedidos_producto_id_fkey(nombre, costo)')
        .gte('created_at', hace7dias.toISOString())
        .eq('estado', 'entregado'),
      supabase.from('cuentas')
        .select('total')
        .eq('estado', 'cerrada')
        .gte('cerrada_at', inicioMes.toISOString()),
      supabase.from('cuentas')
        .select('total, propina, usuarios!cuentas_mesero_id_fkey(nombre)')
        .eq('estado', 'cerrada')
        .gte('cerrada_at', hoy.toISOString())
        .lt('cerrada_at', manana.toISOString()),
      supabase.from('productos')
        .select('nombre, categoria, precio, costo, tiempo_prep_min')
        .eq('activo', true)
        .order('categoria'),
      supabase.from('pedidos')
        .select('producto_id, tiempo_inicio, tiempo_listo, productos!pedidos_producto_id_fkey(nombre)')
        .not('tiempo_inicio', 'is', null)
        .not('tiempo_listo', 'is', null)
        .gte('created_at', hace7dias.toISOString()),
    ])

    // KPIs principales
    const ventasHoy = (cuentasHoy ?? []).reduce((s, c) => s + (c.total ?? 0), 0)
    const propinasHoy = (cuentasHoy ?? []).reduce((s, c) => s + (c.propina ?? 0), 0)
    const descuentosHoy = (cuentasHoy ?? []).reduce((s, c) => s + (c.descuento ?? 0), 0)
    const ticketProm = cuentasHoy?.length ? ventasHoy / cuentasHoy.length : 0
    const ventasMes = (cuentasMes ?? []).reduce((s, c) => s + (c.total ?? 0), 0)
    const mesasOcupadas = (mesas ?? []).filter(m => m.estado === 'ocupada').length
    const mesasLimpieza = (mesas ?? []).filter(m => m.estado === 'limpieza').length

    setKpis({
      ventas_hoy: ventasHoy,
      propinas_hoy: propinasHoy,
      descuentos_hoy: descuentosHoy,
      cuentas_cerradas_hoy: cuentasHoy?.length ?? 0,
      cuentas_abiertas: cuentasAbiertas?.length ?? 0,
      mesas_ocupadas: mesasOcupadas,
      mesas_limpieza: mesasLimpieza,
      ticket_promedio: ticketProm,
      pedidos_cocina: pedidosCocina?.length ?? 0,
      ventas_mes: ventasMes,
    })

    // Método de pago
    const pagos: Record<string, number> = {}
    ;(cuentasHoy ?? []).forEach(c => {
      const m = c.metodo_pago ?? 'efectivo'
      pagos[m] = (pagos[m] ?? 0) + (c.total ?? 0)
    })
    setMetodoPago(Object.entries(pagos).map(([name, value]) => ({ name, value })))

    // Ventas semana
    const dias: Record<string, number> = {}
    ;(pedidosSemana ?? []).forEach(p => {
      const dia = new Date(p.created_at).toLocaleDateString('es-MX', { weekday: 'short' })
      dias[dia] = (dias[dia] ?? 0) + (p.precio_unitario * p.cantidad)
    })
    setVentasSemana(Object.entries(dias).map(([dia, total]) => ({ dia, total })))

    // Top productos
    const conteo: Record<string, number> = {}
    ;(pedidosSemana ?? []).forEach(p => {
      const nombre = (p.productos as unknown as { nombre: string } | null)?.nombre ?? 'N/A'
      conteo[nombre] = (conteo[nombre] ?? 0) + p.cantidad
    })
    setTopProductos(
      Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    )

    // Top meseros hoy
    const meseroMap: Record<string, { nombre: string; ventas: number; propinas: number; cuentas: number }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cuentasMeseros ?? []).forEach((c: any) => {
      const nombre = c.usuarios?.nombre ?? 'Sin nombre'
      if (!meseroMap[nombre]) meseroMap[nombre] = { nombre, ventas: 0, propinas: 0, cuentas: 0 }
      meseroMap[nombre].ventas += c.total ?? 0
      meseroMap[nombre].propinas += c.propina ?? 0
      meseroMap[nombre].cuentas += 1
    })
    setTopMeseros(Object.values(meseroMap).sort((a, b) => b.ventas - a.ventas))

    // Tiempos reales promedio por producto
    const tiemposReales: Record<string, number[]> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pedidosTiempos ?? []).forEach((p: any) => {
      if (!p.tiempo_inicio || !p.tiempo_listo) return
      const mins = (new Date(p.tiempo_listo).getTime() - new Date(p.tiempo_inicio).getTime()) / 60000
      if (mins > 0 && mins < 120) {
        const nombre = p.productos?.nombre ?? p.producto_id
        if (!tiemposReales[nombre]) tiemposReales[nombre] = []
        tiemposReales[nombre].push(mins)
      }
    })

    // Unidades vendidas por producto en 7 días
    const unidades7d: Record<string, { cantidad: number; ingreso: number; costo_total: number }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pedidosSemana ?? []).forEach((p: any) => {
      const nombre = p.productos?.nombre ?? 'N/A'
      if (!unidades7d[nombre]) unidades7d[nombre] = { cantidad: 0, ingreso: 0, costo_total: 0 }
      unidades7d[nombre].cantidad += p.cantidad
      unidades7d[nombre].ingreso += p.precio_unitario * p.cantidad
      unidades7d[nombre].costo_total += (p.productos?.costo ?? 0) * p.cantidad
    })

    // Armar análisis completo
    const analisis: AnalisisProducto[] = (productosData ?? []).map(prod => {
      const margen = prod.precio - prod.costo
      const margen_pct = prod.precio > 0 ? (margen / prod.precio) * 100 : 0
      const tiemposArr = tiemposReales[prod.nombre]
      const tiempo_real = tiemposArr?.length
        ? tiemposArr.reduce((a, b) => a + b, 0) / tiemposArr.length
        : null
      const stats = unidades7d[prod.nombre] ?? { cantidad: 0, ingreso: 0, costo_total: 0 }
      return {
        nombre: prod.nombre,
        categoria: prod.categoria,
        precio: prod.precio,
        costo: prod.costo,
        margen,
        margen_pct,
        tiempo_estimado: prod.tiempo_prep_min,
        tiempo_real,
        unidades_7d: stats.cantidad,
        ingreso_7d: stats.ingreso,
        ganancia_7d: stats.ingreso - stats.costo_total,
      }
    }).sort((a, b) => b.ganancia_7d - a.ganancia_7d)

    setAnalisisProductos(analisis)
    setLoading(false)
  }, [])

  useEffect(() => { fetchDatos() }, [fetchDatos])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  async function preguntarManager(mensaje: string) {
    if (!mensaje.trim() || cargando) return
    const nuevos: MensajeManager[] = [...mensajes, { role: 'user', content: mensaje }]
    setMensajes(nuevos)
    setInput('')
    setCargando(true)
    try {
      const res = await fetch('/api/ai/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nuevos.slice(-8), kpis, ventasSemana, topProductos, analisisProductos }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let respuesta = ''
      setMensajes(prev => [...prev, { role: 'assistant', content: '' }])
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        respuesta += decoder.decode(value)
        setMensajes(prev => {
          const copia = [...prev]; copia[copia.length - 1] = { role: 'assistant', content: respuesta }; return copia
        })
      }
    } catch {
      setMensajes(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el Manager IA.' }])
    } finally { setCargando(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Dashboard Gerencial</h1>
          <p className="text-gray-400 text-sm mt-0.5">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={fetchDatos} className="text-xs text-gray-500 hover:text-white bg-gray-800 px-3 py-2 rounded-xl transition">
          🔄 Actualizar
        </button>
      </div>

      {/* KPIs fila 1 — ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
          <p className="text-2xl mb-1">💰</p>
          <p className="text-3xl font-bold text-green-400">${kpis.ventas_hoy.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
          <p className="text-gray-400 text-sm mt-1">Ventas hoy</p>
          <p className="text-gray-600 text-xs mt-0.5">{kpis.cuentas_cerradas_hoy} cuentas cobradas</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5">
          <p className="text-2xl mb-1">🤝</p>
          <p className="text-3xl font-bold text-yellow-400">${kpis.propinas_hoy.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
          <p className="text-gray-400 text-sm mt-1">Propinas hoy</p>
          <p className="text-gray-600 text-xs mt-0.5">
            {kpis.ventas_hoy > 0 ? `${((kpis.propinas_hoy / kpis.ventas_hoy) * 100).toFixed(1)}% del total` : '—'}
          </p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5">
          <p className="text-2xl mb-1">🎯</p>
          <p className="text-3xl font-bold text-purple-400">${kpis.ticket_promedio.toFixed(0)}</p>
          <p className="text-gray-400 text-sm mt-1">Ticket promedio</p>
          <p className="text-gray-600 text-xs mt-0.5">por cuenta hoy</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
          <p className="text-2xl mb-1">📅</p>
          <p className="text-3xl font-bold text-blue-400">${kpis.ventas_mes.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
          <p className="text-gray-400 text-sm mt-1">Ventas del mes</p>
          <p className="text-gray-600 text-xs mt-0.5">{new Date().toLocaleDateString('es-MX', { month: 'long' })}</p>
        </div>
      </div>

      {/* KPIs fila 2 — operación */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Mesas ocupadas', value: kpis.mesas_ocupadas, emoji: '🪑', color: 'text-orange-400' },
          { label: 'Cuentas abiertas', value: kpis.cuentas_abiertas, emoji: '📋', color: 'text-blue-400' },
          { label: 'En cocina', value: kpis.pedidos_cocina, emoji: '👨‍🍳', color: 'text-yellow-400' },
          { label: 'En limpieza', value: kpis.mesas_limpieza, emoji: '🧹', color: 'text-cyan-400' },
          { label: 'Descuentos hoy', value: `$${kpis.descuentos_hoy.toFixed(0)}`, emoji: '🏷️', color: 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-xl mb-1">{k.emoji}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-500 text-xs mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Meseros hoy */}
      {topMeseros.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">👤 Rendimiento de meseros — hoy</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Mesero</th>
                  <th className="text-right py-2 pr-4">Cuentas</th>
                  <th className="text-right py-2 pr-4">Ventas</th>
                  <th className="text-right py-2 pr-4">Propinas</th>
                  <th className="text-right py-2">Ticket prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topMeseros.map((m, i) => (
                  <tr key={m.nombre} className="hover:bg-gray-800/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                          style={{ backgroundColor: COLORES[i % COLORES.length] }}>
                          {m.nombre.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-white font-medium">{m.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-400">{m.cuentas}</td>
                    <td className="py-3 pr-4 text-right text-green-400 font-bold">${m.ventas.toFixed(0)}</td>
                    <td className="py-3 pr-4 text-right text-yellow-400 font-bold">${m.propinas.toFixed(0)}</td>
                    <td className="py-3 text-right text-purple-400">${(m.ventas / m.cuentas).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ventas semana */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">📈 Ventas últimos 7 días</h3>
          {ventasSemana.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ventasSemana}>
                <XAxis dataKey="dia" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                  formatter={(v: number) => [`$${v.toFixed(0)}`, 'Ventas']} />
                <Bar dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-16 text-sm">Sin datos esta semana</p>}
        </div>

        {/* Método de pago */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">💳 Pago de hoy</h3>
          {metodoPago.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={metodoPago} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {metodoPago.map((entry, i) => (
                      <Cell key={i} fill={COLORES_PAGO[entry.name as keyof typeof COLORES_PAGO] ?? COLORES[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                    formatter={(v: number) => [`$${v.toFixed(0)}`]} />
                  <Legend formatter={(v) => <span className="text-gray-300 text-xs capitalize">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {metodoPago.map(m => (
                  <div key={m.name} className="flex justify-between text-xs">
                    <span className="text-gray-400 capitalize">{m.name}</span>
                    <span className="text-white font-medium">${m.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-gray-500 text-center py-16 text-sm">Sin cobros hoy</p>}
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">🏆 Top productos vendidos (7 días)</h3>
        {topProductos.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {topProductos.map((p, i) => (
              <div key={p.nombre} className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-4 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-white text-xs font-medium truncate">{p.nombre}</span>
                    <span className="text-gray-400 text-xs ml-2 whitespace-nowrap">{p.cantidad} uds</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(p.cantidad / topProductos[0].cantidad) * 100}%`, backgroundColor: COLORES[i] }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-center py-8 text-sm">Sin datos esta semana</p>}
      </div>

      {/* ─── RENTABILIDAD POR PRODUCTO ─── */}
      {analisisProductos.length > 0 && (() => {
        const top12 = [...analisisProductos].sort((a, b) => b.margen_pct - a.margen_pct).slice(0, 12)
        const top12ganancia = [...analisisProductos].filter(p => p.unidades_7d > 0).sort((a, b) => b.ganancia_7d - a.ganancia_7d).slice(0, 10)

        return (
          <div className="space-y-4">
            {/* Margen % por producto */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">💰 Margen de ganancia por producto</h3>
                <span className="text-xs text-gray-500">Precio − Costo ÷ Precio</span>
              </div>
              <ResponsiveContainer width="100%" height={top12.length * 38 + 20}>
                <BarChart data={top12} layout="vertical" margin={{ left: 8, right: 60 }}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke="#6b7280" fontSize={11} />
                  <YAxis type="category" dataKey="nombre" width={160} stroke="#6b7280" fontSize={11} tick={{ fill: '#d1d5db' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                    formatter={(v: number, _: string, props: { payload: AnalisisProducto }) => [
                      `${v.toFixed(1)}% — $${props.payload.margen.toFixed(2)} por pieza`,
                      'Margen'
                    ]}
                  />
                  <Bar dataKey="margen_pct" radius={[0, 6, 6, 0]} minPointSize={4}>
                    {top12.map((entry, i) => (
                      <Cell key={i} fill={entry.margen_pct >= 60 ? '#22c55e' : entry.margen_pct >= 40 ? '#f97316' : '#ef4444'} />
                    ))}
                    <LabelList dataKey="margen_pct" position="right" formatter={(v: number) => `${v.toFixed(0)}%`} style={{ fill: '#9ca3af', fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> ≥60% excelente</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> 40–60% bueno</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> &lt;40% revisar</span>
              </div>
            </div>

            {/* Ganancia generada en 7 días */}
            {top12ganancia.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">📈 Ganancia real generada — últimos 7 días</h3>
                  <span className="text-xs text-gray-500">Solo productos con ventas</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={top12ganancia} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="nombre" stroke="#6b7280" fontSize={10} angle={-35} textAnchor="end" interval={0} tick={{ fill: '#9ca3af' }} />
                    <YAxis stroke="#6b7280" fontSize={11} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                      formatter={(v: number, name: string) => [
                        `$${v.toFixed(2)}`,
                        name === 'ganancia_7d' ? 'Ganancia' : 'Ingreso bruto'
                      ]}
                    />
                    <Legend formatter={v => <span className="text-gray-300 text-xs">{v === 'ganancia_7d' ? 'Ganancia neta' : 'Ingreso bruto'}</span>} />
                    <Bar dataKey="ingreso_7d" fill="#3b82f620" stroke="#3b82f6" strokeWidth={1} radius={[4, 4, 0, 0]} name="ingreso_7d" />
                    <Bar dataKey="ganancia_7d" fill="#22c55e" radius={[4, 4, 0, 0]} name="ganancia_7d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Precio vs Costo + Tiempos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Costo vs Precio */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4">🏷️ Costo vs Precio de venta</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[...analisisProductos].filter(p => p.precio > 0).sort((a, b) => b.precio - a.precio).slice(0, 8)} margin={{ bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="nombre" stroke="#6b7280" fontSize={10} angle={-35} textAnchor="end" interval={0} tick={{ fill: '#9ca3af' }} />
                    <YAxis stroke="#6b7280" fontSize={11} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`]}
                    />
                    <Legend formatter={v => <span className="text-gray-300 text-xs">{v === 'costo' ? 'Costo' : 'Precio venta'}</span>} />
                    <Bar dataKey="precio" fill="#f97316" radius={[4, 4, 0, 0]} name="precio" />
                    <Bar dataKey="costo" fill="#ef4444" radius={[4, 4, 0, 0]} name="costo" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tiempos estimado vs real */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-1">⏱️ Tiempo de preparación</h3>
                <p className="text-xs text-gray-500 mb-3">Estimado vs promedio real en cocina</p>
                {analisisProductos.some(p => p.tiempo_real !== null) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={analisisProductos.filter(p => p.tiempo_real !== null).sort((a, b) => (b.tiempo_real ?? 0) - (a.tiempo_real ?? 0)).slice(0, 8)}
                      margin={{ bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="nombre" stroke="#6b7280" fontSize={10} angle={-35} textAnchor="end" interval={0} tick={{ fill: '#9ca3af' }} />
                      <YAxis stroke="#6b7280" fontSize={11} tickFormatter={v => `${v}m`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                        formatter={(v: number) => [`${v.toFixed(1)} min`]}
                      />
                      <Legend formatter={v => <span className="text-gray-300 text-xs">{v === 'tiempo_estimado' ? 'Estimado' : 'Real'}</span>} />
                      <Bar dataKey="tiempo_estimado" fill="#6b7280" radius={[4, 4, 0, 0]} name="tiempo_estimado" />
                      <Bar dataKey="tiempo_real" fill="#f97316" radius={[4, 4, 0, 0]} name="tiempo_real">
                        {analisisProductos.filter(p => p.tiempo_real !== null).sort((a, b) => (b.tiempo_real ?? 0) - (a.tiempo_real ?? 0)).slice(0, 8).map((entry, i) => (
                          <Cell key={i} fill={(entry.tiempo_real ?? 0) > entry.tiempo_estimado + 3 ? '#ef4444' : (entry.tiempo_real ?? 0) > entry.tiempo_estimado ? '#eab308' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <p className="text-3xl mb-2">⏳</p>
                    <p className="text-gray-400 text-sm">Sin datos reales aún</p>
                    <p className="text-gray-600 text-xs mt-1">Se calculan cuando cocina usa<br/>Iniciar → Marcar Listo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tabla resumen */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-white">📋 Tabla completa de rentabilidad</h3>
                <span className="text-xs text-gray-500">{analisisProductos.length} productos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase border-b border-gray-800 bg-gray-800/50">
                      <th className="text-left px-4 py-3">Producto</th>
                      <th className="text-right px-3 py-3">Precio</th>
                      <th className="text-right px-3 py-3">Costo</th>
                      <th className="text-right px-3 py-3">Margen $</th>
                      <th className="text-right px-3 py-3">Margen %</th>
                      <th className="text-right px-3 py-3">Vendidos 7d</th>
                      <th className="text-right px-3 py-3">Ganancia 7d</th>
                      <th className="text-right px-4 py-3">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {analisisProductos.map(p => (
                      <tr key={p.nombre} className="hover:bg-gray-800/40">
                        <td className="px-4 py-2.5">
                          <div>
                            <p className="text-white font-medium">{p.nombre}</p>
                            <p className="text-gray-600 capitalize">{p.categoria}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-white">${p.precio}</td>
                        <td className="px-3 py-2.5 text-right text-gray-400">${p.costo}</td>
                        <td className="px-3 py-2.5 text-right text-orange-400 font-medium">${p.margen.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            p.margen_pct >= 60 ? 'bg-green-500/20 text-green-400' :
                            p.margen_pct >= 40 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {p.margen_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-300">{p.unidades_7d}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-green-400">
                          {p.ganancia_7d > 0 ? `$${p.ganancia_7d.toFixed(0)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {p.tiempo_real !== null ? (
                            <span className={`${(p.tiempo_real ?? 0) > p.tiempo_estimado + 3 ? 'text-red-400' : (p.tiempo_real ?? 0) > p.tiempo_estimado ? 'text-yellow-400' : 'text-green-400'}`}>
                              {p.tiempo_real.toFixed(1)}m
                            </span>
                          ) : (
                            <span className="text-gray-600">{p.tiempo_estimado}m est.</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Manager IA */}
      <div className="bg-gray-900 border border-blue-500/20 rounded-2xl">
        <div className="p-4 border-b border-blue-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg">🤖</div>
          <div>
            <p className="font-bold text-white">Manager IA</p>
            <p className="text-xs text-blue-400">Powered by Claude Opus 4.7 · Análisis profundo</p>
          </div>
        </div>
        <div ref={chatRef} className="h-56 overflow-auto p-4 space-y-3">
          {mensajes.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-sm lg:max-w-lg px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-200'
              }`}>
                {msg.content || <span className="animate-pulse">Analizando datos...</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-800">
          {['¿Cómo están las ventas hoy?', '¿Qué mesero rindió más?', 'Dame un resumen ejecutivo', '¿Qué áreas mejorar?'].map(s => (
            <button key={s} onClick={() => preguntarManager(s)}
              className="whitespace-nowrap text-xs bg-blue-600/20 text-blue-300 px-3 py-2 rounded-xl hover:bg-blue-600/30 transition border border-blue-600/20">
              {s}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && preguntarManager(input)}
            placeholder="Pregunta sobre el rendimiento del restaurante..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => preguntarManager(input)} disabled={cargando || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-medium transition">
            {cargando ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
