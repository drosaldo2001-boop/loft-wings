'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ESTADO_MESA_CONFIG, ZONAS_MESAS } from '@/lib/constants'
import type { Database } from '@/types/database'
import type { EstadoMesa } from '@/types/database'

type Mesa = Database['public']['Tables']['mesas']['Row']

const ESTADO_ICONS: Record<EstadoMesa, string> = {
  disponible: '🟢',
  ocupada: '🔴',
  reservada: '🟡',
  limpieza: '🔵',
}

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [zonaActiva, setZonaActiva] = useState<string>('Todos')
  const [loading, setLoading] = useState(true)
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null)

  const fetchMesas = useCallback(async () => {
    const { data } = await supabase.from('mesas').select('*').order('numero')
    if (data) setMesas(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMesas()
    // Suscripción en tiempo real
    const channel = supabase
      .channel('mesas_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        fetchMesas()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchMesas])

  async function cambiarEstado(mesaId: string, nuevoEstado: EstadoMesa) {
    await supabase.from('mesas').update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', mesaId)
    setMesaSeleccionada(null)
  }

  const mesasFiltradas = mesas.filter(m =>
    zonaActiva === 'Todos' ? true : m.zona === zonaActiva
  )

  const stats = {
    disponibles: mesas.filter(m => m.estado === 'disponible').length,
    ocupadas: mesas.filter(m => m.estado === 'ocupada').length,
    reservadas: mesas.filter(m => m.estado === 'reservada').length,
    limpieza: mesas.filter(m => m.estado === 'limpieza').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Control de Mesas</h1>
          <p className="text-gray-400 text-sm mt-0.5">Vista en tiempo real · {mesas.length} mesas totales</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          En vivo
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Disponibles', count: stats.disponibles, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Ocupadas', count: stats.ocupadas, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Reservadas', count: stats.reservadas, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
          { label: 'Limpieza', count: stats.limpieza, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-gray-400 text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtro por zona */}
      <div className="flex gap-2 flex-wrap">
        {['Todos', ...ZONAS_MESAS].map((zona) => (
          <button
            key={zona}
            onClick={() => setZonaActiva(zona)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              zonaActiva === zona
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {zona}
          </button>
        ))}
      </div>

      {/* Grid de mesas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {mesasFiltradas.map((mesa) => {
          const config = ESTADO_MESA_CONFIG[mesa.estado as EstadoMesa]
          return (
            <button
              key={mesa.id}
              onClick={() => setMesaSeleccionada(mesa)}
              className={`
                relative p-4 rounded-2xl border-2 transition-all duration-200 text-left
                hover:scale-105 hover:shadow-lg active:scale-95
                ${mesa.estado === 'disponible' ? 'bg-gray-900 border-green-500/40 hover:border-green-500' : ''}
                ${mesa.estado === 'ocupada' ? 'bg-red-500/10 border-red-500/40 hover:border-red-500' : ''}
                ${mesa.estado === 'reservada' ? 'bg-yellow-500/10 border-yellow-500/40 hover:border-yellow-500' : ''}
                ${mesa.estado === 'limpieza' ? 'bg-blue-500/10 border-blue-500/40 hover:border-blue-500' : ''}
              `}
            >
              <div className="text-2xl mb-2">{ESTADO_ICONS[mesa.estado as EstadoMesa]}</div>
              <p className="font-bold text-white text-sm">{mesa.nombre}</p>
              <p className="text-xs text-gray-500">{mesa.zona}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(mesa as any).num_personas > 0 ? `👥 ${(mesa as any).num_personas}` : `${mesa.capacidad} cap.`}
              </p>
              <div className={`mt-2 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${config.text} bg-current/10`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.color} mr-1`} />
                {config.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Modal cambio de estado */}
      {mesaSeleccionada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{mesaSeleccionada.nombre}</h3>
              <button onClick={() => setMesaSeleccionada(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {mesaSeleccionada.zona} · {mesaSeleccionada.capacidad} personas
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Cambiar estado</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ESTADO_MESA_CONFIG) as [EstadoMesa, typeof ESTADO_MESA_CONFIG[EstadoMesa]][]).map(([estado, cfg]) => (
                <button
                  key={estado}
                  onClick={() => cambiarEstado(mesaSeleccionada.id, estado)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition text-sm font-medium
                    ${mesaSeleccionada.estado === estado
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                    }
                  `}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
