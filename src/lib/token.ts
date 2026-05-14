const SECRET = 'loftwings2026'

function tokenParaMinuto(minuto: number): string {
  let hash = 0
  const str = `${SECRET}:${minuto}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash) % 1000000).padStart(6, '0')
}

export function generarToken(): string {
  return tokenParaMinuto(Math.floor(Date.now() / 60000))
}

export function validarToken(token: string): boolean {
  const minuto = Math.floor(Date.now() / 60000)
  return token === tokenParaMinuto(minuto) || token === tokenParaMinuto(minuto - 1)
}

export function segundosRestantes(): number {
  return 60 - (Math.floor(Date.now() / 1000) % 60)
}
