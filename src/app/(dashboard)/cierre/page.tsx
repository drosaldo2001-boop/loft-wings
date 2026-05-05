'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

interface Empleado {
  id: string
  nombre: string
  rol: string
  turno: {
    id: string
    inicio: string
    fin: string | null
  } | null
  ventas: number
  propinas: number
  cuentas: number
  pedidos: number
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

export default function CierrePage() {
  const admin = getSession()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  async function cargar() {
    setLoading(true)
    const dia = new Date(fecha + 'T00:00:00')
    const siguiente = new Date(dia); siguiente.setDate(siguiente.getDate() + 1)

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre, rol')
      .eq('activo', true)
      .not('rol', 'in', '("admin","gerente")')
      .order('nombre')

    if (!usuarios) { setLoading(false); return }

    const ids = usuarios.map(u => u.id)

    const [{ data: turnos }, { data: cuentas }, { data: pedidos }] = await Promise.all([
      supabase.from('turnos').select('id, usuario_id, inicio, fin')
        .in('usuario_id', ids)
        .gte('inicio', dia.toISOString())
        .lt('inicio', siguiente.toISOString()),
      supabase.from('cuentas').select('total, propina, mesero_id')
        .eq('estado', 'cerrada')
        .in('mesero_id', ids)
        .gte('cerrada_at', dia.toISOString())
        .lt('cerrada_at', siguiente.toISOString()),
      supabase.from('pedidos').select('id, cuenta_id')
        .in('estado', ['entregado', 'listo'])
        .gte('created_at', dia.toISOString())
        .lt('created_at', siguiente.toISOString()),
    ])

    const result: Empleado[] = usuarios.map(u => {
      const turno = (turnos ?? []).find((t: any) => t.usuario_id === u.id) ?? null
      const misCuentas = (cuentas ?? []).filter((c: any) => c.mesero_id === u.id)
      return {
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
        turno: turno ? { id: turno.id, inicio: turno.inicio, fin: turno.fin } : null,
        ventas: misCuentas.reduce((s: number, c: any) => s + (c.total ?? 0), 0),
        propinas: misCuentas.reduce((s: number, c: any) => s + (c.propina ?? 0), 0),
        cuentas: misCuentas.length,
        pedidos: pedidos?.length ?? 0,
      }
    })

    setEmpleados(result)
    setLoading(false)
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

  const hoy = new Date().toISOString().split('T')[0]
  const esHoy = fecha === hoy

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🌙 Control de Turnos</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gestión de entradas y salidas del personal</p>
        </div>
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={e => setFecha(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Resumen del día */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{empleados.filter(e => e.turno).length}</p>
            <p className="text-gray-400 text-xs mt-1">{esHoy ? 'Con turno abierto' : 'Trabajaron'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">
              ${empleados.reduce((s, e) => s + e.ventas, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-gray-400 text-xs mt-1">Ventas del día</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">
              ${empleados.reduce((s, e) => s + e.propinas, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-gray-400 text-xs mt-1">Propinas totales</p>
          </div>
        </div>
      )}

      {/* Lista de empleados */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : empleados.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No hay empleados registrados</p>
      ) : (
        <div className="space-y-3">
          {empleados.map(emp => {
            const activo = emp.turno && !emp.turno.fin
            const cerrado = emp.turno && emp.turno.fin
            const sinTurno = !emp.turno
            const cargando = procesando === emp.id

            return (
              <div
                key={emp.id}
                className={`bg-gray-900 border rounded-2xl p-4 transition ${
                  activo ? 'border-green-500/30' : cerrado ? 'border-gray-700' : 'border-gray-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${
                    activo ? 'bg-green-500' : cerrado ? 'bg-gray-600' : 'bg-gray-700'
                  }`}>
                    {emp.nombre.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white">{emp.nombre}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROL_COLORES[emp.rol] ?? 'bg-gray-700 text-gray-400'}`}>
                        {ROL_LABELS[emp.rol] ?? emp.rol}
                      </span>
                      {activo && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          En turno · {duracion(emp.turno!.inicio)}
                        </span>
                      )}
                      {cerrado && (
                        <span className="text-xs text-gray-500">
                          {duracion(emp.turno!.inicio, emp.turno!.fin)} trabajados
                        </span>
                      )}
                    </div>

                    {/* Horario */}
                    {emp.turno && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Entrada: {new Date(emp.turno.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        {emp.turno.fin && (
                          <span> · Salida: {new Date(emp.turno.fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </p>
                    )}

                    {/* Stats */}
                    {(emp.ventas > 0 || emp.propinas > 0) && (
                      <div className="flex gap-3 mt-1 text-xs">
                        {emp.ventas > 0 && <span className="text-green-400">${emp.ventas.toFixed(0)} ventas</span>}
                        {emp.propinas > 0 && <span className="text-yellow-400">${emp.propinas.toFixed(0)} propinas</span>}
                        {emp.cuentas > 0 && <span className="text-gray-500">{emp.cuentas} cuentas</span>}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {esHoy && (
                    <div className="shrink-0">
                      {sinTurno && (
                        <button
                          onClick={() => abrirTurno(emp.id)}
                          disabled={cargando}
                          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition active:scale-95"
                        >
                          {cargando ? '...' : '▶ Abrir'}
                        </button>
                      )}
                      {activo && (
                        <button
                          onClick={() => cerrarTurno(emp.turno!.id, emp.id)}
                          disabled={cargando}
                          className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 disabled:opacity-50 text-red-400 text-sm font-medium px-4 py-2 rounded-xl transition active:scale-95"
                        >
                          {cargando ? '...' : '■ Cerrar'}
                        </button>
                      )}
                      {cerrado && (
                        <span className="text-xs text-gray-600 px-2">Finalizado</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
