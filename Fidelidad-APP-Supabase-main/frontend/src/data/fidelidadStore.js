import { reactive } from 'vue'
import api, { mensajeDeError } from '../services/api'

export const HOY = new Date().toISOString().slice(0, 10)

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

function diffDays(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000)
}

function formatDate(value) {
  if (!value) return 'Sin datos'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function isoAddDays(value, days) {
  const date = toDate(value)
  date.setDate(date.getDate() + Number(days || 0))
  return date.toISOString().slice(0, 10)
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

export function calcularIntervaloPromedio(compras = []) {
  const ordenadas = [...compras].sort((a, b) => toDate(a.fecha) - toDate(b.fecha))
  if (ordenadas.length < 2) return null
  let total = 0
  for (let i = 1; i < ordenadas.length; i++) total += diffDays(ordenadas[i - 1].fecha, ordenadas[i].fecha)
  return Number((total / (ordenadas.length - 1)).toFixed(1))
}

export function obtenerUltimaCompra(compras = []) {
  return [...compras].sort((a, b) => toDate(b.fecha) - toDate(a.fecha))[0] || null
}

export function estimarProximaCompra(compras = []) {
  const ultima = obtenerUltimaCompra(compras)
  const intervalo = calcularIntervaloPromedio(compras)
  if (!ultima || !intervalo) return null
  return isoAddDays(ultima.fecha, Math.round(intervalo))
}

/**
 * Enriquece al cliente con métricas de comportamiento.
 *
 * Los puntos y el nivel llegan calculados del backend y NO se recalculan aquí:
 * duplicar los umbrales en el frontend hacía que una regla cambiada en
 * levelStrategy.js dejara a las dos capas mostrando cosas distintas.
 */
export function analizarCliente(cliente) {
  const compras = cliente?.compras || []
  const puntos = Number(cliente?.puntos ?? 0)
  const nivel = cliente?.nivel || 'Bronce'
  const intervalo = calcularIntervaloPromedio(compras)
  const ultima = obtenerUltimaCompra(compras)
  const proxima = estimarProximaCompra(compras)

  let diasDesdeUltima = null
  let desviacion = 0
  let estado = 'Sin datos'
  let probabilidadRetorno = compras.length ? 45 : 20

  if (ultima && intervalo) {
    diasDesdeUltima = diffDays(ultima.fecha, HOY)
    desviacion = Number((((diasDesdeUltima - intervalo) / intervalo) * 100).toFixed(1))

    if (diasDesdeUltima <= intervalo) {
      estado = 'Activo'
      probabilidadRetorno = 90
    } else if (diasDesdeUltima <= intervalo * 1.5) {
      estado = 'En riesgo'
      probabilidadRetorno = 60
    } else if (diasDesdeUltima <= intervalo * 2.2) {
      estado = 'En riesgo'
      probabilidadRetorno = 35
    } else {
      estado = 'Inactivo'
      probabilidadRetorno = 15
    }
  }

  return {
    ...cliente,
    puntos,
    nivel,
    intervalo,
    frecuencia: intervalo ? `cada ${intervalo} días` : 'Sin datos',
    ultimaCompra: ultima ? formatDate(ultima.fecha) : 'Sin datos',
    ultimaCompraISO: ultima?.fecha || null,
    proximaCompra: proxima ? formatDate(proxima) : 'Sin datos',
    proximaCompraISO: proxima,
    diasDesdeUltima,
    desviacion,
    estado,
    probabilidadRetorno,
    totalCompras: compras.length
  }
}

export function getClientesAnalizados() {
  return state.clientes.map(analizarCliente)
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

export function recompensaSugerida(nivel) {
  if (!nivel) return null
  const disponibles = state.catalogo.filter(r => r.activo && r.nivel === nivel)
  if (disponibles.length) return disponibles[0]
  return state.catalogo.find(r => r.activo) || null
}

export function recompensasPorNivel(nivel) {
  // Solo muestra recompensas del nivel exacto del cliente (no acumulativas)
  if (!nivel) return []
  return state.catalogo.filter(r => r.activo && r.nivel === nivel)
}

export async function registrarCompra(clienteId, monto, fecha = HOY) {
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

export async function entregarRecompensa(clienteId, recompensaId, fecha = HOY) {
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
