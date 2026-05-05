'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

interface CuentaAbierta {
  id: string
  nombre_cuenta: string | null
  total: number
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mesas: any
}

interface PedidoPendiente {
  id: string
  cantidad: number
  estado: string
  notas: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productos: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cuentas: any
}

export default function CierrePage() {
  const user = getSession()
  const [ventas, setVentas] = useState(0)
  const [propinas, setPropinas] = useState(0)
  const [cuentasCerradas, setCuentasCerradas] = useState(0)
  const [cuentasAbiertas, setCuentasAbiertas] = useState<CuentaAbierta[]>([])
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [cerrando, setCerrando] = useState(false)
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    if (!user) return

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)
    const esAdmin = user.rol === 'admin' || user.rol === 'gerente'
    const esMesero = user.rol === 'mesero' || user.rol === 'cajero' || esAdmin
    const esCocina = user.rol === 'cocina' || esAdmin

    async function cargar() {
      setLoading(true)
      try {
        if (esMesero) {
          const baseResumen = supabase.from('cuentas').select('total, propina')
            .eq('estado', 'cerrada')
            .gte('cerrada_at', hoy.toISOString())
            .lt('cerrada_at', manana.toISOString())
          const qResumen = esAdmin ? baseResumen : baseResumen.eq('mesero_id', user!.id)

          const baseAbiertas = supabase.from('cuentas')
            .select('id, nombre_cuenta, total, created_at, mesas!cuentas_mesa_id_fkey(nombre)')
            .eq('estado', 'abierta').order('created_at')
          const qAbiertas = esAdmin ? baseAbiertas : baseAbiertas.eq('mesero_id', user!.id)

          const [{ data: res }, { data: ab }] = await Promise.all([qResumen, qAbiertas])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setVentas((res ?? []).reduce((s: number, c: any) => s + (c.total ?? 0), 0))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPropinas((res ?? []).reduce((s: number, c: any) => s + (c.propina ?? 0), 0))
          setCuentasCerradas(res?.length ?? 0)
          setCuentasAbiertas((ab ?? []) as unknown as CuentaAbierta[])
        }

        if (esCocina) {
          const { data: pend } = await supabase
            .from('pedidos')
            .select('id, cantidad, estado, notas, productos!pedidos_producto_id_fkey(nombre), cuentas!pedidos_cuenta_id_fkey(mesas!cuentas_mesa_id_fkey(nombre))')
            .in('estado', ['nuevo', 'en_preparacion'])
            .order('created_at')
          setPedidosPendientes((pend ?? []) as unknown as PedidoPendiente[])
        }
      } finally {
        setLoading(false)
      }
    }

    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cerrarTurno() {
    if (!window.confirm('¿Confirmar cierre de turno? Las mesas en limpieza pasarán a disponibles.')) return
    setCerrando(true)
    await supabase.from('mesas').update({ estado: 'disponible' }).eq('estado', 'limpieza')
    setCerrando(false)
    setCerrado(true)
  }

  const ticketProm = cuentasCerradas > 0 ? ventas / cuentasCerradas : 0
  const esMeseroView = user?.rol === 'mesero' || user?.rol === 'cajero' || user?.rol === 'admin' || user?.rol === 'gerente'
  const esCocinaView = user?.rol === 'cocina' || user?.rol === 'admin' || user?.rol === 'gerente'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">🌙 Cierre del Día</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          {user && <span className="text-orange-400"> · {user.nombre}</span>}
        </p>
      </div>

      {/* Resumen ventas */}
      {esMeseroView && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <p className="text-xl font-bold text-green-400">${ventas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
            <p className="text-gray-400 text-xs mt-1">Ventas hoy</p>
            <p className="text-gray-600 text-xs">{cuentasCerradas} cuentas</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
            <p className="text-xl font-bold text-yellow-400">${propinas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
            <p className="text-gray-400 text-xs mt-1">Propinas</p>
            <p className="text-gray-600 text-xs">
              {ventas > 0 ? `${((propinas / ventas) * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
            <p className="text-xl font-bold text-purple-400">${ticketProm.toFixed(0)}</p>
            <p className="text-gray-400 text-xs mt-1">Ticket prom.</p>
          </div>
        </div>
      )}

      {/* Cuentas abiertas */}
      {esMeseroView && cuentasAbiertas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Cuentas abiertas pendientes</p>
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">{cuentasAbiertas.length}</span>
          </div>
          {cuentasAbiertas.map(c => (
            <div key={c.id} className="bg-gray-900 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-sm">{c.mesas?.nombre ?? c.mesas?.[0]?.nombre ?? 'Sin mesa'}</p>
                {c.nombre_cuenta && <p className="text-xs text-orange-400">{c.nombre_cuenta}</p>}
                <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <p className="text-orange-400 font-bold">${(c.total ?? 0).toFixed(0)}</p>
            </div>
          ))}
          <p className="text-xs text-yellow-500">⚠️ Cierra estas cuentas antes de terminar el turno</p>
        </div>
      )}

      {esMeseroView && cuentasAbiertas.length === 0 && cuentasCerradas > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-medium text-sm">Todas las cuentas están cerradas</p>
        </div>
      )}

      {/* Pedidos pendientes cocina */}
      {esCocinaView && pedidosPendientes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Pedidos pendientes en cocina</p>
            <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-bold">{pedidosPendientes.length}</span>
          </div>
          {pedidosPendientes.map(p => (
            <div key={p.id} className="bg-gray-900 border border-yellow-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-sm">{p.productos?.nombre ?? p.notas ?? 'Producto'}</p>
                <p className="text-xs text-gray-500">{p.cuentas?.mesas?.nombre ?? p.cuentas?.mesas?.[0]?.nombre ?? 'Sin mesa'}</p>
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
      )}

      {esCocinaView && pedidosPendientes.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-medium text-sm">Sin pedidos pendientes en cocina</p>
        </div>
      )}

      {/* Botón cerrar turno */}
      {!cerrado ? (
        <button
          onClick={cerrarTurno}
          disabled={cerrando}
          className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 rounded-xl text-base shadow-lg shadow-orange-500/20 active:scale-95 transition disabled:opacity-50"
        >
          {cerrando ? 'Cerrando...' : '🌙 Cerrar Turno del Día'}
        </button>
      ) : (
        <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-6 text-center space-y-2">
          <p className="text-4xl">🌙</p>
          <p className="text-xl font-bold text-green-400">¡Buen trabajo hoy!</p>
          <p className="text-gray-400 text-sm">Turno cerrado correctamente</p>
          {propinas > 0 && <p className="text-yellow-400 font-medium">Propinas del día: ${propinas.toFixed(2)}</p>}
        </div>
      )}
    </div>
  )
}
