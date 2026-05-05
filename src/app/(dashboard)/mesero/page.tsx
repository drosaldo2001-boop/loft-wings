'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { CATEGORIAS, SALSAS_ALITAS } from '@/lib/constants'
import type { Database, EstadoPedido } from '@/types/database'

type Mesa = Database['public']['Tables']['mesas']['Row']
type Producto = Database['public']['Tables']['productos']['Row']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cuenta = any

type PedidoItem = { producto: Producto; cantidad: number; notas: string; modificaciones: string[] }
type Vista = 'mesas' | 'abrirMesa' | 'selCuenta' | 'menu' | 'carrito' | 'ia' | 'resumen'

interface Promocion {
  id: string
  nombre: string
  descripcion: string | null
  dia_semana: string
  precio: number | null
  activa: boolean
}

interface MensajeIA { role: 'user' | 'assistant'; content: string }

interface PedidoEstado {
  id: string
  cantidad: number
  estado: string
  notas: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  productos: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cuentas: any
}

export default function MeseroPage() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [mesaActiva, setMesaActiva] = useState<Mesa | null>(null)
  const [cuentaActiva, setCuentaActiva] = useState<Cuenta | null>(null)
  const [cuentasEnMesa, setCuentasEnMesa] = useState<Cuenta[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState<string>('alitas')
  const [carrito, setCarrito] = useState<PedidoItem[]>([])
  const [vista, setVista] = useState<Vista>('mesas')
  const [nombreCuenta, setNombreCuenta] = useState('')
  const [numPersonas, setNumPersonas] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [modalSalsas, setModalSalsas] = useState<{ producto: Producto; maxSalsas: number } | null>(null)
  const [salsasSeleccionadas, setSalsasSeleccionadas] = useState<string[]>([])
  const [pedidosActivos, setPedidosActivos] = useState<PedidoEstado[]>([])
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [promociones, setPromociones] = useState<Promocion[]>([])

  const [mensajesIA, setMensajesIA] = useState<MensajeIA[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente IA. Puedo ayudarte con recomendaciones del menú, información sobre alérgenos y mucho más. ¿En qué te ayudo?' }
  ])
  const [inputIA, setInputIA] = useState('')
  const [cargandoIA, setCargandoIA] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const user = getSession()

  const fetchData = useCallback(async () => {
    const [{ data: mesasData }, { data: productosData }, { data: promoData }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('productos').select('*').eq('activo', true).order('categoria'),
      supabase.from('promociones').select('*').eq('activa', true).order('dia_semana'),
    ])
    if (mesasData) setMesas(mesasData)
    if (productosData) setProductos(productosData)
    if (promoData) setPromociones(promoData as Promocion[])
  }, [])

  const fetchResumen = useCallback(async () => {
    setCargandoResumen(true)
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, cantidad, estado, notas,
        productos!pedidos_producto_id_fkey (nombre),
        cuentas!pedidos_cuenta_id_fkey (nombre_cuenta, mesas!cuentas_mesa_id_fkey (nombre))
      `)
      .in('estado', ['nuevo', 'en_preparacion', 'listo', 'entregado'])
      .order('created_at', { ascending: true })
    if (error) console.error('Resumen error:', error.message)
    if (data) setPedidosActivos(data as unknown as PedidoEstado[])
    setCargandoResumen(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajesIA])

  useEffect(() => {
    if (vista !== 'resumen') return
    fetchResumen()
    const channel = supabase.channel('mesero_resumen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchResumen)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [vista, fetchResumen])

  async function seleccionarMesa(mesa: Mesa) {
    setMesaActiva(mesa)
    if (mesa.estado === 'disponible') {
      setNombreCuenta('')
      setNumPersonas(1)
      setVista('abrirMesa')
    } else if (mesa.estado === 'ocupada') {
      const { data: cuentas } = await supabase
        .from('cuentas')
        .select('*')
        .eq('mesa_id', mesa.id)
        .eq('estado', 'abierta')
        .order('created_at')
      setCuentasEnMesa(cuentas ?? [])
      setNombreCuenta('')
      setVista('selCuenta')
    }
  }

  async function abrirMesa() {
    if (!mesaActiva || !user) return
    setCargando(true)
    const nombreFinal = nombreCuenta.trim() || 'Cuenta 1'

    const { data: cuenta, error: errCuenta } = await supabase.from('cuentas').insert({
      mesa_id: mesaActiva.id,
      mesero_id: user.id,
      nombre_cuenta: nombreFinal,
      subtotal: 0,
      impuesto: 0,
      total: 0,
      plataforma: 'local',
      num_personas: numPersonas,
    }).select().single()

    if (errCuenta || !cuenta) {
      alert(`❌ Error al abrir mesa: ${errCuenta?.message}`)
      setCargando(false)
      return
    }

    await supabase.from('mesas').update({
      estado: 'ocupada',
      mesero_id: user.id,
      cuenta_id: cuenta.id,
      num_personas: numPersonas,
    }).eq('id', mesaActiva.id)

    setCuentaActiva(cuenta)
    setMesaActiva(prev => prev ? { ...prev, estado: 'ocupada' } : prev)
    setNombreCuenta('')
    setCargando(false)
    setVista('menu')
    fetchData()
  }

  async function seleccionarCuenta(cuenta: Cuenta) {
    setCuentaActiva(cuenta)
    setVista('menu')
  }

  async function crearNuevaCuenta() {
    if (!mesaActiva || !user) return
    setCargando(true)
    const num = cuentasEnMesa.length + 1
    const nombreFinal = nombreCuenta.trim() || `Cuenta ${num}`

    const { data: cuenta } = await supabase.from('cuentas').insert({
      mesa_id: mesaActiva.id,
      mesero_id: user.id,
      nombre_cuenta: nombreFinal,
      subtotal: 0,
      impuesto: 0,
      total: 0,
      plataforma: 'local',
      num_personas: numPersonas,
    }).select().single()

    if (cuenta) {
      setCuentaActiva(cuenta)
      setNombreCuenta('')
      setNumPersonas(1)
      setVista('menu')
    }
    setCargando(false)
  }

  function maxSalsasParaProducto(nombre: string): number {
    if (nombre.includes('10 pz')) return 1
    if (nombre.includes('20 pz')) return 3
    if (nombre.includes('30 pz') || nombre.includes('40 pz') || nombre.includes('50 pz')) return 4
    if (nombre.includes('250 gr')) return 1
    if (nombre.includes('500 gr')) return 2
    return 0
  }

  function clickAgregar(producto: Producto) {
    const max = maxSalsasParaProducto(producto.nombre)
    if (((producto.categoria as string) === 'alitas' || (producto.categoria as string) === 'boneless') && max > 0) {
      setSalsasSeleccionadas([])
      setModalSalsas({ producto, maxSalsas: max })
    } else {
      agregarAlCarrito(producto, [])
    }
  }

  function agregarAlCarrito(producto: Producto, modificaciones: string[]) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.producto.id === producto.id && JSON.stringify(i.modificaciones) === JSON.stringify(modificaciones))
      if (idx >= 0) {
        const nuevo = [...prev]
        nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1 }
        return nuevo
      }
      return [...prev, { producto, cantidad: 1, notas: '', modificaciones }]
    })
  }

  function confirmarSalsas() {
    if (!modalSalsas) return
    agregarAlCarrito(modalSalsas.producto, salsasSeleccionadas)
    setModalSalsas(null)
    setSalsasSeleccionadas([])
  }

  function toggleSalsa(salsa: string) {
    setSalsasSeleccionadas(prev => {
      if (prev.includes(salsa)) return prev.filter(s => s !== salsa)
      if (prev.length >= (modalSalsas?.maxSalsas ?? 1)) return prev
      return [...prev, salsa]
    })
  }

  function quitarDelCarrito(idx: number) {
    setCarrito(prev => {
      const nuevo = [...prev]
      if (nuevo[idx].cantidad > 1) nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad - 1 }
      else nuevo.splice(idx, 1)
      return nuevo
    })
  }

  async function enviarPedido() {
    if (!mesaActiva || !cuentaActiva || carrito.length === 0) {
      alert(`❌ Faltan datos: mesa=${!!mesaActiva} cuenta=${!!cuentaActiva} carrito=${carrito.length}`)
      return
    }
    setCargando(true)

    const { error: errPedidos } = await supabase.from('pedidos').insert(
      carrito.map(item => ({
        cuenta_id: cuentaActiva.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.producto.precio,
        modificaciones: item.modificaciones,
        notas: item.notas || null,
        estado: 'nuevo' as EstadoPedido,
      }))
    )

    if (errPedidos) {
      alert(`❌ Error al enviar pedido: ${errPedidos.message}`)
      setCargando(false)
      return
    }

    const subtotalNuevo = carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
    const nuevoSubtotal = (cuentaActiva.subtotal ?? 0) + subtotalNuevo
    await supabase.from('cuentas').update({
      subtotal: nuevoSubtotal,
      impuesto: nuevoSubtotal * 0.16,
      total: nuevoSubtotal * 1.16,
    }).eq('id', cuentaActiva.id)

    setCarrito([])
    setCargando(false)
    setVista('mesas')
    setMesaActiva(null)
    setCuentaActiva(null)
    fetchData()
    alert(`✅ Pedido enviado a cocina\n${mesaActiva.nombre} · ${cuentaActiva.nombre_cuenta}`)
  }

  async function preguntarIA(mensaje: string) {
    if (!mensaje.trim() || cargandoIA) return
    const nuevos: MensajeIA[] = [...mensajesIA, { role: 'user', content: mensaje }]
    setMensajesIA(nuevos)
    setInputIA('')
    setCargandoIA(true)
    try {
      const res = await fetch('/api/ai/mesero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nuevos.slice(-8),
          mesaActiva: mesaActiva?.nombre,
          carrito: carrito.map(i => `${i.cantidad}x ${i.producto.nombre}`),
        }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let respuesta = ''
      setMensajesIA(prev => [...prev, { role: 'assistant', content: '' }])
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        respuesta += decoder.decode(value)
        setMensajesIA(prev => {
          const copia = [...prev]
          copia[copia.length - 1] = { role: 'assistant', content: respuesta }
          return copia
        })
      }
    } catch {
      setMensajesIA(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un error.' }])
    } finally {
      setCargandoIA(false)
    }
  }

  const totalCarrito = carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)
  const productosFiltrados = productos.filter(p => p.categoria === categoriaActiva)

  const DIAS: Record<string, string> = {
    lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
    viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo', siempre: 'Siempre',
  }
  const DIAS_COLORES: Record<string, string> = {
    lunes: 'bg-red-500/20 border-red-500/40 text-red-300',
    martes: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    miercoles: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    jueves: 'bg-green-500/20 border-green-500/40 text-green-300',
    viernes: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    sabado: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    domingo: 'bg-pink-500/20 border-pink-500/40 text-pink-300',
    siempre: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  }
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const diaHoy = diasSemana[new Date().getDay()]
  const promosHoy = promociones.filter(p => p.dia_semana === diaHoy)
  const promosSiempre = promociones.filter(p => p.dia_semana === 'siempre')
  const promosOtros = promociones.filter(p => p.dia_semana !== diaHoy && p.dia_semana !== 'siempre')

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        {vista !== 'mesas' && (
          <button
            onClick={() => {
              if (vista === 'menu' || vista === 'ia') setVista('mesas')
              else if (vista === 'carrito') setVista('menu')
              else if (vista === 'resumen') setVista('mesas')
              else if (vista === 'abrirMesa' || vista === 'selCuenta') { setVista('mesas'); setMesaActiva(null) }
            }}
            className="text-gray-400 hover:text-white text-xl p-1"
          >←</button>
        )}
        <div className="flex-1">
          <h1 className="font-bold text-white">🛎️ Módulo Mesero</h1>
          {mesaActiva && vista !== 'resumen' && (
            <p className="text-xs text-orange-400">
              {mesaActiva.nombre}
              {cuentaActiva && <span className="text-gray-500"> · {cuentaActiva.nombre_cuenta}</span>}
            </p>
          )}
        </div>
        {vista === 'mesas' && (
          <button
            onClick={() => setVista('resumen')}
            className="relative bg-blue-600/20 border border-blue-600/30 text-blue-400 px-3 py-2 rounded-xl text-sm font-medium"
          >
            📋 Mis Pedidos
          </button>
        )}
        {carrito.length > 0 && vista === 'menu' && (
          <button
            onClick={() => setVista('carrito')}
            className="relative bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            🛒 Carrito
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
              {carrito.reduce((s, i) => s + i.cantidad, 0)}
            </span>
          </button>
        )}
      </div>

      {/* Vista: mesas */}
      {vista === 'mesas' && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <p className="text-gray-400 text-sm">Selecciona una mesa para atender</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mesas.map(mesa => (
              <button
                key={mesa.id}
                onClick={() => seleccionarMesa(mesa)}
                disabled={mesa.estado === 'limpieza' || mesa.estado === 'reservada'}
                className={`p-4 rounded-2xl border-2 text-left transition active:scale-95
                  ${mesa.estado === 'disponible' ? 'bg-gray-900 border-green-500/40 hover:border-green-500' : ''}
                  ${mesa.estado === 'ocupada' ? 'bg-red-500/10 border-red-500/50 hover:border-red-400' : ''}
                  ${mesa.estado === 'reservada' ? 'bg-yellow-500/10 border-yellow-500/50 cursor-not-allowed opacity-60' : ''}
                  ${mesa.estado === 'limpieza' ? 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <p className="font-bold text-white">{mesa.nombre}</p>
                <p className="text-xs text-gray-400">{mesa.zona}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(mesa as any).num_personas > 0 ? `👥 ${(mesa as any).num_personas} personas` : `${mesa.capacidad} cap.`}
                </p>
                <span className={`text-xs mt-2 inline-block ${
                  mesa.estado === 'disponible' ? 'text-green-400' :
                  mesa.estado === 'ocupada' ? 'text-red-400' :
                  mesa.estado === 'limpieza' ? 'text-blue-400' : 'text-yellow-400'
                }`}>
                  {mesa.estado === 'disponible' ? '● Disponible' :
                   mesa.estado === 'ocupada' ? '● Ocupada' :
                   mesa.estado === 'limpieza' ? '🧹 Limpieza' : '● Reservada'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vista: abrir mesa (disponible) */}
      {vista === 'abrirMesa' && mesaActiva && (
        <div className="flex-1 flex flex-col p-6 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🪑</span>
            </div>
            <h2 className="text-xl font-bold text-white">{mesaActiva.nombre}</h2>
            <p className="text-gray-400 text-sm">{mesaActiva.zona} · {mesaActiva.capacidad} personas</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <label className="text-sm text-gray-400">Número de personas</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setNumPersonas(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-xl bg-gray-700 text-white text-xl font-bold hover:bg-gray-600 active:scale-95 transition">−</button>
              <span className="text-2xl font-bold text-white w-12 text-center">{numPersonas}</span>
              <button onClick={() => setNumPersonas(p => p + 1)} className="w-10 h-10 rounded-xl bg-gray-700 text-white text-xl font-bold hover:bg-gray-600 active:scale-95 transition">+</button>
            </div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <label className="text-sm text-gray-400">Nombre de la cuenta <span className="text-gray-600">(opcional)</span></label>
            <input
              value={nombreCuenta}
              onChange={e => setNombreCuenta(e.target.value)}
              placeholder="Ej: Familia García, Cuenta 1, Mesa 3..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            onClick={abrirMesa}
            disabled={cargando}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-green-500/20 active:scale-95 transition disabled:opacity-50"
          >
            {cargando ? 'Abriendo...' : '✅ Abrir Mesa y Tomar Pedido'}
          </button>
        </div>
      )}

      {/* Vista: seleccionar cuenta (mesa ocupada) */}
      {vista === 'selCuenta' && mesaActiva && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <span className="text-xl">🪑</span>
            </div>
            <div>
              <h2 className="font-bold text-white">{mesaActiva.nombre}</h2>
              <p className="text-sm text-gray-400">{cuentasEnMesa.length} cuenta{cuentasEnMesa.length !== 1 ? 's' : ''} abierta{cuentasEnMesa.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Cuentas existentes */}
          {cuentasEnMesa.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Cuentas abiertas</p>
              {cuentasEnMesa.map((cuenta, i) => (
                <button
                  key={cuenta.id}
                  onClick={() => seleccionarCuenta(cuenta)}
                  className="w-full bg-gray-900 border border-gray-700 hover:border-orange-500 rounded-xl p-4 text-left transition active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{cuenta.nombre_cuenta || `Cuenta ${i + 1}`}</p>
                      <p className="text-xs text-gray-500">Abierta {new Date(cuenta.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}{cuenta.num_personas > 0 ? ` · 👥 ${cuenta.num_personas}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-400 font-bold">${(cuenta.total ?? 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-600">total</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Nueva cuenta */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Agregar nueva cuenta</p>
            <input
              value={nombreCuenta}
              onChange={e => setNombreCuenta(e.target.value)}
              placeholder={`Cuenta ${cuentasEnMesa.length + 1}, Nombre del cliente...`}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="bg-gray-900 rounded-xl p-3 space-y-2">
              <label className="text-xs text-gray-400">Número de personas</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setNumPersonas(p => Math.max(1, p - 1))} className="w-9 h-9 rounded-lg bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 active:scale-95 transition">−</button>
                <span className="text-xl font-bold text-white w-10 text-center">{numPersonas}</span>
                <button onClick={() => setNumPersonas(p => p + 1)} className="w-9 h-9 rounded-lg bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 active:scale-95 transition">+</button>
              </div>
            </div>
            <button
              onClick={crearNuevaCuenta}
              disabled={cargando}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition active:scale-95 disabled:opacity-50"
            >
              {cargando ? 'Creando...' : '＋ Nueva Cuenta en esta Mesa'}
            </button>
          </div>
        </div>
      )}

      {/* Vista: menú */}
      {vista === 'menu' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-2 p-3 overflow-x-auto border-b border-gray-800 bg-gray-900">
            <button
              onClick={() => setCategoriaActiva('__promos__')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition border
                ${categoriaActiva === '__promos__'
                  ? 'bg-yellow-500 text-white border-yellow-500'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20'}`}
            >
              🎉 Promos
              {promosHoy.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${categoriaActiva === '__promos__' ? 'bg-white/30' : 'bg-yellow-500/30'}`}>
                  {promosHoy.length}
                </span>
              )}
            </button>
            {CATEGORIAS.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoriaActiva(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition
                  ${categoriaActiva === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                <span>{cat.emoji}</span> {cat.label}
              </button>
            ))}
            <button
              onClick={() => setVista('ia')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-purple-600/20 text-purple-400 border border-purple-600/30 hover:bg-purple-600/30 transition"
            >
              🤖 IA
            </button>
          </div>

          {/* Productos normales */}
          {categoriaActiva !== '__promos__' && (
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {productosFiltrados.map(prod => (
                <div key={prod.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm">{prod.nombre}</p>
                      {prod.es_popular && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Popular</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{prod.descripcion}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-orange-400 font-bold">${prod.precio}</span>
                      <span className="text-xs text-gray-600">⏱ {prod.tiempo_prep_min} min</span>
                      {prod.alergenos.length > 0 && (
                        <span className="text-xs text-yellow-600">⚠️ {prod.alergenos.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => clickAgregar(prod)}
                    className="w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-xl text-white text-xl font-bold flex items-center justify-center transition active:scale-90"
                  >+</button>
                </div>
              ))}
            </div>
          )}

          {/* Vista promociones */}
          {categoriaActiva === '__promos__' && (
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {promociones.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">🎉</p>
                  <p className="text-gray-400">No hay promociones activas</p>
                </div>
              )}
              {promociones.map(promo => {
                const esHoy = promo.dia_semana === diaHoy || promo.dia_semana === 'siempre'
                return (
                  <div
                    key={promo.id}
                    className={`rounded-2xl p-4 border-2 transition ${
                      esHoy
                        ? 'bg-yellow-500/15 border-yellow-500/60 shadow-lg shadow-yellow-500/10'
                        : `border ${DIAS_COLORES[promo.dia_semana] ?? 'bg-gray-800/40 border-gray-700'}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                            esHoy ? 'bg-yellow-500/30 text-yellow-300' : 'bg-gray-700 text-gray-400'
                          }`}>
                            {esHoy && promo.dia_semana !== 'siempre' ? '⭐ HOY' : DIAS[promo.dia_semana]}
                          </span>
                          <p className={`font-bold text-sm ${esHoy ? 'text-white' : 'text-gray-300'}`}>
                            {promo.nombre}
                          </p>
                        </div>
                        {promo.descripcion && (
                          <p className="text-xs text-gray-400 mt-1">{promo.descripcion}</p>
                        )}
                      </div>
                      {promo.precio != null && (
                        <span className={`font-bold text-lg whitespace-nowrap ${esHoy ? 'text-yellow-400' : 'text-orange-400'}`}>
                          ${promo.precio}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista: carrito */}
      {vista === 'carrito' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {carrito.length === 0 ? (
              <p className="text-gray-500 text-center py-12">El carrito está vacío</p>
            ) : (
              carrito.map((item, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{item.producto.nombre}</p>
                    {item.modificaciones.length > 0 && (
                      <p className="text-xs text-orange-300 mt-0.5">🔥 {item.modificaciones.join(', ')}</p>
                    )}
                    <p className="text-orange-400 text-sm font-bold mt-1">${(item.producto.precio * item.cantidad).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => quitarDelCarrito(idx)} className="w-8 h-8 bg-gray-800 rounded-lg text-white flex items-center justify-center hover:bg-red-500/20">−</button>
                    <span className="text-white font-bold w-6 text-center">{item.cantidad}</span>
                    <button onClick={() => agregarAlCarrito(item.producto, item.modificaciones)} className="w-8 h-8 bg-orange-500/20 rounded-lg text-orange-400 flex items-center justify-center hover:bg-orange-500/30">+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {carrito.length > 0 && (
            <div className="p-4 bg-gray-900 border-t border-gray-800 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">${totalCarrito.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">IVA (16%)</span>
                <span className="text-white">${(totalCarrito * 0.16).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Total</span>
                <span className="text-orange-400">${(totalCarrito * 1.16).toFixed(2)}</span>
              </div>
              <button
                onClick={enviarPedido}
                disabled={cargando}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-orange-500/20 active:scale-95 transition disabled:opacity-50"
              >
                {cargando ? 'Enviando...' : '🍳 Enviar a Cocina'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vista: resumen de pedidos */}
      {vista === 'resumen' && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-lg">📋 Estado de mis pedidos</h2>
            <button onClick={fetchResumen} className="text-xs text-gray-500 hover:text-white px-3 py-1.5 bg-gray-800 rounded-lg">
              🔄 Actualizar
            </button>
          </div>

          {cargandoResumen ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : pedidosActivos.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No hay pedidos activos</p>
          ) : (() => {
            // Agrupar por mesa
            const porMesa: Record<string, { mesaNombre: string; cuentaNombre: string; items: PedidoEstado[] }> = {}
            pedidosActivos.forEach(p => {
              const mesaNombre = p.cuentas?.mesas?.nombre ?? 'Sin mesa'
              const cuentaNombre = p.cuentas?.nombre_cuenta ?? 'Cuenta'
              const key = `${mesaNombre}-${cuentaNombre}`
              if (!porMesa[key]) porMesa[key] = { mesaNombre, cuentaNombre, items: [] }
              porMesa[key].items.push(p)
            })

            return Object.entries(porMesa).map(([key, grupo]) => {
              const listos = grupo.items.filter(p => p.estado === 'listo')
              const enPrep = grupo.items.filter(p => p.estado === 'en_preparacion')
              const nuevos = grupo.items.filter(p => p.estado === 'nuevo')
              const entregados = grupo.items.filter(p => p.estado === 'entregado')

              return (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{grupo.mesaNombre}</p>
                      <p className="text-xs text-gray-400">{grupo.cuentaNombre}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {listos.length > 0 && <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">✅ {listos.length} listo{listos.length > 1 ? 's' : ''}</span>}
                      {enPrep.length > 0 && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">👨‍🍳 {enPrep.length}</span>}
                      {nuevos.length > 0 && <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">🆕 {nuevos.length}</span>}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-800">
                    {/* Listos para entregar - primero y destacados */}
                    {listos.map(p => (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3 bg-green-500/5 border-l-4 border-green-500">
                        <span className="text-green-400 text-lg">✅</span>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{p.productos?.nombre}</p>
                          {p.notas && <p className="text-xs text-gray-500">{p.notas}</p>}
                        </div>
                        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-lg">×{p.cantidad} LISTO</span>
                      </div>
                    ))}
                    {/* En preparación */}
                    {enPrep.map(p => (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3 border-l-4 border-yellow-500/50">
                        <span className="text-yellow-400 text-lg">👨‍🍳</span>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{p.productos?.nombre}</p>
                          {p.notas && <p className="text-xs text-gray-500">{p.notas}</p>}
                        </div>
                        <span className="text-yellow-400 text-xs px-2 py-1 rounded-lg bg-yellow-500/10">×{p.cantidad} En prep.</span>
                      </div>
                    ))}
                    {/* Nuevos */}
                    {nuevos.map(p => (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3 border-l-4 border-blue-500/30">
                        <span className="text-blue-400 text-lg">🆕</span>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{p.productos?.nombre}</p>
                          {p.notas && <p className="text-xs text-gray-500">{p.notas}</p>}
                        </div>
                        <span className="text-blue-400 text-xs px-2 py-1 rounded-lg bg-blue-500/10">×{p.cantidad} Esperando</span>
                      </div>
                    ))}
                    {/* Entregados - al final y atenuados */}
                    {entregados.map(p => (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3 opacity-40">
                        <span className="text-gray-500 text-lg">☑️</span>
                        <div className="flex-1">
                          <p className="text-gray-400 text-sm line-through">{p.productos?.nombre}</p>
                        </div>
                        <span className="text-gray-600 text-xs">×{p.cantidad} entregado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Vista: IA */}
      {vista === 'ia' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 bg-purple-600/10 border-b border-purple-600/20 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm">🤖</div>
            <div>
              <p className="text-sm font-medium text-purple-300">Asistente Loft Wings IA</p>
              <p className="text-xs text-purple-500">Powered by Claude Opus 4.7</p>
            </div>
          </div>

          <div ref={chatRef} className="flex-1 overflow-auto p-4 space-y-4">
            {mensajesIA.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm ${
                  msg.role === 'user' ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                }`}>
                  {msg.content || <span className="animate-pulse">●●●</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-800">
            {['¿Qué recomiendas para alguien que no come picante?', '¿Cuáles no tienen gluten?', '¿Qué combos hay?'].map(s => (
              <button key={s} onClick={() => preguntarIA(s)} className="whitespace-nowrap text-xs bg-gray-800 text-gray-300 px-3 py-2 rounded-xl hover:bg-gray-700 transition">
                {s}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input
              value={inputIA}
              onChange={e => setInputIA(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && preguntarIA(inputIA)}
              placeholder="Pregunta sobre el menú, alérgenos, combos..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => preguntarIA(inputIA)}
              disabled={cargandoIA || !inputIA.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-medium transition"
            >
              {cargandoIA ? '...' : '→'}
            </button>
          </div>
        </div>
      )}
      {/* Modal selección de salsas */}
      {modalSalsas && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-white text-lg">🔥 Elige las salsas</h3>
              <p className="text-sm text-gray-400">{modalSalsas.producto.nombre}</p>
              <p className="text-xs text-orange-400 mt-1">
                Puedes elegir hasta {modalSalsas.maxSalsas} salsa{modalSalsas.maxSalsas > 1 ? 's' : ''} · {salsasSeleccionadas.length}/{modalSalsas.maxSalsas} seleccionada{salsasSeleccionadas.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SALSAS_ALITAS.map(salsa => {
                const seleccionada = salsasSeleccionadas.includes(salsa)
                const lleno = salsasSeleccionadas.length >= modalSalsas.maxSalsas && !seleccionada
                return (
                  <button
                    key={salsa}
                    onClick={() => toggleSalsa(salsa)}
                    disabled={lleno}
                    className={`px-3 py-3 rounded-xl text-sm font-medium text-left transition border-2 active:scale-95
                      ${seleccionada
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : lleno
                          ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                  >
                    {seleccionada ? '✓ ' : ''}{salsa}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setModalSalsas(null); setSalsasSeleccionadas([]) }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarSalsas}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition active:scale-95"
              >
                {salsasSeleccionadas.length === 0 ? 'Sin salsa' : '✓ Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
