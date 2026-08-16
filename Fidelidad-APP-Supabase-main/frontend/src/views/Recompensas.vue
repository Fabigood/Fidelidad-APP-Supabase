<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Incentivos internos</p>
        <h1>Gestionar recompensas</h1>
      </div>
    </div>

    <div class="notice">El cliente no conoce el nivel interno. El local siempre puede entregar una recompensa sorpresa; mientras mayor sea el nivel, mejor será el regalo sugerido.</div>

    <div class="two-cols">
      <!-- ── PASO 1: Seleccionar cliente (dropdown, no input FK) ── -->
      <article class="panel-card form-card">
        <h2><span class="step-badge">1</span> Seleccionar cliente</h2>
        <label for="recompensa-cliente">
          Cliente <span class="required-mark" aria-hidden="true">*</span>
        </label>
        <select id="recompensa-cliente" v-model.number="clienteId">
          <option value="" disabled>— Elige un cliente —</option>
          <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }} — {{ c.email }}</option>
        </select>

        <div class="mini-profile" v-if="cliente">
          <div class="mini-top">
            <strong>{{ cliente.nombre }}</strong>
            <span class="status" :class="cliente.estado === 'Activo' ? 'ok' : 'warn'">{{ cliente.estado }}</span>
          </div>
          <div class="info-list compact">
            <p><span>Nivel interno</span><strong><em class="badge" :class="nivelClass(cliente.nivel)">{{ cliente.nivel }}</em></strong></p>
            <p><span>Puntos</span><strong>{{ cliente.puntos }} pts</strong></p>
            <p><span>Frecuencia</span><strong>{{ cliente.frecuencia }}</strong></p>
            <p><span>Probabilidad regreso</span><strong>{{ cliente.probabilidadRetorno }}%</strong></p>
            <p><span>Recompensa sugerida</span><strong>{{ sugerida?.nombre || 'Sin catálogo' }}</strong></p>
          </div>
        </div>
      </article>

      <!-- ── PASO 2: Dropdown de recompensas cargado según nivel del cliente ── -->
      <article class="panel-card">
        <h2><span class="step-badge">2</span> Seleccionar recompensa</h2>

        <div v-if="!clienteId" class="cascade-hint">
          ⬅ Primero selecciona un cliente para ver las recompensas disponibles para su nivel.
        </div>

        <template v-if="clienteId && cliente">
          <label for="recompensa-seleccion">
            Recompensas disponibles para nivel
            <em class="badge" :class="nivelClass(cliente.nivel)">{{ cliente.nivel }}</em>
          </label>

          <!-- Dropdown que se carga dinámicamente según el nivel del cliente seleccionado -->
          <select id="recompensa-seleccion" v-model.number="recompensaId" class="reward-select">
            <option value="" disabled>— Elige una recompensa —</option>
            <option
              v-for="item in recompensasDisponibles"
              :key="item.id"
              :value="item.id"
            >
              {{ item.nombre }} · {{ item.tipo }} · {{ item.detalle }}
            </option>
          </select>

          <p class="helper-text" v-if="recompensasDisponibles.length === 0">
            No hay recompensas configuradas para el nivel {{ cliente.nivel }}.
          </p>

          <!-- Detalle de la recompensa seleccionada -->
          <div class="reward-preview" v-if="recompensaSeleccionada">
            <strong>{{ recompensaSeleccionada.nombre }}</strong>
            <span>{{ recompensaSeleccionada.tipo }} · {{ recompensaSeleccionada.detalle }}</span>
          </div>

          <div class="actions-row">
            <button class="primary-btn" @click="entregar" :disabled="!recompensaSeleccionada || entregando">
              {{ entregando ? 'Entregando…' : 'Entregar recompensa' }}
            </button>
          </div>
          <p v-if="mensaje" class="success-msg" role="status">
            <span aria-hidden="true">✓</span> {{ mensaje }}
          </p>
          <div v-if="error" class="alert-error" role="alert">
            <span aria-hidden="true">⚠</span> {{ error }}
          </div>
        </template>
      </article>
    </div>

    <article class="panel-card table-card" v-if="historial.length">
      <h2>Historial de recompensas entregadas</h2>
      <table>
        <thead><tr><th>Fecha</th><th>Recompensa</th><th>Tipo</th><th>Nivel</th></tr></thead>
        <tbody>
          <tr v-for="h in historial" :key="h.id">
            <td>{{ h.fecha }}</td><td>{{ h.recompensa }}</td><td>{{ h.tipo }}</td><td>{{ h.nivel }}</td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>

