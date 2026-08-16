<template>
  <section class="page fade-in" v-if="cliente">
    <div class="client-header">
      <div class="avatar big">{{ iniciales(cliente.nombre) }}</div>
      <div>
        <h1>{{ cliente.nombre }}</h1>
        <p>{{ cliente.email }}</p>
      </div>
      <span class="status" :class="cliente.estado === 'Activo' ? 'ok' : 'warn'">{{ cliente.estado }}</span>
      <button class="primary-btn" :disabled="enviando" @click="enviarTarjetaCliente">
        {{ enviando ? 'Enviando…' : 'Enviar tarjeta' }}
      </button>
      <button @click="verTarjeta">Vista previa</button>
    </div>
    <p v-if="mensajeTarjeta" class="tarjeta-mensaje" :class="{ error: errorTarjeta }">{{ mensajeTarjeta }}</p>

    <TarjetaPreviewModal
      :visible="previewVisible"
      :html="previewHtml"
      :cargando="previewCargando"
      :error="previewError"
      @close="previewVisible = false"
    />

    <div class="stats-grid four">
      <article class="stat-card"><span>Puntos acumulados</span><strong>{{ cliente.puntos }}</strong></article>
      <article class="stat-card"><span>Nivel interno</span><strong>{{ cliente.nivel }}</strong></article>
      <article class="stat-card"><span>Compras totales</span><strong>{{ cliente.totalCompras }}</strong></article>
      <article class="stat-card"><span>Prob. regreso</span><strong>{{ cliente.probabilidadRetorno }}%</strong></article>
    </div>

    <div class="dashboard-grid">
      <article class="panel-card">
        <h2>Análisis de comportamiento</h2>
        <div class="info-list">
          <p><span>Frecuencia de compra</span><strong>{{ cliente.frecuencia }}</strong></p>
          <p><span>Intervalo promedio</span><strong>{{ cliente.intervalo || 'Sin datos' }} días</strong></p>
          <p><span>Desviación actual</span><strong :class="cliente.desviacion > 0 ? 'text-danger' : ''">{{ cliente.desviacion }}%</strong></p>
          <p><span>Última compra</span><strong>{{ cliente.ultimaCompra }}</strong></p>
          <p><span>Próxima esperada</span><strong>{{ cliente.proximaCompra }}</strong></p>
        </div>
      </article>

      <article class="panel-card table-card">
        <h2>Historial de compras</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Monto</th><th>Puntos</th></tr></thead>
          <tbody>
            <tr v-for="compra in compras" :key="compra.id">
              <td>{{ formatDate(compra.fecha) }}</td>
              <td>${{ Number(compra.monto).toFixed(2) }}</td>
              <td>{{ Math.floor(compra.monto) }} pts</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  </section>

  <section class="page fade-in" v-else-if="state.loading">
    <p class="helper-text">Cargando cliente…</p>
  </section>

  <section class="page fade-in" v-else>
    <div class="alert-error">
      ⚠ No se encontró el cliente solicitado. Puede que haya sido eliminado.
    </div>
    <button class="primary-btn" @click="$router.push('/admin/clientes')">
      Volver al listado
    </button>
  </section>
</template>

<script>
import { state, cargarDatos, getCliente, analizarCliente, comprasOrdenadas, formatDate, enviarTarjeta, previsualizarTarjetaCliente, mensajeDeError } from '../data/fidelidadStore'
import TarjetaPreviewModal from '../components/TarjetaPreviewModal.vue'

export default {
  name: 'ClientePerfil',
  components: { TarjetaPreviewModal },
  data() {
    return {
      state,
      enviando: false,
      mensajeTarjeta: '',
      errorTarjeta: false,
      previewVisible: false,
      previewHtml: '',
      previewCargando: false,
      previewError: ''
    }
  },
  mounted() {
    cargarDatos()
  },
  computed: {
    clienteBase() {
      return getCliente(this.$route.params.id)
    },
    cliente() {
      return this.clienteBase ? analizarCliente(this.clienteBase) : null
    },
    compras() {
      return this.clienteBase ? comprasOrdenadas(this.clienteBase).slice().reverse() : []
    }
  },
  methods: {
    formatDate,
    iniciales(nombre) {
      return String(nombre).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
    },
    async enviarTarjetaCliente() {
      this.enviando = true
      this.mensajeTarjeta = ''
      this.errorTarjeta = false
      try {
        await enviarTarjeta(this.cliente.id)
        this.mensajeTarjeta = `Tarjeta enviada a ${this.cliente.email}`
      } catch (err) {
        this.errorTarjeta = true
        this.mensajeTarjeta = mensajeDeError(err, 'No se pudo enviar la tarjeta de fidelidad')
      } finally {
        this.enviando = false
      }
    },
    async verTarjeta() {
      this.previewVisible = true
      this.previewCargando = true
      this.previewError = ''
      this.previewHtml = ''
      try {
        this.previewHtml = await previsualizarTarjetaCliente(this.cliente.id)
      } catch (err) {
        this.previewError = mensajeDeError(err, 'No se pudo cargar la vista previa')
      } finally {
        this.previewCargando = false
      }
    }
  }
}
</script>

<style scoped>
.alert-error {
  background: #fdecea;
  border: 1px solid #e74c3c;
  color: #c0392b;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.875rem;
  margin-bottom: 10px;
}
.alert-success {
  background: #eafaf1;
  border: 1px solid #2ecc71;
  color: #1e8449;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.875rem;
  margin-bottom: 10px;
}

.tarjeta-mensaje {
  margin: -8px 0 16px;
  color: #1e8449;
  font-size: 0.875rem;
}
.tarjeta-mensaje.error {
  color: #c0392b;
}
</style>
