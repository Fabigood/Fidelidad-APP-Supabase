<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Fidelización</p>
        <h1>Tarjetas enviadas</h1>
      </div>
    </div>

    <article class="panel-card table-card">
      <div class="table-head">
        <h2 id="titulo-historial">Historial de envíos</h2>
        <div>
          <label for="buscar-tarjeta" class="sr-only">Buscar tarjetas por cliente o correo</label>
          <input
            id="buscar-tarjeta"
            v-model="filtro"
            type="search"
            class="search"
            placeholder="Buscar por cliente o correo..."
          />
        </div>
      </div>

      <div v-if="cargando" class="helper-text" role="status">Cargando tarjetas…</div>
      <div v-else-if="error" class="alert-error" role="alert">
        <span aria-hidden="true">⚠</span> {{ error }}
      </div>
      <div v-else-if="!totalItems" class="helper-text">
        {{ tarjetas.length ? 'No se encontraron tarjetas para esa búsqueda.' : 'Todavía no se envió ninguna tarjeta de fidelidad.' }}
      </div>

      <template v-else>
        <table aria-describedby="titulo-historial">
          <caption class="sr-only">
            Tarjetas de fidelidad enviadas, con el nivel y los puntos que tenía el cliente al enviarla
          </caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Correo</th>
              <th scope="col">Nivel</th>
              <th scope="col">Puntos al enviar</th>
              <th scope="col">Fecha de envío</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in itemsPagina" :key="t.id">
              <th scope="row">
                <!-- Antes era un <strong> con @click: invisible para el teclado
                     y no se anunciaba como elemento interactivo. -->
                <button
                  type="button"
                  class="cliente-link"
                  @click="$router.push('/admin/clientes/' + t.clienteId)"
                >
                  {{ t.nombre }}
                </button>
              </th>
              <td>{{ t.email }}</td>
              <td><span class="badge" :class="nivelClass(t.nivel)">{{ t.nivel }}</span></td>
              <td>{{ t.puntos }} pts</td>
              <td>{{ formatFechaHora(t.fechaEnvio) }}</td>
              <td>
                <button @click="verTarjeta(t)">
                  Vista previa<span class="sr-only"> de la tarjeta de {{ t.nombre }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <PaginacionTabla
          :total-items="totalItems"
          :pagina-actual="paginaActual"
          :por-pagina="porPagina"
          etiqueta="tarjetas"
          @cambiar-pagina="cambiarPagina"
          @cambiar-tamano="cambiarTamano"
        />
      </template>
    </article>

    <TarjetaPreviewModal
      :visible="previewVisible"
      :html="previewHtml"
      :cargando="previewCargando"
      :error="previewError"
      @close="previewVisible = false"
    />
  </section>
</template>

<script>
import { listarTarjetasEnviadas, previsualizarTarjetaEnviada, nivelClass, mensajeDeError } from '../data/fidelidadStore'
import TarjetaPreviewModal from '../components/TarjetaPreviewModal.vue'
import PaginacionTabla from '../components/PaginacionTabla.vue'
import { paginacionMixin } from '../utils/paginacion'

export default {
  name: 'Tarjetas',
  components: { TarjetaPreviewModal, PaginacionTabla },
  mixins: [paginacionMixin],
  data() {
    return {
      filtro: '',
      tarjetas: [],
      cargando: true,
      error: '',
      previewVisible: false,
      previewHtml: '',
      previewCargando: false,
      previewError: ''
    }
  },
  computed: {
    itemsPaginables() {
      const term = this.filtro.trim().toLowerCase()
      if (!term) return this.tarjetas
      return this.tarjetas.filter(t => (t.nombre + ' ' + t.email).toLowerCase().includes(term))
    }
  },
  watch: {
    filtro() {
      this.reiniciarPaginacion()
    }
  },
  async mounted() {
    try {
      this.tarjetas = await listarTarjetasEnviadas()
    } catch (err) {
      this.error = mensajeDeError(err, 'No se pudo cargar el historial de tarjetas')
    } finally {
      this.cargando = false
    }
  },
  methods: {
    nivelClass,
    formatFechaHora(value) {
      if (!value) return 'Sin datos'
      const fecha = new Date(value)
      return fecha.toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    },
    async verTarjeta(t) {
      this.previewVisible = true
      this.previewCargando = true
      this.previewError = ''
      this.previewHtml = ''
      try {
        this.previewHtml = await previsualizarTarjetaEnviada(t.id)
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
.cliente-link {
  cursor: pointer;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: bold;
  text-align: left;
}
.cliente-link:hover {
  text-decoration: underline;
}
.alert-error {
  background: #fdecea;
  border: 1px solid #e74c3c;
  color: #c0392b;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.875rem;
}
</style>
