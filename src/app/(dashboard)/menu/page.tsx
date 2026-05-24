'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIAS } from '@/lib/constants'

interface Extra { nombre: string; precio: number }

interface Producto {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  precio: number
  costo: number
  activo: boolean
  tiempo_prep_min: number
  es_popular: boolean
  alergenos: string[]
  grupos_opciones?: { nombre: string; opciones: Extra[] }[]
}

const CATEGORIAS_CON_TODAS = [{ id: 'todas', label: 'Todas', emoji: '📋' }, ...CATEGORIAS]

const FORM_VACIO = {
  nombre: '', descripcion: '', categoria: 'alitas',
  precio: '', costo: '', tiempo_prep_min: '15',
  es_popular: false, alergenos: '',
}

export default function MenuPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Modal editar / nuevo
  const [modalProducto, setModalProducto] = useState<Producto | null | 'nuevo'>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

  // Extras opcionales
  const [extras, setExtras] = useState<Extra[]>([])
  const [extraNombre, setExtraNombre] = useState('')
  const [extraPrecio, setExtraPrecio] = useState('')

  const fetchProductos = useCallback(async () => {
    const { data } = await supabase.from('productos').select('*').order('categoria').order('nombre')
    if (data) setProductos(data as Producto[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  function abrirNuevo() {
    setForm(FORM_VACIO)
    setExtras([])
    setExtraNombre('')
    setExtraPrecio('')
    setModalProducto('nuevo')
  }

  function abrirEditar(p: Producto) {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoria: p.categoria,
      precio: String(p.precio),
      costo: String(p.costo),
      tiempo_prep_min: String(p.tiempo_prep_min),
      es_popular: p.es_popular,
      alergenos: p.alergenos.join(', '),
    })
    const extrasGuardados = p.grupos_opciones?.[0]?.opciones ?? []
    setExtras(extrasGuardados)
    setExtraNombre('')
    setExtraPrecio('')
    setModalProducto(p)
  }

  function agregarExtra() {
    if (!extraNombre.trim()) return
    setExtras(prev => [...prev, { nombre: extraNombre.trim(), precio: parseFloat(extraPrecio) || 0 }])
    setExtraNombre('')
    setExtraPrecio('')
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.precio) return
    setGuardando(true)
    const grupos_opciones = extras.length > 0
      ? [{ nombre: 'Extras opcionales', opciones: extras }]
      : []
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria,
      precio: parseFloat(form.precio) || 0,
      costo: parseFloat(form.costo) || 0,
      tiempo_prep_min: parseInt(form.tiempo_prep_min) || 15,
      es_popular: form.es_popular,
      alergenos: form.alergenos ? form.alergenos.split(',').map(a => a.trim()).filter(Boolean) : [],
      grupos_opciones,
    }

    if (modalProducto === 'nuevo') {
      await supabase.from('productos').insert({ ...payload, activo: true, ingredientes: [] })
    } else if (modalProducto) {
      await supabase.from('productos').update(payload).eq('id', (modalProducto as Producto).id)
    }

    setModalProducto(null)
    setGuardando(false)
    fetchProductos()
  }

  async function toggleActivo(p: Producto) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    fetchProductos()
  }

  async function eliminar(id: string) {
    await supabase.from('productos').delete().eq('id', id)
    setConfirmarEliminar(null)
    fetchProductos()
  }

  const productosFiltrados = productos.filter(p => {
    const matchCat = categoriaFiltro === 'todas' || p.categoria === categoriaFiltro
    const matchBusq = busqueda === '' || p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchBusq
  })

  const countPorCategoria = (catId: string) =>
    catId === 'todas' ? productos.length : productos.filter(p => p.categoria === catId).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">🍽️ Editor de Menú</h1>
          <p className="text-gray-400 text-sm">{productos.length} productos · {productos.filter(p => p.activo).length} activos</p>
        </div>
        <button onClick={abrirNuevo}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition active:scale-95">
          ＋ Nuevo Producto
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{productos.filter(p => p.activo).length}</p>
          <p className="text-xs text-gray-500 mt-1">Activos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-500">{productos.filter(p => !p.activo).length}</p>
          <p className="text-xs text-gray-500 mt-1">Inactivos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{productos.filter(p => p.es_popular).length}</p>
          <p className="text-xs text-gray-500 mt-1">Populares</p>
        </div>
      </div>

      {/* Buscador */}
      <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar producto..."
        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />

      {/* Categorías */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIAS_CON_TODAS.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaFiltro(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              categoriaFiltro === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            <span>{cat.emoji}</span> {cat.label}
            <span className="text-xs opacity-60">({countPorCategoria(cat.id)})</span>
          </button>
        ))}
      </div>

      {/* Lista de productos */}
      <div className="space-y-2">
        {productosFiltrados.map(prod => {
          const margen = prod.precio > 0 ? ((prod.precio - prod.costo) / prod.precio * 100) : 0
          return (
            <div key={prod.id} className={`bg-gray-900 border rounded-2xl p-4 flex items-center gap-3 transition ${!prod.activo ? 'opacity-50 border-gray-800' : 'border-gray-800 hover:border-gray-700'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white text-sm">{prod.nombre}</p>
                  {prod.es_popular && <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">⭐ Popular</span>}
                  {!prod.activo && <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">Inactivo</span>}
                  <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full capitalize">{prod.categoria}</span>
                </div>
                {prod.descripcion && <p className="text-xs text-gray-600 mt-0.5 truncate">{prod.descripcion}</p>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-orange-400 font-bold text-sm">${prod.precio}</span>
                  {prod.costo > 0 && (
                    <>
                      <span className="text-gray-600 text-xs">Costo: ${prod.costo}</span>
                      <span className={`text-xs font-medium ${margen >= 60 ? 'text-green-400' : margen >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {margen.toFixed(0)}% margen
                      </span>
                    </>
                  )}
                  <span className="text-gray-600 text-xs">⏱ {prod.tiempo_prep_min} min</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActivo(prod)}
                  title={prod.activo ? 'Desactivar' : 'Activar'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${prod.activo ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-800 text-gray-600 hover:bg-gray-700'}`}>
                  {prod.activo ? '✓' : '○'}
                </button>
                <button onClick={() => abrirEditar(prod)}
                  className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center text-sm transition">
                  ✏️
                </button>
                <button onClick={() => setConfirmarEliminar(prod.id)}
                  className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center text-sm transition">
                  🗑
                </button>
              </div>
            </div>
          )
        })}
        {productosFiltrados.length === 0 && (
          <p className="text-gray-500 text-center py-12">No se encontraron productos</p>
        )}
      </div>

      {/* ─── MODAL: Crear / Editar ─── */}
      {modalProducto !== null && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4 overflow-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
            <h3 className="text-lg font-bold text-white">
              {modalProducto === 'nuevo' ? '＋ Nuevo Producto' : `✏️ Editar: ${(modalProducto as Producto).nombre}`}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre del producto"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción breve del platillo"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Categoría</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map(cat => (
                    <button key={cat.id} onClick={() => setForm(f => ({ ...f, categoria: cat.id }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${form.categoria === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Precio venta ($) *</label>
                  <input type="number" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Costo producción ($)</label>
                  <input type="number" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tiempo prep. (min)</label>
                  <input type="number" value={form.tiempo_prep_min} onChange={e => setForm(f => ({ ...f, tiempo_prep_min: e.target.value }))}
                    placeholder="15"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>

              {form.precio && form.costo && parseFloat(form.precio) > 0 && (
                <div className="bg-gray-800 rounded-xl p-3 flex justify-between text-sm">
                  <span className="text-gray-400">Margen de ganancia:</span>
                  <span className={`font-bold ${((parseFloat(form.precio) - parseFloat(form.costo)) / parseFloat(form.precio) * 100) >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {((parseFloat(form.precio) - parseFloat(form.costo || '0')) / parseFloat(form.precio) * 100).toFixed(1)}%
                    {' '}(${(parseFloat(form.precio) - parseFloat(form.costo || '0')).toFixed(2)} por pieza)
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Alérgenos (separados por coma)</label>
                <input value={form.alergenos} onChange={e => setForm(f => ({ ...f, alergenos: e.target.value }))}
                  placeholder="gluten, lacteo, huevo..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, es_popular: !f.es_popular }))}
                  className={`w-11 h-6 rounded-full transition relative ${form.es_popular ? 'bg-orange-500' : 'bg-gray-700'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${form.es_popular ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">⭐ Marcar como popular</span>
              </label>

              {/* ── EXTRAS OPCIONALES ── */}
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <label className="text-xs text-gray-400 font-medium block">➕ Extras opcionales</label>
                <p className="text-xs text-gray-600">Selecciona productos del menú que el cliente puede agregar al ordenar este platillo</p>

                {/* Lista de extras ya agregados */}
                {extras.length > 0 && (
                  <div className="space-y-1">
                    {extras.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
                        <span className="flex-1 text-white text-sm">{e.nombre}</span>
                        <span className="text-green-400 text-sm font-medium">+${e.precio}</span>
                        <button onClick={() => setExtras(prev => prev.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selector de producto + precio */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Producto</label>
                    <select
                      value={extraNombre}
                      onChange={e => {
                        const p = productos.find(p => p.nombre === e.target.value)
                        setExtraNombre(e.target.value)
                        if (p) setExtraPrecio(String(p.precio))
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">— Elige un producto —</option>
                      {productos.filter(p => modalProducto === 'nuevo' || (modalProducto as Producto)?.id !== p.id).map(p => (
                        <option key={p.id} value={p.nombre}>{p.nombre} (${p.precio})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500 mb-1 block">Precio extra</label>
                    <input
                      type="number"
                      value={extraPrecio}
                      onChange={e => setExtraPrecio(e.target.value)}
                      placeholder="$0"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <button
                    onClick={agregarExtra}
                    disabled={!extraNombre}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-bold transition mb-0"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalProducto(null)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button onClick={guardar} disabled={!form.nombre.trim() || !form.precio || guardando}
                className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold transition active:scale-95">
                {guardando ? 'Guardando...' : '✓ Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <p className="text-4xl">🗑️</p>
            <h3 className="font-bold text-white text-lg">¿Eliminar producto?</h3>
            <p className="text-gray-400 text-sm">Esto lo borrará del menú permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarEliminar(null)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-medium hover:bg-gray-700 transition">
                Cancelar
              </button>
              <button onClick={() => eliminar(confirmarEliminar)}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
