'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { IVA } from '@/lib/constants'
import type { MetodoPago } from '@/types/database'

interface CuentaDetalle {
  id: string
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  estado: string
  created_at: string
  metodo_pago: string | null
  notas: string | null
  nombre_cuenta: string | null
  mesas: { nombre: string } | null
  usuarios: { nombre: string } | null
  pedidos: {
    id: string
    cantidad: number
    precio_unitario: number
    estado: string
    notas: string | null
    modificaciones: string[]
    productos: { nombre: string } | null
  }[]
}

const METODOS: { id: MetodoPago; label: string; emoji: string }[] = [
  { id: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { id: 'tarjeta', label: 'Tarjeta', emoji: '💳' },
  { id: 'transferencia', label: 'Transferencia', emoji: '📱' },
]

const PROPINAS = [0, 5, 10, 15, 20]

export default function CajaPage() {
  const [cuentas, setCuentas] = useState<CuentaDetalle[]>([])
  const [cuentaActiva, setCuentaActiva] = useState<CuentaDetalle | null>(null)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [descuento, setDescuento] = useState(0)
  const [propina, setPropina] = useState(0)
  const [loading, setLoading] = useState(true)
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [vistaTicket, setVistaTicket] = useState(false)

  const fetchCuentas = useCallback(async () => {
    const { data } = await supabase
      .from('cuentas')
      .select(`
        id, subtotal, descuento, impuesto, total, estado, created_at, metodo_pago, notas, nombre_cuenta,
        mesas!cuentas_mesa_id_fkey (nombre),
        usuarios!cuentas_mesero_id_fkey (nombre),
        pedidos!pedidos_cuenta_id_fkey (id, cantidad, precio_unitario, estado, notas, modificaciones, productos!pedidos_producto_id_fkey (nombre))
      `)
      .eq('estado', 'abierta')
      .order('created_at', { ascending: true })
    if (data) setCuentas(data as unknown as CuentaDetalle[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCuentas()
    const channel = supabase.channel('caja_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas' }, fetchCuentas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchCuentas)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCuentas])

  async function cancelarProducto(pedidoId: string, nombre: string) {
    if (!cuentaActiva) return
    if (!window.confirm(`¿Cancelar "${nombre}"?`)) return
    await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', pedidoId)
    // Recalcular subtotal de la cuenta sin ese pedido
    const pedidosRestantes = cuentaActiva.pedidos.filter((p: any) => p.id !== pedidoId && p.estado !== 'cancelado')
    const nuevoSubtotal = pedidosRestantes.reduce((s: number, p: any) => s + p.precio_unitario * p.cantidad, 0)
    await supabase.from('cuentas').update({ subtotal: nuevoSubtotal, total: nuevoSubtotal }).eq('id', cuentaActiva.id)
    fetchCuentas()
  }

  async function cancelarCuenta() {
    if (!cuentaActiva) return
    if (!window.confirm(`¿Cancelar la cuenta "${cuentaActiva.nombre_cuenta ?? cuentaActiva.mesas?.nombre}"? Los pedidos se marcarán como cancelados.`)) return
    await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('cuenta_id', cuentaActiva.id)
    await supabase.from('cuentas').update({ estado: 'cancelada' }).eq('id', cuentaActiva.id)
    if (cuentaActiva.mesas) {
      const { data: mesaData } = await supabase.from('mesas').select('id').eq('nombre', cuentaActiva.mesas.nombre).single()
      if (mesaData) {
        const { data: restantes } = await supabase.from('cuentas').select('id').eq('mesa_id', mesaData.id).eq('estado', 'abierta')
        if (!restantes || restantes.length === 0) {
          await supabase.from('mesas').update({ estado: 'disponible', cuenta_id: null, mesero_id: null, num_personas: 0 }).eq('id', mesaData.id)
        }
      }
    }
    setCuentaActiva(null)
    setDescuento(0)
    setPropina(0)
    setEfectivoRecibido('')
    setVistaTicket(false)
    fetchCuentas()
  }

  async function cerrarCuenta() {
    if (!cuentaActiva) return
    const subtotal = cuentaActiva.pedidos.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + p.precio_unitario * p.cantidad, 0)
    const descuentoAplicado = subtotal * (descuento / 100)
    const base = subtotal - descuentoAplicado
    const impuesto = base * IVA
    const propinaAmt = base * (propina / 100)
    const total = base + impuesto + propinaAmt

    await supabase.from('cuentas').update({
      estado: 'cerrada',
      subtotal,
      descuento: descuentoAplicado,
      impuesto,
      propina: propinaAmt,
      total,
      metodo_pago: metodoPago,
      cerrada_at: new Date().toISOString(),
    }).eq('id', cuentaActiva.id)

    await supabase.from('pedidos').update({ estado: 'entregado' })
      .eq('cuenta_id', cuentaActiva.id).neq('estado', 'cancelado')

    if (cuentaActiva.mesas) {
      const { data: mesaData } = await supabase.from('mesas').select('id').eq('nombre', cuentaActiva.mesas.nombre).single()
      if (mesaData) {
        const { data: cuentasRestantes } = await supabase.from('cuentas')
          .select('id').eq('mesa_id', mesaData.id).eq('estado', 'abierta')
        if (!cuentasRestantes || cuentasRestantes.length === 0) {
          await supabase.from('mesas').update({ estado: 'limpieza', cuenta_id: null, mesero_id: null }).eq('id', mesaData.id)
        }
      }
    }

    setCuentaActiva(null)
    setDescuento(0)
    setPropina(0)
    setEfectivoRecibido('')
    setVistaTicket(false)
    fetchCuentas()
  }

  function imprimirTicket() {
    window.print()
  }

  const pedidosActivos = cuentaActiva?.pedidos.filter(p => p.estado !== 'cancelado') ?? []
  const subtotalActivo = pedidosActivos.reduce((s, p) => s + p.precio_unitario * p.cantidad, 0)
  const descuentoAmt = subtotalActivo * (descuento / 100)
  const base = subtotalActivo - descuentoAmt
  const impuestoAmt = base * IVA
  const propinaAmt = base * (propina / 100)
  const totalFinal = base + impuestoAmt + propinaAmt
  const cambio = parseFloat(efectivoRecibido || '0') - totalFinal

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <>
      {/* Estilos de impresión — rollo 58mm (área imprimible 48mm) */}
      <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm 5mm;
          }
          html, body { margin: 0; padding: 0; }
          body * { visibility: hidden; }
          #ticket-print, #ticket-print * { visibility: visible; }
          #ticket-print {
            position: fixed;
            top: 0;
            left: 0;
            width: 48mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 7.5pt;
            line-height: 1.4;
            color: #000 !important;
            background: #fff !important;
          }
          #ticket-print table { width: 100%; border-collapse: collapse; }
          #ticket-print td { padding: 0; vertical-align: top; }
          #ticket-print td.precio { text-align: right; white-space: nowrap; padding-left: 3px; width: 1%; }
          #ticket-print .t-centro { text-align: center; }
          #ticket-print .t-bold { font-weight: bold; }
          #ticket-print .t-grande { font-size: 10pt; }
          #ticket-print .t-chico { font-size: 6.5pt; }
          #ticket-print .divider { display: block; border-top: 1px dashed #000; margin: 1.5mm 0; }
          #ticket-print .print-hide { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row gap-0">
        {/* Panel izquierdo */}
        <div className="lg:w-80 xl:w-96 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h1 className="text-xl font-bold text-white">💳 Caja</h1>
            <p className="text-gray-400 text-sm">{cuentas.length} cuentas abiertas</p>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {cuentas.length === 0 ? (
              <p className="text-gray-500 text-center py-12 text-sm">No hay cuentas abiertas</p>
            ) : cuentas.map(cuenta => (
              <button
                key={cuenta.id}
                onClick={() => { setCuentaActiva(cuenta); setDescuento(0); setPropina(0); setEfectivoRecibido(''); setVistaTicket(false) }}
                className={`w-full text-left p-4 rounded-xl border transition ${
                  cuentaActiva?.id === cuenta.id
                    ? 'bg-orange-500/15 border-orange-500/40'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-white">{cuenta.mesas?.nombre ?? 'Sin mesa'}</p>
                    {cuenta.nombre_cuenta && <p className="text-xs text-orange-400">{cuenta.nombre_cuenta}</p>}
                  </div>
                  <p className="text-orange-400 font-bold">${cuenta.total.toFixed(0)}</p>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-400">{cuenta.pedidos.length} platillos</p>
                  {cuenta.usuarios && <p className="text-xs text-gray-500">👤 {cuenta.usuarios.nombre}</p>}
                </div>
                <p className="text-xs text-gray-600">{new Date(cuenta.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex-1 flex flex-col overflow-auto">
          {!cuentaActiva ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <p className="text-6xl mb-4">💳</p>
                <p className="text-gray-400 text-lg">Selecciona una cuenta para cobrar</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Header con mesero */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{cuentaActiva.mesas?.nombre}</h2>
                  {cuentaActiva.nombre_cuenta && <p className="text-sm text-orange-400">{cuentaActiva.nombre_cuenta}</p>}
                  {cuentaActiva.usuarios && (
                    <p className="text-sm text-gray-400 mt-0.5">👤 Mesero: <span className="text-white">{cuentaActiva.usuarios.nombre}</span></p>
                  )}
                  <p className="text-xs text-gray-600">Abierta {new Date(cuentaActiva.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVistaTicket(!vistaTicket)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${vistaTicket ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    🧾 Ticket
                  </button>
                  <button onClick={() => { setCuentaActiva(null); setVistaTicket(false) }} className="text-gray-500 hover:text-white text-2xl px-2">×</button>
                </div>
              </div>

              {/* Vista ticket para cliente */}
              {vistaTicket ? (
                <div id="ticket-print" className="bg-white text-black rounded-2xl p-3 font-mono text-xs max-w-[200px]">

                  {/* Encabezado */}
                  <div className="t-centro text-center mb-1">
                    <p className="t-bold t-grande font-bold text-sm tracking-widest">LOFT WINGS</p>
                    <span className="divider block border-t border-dashed border-black my-1" />
                    <p>{new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    <p>{cuentaActiva.mesas?.nombre}{cuentaActiva.nombre_cuenta ? ` / ${cuentaActiva.nombre_cuenta}` : ''}</p>
                    {cuentaActiva.usuarios && <p>Mesero: {cuentaActiva.usuarios.nombre}</p>}
                  </div>

                  <span className="divider block border-t border-dashed border-black my-1" />

                  {/* Productos — tabla para alinear precios */}
                  <table className="w-full" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {pedidosActivos.map(p => (
                        <>
                          <tr key={p.id}>
                            <td style={{ wordBreak: 'break-word', verticalAlign: 'top', paddingRight: '3px' }}>
                              {p.cantidad}x {p.productos?.nombre}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', width: '1%' }}>
                              ${(p.precio_unitario * p.cantidad).toFixed(2)}
                            </td>
                          </tr>
                          {p.modificaciones?.length > 0 && (
                            <tr key={`${p.id}-mod`}>
                              <td colSpan={2} className="t-chico" style={{ fontSize: '6.5pt', paddingLeft: '6px', paddingBottom: '2px' }}>
                                &gt; {p.modificaciones.join(', ')}
                              </td>
                            </tr>
                          )}
                          {p.notas && (
                            <tr key={`${p.id}-nota`}>
                              <td colSpan={2} className="t-chico" style={{ fontSize: '6.5pt', paddingLeft: '6px', paddingBottom: '2px' }}>
                                Nota: {p.notas}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>

                  <span className="divider block border-t border-dashed border-black my-1" />

                  {/* Totales */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td>Subtotal</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>${subtotalActivo.toFixed(2)}</td>
                      </tr>
                      {descuento > 0 && (
                        <tr>
                          <td>Descuento {descuento}%</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>-${descuentoAmt.toFixed(2)}</td>
                        </tr>
                      )}
                      {propina > 0 && (
                        <tr>
                          <td>Propina {propina}%</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>+${propinaAmt.toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <span className="divider block border-t border-dashed border-black my-1" />

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td className="t-bold font-bold" style={{ fontSize: '10pt' }}>TOTAL</td>
                        <td className="t-bold font-bold" style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '1%', fontSize: '10pt' }}>${totalFinal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <span className="divider block border-t border-dashed border-black my-1" />
                  <p className="text-center t-centro text-xs mt-1">Gracias por su visita!</p>

                  {/* Botones — ocultos al imprimir */}
                  <div className="print-hide flex gap-2 mt-3">
                    <button onClick={imprimirTicket} className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-bold">🖨️ Imprimir</button>
                    <button onClick={() => setVistaTicket(false)} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-bold">✅ Cobrar</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Pedidos */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
                    {pedidosActivos.map(pedido => (
                      <div key={pedido.id} className="flex items-center gap-3 p-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{pedido.productos?.nombre ?? pedido.notas}</p>
                          {pedido.modificaciones?.length > 0 && <p className="text-xs text-orange-300">🔥 {pedido.modificaciones.join(', ')}</p>}
                          {pedido.notas && pedido.productos?.nombre && <p className="text-xs text-gray-500">📝 {pedido.notas}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-white text-sm">×{pedido.cantidad}</p>
                          <p className="text-orange-400 font-bold">${(pedido.precio_unitario * pedido.cantidad).toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => cancelarProducto(pedido.id, pedido.productos?.nombre ?? pedido.notas ?? 'producto')}
                          className="shrink-0 w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition text-lg font-bold"
                          title="Cancelar producto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Descuento */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-400">Descuento</p>
                    <div className="flex gap-2">
                      {[0, 5, 10, 15, 20].map(d => (
                        <button key={d} onClick={() => setDescuento(d)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${descuento === d ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                          {d}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Propina */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-400">Propina</p>
                    <div className="flex gap-2">
                      {PROPINAS.map(p => (
                        <button key={p} onClick={() => setPropina(p)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${propina === p ? 'bg-yellow-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                          {p === 0 ? 'Sin' : `${p}%`}
                        </button>
                      ))}
                    </div>
                    {propina > 0 && (
                      <p className="text-yellow-400 text-sm text-center font-medium">
                        Propina: ${propinaAmt.toFixed(2)} para {cuentaActiva.usuarios?.nombre ?? 'el mesero'}
                      </p>
                    )}
                  </div>

                  {/* Totales */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Subtotal</span><span className="text-white">${subtotalActivo.toFixed(2)}</span></div>
                    {descuento > 0 && <div className="flex justify-between text-sm"><span className="text-green-400">Descuento {descuento}%</span><span className="text-green-400">-${descuentoAmt.toFixed(2)}</span></div>}
                    {propina > 0 && <div className="flex justify-between text-sm"><span className="text-yellow-400">Propina {propina}%</span><span className="text-yellow-400">+${propinaAmt.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-700">
                      <span className="text-white">Total</span>
                      <span className="text-orange-400">${totalFinal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Método de pago */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-400">Método de pago</p>
                    <div className="grid grid-cols-3 gap-2">
                      {METODOS.map(m => (
                        <button key={m.id} onClick={() => setMetodoPago(m.id)}
                          className={`py-3 rounded-xl text-sm font-medium transition flex flex-col items-center gap-1 ${metodoPago === m.id ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                          <span className="text-xl">{m.emoji}</span>{m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Efectivo recibido */}
                  {metodoPago === 'efectivo' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-400">Efectivo recibido</p>
                      <input type="number" value={efectivoRecibido} onChange={e => setEfectivoRecibido(e.target.value)}
                        placeholder="$0.00"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      {parseFloat(efectivoRecibido) >= totalFinal && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                          <p className="text-green-400 font-bold text-lg">Cambio: ${cambio.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setVistaTicket(true)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl text-base transition active:scale-95"
                    >
                      🧾 Ver Ticket
                    </button>
                    <button onClick={cerrarCuenta}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 rounded-xl text-base shadow-lg shadow-green-500/20 active:scale-95 transition">
                      ✅ Cobrar ${totalFinal.toFixed(2)}
                    </button>
                  </div>
                  <button
                    onClick={cancelarCuenta}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl transition active:scale-95 text-sm"
                  >
                    🚫 Cancelar Cuenta
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
