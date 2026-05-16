'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { generarToken, segundosRestantes } from '@/lib/token'

interface Empleado {
  id: string
  nombre: string
  rol: string
  turno: { id: string; inicio: string; fin: string | null } | null
  ventas: number
  propinas: number
  cuentas: number
}

interface Turno {
  id: string
  usuario_id: string
  inicio: string
  fin: string | null
}

interface DiaResumen {
  fecha: string
  entrada: string | null
  salida: string | null
  horas: number
}

const ROL_LABELS: Record<string, string> = {
  mesero: 'Mesero', cocina: 'Cocina', cajero: 'Cajero',
  almacen: 'Almacén', admin: 'Admin', gerente: 'Gerente',
}
const ROL_COLORES: Record<string, string> = {
  mesero: 'bg-orange-500/20 text-orange-400',
  cocina: 'bg-yellow-500/20 text-yellow-400',
  cajero: 'bg-blue-500/20 text-blue-400',
  almacen: 'bg-green-500/20 text-green-400',
}

function duracion(inicio: string, fin?: string | null): string {
  const ms = (fin ? new Date(fin) : new Date()).getTime() - new Date(inicio).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

function TiempoVivo({ inicio }: { inicio: string }) {
  const [texto, setTexto] = useState(() => duracion(inicio))
  useEffect(() => {
    const id = setInterval(() => setTexto(duracion(inicio)), 30000)
    return () => clearInterval(id)
  }, [inicio])
  return <span>{texto}</span>
}

function horasDecimal(inicio: string, fin: string | null): number {
  if (!fin) return 0
  return (new Date(fin).getTime() - new Date(inicio).getTime()) / 3600000
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function fmtFecha(fecha: string) {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function CierrePage() {
  const admin = getSession()
  const [tab, setTab] = useState<'turnos' | 'resumen' | 'propinas'>('turnos')

  // ── TAB TURNOS ──
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])

  // ── MODAL TOKEN ──
  type ModalData = { empleadoId: string; nombre: string; accion: 'abrir' | 'cerrar'; turnoId?: string }
  const [modal, setModal] = useState<ModalData | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState('')

  // ── TAB RESUMEN ──
  const [empleadosList, setEmpleadosList] = useState<{ id: string; nombre: string; rol: string }[]>([])
  const [empleadoSel, setEmpleadoSel] = useState<string>('')
  const [periodoRes, setPeriodoRes] = useState<'semana' | 'mes'>('semana')
  const [diasResumen, setDiasResumen] = useState<DiaResumen[]>([])
  const [loadingRes, setLoadingRes] = useState(false)

  // ── TAB PROPINAS ──
  interface PropinaCuenta {
    id: string; total: number; propina: number; cerrada_at: string
    mesero: string; empleadosActivos: string[]; porPersona: number
  }
  interface ResumenEmpleado { id: string; nombre: string; total: number; cuentas: number }
  const [periodoProp, setPeriodoProp] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [detallePropinas, setDetallePropinas] = useState<PropinaCuenta[]>([])
  const [resumenPropinas, setResumenPropinas] = useState<ResumenEmpleado[]>([])
  const [loadingProp, setLoadingProp] = useState(false)
  const [totalPropinas, setTotalPropinas] = useState(0)

  const hoy = new Date().toISOString().split('T')[0]
  const esHoy = fecha === hoy

  const [tokenActual, setTokenActual] = useState(generarToken)
  const [segs, setSegs] = useState(segundosRestantes)
  useEffect(() => {
    const id = setInterval(() => {
      setTokenActual(generarToken())
      setSegs(segundosRestantes())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── CARGAR TURNOS DEL DÍA ──
  const cargar = useCallback(async () => {
    setLoading(true)
    const dia = new Date(fecha + 'T00:00:00')
    const siguiente = new Date(dia); siguiente.setDate(siguiente.getDate() + 1)

    const { data: usuarios } = await supabase
      .from('usuarios').select('id, nombre, rol').eq('activo', true)
      .not('rol', 'in', '("admin","gerente")').order('nombre')

    if (!usuarios) { setLoading(false); return }

    setEmpleadosList(usuarios)
    if (!empleadoSel && usuarios.length > 0) setEmpleadoSel(usuarios[0].id)

    const ids = usuarios.map(u => u.id)
    const [{ data: turnosAbiertos }, { data: turnosCerrados }, { data: cuentas }] = await Promise.all([
      // Turnos sin salida — siempre visibles sin importar fecha
      supabase.from('turnos').select('id, usuario_id, inicio, fin')
        .in('usuario_id', ids)
        .is('fin', null),
      // Turnos cerrados del día seleccionado
      supabase.from('turnos').select('id, usuario_id, inicio, fin')
        .in('usuario_id', ids)
        .not('fin', 'is', null)
        .gte('inicio', dia.toISOString())
        .lt('inicio', siguiente.toISOString()),
      supabase.from('cuentas').select('total, propina, mesero_id')
        .eq('estado', 'cerrada').in('mesero_id', ids)
        .gte('cerrada_at', dia.toISOString())
        .lt('cerrada_at', siguiente.toISOString()),
    ])
    // Combinar: turnos abiertos + turnos cerrados del día (sin duplicados)
    const abiertosIds = new Set((turnosAbiertos ?? []).map((t: any) => t.usuario_id))
    const cerradosHoy = (turnosCerrados ?? []).filter((t: any) => !abiertosIds.has(t.usuario_id))
    const turnos = [...(turnosAbiertos ?? []), ...cerradosHoy]

    const result: Empleado[] = usuarios.map(u => {
      const turno = (turnos ?? []).find((t: any) => t.usuario_id === u.id) ?? null
      const misCuentas = (cuentas ?? []).filter((c: any) => c.mesero_id === u.id)
      return {
        id: u.id, nombre: u.nombre, rol: u.rol,
        turno: turno ? { id: turno.id, inicio: turno.inicio, fin: turno.fin } : null,
        ventas: misCuentas.reduce((s: number, c: any) => s + (c.total ?? 0), 0),
        propinas: misCuentas.reduce((s: number, c: any) => s + (c.propina ?? 0), 0),
        cuentas: misCuentas.length,
      }
    })

    setEmpleados(result)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  // ── CARGAR RESUMEN ──
  useEffect(() => {
    if (tab !== 'resumen' || !empleadoSel) return
    cargarResumen()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, empleadoSel, periodoRes])

  async function cargarResumen() {
    setLoadingRes(true)
    const ahora = new Date()
    let inicio: Date

    if (periodoRes === 'semana') {
      inicio = new Date(ahora)
      inicio.setDate(ahora.getDate() - 6)
      inicio.setHours(0, 0, 0, 0)
    } else {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    }
    const fin = new Date(ahora); fin.setHours(23, 59, 59, 999)

    const { data: turnos } = await supabase
      .from('turnos').select('id, inicio, fin')
      .eq('usuario_id', empleadoSel)
      .gte('inicio', inicio.toISOString())
      .lte('inicio', fin.toISOString())
      .order('inicio')

    // Generar todos los días del período
    const dias: DiaResumen[] = []
    const cursor = new Date(inicio)
    while (cursor <= ahora) {
      const fechaStr = cursor.toISOString().split('T')[0]
      const t = (turnos ?? []).find((t: any) => t.inicio.startsWith(fechaStr)) as Turno | undefined
      dias.push({
        fecha: fechaStr,
        entrada: t?.inicio ?? null,
        salida: t?.fin ?? null,
        horas: t ? horasDecimal(t.inicio, t.fin) : 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    setDiasResumen(dias)
    setLoadingRes(false)
  }

  // ── CARGAR PROPINAS ──
  useEffect(() => {
    if (tab !== 'propinas') return
    cargarPropinas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, periodoProp])

  async function cargarPropinas() {
    setLoadingProp(true)
    const ahora = new Date()
    let inicio: Date
    if (periodoProp === 'hoy') {
      inicio = new Date(ahora.toISOString().split('T')[0] + 'T00:00:00')
    } else if (periodoProp === 'semana') {
      inicio = new Date(ahora); inicio.setDate(ahora.getDate() - 6); inicio.setHours(0,0,0,0)
    } else {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    }
    const fin = new Date(ahora); fin.setHours(23,59,59,999)

    const [{ data: cuentas }, { data: turnos }, { data: usuarios }] = await Promise.all([
      supabase.from('cuentas')
        .select('id, total, propina, cerrada_at, mesero_id')
        .eq('estado', 'cerrada').gt('propina', 0)
        .gte('cerrada_at', inicio.toISOString())
        .lte('cerrada_at', fin.toISOString())
        .order('cerrada_at', { ascending: false }),
      supabase.from('turnos')
        .select('id, usuario_id, inicio, fin')
        .gte('inicio', inicio.toISOString())
        .lte('inicio', fin.toISOString()),
      supabase.from('usuarios').select('id, nombre').eq('activo', true),
    ])

    if (!cuentas || !turnos || !usuarios) { setLoadingProp(false); return }

    const nombreMap: Record<string, string> = {}
    usuarios.forEach((u: any) => { nombreMap[u.id] = u.nombre })

    // Para cada cuenta, encontrar empleados activos en ese momento
    const detalles: PropinaCuenta[] = cuentas.map((c: any) => {
      const ts = new Date(c.cerrada_at).getTime()
      const activos = (turnos as any[]).filter(t => {
        const ini = new Date(t.inicio).getTime()
        const fin2 = t.fin ? new Date(t.fin).getTime() : Date.now()
        return ini <= ts && fin2 >= ts
      })
      const nombres = activos.map((t: any) => nombreMap[t.usuario_id] ?? '?').filter(Boolean)
      const unicos = [...new Set(nombres)]
      return {
        id: c.id,
        total: c.total,
        propina: c.propina,
        cerrada_at: c.cerrada_at,
        mesero: nombreMap[c.mesero_id] ?? '?',
        empleadosActivos: unicos,
        porPersona: unicos.length > 0 ? c.propina / unicos.length : c.propina,
      }
    })

    // Resumen por empleado
    const mapa: Record<string, ResumenEmpleado> = {}
    detalles.forEach(d => {
      d.empleadosActivos.forEach(nombre => {
        if (!mapa[nombre]) mapa[nombre] = { id: nombre, nombre, total: 0, cuentas: 0 }
        mapa[nombre].total += d.porPersona
        mapa[nombre].cuentas += 1
      })
    })
    const resumen = Object.values(mapa).sort((a, b) => b.total - a.total)

    setDetallePropinas(detalles)
    setResumenPropinas(resumen)
    setTotalPropinas(cuentas.reduce((s: number, c: any) => s + (c.propina ?? 0), 0))
    setLoadingProp(false)
  }

  function pedirToken(data: ModalData) {
    setTokenInput('')
    setTokenError('')
    setModal(data)
  }

  async function confirmarFichaje() {
    if (!modal) return
    if (tokenInput !== tokenActual) {
      setTokenError('❌ Código incorrecto — revisa el código en pantalla')
      return
    }
    setModal(null)
    const session = getSession()
    if (!session) return
    setProcesando(modal.empleadoId)
    try {
      if (modal.accion === 'abrir') {
        const res = await fetch('/api/turnos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario_id: modal.empleadoId, inicio: new Date().toISOString(), abierto_por: session.id }),
        })
        const json = await res.json()
        if (!res.ok) alert(`❌ Error: ${json.error}`)
        else setEmpleados(prev => prev.map(e =>
          e.id === modal.empleadoId ? { ...e, turno: { id: json.id, inicio: json.inicio, fin: null } } : e
        ))
      } else {
        const fin = new Date().toISOString()
        const res = await fetch('/api/turnos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: modal.turnoId, fin, cerrado_por: session.id }),
        })
        const json = await res.json()
        if (!res.ok) alert(`❌ Error: ${json.error}`)
        else setEmpleados(prev => prev.map(e =>
          e.id === modal.empleadoId ? { ...e, turno: e.turno ? { ...e.turno, fin } : null } : e
        ))
      }
    } catch (e: any) {
      alert(`❌ Excepción: ${e?.message ?? e}`)
    } finally {
      setProcesando(null)
    }
  }

  // Totales resumen
  const totalHoras = diasResumen.reduce((s, d) => s + d.horas, 0)
  const diasTrabajados = diasResumen.filter(d => d.horas > 0).length

  // Semanas para agrupar en vista mes
  function agruparPorSemana(dias: DiaResumen[]) {
    const semanas: DiaResumen[][] = []
    let semana: DiaResumen[] = []
    dias.forEach((d, i) => {
      semana.push(d)
      if (semana.length === 7 || i === dias.length - 1) {
        semanas.push(semana)
        semana = []
      }
    })
    return semanas
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🌙 Control de Turnos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Gestión de horarios del personal</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {([
          { key: 'turnos', label: '📋 Turnos del día' },
          { key: 'resumen', label: '📊 Resumen horarios' },
          { key: 'propinas', label: '💰 Propinas' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition -mb-px border border-b-0 ${
              tab === t.key
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: TURNOS ═══ */}
      {tab === 'turnos' && (
        <div className="space-y-4">
          {/* Token rotativo */}
          {esHoy && (
            <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Código para empleados · expira en {segs}s</p>
                <p className="text-4xl font-mono font-bold text-orange-400 tracking-widest">{tokenActual}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Página de fichaje</p>
                <a href="/fichar" target="_blank"
                  className="text-sm text-orange-400 underline underline-offset-2 hover:text-orange-300">
                  /fichar →
                </a>
              </div>
            </div>
          )}

          {/* Filtro fecha + stats */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="grid grid-cols-3 gap-3 flex-1">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-green-400">{empleados.filter(e => e.turno).length}</p>
                <p className="text-gray-500 text-xs">{esHoy ? 'En turno' : 'Trabajaron'}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-orange-400">
                  ${empleados.reduce((s, e) => s + e.ventas, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-gray-500 text-xs">Ventas</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-yellow-400">
                  ${empleados.reduce((s, e) => s + e.propinas, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-gray-500 text-xs">Propinas</p>
              </div>
            </div>
            <input type="date" value={fecha} max={hoy}
              onChange={e => setFecha(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {empleados.map(emp => {
                const activo = emp.turno && !emp.turno.fin
                const cerrado = emp.turno && emp.turno.fin
                const sinTurno = !emp.turno
                const cargando = procesando === emp.id

                return (
                  <div key={emp.id} className={`bg-gray-900 border rounded-2xl p-4 transition ${
                    activo ? 'border-green-500/30' : cerrado ? 'border-gray-700' : 'border-gray-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${
                        activo ? 'bg-green-500' : cerrado ? 'bg-gray-600' : 'bg-gray-700'
                      }`}>
                        {emp.nombre.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-white">{emp.nombre}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ROL_COLORES[emp.rol] ?? 'bg-gray-700 text-gray-400'}`}>
                            {ROL_LABELS[emp.rol] ?? emp.rol}
                          </span>
                          {activo && (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                              <TiempoVivo inicio={emp.turno!.inicio} />
                            </span>
                          )}
                          {cerrado && (
                            <span className="text-xs text-gray-500">{duracion(emp.turno!.inicio, emp.turno!.fin)}</span>
                          )}
                        </div>
                        {emp.turno && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Entrada: {fmt(emp.turno.inicio)}
                            {emp.turno.fin && ` · Salida: ${fmt(emp.turno.fin)}`}
                          </p>
                        )}
                        {(emp.ventas > 0 || emp.propinas > 0) && (
                          <div className="flex gap-3 mt-1 text-xs">
                            {emp.ventas > 0 && <span className="text-green-400">${emp.ventas.toFixed(0)} ventas</span>}
                            {emp.propinas > 0 && <span className="text-yellow-400">${emp.propinas.toFixed(0)} propinas</span>}
                            {emp.cuentas > 0 && <span className="text-gray-500">{emp.cuentas} cuentas</span>}
                          </div>
                        )}
                      </div>

                      {esHoy && (
                        <div className="shrink-0">
                          {sinTurno && (
                            <button onClick={() => pedirToken({ empleadoId: emp.id, nombre: emp.nombre, accion: 'abrir' })} disabled={cargando}
                              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition active:scale-95">
                              {cargando ? '...' : '▶ Abrir'}
                            </button>
                          )}
                          {activo && (
                            <button onClick={() => pedirToken({ empleadoId: emp.id, nombre: emp.nombre, accion: 'cerrar', turnoId: emp.turno!.id })} disabled={cargando}
                              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 disabled:opacity-50 text-red-400 text-sm font-medium px-4 py-2 rounded-xl transition active:scale-95">
                              {cargando ? '...' : '■ Cerrar'}
                            </button>
                          )}
                          {cerrado && <span className="text-xs text-gray-600 px-2">Finalizado</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: RESUMEN ═══ */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap items-center">
            <select
              value={empleadoSel}
              onChange={e => setEmpleadoSel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {empleadosList.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} · {ROL_LABELS[e.rol] ?? e.rol}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {(['semana', 'mes'] as const).map(p => (
                <button key={p} onClick={() => setPeriodoRes(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    periodoRes === p ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {p === 'semana' ? 'Esta semana' : 'Este mes'}
                </button>
              ))}
            </div>
          </div>

          {loadingRes ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Totales */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{totalHoras.toFixed(1)}h</p>
                  <p className="text-gray-400 text-sm">Total horas</p>
                  <p className="text-gray-600 text-xs">{periodoRes === 'semana' ? 'esta semana' : 'este mes'}</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{diasTrabajados}</p>
                  <p className="text-gray-400 text-sm">Días trabajados</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-400">
                    {diasTrabajados > 0 ? (totalHoras / diasTrabajados).toFixed(1) : '0'}h
                  </p>
                  <p className="text-gray-400 text-sm">Promedio diario</p>
                </div>
              </div>

              {/* Tabla por día */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                  <p className="font-semibold text-white text-sm">Detalle por día</p>
                  {periodoRes === 'mes' && (
                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</p>
                  )}
                </div>

                {periodoRes === 'semana' ? (
                  <div className="divide-y divide-gray-800">
                    {diasResumen.map(dia => (
                      <div key={dia.fecha} className={`px-5 py-3 flex items-center justify-between ${dia.horas > 0 ? '' : 'opacity-40'}`}>
                        <div>
                          <p className="text-white text-sm font-medium">{fmtFecha(dia.fecha)}</p>
                          {dia.entrada && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {fmt(dia.entrada)} → {dia.salida ? fmt(dia.salida) : <span className="text-green-400">en turno</span>}
                            </p>
                          )}
                          {!dia.entrada && <p className="text-xs text-gray-600">Sin registro</p>}
                        </div>
                        <div className="text-right">
                          {dia.horas > 0 ? (
                            <span className={`font-bold text-sm ${dia.horas >= 8 ? 'text-green-400' : dia.horas >= 4 ? 'text-yellow-400' : 'text-orange-400'}`}>
                              {Math.floor(dia.horas)}h {Math.round((dia.horas % 1) * 60)}m
                            </span>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="px-5 py-3 bg-gray-800/50 flex items-center justify-between">
                      <p className="font-bold text-white text-sm">Total semana</p>
                      <p className="font-bold text-green-400">{totalHoras.toFixed(1)} horas</p>
                    </div>
                  </div>
                ) : (
                  /* Vista mes: agrupado por semanas */
                  <div className="divide-y divide-gray-800">
                    {agruparPorSemana(diasResumen).map((semana, si) => {
                      const horasSemana = semana.reduce((s, d) => s + d.horas, 0)
                      return (
                        <div key={si}>
                          <div className="px-5 py-2 bg-gray-800/30">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                              Semana {si + 1} · {horasSemana.toFixed(1)}h
                            </p>
                          </div>
                          {semana.map(dia => (
                            <div key={dia.fecha} className={`px-5 py-2.5 flex items-center justify-between ${dia.horas > 0 ? '' : 'opacity-35'}`}>
                              <div className="flex items-center gap-3">
                                <p className="text-white text-sm w-32">{fmtFecha(dia.fecha)}</p>
                                {dia.entrada ? (
                                  <p className="text-xs text-gray-500">
                                    {fmt(dia.entrada)} → {dia.salida ? fmt(dia.salida) : <span className="text-green-400">activo</span>}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-700">Sin turno</p>
                                )}
                              </div>
                              <span className={`text-sm font-medium ${dia.horas >= 8 ? 'text-green-400' : dia.horas >= 4 ? 'text-yellow-400' : dia.horas > 0 ? 'text-orange-400' : 'text-gray-700'}`}>
                                {dia.horas > 0 ? `${Math.floor(dia.horas)}h ${Math.round((dia.horas % 1) * 60)}m` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                    <div className="px-5 py-3 bg-gray-800/50 flex items-center justify-between">
                      <p className="font-bold text-white text-sm">Total mes</p>
                      <p className="font-bold text-green-400">{totalHoras.toFixed(1)} horas · {diasTrabajados} días</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: PROPINAS ═══ */}
      {tab === 'propinas' && (
        <div className="space-y-4">
          {/* Filtro período */}
          <div className="flex gap-2">
            {([
              { key: 'hoy', label: 'Hoy' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'mes', label: 'Este mes' },
            ] as const).map(p => (
              <button key={p.key} onClick={() => setPeriodoProp(p.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  periodoProp === p.key ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          {loadingProp ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Resumen total */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-400">${totalPropinas.toFixed(2)}</p>
                  <p className="text-gray-400 text-sm">Total propinas</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{detallePropinas.length}</p>
                  <p className="text-gray-400 text-sm">Cuentas con propina</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{resumenPropinas.length}</p>
                  <p className="text-gray-400 text-sm">Empleados participaron</p>
                </div>
              </div>

              {/* Distribución por empleado */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800">
                  <p className="font-semibold text-white text-sm">💰 Distribución por empleado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Propina dividida entre quienes estaban activos al momento del cobro</p>
                </div>
                {resumenPropinas.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">No hay propinas registradas en este período</div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {resumenPropinas.map((e, i) => (
                      <div key={e.id} className="px-5 py-3 flex items-center gap-4">
                        <span className="text-gray-600 text-sm w-6 text-center">{i + 1}</span>
                        <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm shrink-0">
                          {e.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white text-sm">{e.nombre}</p>
                          <p className="text-xs text-gray-500">{e.cuentas} cuentas participadas</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-yellow-400 text-lg">${e.total.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">a recibir</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detalle por cuenta */}
              {detallePropinas.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-800">
                    <p className="font-semibold text-white text-sm">📋 Detalle por cuenta</p>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {detallePropinas.map(d => (
                      <div key={d.id} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-white text-sm font-medium">Cuenta cobrada</span>
                            <span className="text-gray-500 text-xs ml-2">
                              {new Date(d.cerrada_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-gray-600 text-xs ml-2">Mesero: {d.mesero}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-yellow-400 font-bold">${d.propina.toFixed(2)}</span>
                            <span className="text-gray-500 text-xs ml-1">propina</span>
                          </div>
                        </div>
                        {d.empleadosActivos.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-xs text-gray-600">÷ entre:</span>
                            {d.empleadosActivos.map(n => (
                              <span key={n} className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">
                                {n} (${d.porPersona.toFixed(2)})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-orange-400 mt-1">⚠️ Sin empleados con turno activo — propina sin asignar</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MODAL TOKEN ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm space-y-5">
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                {modal.accion === 'abrir' ? '▶ Abrir turno' : '■ Cerrar turno'}
              </p>
              <p className="text-gray-400 text-sm mt-1">{modal.nombre}</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Código activo · expira en {segs}s</p>
              <p className="text-3xl font-mono font-bold text-orange-400 tracking-widest">{tokenActual}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Ingresa el código para confirmar</label>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={tokenInput}
                onChange={e => { setTokenInput(e.target.value.replace(/\D/g, '')); setTokenError('') }}
                onKeyDown={e => e.key === 'Enter' && confirmarFichaje()}
                placeholder="000000"
                className="w-full bg-gray-800 border border-gray-700 text-white text-center text-2xl font-mono tracking-widest rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {tokenError && <p className="text-red-400 text-sm">{tokenError}</p>}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button onClick={confirmarFichaje} disabled={tokenInput.length !== 6}
                className={`flex-1 py-3 rounded-xl font-bold text-white transition disabled:opacity-40 ${modal.accion === 'abrir' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
