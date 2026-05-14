'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Empleado {
  id: string
  nombre: string
  rol: string
  turno: { id: string; inicio: string } | null
}

export default function FicharPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [empleadoId, setEmpleadoId] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    cargarEmpleados()
  }, [])

  async function cargarEmpleados() {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString()

    const { data: usuarios } = await supabase
      .from('usuarios').select('id, nombre, rol')
      .not('rol', 'in', '("admin","gerente")')
      .eq('activo', true).order('nombre')

    if (!usuarios) return

    const { data: turnos } = await supabase
      .from('turnos').select('id, usuario_id, inicio')
      .in('usuario_id', usuarios.map(u => u.id))
      .gte('inicio', inicio).lt('inicio', fin).is('fin', null)

    setEmpleados(usuarios.map(u => ({
      ...u,
      turno: (turnos ?? []).find((t: any) => t.usuario_id === u.id) ?? null,
    })))
    if (usuarios.length > 0) setEmpleadoId(usuarios[0].id)
  }

  const empleadoSel = empleados.find(e => e.id === empleadoId)
  const tieneturno = !!empleadoSel?.turno

  async function fichar() {
    if (!empleadoId || !token) return
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/fichar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empleadoId,
          token,
          accion: tieneturno ? 'salida' : 'entrada',
          turno_id: empleadoSel?.turno?.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg({ tipo: 'error', texto: json.error })
      } else {
        setMsg({ tipo: 'ok', texto: tieneturno ? '✅ Salida registrada' : '✅ Entrada registrada' })
        setToken('')
        await cargarEmpleados()
      }
    } catch (e: any) {
      setMsg({ tipo: 'error', texto: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/20">
            <span className="text-3xl">🍗</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Loft Wings</h1>
          <p className="text-gray-400 text-sm mt-1">Registro de asistencia</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          {/* Empleado */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">¿Quién eres?</label>
            <select
              value={empleadoId}
              onChange={e => setEmpleadoId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {empleados.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
            {empleadoSel && (
              <p className={`text-xs px-3 py-1.5 rounded-lg ${tieneturno ? 'bg-green-500/10 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                {tieneturno
                  ? `🟢 Entrada registrada a las ${new Date(empleadoSel.turno!.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                  : '⚪ Sin entrada hoy'}
              </p>
            )}
          </div>

          {/* Token */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">Código del administrador</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-gray-800 border border-gray-700 text-white text-center text-2xl font-mono tracking-widest rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Mensaje */}
          {msg && (
            <div className={`text-sm text-center px-4 py-3 rounded-xl font-medium ${
              msg.tipo === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {msg.texto}
            </div>
          )}

          {/* Botón */}
          <button
            onClick={fichar}
            disabled={loading || token.length !== 6}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg transition active:scale-95 disabled:opacity-50 ${
              tieneturno ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {loading ? '...' : tieneturno ? '🚪 Registrar Salida' : '✅ Registrar Entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}
