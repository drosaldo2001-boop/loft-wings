export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

let menuCache: string | null = null
let menuCacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

function getSupabaseAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function getMenuContext(): Promise<string> {
  if (menuCache && Date.now() - menuCacheTime < CACHE_TTL) return menuCache

  const { data: productos } = await getSupabaseAdmin()
    .from('productos')
    .select('nombre, descripcion, categoria, precio, tiempo_prep_min, ingredientes, alergenos, es_popular')
    .eq('activo', true)
    .order('categoria')

  if (!productos) return ''

  const por_categoria = productos.reduce((acc: Record<string, string[]>, p: {
    categoria: string; nombre: string; precio: number; descripcion: string
    es_popular: boolean; alergenos: string[]; tiempo_prep_min: number
  }) => {
    if (!acc[p.categoria]) acc[p.categoria] = []
    acc[p.categoria].push(
      `• ${p.nombre} ($${p.precio}) - ${p.descripcion}` +
      (p.es_popular ? ' [POPULAR]' : '') +
      (p.alergenos.length ? ` | Alérgenos: ${p.alergenos.join(', ')}` : ' | Sin alérgenos comunes') +
      ` | Prep: ${p.tiempo_prep_min} min`
    )
    return acc
  }, {} as Record<string, string[]>)

  menuCache = Object.entries(por_categoria)
    .map(([cat, items]) => `=== ${cat.toUpperCase()} ===\n${(items as string[]).join('\n')}`)
    .join('\n\n')
  menuCacheTime = Date.now()
  return menuCache
}

export async function POST(req: Request) {
  const { messages, mesaActiva, carrito } = await req.json()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const menuContext = await getMenuContext()

  const systemPrompt = `Eres el asistente IA de Loft Wings, un restaurante especializado en alitas de pollo crujientes, hamburguesas premium y papas gourmet.

Tu personalidad: amigable, conocedor del menú, enfocado en dar la mejor experiencia al cliente. Hablas español de México.

MENÚ ACTUAL:
${menuContext}

SALSAS DISPONIBLES PARA ALITAS: Buffalo, BBQ, Mango Habanero, Honey Garlic, Parmesan, Lemon Pepper, Korean BBQ, Chipotle.

REGLAS:
- Recomienda basado en preferencias del cliente (picante, sin gluten, popular, etc.)
- Si preguntan por alérgenos, sé muy preciso con la información
- Sugiere combos y upgrades cuando sea natural (ej: "Con las alitas quedan perfectas unas papas con queso")
- Usa emojis con moderación para ser más amigable
- Si no sabes algo del menú, di que lo consultarás con el chef
- Sé conciso, el mesero necesita respuestas rápidas
${mesaActiva ? `\nMESA ACTIVA: ${mesaActiva}` : ''}
${carrito?.length ? `\nPEDIDO ACTUAL: ${carrito.join(', ')}` : ''}`

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 512,
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

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
