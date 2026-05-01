export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface AnalisisProducto {
  nombre: string
  categoria: string
  precio: number
  costo: number
  margen: number
  margen_pct: number
  tiempo_estimado: number
  tiempo_real: number | null
  unidades_7d: number
  ingreso_7d: number
  ganancia_7d: number
}

export async function POST(req: Request) {
  const { messages, kpis, ventasSemana, topProductos, analisisProductos } = await req.json()

  // Ordenar productos por margen y por ganancia generada
  const porMargen = [...(analisisProductos ?? [])].sort((a: AnalisisProducto, b: AnalisisProducto) => b.margen_pct - a.margen_pct)
  const porGanancia = [...(analisisProductos ?? [])].sort((a: AnalisisProducto, b: AnalisisProducto) => b.ganancia_7d - a.ganancia_7d)
  const masLentos = [...(analisisProductos ?? [])].filter((p: AnalisisProducto) => p.tiempo_real !== null).sort((a: AnalisisProducto, b: AnalisisProducto) => (b.tiempo_real ?? 0) - (a.tiempo_real ?? 0))

  const contexto = `
DATOS EN TIEMPO REAL — ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

📊 KPIs DEL DÍA:
• Ventas hoy: $${kpis.ventas_hoy?.toFixed(2) ?? 0}
• Propinas hoy: $${kpis.propinas_hoy?.toFixed(2) ?? 0} (${kpis.ventas_hoy > 0 ? ((kpis.propinas_hoy / kpis.ventas_hoy) * 100).toFixed(1) : 0}% del total)
• Descuentos aplicados: $${kpis.descuentos_hoy?.toFixed(2) ?? 0}
• Mesas ocupadas: ${kpis.mesas_ocupadas ?? 0}
• Cuentas abiertas: ${kpis.cuentas_abiertas ?? 0}
• Cuentas cobradas hoy: ${kpis.cuentas_cerradas_hoy ?? 0}
• Ticket promedio: $${kpis.ticket_promedio?.toFixed(2) ?? 0}
• Pedidos activos en cocina: ${kpis.pedidos_cocina ?? 0}
• Ventas del mes: $${kpis.ventas_mes?.toFixed(2) ?? 0}

📈 VENTAS ÚLTIMOS 7 DÍAS:
${ventasSemana?.map((d: { dia: string; total: number }) => `• ${d.dia}: $${d.total.toFixed(2)}`).join('\n') ?? 'Sin datos'}

💰 ANÁLISIS DE RENTABILIDAD POR PRODUCTO:
Columnas: Producto | Precio | Costo | Margen $ | Margen % | Vendidos 7d | Ganancia generada 7d
${(analisisProductos ?? []).map((p: AnalisisProducto) =>
  `• ${p.nombre} | $${p.precio} | $${p.costo} | $${p.margen.toFixed(2)} | ${p.margen_pct.toFixed(1)}% | ${p.unidades_7d} uds | $${p.ganancia_7d.toFixed(2)}`
).join('\n') || 'Sin datos de productos'}

🏆 TOP 5 MAYOR MARGEN %:
${porMargen.slice(0, 5).map((p: AnalisisProducto, i: number) => `${i + 1}. ${p.nombre}: ${p.margen_pct.toFixed(1)}% ($${p.margen.toFixed(2)} por pieza)`).join('\n') || 'Sin datos'}

💸 TOP 5 MÁS RENTABLES (ganancia total generada en 7 días):
${porGanancia.slice(0, 5).map((p: AnalisisProducto, i: number) => `${i + 1}. ${p.nombre}: $${p.ganancia_7d.toFixed(2)} en 7 días (${p.unidades_7d} uds)`).join('\n') || 'Sin datos'}

⏱️ TIEMPOS DE PREPARACIÓN (estimado vs real promedio):
${(analisisProductos ?? []).filter((p: AnalisisProducto) => p.tiempo_real !== null).map((p: AnalisisProducto) => {
  const diff = (p.tiempo_real ?? 0) - p.tiempo_estimado
  const status = diff > 3 ? '🔴 lento' : diff > 0 ? '🟡 ok' : '🟢 rápido'
  return `• ${p.nombre}: estimado ${p.tiempo_estimado} min | real ${(p.tiempo_real ?? 0).toFixed(1)} min ${status}`
}).join('\n') || 'Sin datos de tiempos reales aún (necesita pedidos completados)'}

🐌 PRODUCTOS MÁS LENTOS (tiempo real):
${masLentos.slice(0, 5).map((p: AnalisisProducto, i: number) => `${i + 1}. ${p.nombre}: ${(p.tiempo_real ?? 0).toFixed(1)} min promedio`).join('\n') || 'Sin datos'}

🏆 TOP PRODUCTOS MÁS VENDIDOS (7 días):
${topProductos?.map((p: { nombre: string; cantidad: number }, i: number) => `${i + 1}. ${p.nombre}: ${p.cantidad} unidades`).join('\n') ?? 'Sin datos'}`

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: `Eres el Manager IA de Loft Wings, un consultor de negocios experto en restaurantes mexicanos.

Tienes acceso COMPLETO a los datos del restaurante en tiempo real, incluyendo costos, márgenes de ganancia y tiempos reales de preparación de cada producto.

${contexto}

CÓMO ANALIZAR:
- Cuando pregunten por costos/ganancias: usa los datos de rentabilidad por producto. Distingue entre margen % (eficiencia) y ganancia total generada (impacto en el negocio).
- Cuando pregunten por tiempos: compara estimado vs real. Si un producto tarda más de lo estimado sistemáticamente, es un problema operacional.
- Identifica productos "estrella" (alto margen + alto volumen), "vacas lecheras" (bajo margen pero mucho volumen), "perros" (bajo margen + poco volumen).
- Detecta oportunidades: productos con buen margen que no se venden suficiente → promover más.
- Detecta problemas: productos lentos que generan cuellos de botella en cocina.
- Cuando calcules proyecciones: usa ventas_mes y datos de la semana.
- Usa emojis para estructura visual. Responde en español de México.
- Sé directo y accionable. El dueño necesita saber QUÉ hacer, no solo qué pasa.`,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
