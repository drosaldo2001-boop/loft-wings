import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validarToken } from '@/lib/token'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { empleado_id, token, accion, turno_id } = await req.json()

    if (!token || token.length !== 6) {
      return NextResponse.json({ error: 'Token requerido (6 dígitos)' }, { status: 400 })
    }
    if (!validarToken(token)) {
      return NextResponse.json({ error: '❌ Código incorrecto — pide el código al administrador' }, { status: 401 })
    }

    if (accion === 'entrada') {
      const { data, error } = await db()
        .from('turnos')
        .insert({ usuario_id: empleado_id, inicio: new Date().toISOString() })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data, { status: 201 })
    }

    if (accion === 'salida' && turno_id) {
      const { data, error } = await db()
        .from('turnos')
        .update({ fin: new Date().toISOString() })
        .eq('id', turno_id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
