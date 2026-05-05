'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

interface ResumenMesero {
  cuentas: number
  ventas: number
  propinas: number
  descuentos: number
}

interface CuentaAbierta {
  id: string
  nombre_cuenta: string | null
  total: number
  created_at: string
  mesas: { nombre: string } | null
}

interface PedidoPendiente {
  id: string
  cantidad: number
  estado: string
  productos: { nombre: string } | null
  cuentas: { mesas: { nombre: string } | null } | null
}

export default function CierrePage() {
  const user = getSession()
  const [resumen, setResumen] = useState<ResumenMesero>({ cuentas: 0, ventas: 0, propinas: 0, descuentos: 0 })
  const [cuentasAbiertas, setCuentasAbiertas] = useState<CuentaAbierta[]>([])
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [cerrando, setCerrando] = useState(false)
  const [cerrado, setCerrado] = useState(false)

  const fetchDatos = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)

    const esAdmin = user.rol === 'admin' || user.rol === 'gerente'
    const esMesero = user.rol === 'mesero' || esAdmin || user.rol === 'cajero'
    const esCocina = user.rol === 'cocina' || esAdmin

    if (esMesero) {
      const qResumen = esAdmin
        ? supabase.from('cuentas').select('total, propina, descuento').eq('estado', 'cerrada').gte('cerrada_at', hoy.toISOString()).lt('cerrada_at', manana.toISOString())
        : supabase.from('cuentas').select('total, propina, descuento').eq('estado', 'cerrada').eq('mesero_id', user.id).gte('cerrada_at', hoy.toISOString()).lt('cerrada_at', manana.toISOString())
      const qAbiertas = esAdmin
        ? supabase.from('cuentas').select('id, nombre_cuenta, total, created_at, mesas!cuentas_mesa_id_fkey(nombre)').eq('estado', 'abierta').order('created_at')
        : supabase.from('cuentas').select('id, nombre_cuenta, total, created_at, mesas!cuentas_mesa_id_fkey(nombre)').eq('estado', 'abierta').eq('mesero_id', user.id).order('created_at')

      const [{ data: cuentasHoy }, { data: abiertas }] = await Promise.all([qResumen, qAbiertas])
      setResumen({
        cuentas: cuentasHoy?.length ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ventas: (cuentasHoy ?? []).reduce((s: number, c: any) => s + (c.total ?? 0), 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        propinas: (cuentasHoy ?? []).reduce((s: number, c: any) => s + (c.propina ?? 0), 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        descuentos: (cuentasHoy ?? []).reduce((s: number, c: any) => s + (c.descuento ?? 0), 0),
      })
      setCuentasAbiertas((abiertas ?? []) as CuentaAbierta[])
    }

    if (esCocina) {
      const { data: pendientes } = await supabase
        .from('pedidos')
        .select('id, cantidad, estado, productos!pedidos_producto_id_fkey(nombre), cuentas!pedidos_cuenta_id_fkey(mesas!cuentas_mesa_id_fkey(nombre))')
        .in('estado', ['nuevo', 'en_preparacion'])
        .order('created_at')
      setPedidosPendientes((pendientes ?? []) as PedidoPendiente[])
    }

    setLoading(false)
  }, [user])

  useEffect(() => { fetchDatos() }, [fetchDatos])

  async function cerrarTurno() {
    if (!user) return
    if (!window.confirm('¿Confirmar cierre de turno? Esto marcará todas las mesas en limpieza como disponibles.')) return
    setCerrando(true)

    // Marcar mesas en limpieza → disponible
    await supabase.from('mesas').update({ estado: 'disponible' }).eq('estado', 'limpieza')

    // Cocina: marcar pedidos "nuevo" sin inicio como cancelado si llevan más de 3 horas
    if (user.rol === 'cocina' || user.rol === 'admin' || user.rol === 'gerente') {
      const hace3h = new Date(Date.now() - 3 * 60 * 60 * 1000)
      await supabase.from('pedidos')
        .update({ estado: 'cancelado' })
        .eq('estado', 'nuevo')
        .lt('created_at', hace3h.toISOString())
    }

    setCerrando(false)
    setCerrado(true)
    fetchDatos()
  }

  const esMeseroView = user?.rol === 'mesero' || user?.rol === 'admin' || user?.rol === 'gerente' || user?.rol === 'cajero'
  const esCocinaView = user?.rol === 'cocina' || user?.rol === 'admin' || user?.rol === 'gerente'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🌙 Cierre del Día</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          {user && <span className="text-orange-400"> · {user.nombre}</span>}
        </p>
      </div>

      {/* Resumen mesero */}
      {esMeseroView && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Resumen de tu turno hoy</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <p className="text-2xl font-bold text-green-400">${resumen.ventas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
              <p className="text-gray-400 text-sm">Ventas cobradas</p>
              <p className="text-gray-600 text-xs">{resumen.cuentas} cuentas</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
              <p className="text-2xl font-bold text-yellow-400">${resumen.propinas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
              <p className="text-gray-400 text-sm">Propinas</p>
              <p className="text-gray-600 text-xs">
                {resumen.ventas > 0 ? `${((resumen.propinas / resumen.ventas) * 100).toFixed(1)}% promedio` : '—'}
              </p>
            </div>
            {resumen.descuentos > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <p className="text-2xl font-bold text-red-400">-${resumen.descuentos.toFixed(0)}</p>
                <p className="text-gray-400 text-sm">Descuentos</p>
              </div>
            )}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
              <p className="text-2xl font-bold text-purple-400">
                ${resumen.cuentas > 0 ? (resumen.ventas / resumen.cuentas).toFixed(0) : '0'}
              </p>
              <p className="text-gray-400 text-sm">Ticket promedio</p>
            </div>
          </div>
        </div>
      )}

      {/* Cuentas abiertas */}
      {esMeseroView && cuentasAbiertas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Cuentas todavía abiertas</p>
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">{cuentasAbiertas.length}</span>
          </div>
          <div className="space-y-2">
            {cuentasAbiertas.map(c => (
              <div key={c.id} className="bg-gray-900 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{c.mesas?.nombre ?? 'Sin mesa'}</p>
                  {c.nombre_cuenta && <p className="text-xs text-orange-400">{c.nombre_cuenta}</p>}
                  <p className="text-xs text-gray-500">Abierta {new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <p className="text-orange-400 font-bold">${(c.total ?? 0).toFixed(0)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-500">⚠️ Cierra o cobra estas cuentas antes de terminar tu turno</p>
        </div>
      )}

      {esMeseroView && cuentasAbiertas.length === 0 && resumen.cuentas > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-medium">Todas tus cuentas están cerradas</p>
        </div>
      )}

      {/* Pedidos pendientes cocina */}
      {esCocinaView && pedidosPendientes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Pedidos pendientes en cocina</p>
            <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-bold">{pedidosPendientes.length}</span>
          </div>
          <div className="space-y-2">
            {pedidosPendientes.map(p => (
              <div key={p.id} className="bg-gray-900 border border-yellow-500/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{p.productos?.nombre ?? 'Producto'}</p>
                  <p className="text-xs text-gray-500">{(p.cuentas as any)?.mesas?.nombre ?? 'Sin mesa'}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">×{p.cantidad}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.estado === 'nuevo' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {p.estado === 'nuevo' ? 'Nuevo' : 'En prep.'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {esCocinaView && pedidosPendientes.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-medium">Sin pedidos pendientes en cocina</p>
        </div>
      )}

      {/* Botón cerrar turno */}
      {!cerrado ? (
        <button
          onClick={cerrarTurno}
          disabled={cerrando}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-orange-500/20 active:scale-95 transition disabled:opacity-50"
        >
          {cerrando ? 'Cerrando turno...' : '🌙 Cerrar Turno del Día'}
        </button>
      ) : (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-2">
          <p className="text-4xl">🌙</p>
          <p className="text-xl font-bold text-green-400">¡Buen trabajo hoy!</p>
          <p className="text-gray-400 text-sm">Turno cerrado correctamente</p>
          {resumen.propinas > 0 && (
            <p className="text-yellow-400 font-medium">Propinas del día: ${resumen.propinas.toFixed(2)}</p>
          )}
        </div>
      )}
    </div>
  )
}
