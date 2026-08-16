import axios from 'axios'
import { getToken, clearToken } from '../utils/auth'

// Sin VITE_API_URL se usa una ruta relativa: en el VPS nginx hace de proxy de
// /api hacia el backend. Antes había una URL de Render fija en el código, que
// se compilaba dentro del bundle si faltaba la variable.
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL,
  timeout: 20000
})

api.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

/** Extrae el mensaje de error de la API con un texto de reserva legible. */
export function mensajeDeError(error, porDefecto = 'Ocurrió un error inesperado') {
  if (error?.code === 'ECONNABORTED') return 'La petición tardó demasiado. Reintentá.'
  if (!error?.response) return 'No se pudo conectar con el servidor'
  if (error.response.status === 429) {
    return error.response.data?.error || 'Demasiadas peticiones. Esperá un momento.'
  }
  return error.response.data?.error || porDefecto
}

export default api
