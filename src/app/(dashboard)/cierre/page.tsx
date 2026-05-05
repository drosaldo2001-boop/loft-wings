'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

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
  const [tab, setTab] = useState<'turnos' | 'resumen'>('turnos')

  // ── TAB TURNOS ──
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])

  // ── TAB RESUMEN ──
  const [empleadosList, setEmpleadosList] = useState<{ id: string; nombre: string; rol: string }[]>([])
  const [empleadoSel, setEmpleadoSel] = useState<string>('')
  const [periodoRes, setPeriodoRes] = useState<'semana' | 'mes'>('semana')
  const [diasResumen, setDiasResumen] = useState<DiaResumen[]>([])
  const [loadingRes, setLoadingRes] = useState(false)

  const hoy = new Date().toISOString().split('T')[0]
  const esHoy = fecha === hoy

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
    const [{ data: turnos }, { data: cuentas }] = await Promise.all([
      supabase.from('turnos').select('id, usuario_id, inicio, fin')
        .in('usuario_id', ids)
        .gte('inicio', dia.toISOString())
        .lt('inicio', siguiente.toISOString()),
      supabase.from('cuentas').select('total, propina, mesero_id')
        .eq('estado', 'cerrada').in('mesero_id', ids)
        .gte('cerrada_at', dia.toISOString())
        .lt('cerrada_at', siguiente.toISOString()),
    ])

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

  async function abrirTurno(empleadoId: string) {
    if (!admin) return
    setProcesando(empleadoId)
    await supabase.from('turnos').insert({
      usuario_id: empleadoId,
      inicio: new Date().toISOString(),
      abierto_por: admin.id,
    })
    await cargar()
    setProcesando(null)
  }

  async function cerrarTurno(turnoId: string, empleadoId: string) {
    if (!admin) return
    setProcesando(empleadoId)
    await supabase.from('turnos').update({
      fin: new Date().toISOString(),
      cerrado_por: admin.id,
    }).eq('id', turnoId)
    await cargar()
    setProcesando(null)
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
        {(['turnos', 'resumen'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition -mb-px border border-b-0 ${
              tab === t
                ? 'bg-gray-900 border-gray-700 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'turnos' ? '📋 Turnos del día' : '📊 Resumen horarios'}
          </button>
        ))}
      </div>

      {/* ═══ TAB: TURNOS ═══ */}
      {tab === 'turnos' && (
        <div className="space-y-4">
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
                              {duracion(emp.turno!.inicio)}
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
                            <button onClick={() => abrirTurno(emp.id)} disabled={cargando}
                              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition active:scale-95">
                              {cargando ? '...' : '▶ Abrir'}
                            </button>
                          )}
                          {activo && (
                            <button onClick={() => cerrarTurno(emp.turno!.id, emp.id)} disabled={cargando}
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
    </div>
  )
}
