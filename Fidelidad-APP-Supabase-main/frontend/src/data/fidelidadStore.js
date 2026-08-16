import { reactive } from 'vue'
import api, { mensajeDeError } from '../services/api'

/**
 * Fecha de hoy en formato ISO.
 *
 * Es una función y no una constante de módulo: el panel se deja abierto durante
 * toda la jornada, y una constante calculada al cargar seguiría diciendo "ayer"
 * después de medianoche, registrando compras con la fecha equivocada.
 */
export function hoy() {
  const ahora = new Date()
  const offset = ahora.getTimezoneOffset() * 60000
  return new Date(ahora.getTime() - offset).toISOString().slice(0, 10)
}

// Compatibilidad con el código que ya importaba HOY.
export const HOY = hoy()

/**
 * Listas permitidas. Deben coincidir con backend/validators/index.js:
 * el servidor rechaza con 422 cualquier valor fuera de ellas.
 */
export const NIVELES = Object.freeze(['Bronce', 'Plata', 'Oro'])
export const TIPOS_RECOMPENSA = Object.freeze(['Producto', 'Descuento', 'Experiencia', 'Servicio'])

export const state = reactive({
  clientes: [],
  catalogo: [],
  resumen: null,
  loading: false,
  error: ''
})

function toDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value) {
  if (!value) return 'Sin datos'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export async function cargarDatos() {
  state.loading = true
  state.error = ''
  try {
    const [clientesRes, recompensasRes] = await Promise.all([
      api.get('/fidelidad/clientes'),
      api.get('/fidelidad/recompensas')
    ])
    state.clientes = clientesRes.data || []
    state.catalogo = recompensasRes.data || []
  } catch (err) {
    state.error = mensajeDeError(err, 'No se pudieron cargar los datos')
    console.error(err)
  } finally {
    state.loading = false
  }
}

export async function cargarResumenAdministrativo() {
  state.loading = true
  state.error = ''

  try {
    // Endpoint autenticado: incluye las cifras de negocio que el resumen
    // público ya no expone.
    const { data } = await api.get('/fidelidad/resumen')
    state.resumen = data || null
    return state.resumen
  } catch (err) {
    state.error = mensajeDeError(err, 'No se pudo cargar el resumen administrativo')
    console.error(err)
    return null
  } finally {
    state.loading = false
  }
}

export function nivelClass(nivel) {
  const n = String(nivel || '').toLowerCase()
  if (n.includes('oro')) return 'gold'
  if (n.includes('plata')) return 'platinum'
  return 'bronze'
}

export function comprasOrdenadas(cliente) {
  return [...(cliente?.compras || [])].sort((a, b) => toDate(a.fecha) - toDate(b.fecha))
}

/**
 * Da formato de presentación a un cliente ya analizado por el backend.
 *
 * NO recalcula puntos, nivel, estado ni probabilidad de retorno: son reglas de
 * negocio y viven en FidelidadService. Cuando el frontend las duplicaba, un
 * cliente con una sola compra aparecía como "En observación" en el panel y
 * "Sin datos" en el listado, y dos compras el mismo día (intervalo 0) lo
 * dejaban en "Sin datos" en vez de "Activo".
 */
export function analizarCliente(cliente) {
  if (!cliente) return null

  const compras = cliente.compras || []
  const intervalo = cliente.intervalo ?? null
  const diasDesdeUltima = cliente.diasDesdeUltima ?? null

  // Desviación respecto al ritmo habitual de compra, solo para mostrar.
  const desviacion =
    intervalo > 0 && diasDesdeUltima !== null
      ? Number((((diasDesdeUltima - intervalo) / intervalo) * 100).toFixed(1))
      : 0

  return {
    ...cliente,
    puntos: Number(cliente.puntos ?? 0),
    nivel: cliente.nivel || 'Bronce',
    estado: cliente.estado || 'Sin datos',
    probabilidadRetorno: Number(cliente.probabilidadRetorno ?? 0),
    intervalo,
    frecuencia: intervalo === null ? 'Sin datos' : `cada ${intervalo} días`,
    ultimaCompra: cliente.ultimaCompra ? formatDate(cliente.ultimaCompra) : 'Sin datos',
    ultimaCompraISO: cliente.ultimaCompra || null,
    proximaCompra: cliente.proximaCompra ? formatDate(cliente.proximaCompra) : 'Sin datos',
    proximaCompraISO: cliente.proximaCompra || null,
    diasDesdeUltima,
    desviacion,
    totalCompras: cliente.totalCompras ?? compras.length
  }
}

export function getClientesAnalizados() {
  return state.clientes.map(analizarCliente).filter(Boolean)
}

/**
 * Devuelve null si el cliente no existe.
 *
 * Antes caía a state.clientes[0]: entrar a /admin/clientes/9999 mostraba el
 * perfil de OTRO cliente como si fuera ese, y "Enviar tarjeta" le mandaba el
 * correo a la persona equivocada.
 */
export function getCliente(id) {
  const clienteId = Number(id)
  if (!Number.isFinite(clienteId)) return null
  return state.clientes.find(c => Number(c.id) === clienteId) || null
}

/**
 * Recompensa sugerida para un nivel.
 *
 * Solo sugiere dentro del nivel del cliente. Antes caía a cualquier recompensa
 * activa de otro nivel: como el desplegable solo lista las del nivel exacto, el
 * id sugerido no existía entre las opciones, el select salía en blanco y el
 * botón "Entregar" quedaba activo, entregando una recompensa que nunca se
 * mostró en pantalla.
 */
export function recompensaSugerida(nivel) {
  if (!nivel) return null
  return state.catalogo.find(r => r.activo && r.nivel === nivel) || null
}

export function recompensasPorNivel(nivel) {
  // Solo muestra recompensas del nivel exacto del cliente (no acumulativas)
  if (!nivel) return []
  return state.catalogo.filter(r => r.activo && r.nivel === nivel)
}

export async function registrarCompra(clienteId, monto, fecha = hoy()) {
  if (!clienteId || !monto || Number(monto) <= 0) return null
  await api.post('/fidelidad/compras', { cliente_id: clienteId, monto: Number(monto), fecha })
  await cargarDatos()
  return analizarCliente(getCliente(clienteId))
}

export async function guardarCliente(payload) {
  const data = { nombre: payload.nombre, email: payload.email }
  let resultado = null
  if (payload.id) {
    resultado = await api.put(`/fidelidad/clientes/${payload.id}`, data)
  } else {
    resultado = await api.post('/fidelidad/clientes', data)
  }
  await cargarDatos()
  return resultado.data
}

export async function enviarTarjeta(clienteId) {
  const { data } = await api.post(`/fidelidad/clientes/${clienteId}/tarjeta`)
  return data
}

export async function listarTarjetasEnviadas() {
  const { data } = await api.get('/fidelidad/tarjetas')
  return data || []
}

export async function previsualizarTarjetaCliente(clienteId) {
  const { data } = await api.get(`/fidelidad/clientes/${clienteId}/tarjeta/preview`)
  return data.html
}

export async function previsualizarTarjetaEnviada(tarjetaId) {
  const { data } = await api.get(`/fidelidad/tarjetas/${tarjetaId}/preview`)
  return data.html
}

export async function eliminarCliente(id) {
  await api.delete(`/fidelidad/clientes/${id}`)
  await cargarDatos()
}

export async function guardarRecompensa(payload) {
  const data = {
    nombre: payload.nombre,
    nivel: payload.nivel,
    tipo: payload.tipo,
    detalle: payload.detalle,
    activo: Boolean(payload.activo)
  }
  if (payload.id) {
    await api.put(`/fidelidad/recompensas/${payload.id}`, data)
  } else {
    await api.post('/fidelidad/recompensas', data)
  }
  await cargarDatos()
}

export async function eliminarRecompensa(id) {
  await api.delete(`/fidelidad/recompensas/${id}`)
  await cargarDatos()
}

export async function entregarRecompensa(clienteId, recompensaId, fecha = hoy()) {
  if (!clienteId || !recompensaId) return null
  const { data } = await api.post('/fidelidad/reclamos', {
    cliente_id: clienteId,
    recompensa_id: recompensaId,
    fecha
  })
  await cargarDatos()
  return data
}

export { formatDate, mensajeDeError }
