const TOKEN_KEY = 'token'

function decodePayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function saveToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function isTokenValid(token = getToken()) {
  if (!token) return false
  const payload = decodePayload(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 > Date.now()
}

export function isAuthenticated() {
  const token = getToken()
  if (isTokenValid(token)) return true
  if (token) clearToken()
  return false
}

/**
 * Milisegundos que le quedan a la sesión, o 0 si ya expiró.
 *
 * Permite avisar antes de que el token caduque. Sin esto, el usuario seguía
 * trabajando hasta que una petición devolvía 401 y lo expulsaba de golpe,
 * perdiendo lo que estuviera escribiendo.
 */
export function tiempoRestanteMs(token = getToken()) {
  if (!token) return 0
  const payload = decodePayload(token)
  if (!payload?.exp) return 0
  return Math.max(0, payload.exp * 1000 - Date.now())
}

export function usuarioActual(token = getToken()) {
  return decodePayload(token || '')?.username || null
}
