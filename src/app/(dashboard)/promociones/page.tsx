'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Promocion {
  id: string
  nombre: string
  descripcion: string | null
  dia_semana: string
  precio: number | null
  activa: boolean
  created_at: string
}

const DIAS = [
  { id: 'lunes', label: 'Lunes', color: 'bg-red-500' },
  { id: 'martes', label: 'Martes', color: 'bg-orange-500' },
  { id: 'miercoles', label: 'Miércoles', color: 'bg-yellow-500' },
  { id: 'jueves', label: 'Jueves', color: 'bg-green-500' },
  { id: 'viernes', label: 'Viernes', color: 'bg-blue-500' },
  { id: 'sabado', label: 'Sábado', color: 'bg-purple-500' },
  { id: 'domingo', label: 'Domingo', color: 'bg-pink-500' },
  { id: 'siempre', label: 'Siempre', color: 'bg-orange-500' },
]

const DIAS_COLORES: Record<string, string> = {
  lunes: 'border-red-500/40 bg-red-500/10',
  martes: 'border-orange-500/40 bg-orange-500/10',
  miercoles: 'border-yellow-500/40 bg-yellow-500/10',
  jueves: 'border-green-500/40 bg-green-500/10',
  viernes: 'border-blue-500/40 bg-blue-500/10',
  sabado: 'border-purple-500/40 bg-purple-500/10',
  domingo: 'border-pink-500/40 bg-pink-500/10',
  siempre: 'border-orange-500/40 bg-orange-500/10',
}

const DIAS_LABEL: Record<string, string> = Object.fromEntries(DIAS.map(d => [d.id, d.label]))

const FORM_VACIO = { nombre: '', descripcion: '', dia_semana: 'siempre', precio: '' }

export default function PromocionesPage() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

  const fetchPromociones = useCallback(async () => {
    const { data } = await supabase
      .from('promociones')
      .select('*')
      .order('dia_semana')
      .order('nombre')
    if (data) setPromociones(data as Promocion[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPromociones() }, [fetchPromociones])

  async function guardarPromocion() {
    if (!form.nombre.trim()) return
    setGuardando(true)
    await supabase.from('promociones').insert({
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      dia_semana: form.dia_semana,
      precio: form.precio ? parseFloat(form.precio) : null,
      activa: true,
    })
    setForm(FORM_VACIO)
    setMostrarForm(false)
    setGuardando(false)
    fetchPromociones()
  }

  async function eliminarPromocion(id: string) {
    await supabase.from('promociones').delete().eq('id', id)
    setConfirmarEliminar(null)
    fetchPromociones()
  }

  async function toggleActiva(promo: Promocion) {
    await supabase.from('promociones').update({ activa: !promo.activa }).eq('id', promo.id)
    fetchPromociones()
  }

  // Agrupar por día
  const porDia: Record<string, Promocion[]> = {}
  DIAS.forEach(d => { porDia[d.id] = [] })
  promociones.forEach(p => {
    if (porDia[p.dia_semana]) porDia[p.dia_semana].push(p)
  })

  const diasConPromos = DIAS.filter(d => porDia[d.id].length > 0)
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const diaHoy = diasSemana[new Date().getDay()]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🎉 Promociones del Día</h1>
          <p className="text-gray-400 text-sm">{promociones.length} promociones · {promociones.filter(p => p.activa).length} activas</p>
        </div>
        <button
          onClick={() => { setMostrarForm(true); setForm(FORM_VACIO) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition active:scale-95"
        >
          ＋ Nueva Promoción
        </button>
      </div>

      {/* Hoy highlight */}
      {porDia[diaHoy]?.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <p className="text-yellow-400 font-bold text-sm">HOY — {DIAS_LABEL[diaHoy]}</p>
          </div>
          <div className="space-y-2">
            {porDia[diaHoy].map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="text-white font-medium text-sm">{p.nombre}</span>
                  {p.descripcion && <span className="text-gray-400 text-xs ml-2">{p.descripcion}</span>}
                </div>
                {p.precio != null && <span className="text-yellow-400 font-bold">${p.precio}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista por día */}
      {diasConPromos.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-gray-400 text-lg font-medium">No hay promociones</p>
          <p className="text-gray-600 text-sm">Crea la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-4">
          {diasConPromos.map(dia => (
            <div key={dia.id} className={`border rounded-2xl overflow-hidden ${DIAS_COLORES[dia.id]}`}>
              <div className="px-4 py-3 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${dia.color}`} />
                <p className="font-bold text-white">{dia.label}</p>
                <span className="text-xs text-gray-500 ml-1">{porDia[dia.id].length} promo{porDia[dia.id].length !== 1 ? 's' : ''}</span>
                {dia.id === diaHoy && (
                  <span className="ml-auto text-xs bg-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded-full font-bold">HOY</span>
                )}
              </div>
              <div className="divide-y divide-white/5">
                {porDia[dia.id].map(promo => (
                  <div key={promo.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${promo.activa ? 'text-white' : 'text-gray-500 line-through'}`}>
                        {promo.nombre}
                      </p>
                      {promo.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{promo.descripcion}</p>
                      )}
                    </div>
                    {promo.precio != null && (
                      <span className={`font-bold text-sm whitespace-nowrap ${promo.activa ? 'text-orange-400' : 'text-gray-600'}`}>
                        ${promo.precio}
                      </span>
                    )}
                    {/* Toggle activa */}
                    <button
                      onClick={() => toggleActiva(promo)}
                      title={promo.activa ? 'Desactivar' : 'Activar'}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                        promo.activa
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-gray-800 text-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {promo.activa ? '✓' : '○'}
                    </button>
                    {/* Eliminar */}
                    <button
                      onClick={() => setConfirmarEliminar(promo.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center text-sm transition"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: nueva promoción */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-white text-lg">🎉 Nueva Promoción</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: 1 KG de Alitas"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Al precio especial del martes"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Día de la semana</label>
                <div className="grid grid-cols-4 gap-2">
                  {DIAS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setForm(f => ({ ...f, dia_semana: d.id }))}
                      className={`py-2 rounded-xl text-xs font-medium transition ${
                        form.dia_semana === d.id
                          ? `${d.color} text-white`
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Precio (opcional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={form.precio}
                    onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setMostrarForm(false); setForm(FORM_VACIO) }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPromocion}
                disabled={!form.nombre.trim() || guardando}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold transition active:scale-95"
              >
                {guardando ? 'Guardando...' : '✓ Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar eliminar */}
      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <p className="text-4xl">🗑️</p>
            <h3 className="font-bold text-white text-lg">¿Eliminar promoción?</h3>
            <p className="text-gray-400 text-sm">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarEliminar(null)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarPromocion(confirmarEliminar)}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
