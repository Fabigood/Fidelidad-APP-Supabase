<template>
  <section class="page fade-in">
    <div class="page-head">
      <div><p class="eyebrow">Analítica</p><h1>Estadísticas</h1></div>
    </div>

    <div v-if="state.error" class="alert-error" role="alert">
      <span aria-hidden="true">⚠</span> {{ state.error }}
    </div>
    <p v-else-if="state.loading" class="helper-text" role="status">Cargando estadísticas…</p>

    <div class="stats-grid">
      <article class="stat-card"><span>Retención estimada</span><strong>{{ retornoPromedio }}%</strong></article>
      <article class="stat-card"><span>Promedio recompra</span><strong>{{ promedioRecompra }} días</strong></article>
      <article class="stat-card danger"><span>Clientes en riesgo</span><strong>{{ clientesRiesgo }}</strong></article>
      <article class="stat-card"><span>Regalos entregados</span><strong>{{ regalosEntregados }}</strong></article>
    </div>

    <article class="panel-card table-card">
      <h2 id="titulo-indicadores">Indicadores por cliente</h2>

      <p v-if="!totalItems" class="helper-text">Todavía no hay clientes para analizar.</p>

      <template v-else>
        <table aria-describedby="titulo-indicadores">
          <caption class="sr-only">
            Indicadores de comportamiento por cliente: nivel, frecuencia de compra,
            probabilidad de regreso y estado
          </caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Nivel</th>
              <th scope="col">Frecuencia</th>
              <th scope="col">Prob. regreso</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in itemsPagina" :key="c.id">
              <th scope="row">{{ c.nombre }}</th>
              <td><span class="badge" :class="nivelClass(c.nivel)">{{ c.nivel }}</span></td>
              <td>{{ c.frecuencia }}</td>
              <td>{{ c.probabilidadRetorno }}%</td>
              <td><span class="status" :class="c.estado === 'Activo' ? 'ok' : 'warn'">{{ c.estado }}</span></td>
            </tr>
          </tbody>
        </table>

        <PaginacionTabla
          :total-items="totalItems"
          :pagina-actual="paginaActual"
          :por-pagina="porPagina"
          etiqueta="clientes"
          @cambiar-pagina="cambiarPagina"
          @cambiar-tamano="cambiarTamano"
        />
      </template>
    </article>
  </section>
</template>

<script>
import { state, cargarDatos, getClientesAnalizados, nivelClass } from '../data/fidelidadStore'
import PaginacionTabla from '../components/PaginacionTabla.vue'
import { paginacionMixin } from '../utils/paginacion'

export default {
  name: 'Estadisticas',
  components: { PaginacionTabla },
  mixins: [paginacionMixin],
  data() {
    return { state }
  },
  mounted() {
    cargarDatos()
  },
  computed: {
    itemsPaginables() {
      return this.clientes
    },
    clientes() {
      return getClientesAnalizados()
    },
    retornoPromedio() {
      if (!this.clientes.length) return 0
      return Math.round(this.clientes.reduce((t, c) => t + c.probabilidadRetorno, 0) / this.clientes.length)
    },
    promedioRecompra() {
      // filter(Boolean) descartaba el intervalo 0 (varias compras el mismo día),
      // que es un dato válido y no una ausencia.
      const intervalos = this.clientes.map(c => c.intervalo).filter(i => i !== null && i !== undefined)
      if (!intervalos.length) return 0
      return (intervalos.reduce((t, x) => t + x, 0) / intervalos.length).toFixed(1)
    },
    clientesRiesgo() {
      return this.clientes.filter(c => c.estado !== 'Activo').length
    },
    regalosEntregados() {
      return this.clientes.reduce((t, c) => t + (c.recompensasEntregadas?.length || 0), 0)
    }
  },
  methods: { nivelClass }
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
  margin-bottom: 12px;
}
</style>
