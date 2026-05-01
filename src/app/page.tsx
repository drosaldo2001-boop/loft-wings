'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, setSession } from '@/lib/auth'
import { ROL_ROUTES } from '@/lib/routes'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login(username, password)
      setSession(user)
      router.push(ROL_ROUTES[user.rol] ?? '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Fondo con patrón */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 mb-4 shadow-2xl shadow-orange-500/30">
            <span className="text-4xl">🍗</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Loft Wings</h1>
          <p className="text-gray-400 mt-1">Sistema de Gestión</p>
        </div>

        {/* Card de login */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Iniciar Sesión</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre de usuario"
                required
                autoComplete="username"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/20 mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {/* Accesos rápidos demo */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center mb-3">Accesos de demostración</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', user: 'admin', pass: 'admin123', color: 'bg-purple-600/20 text-purple-400 border-purple-600/30' },
                { label: 'Gerente', user: 'gerente', pass: 'gerente123', color: 'bg-blue-600/20 text-blue-400 border-blue-600/30' },
                { label: 'Mesero', user: 'mesero1', pass: 'mesero123', color: 'bg-orange-600/20 text-orange-400 border-orange-600/30' },
                { label: 'Cocina', user: 'cocina', pass: 'cocina123', color: 'bg-red-600/20 text-red-400 border-red-600/30' },
              ].map((demo) => (
                <button
                  key={demo.user}
                  type="button"
                  onClick={() => { setUsername(demo.user); setPassword(demo.pass) }}
                  className={`text-xs font-medium px-3 py-2 rounded-lg border transition ${demo.color}`}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Loft Wings © {new Date().getFullYear()} — Powered by Claude AI
        </p>
      </div>
    </div>
  )
}
