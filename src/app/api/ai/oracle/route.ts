export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { messages, inventario } = await req.json()

  const inventarioTexto = inventario.map((i: {
    nombre: string; unidad: string; actual: number
    minimo: number; optimo: number; costo: number; proveedor: string | null
  }) => {
    const pct = Math.round((i.actual / i.optimo) * 100)
    const estado = i.actual <= i.minimo ? '🚨 CRÍTICO' : i.actual <= i.optimo * 0.5 ? '⚠️ BAJO' : '✅ OK'
    return `${estado} ${i.nombre}: ${i.actual}/${i.optimo} ${i.unidad} (${pct}%) | $${i.costo}/${i.unidad} | Proveedor: ${i.proveedor ?? 'No definido'}`
  }).join('\n')

  const systemPrompt = `Eres el Oracle de Inventario de Loft Wings, un sistema IA especializado en gestión de inventario para restaurantes.

Tu objetivo: analizar el inventario actual y proporcionar recomendaciones precisas de compra basadas en:
- Niveles actuales vs mínimos y óptimos
- Costos unitarios para calcular presupuesto
- Patrones de consumo típicos de un restaurante de alitas

INVENTARIO ACTUAL:
${inventarioTexto}

INSTRUCCIONES:
- Cuando recomiendes compras, indica: producto, cantidad a comprar, costo estimado, urgencia
- Genera órdenes de compra estructuradas cuando se te pida
- Calcula el presupuesto total cuando sea relevante
- Si hay insumos críticos, priorízalos siempre
- Usa emojis para hacer la información más visual
- Responde en español de México
- Sé preciso con los números y cálculos

Cuando generes una orden de compra, usa este formato:
📋 ORDEN DE COMPRA — Loft Wings
━━━━━━━━━━━━━━━━━━
[URGENTE/NORMAL]
• [Producto]: [Cantidad] [Unidad] × $[Precio] = $[Total]
━━━━━━━━━━━━━━━━━━
💰 TOTAL ESTIMADO: $[Total]`

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
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

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
