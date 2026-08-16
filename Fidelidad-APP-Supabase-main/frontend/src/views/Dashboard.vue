<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Resumen interno</p>
        <h1>Panel principal</h1>
      </div>
      <span class="date-pill">{{ fechaActual }}</span>
    </div>

    <p v-if="state.error" class="soft-link">{{ state.error }}</p>

    <div class="stats-grid">
      <article class="stat-card">
        <span>Clientes totales</span>
        <strong>{{ resumen.totalClientes }}</strong>
      </article>

      <article class="stat-card">
        <span>Compras registradas</span>
        <strong>{{ resumen.totalCompras }}</strong>
      </article>

      <article class="stat-card">
        <span>Puntos generados</span>
        <strong>{{ resumen.puntosGenerados }}</strong>
      </article>

      <article class="stat-card danger">
        <span>En riesgo</span>
        <strong>{{ resumen.totalClientesEnRiesgo }}</strong>
      </article>

      <article class="stat-card">
        <span>Prob. retorno prom.</span>
        <strong>{{ resumen.retornoPromedio }}%</strong>
      </article>

      <article class="stat-card">
        <span>Ticket promedio</span>
        <strong>${{ resumen.ticketPromedio.toFixed(2) }}</strong>
      </article>
    </div>

    <div class="dashboard-grid">
      <article class="panel-card">
        <h2>Distribución por nivel interno</h2>

        <div class="level-row" v-for="nivel in niveles" :key="nivel.nombre">
          <span class="badge" :class="nivel.clase">{{ nivel.nombre }}</span>
          <div class="bar">
            <i :style="{ width: nivel.porcentaje + '%' }"></i>
          </div>
          <strong>{{ nivel.total }}</strong>
        </div>
      </article>

      <article class="panel-card">
        <h2>Clientes en riesgo</h2>

        <div class="risk-row" v-for="c in clientesRiesgo" :key="c.id">
          <strong>{{ c.nombre }}</strong>
          <span>{{ c.probabilidadRetorno }}% retorno · {{ c.estado }}</span>
        </div>

        <p v-if="!clientesRiesgo.length" class="soft-link">
          No hay clientes en riesgo.
        </p>
      </article>
    </div>
  </section>
</template>

<script>
import { state, cargarResumenAdministrativo, nivelClass } from '../data/fidelidadStore'

const resumenVacio = {
  totalClientes: 0,
  totalCompras: 0,
  puntosGenerados: 0,
  recompensasDisponibles: 0,
  recompensasEntregadas: 0,
  retornoPromedio: 0,
  totalClientesEnRiesgo: 0,
  ticketPromedio: 0,
  clientesPorNivel: [],
  clientesEnRiesgo: []
}

export default {
  name: 'Dashboard',

  data() {
    return {
      state
    }
  },

  mounted() {
    cargarResumenAdministrativo()
  },

  computed: {
    fechaActual() {
      return new Date().toLocaleDateString('es-EC')
    },

    resumen() {
      return this.state.resumen || resumenVacio
    },

    clientesRiesgo() {
      return this.resumen.clientesEnRiesgo || []
    },

    niveles() {
      return (this.resumen.clientesPorNivel || []).map(item => ({
        nombre: item.nivel,
        total: item.total,
        porcentaje: item.porcentaje,
        clase: nivelClass(item.nivel)
      }))
    }
  }
}
</script>