<script>
import { hoy, cargarDatos, getClientesAnalizados, getCliente, analizarCliente, recompensaSugerida, recompensasPorNivel, entregarRecompensa, nivelClass, mensajeDeError } from '../data/fidelidadStore'

export default {
  name: 'Recompensas',
  data() {
    return {
      clienteId: '',
      recompensaId: null,
      mensaje: '',
      error: '',
      entregando: false
    }
  },
  mounted() {
    cargarDatos()
  },
  computed: {
    clientes() {
      return getClientesAnalizados()
    },
    clienteBase() {
      return getCliente(this.clienteId)
    },
    cliente() {
      return this.clienteBase ? analizarCliente(this.clienteBase) : null
    },
    sugerida() {
      return recompensaSugerida(this.cliente?.nivel)
    },
    // Recompensas filtradas por nivel del cliente seleccionado (cascade)
    recompensasDisponibles() {
      return recompensasPorNivel(this.cliente?.nivel)
    },
    recompensaSeleccionada() {
      return this.recompensasDisponibles.find(r => r.id === this.recompensaId) || null
    },
    historial() {
      return [...(this.clienteBase?.recompensasEntregadas || [])].reverse()
    }
  },
  watch: {
    // Al cambiar de cliente, preseleccionar la recompensa sugerida.
    // Un solo watcher sobre las opciones disponibles: antes había dos
    // (clienteId y sugerida) que se pisaban entre sí según el orden de
    // evaluación, y además el @change del select ya ponía recompensaId a null.
    recompensasDisponibles: {
      immediate: true,
      handler(opciones) {
        const sigueSiendoValida = opciones.some(r => r.id === this.recompensaId)
        if (sigueSiendoValida) return

        // Solo se preselecciona algo que exista realmente en el desplegable.
        this.recompensaId = this.sugerida?.id ?? opciones[0]?.id ?? null
        this.mensaje = ''
      }
    }
  },
  methods: {
    nivelClass,
    async entregar() {
      this.error = ''
      this.mensaje = ''

      if (!this.clienteId || !this.recompensaId) {
        this.error = 'Seleccioná un cliente y una recompensa'
        return
      }

      const item = this.recompensaSeleccionada
      this.entregando = true
      try {
        const registro = await entregarRecompensa(this.clienteId, this.recompensaId, hoy())
        if (registro) this.mensaje = 'Recompensa entregada: ' + (item ? item.nombre : 'registrada')
      } catch (err) {
        this.error = mensajeDeError(err, 'No se pudo entregar la recompensa')
      } finally {
        this.entregando = false
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

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--accent, #6366f1);
  color: #fff;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  margin-right: 6px;
}
.required-mark {
  color: #e74c3c;
  font-size: 0.85em;
  margin-left: 2px;
}
.cascade-hint {
  color: var(--text-muted, #888);
  font-size: 0.9rem;
  padding: 16px;
  text-align: center;
  border: 2px dashed var(--border, #ddd);
  border-radius: 8px;
  margin-top: 8px;
}
.reward-select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border, #ddd);
  font-size: 0.9rem;
  margin-bottom: 10px;
}
.reward-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface2, #f8f8f8);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 0.9rem;
}
</style>
