<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Transacciones</p>
        <h1>Registrar compra</h1>
      </div>
    </div>

    <div class="two-cols">
      <article class="panel-card form-card">
        <h2>Datos de la compra</h2>

        <!-- ── Selector de cliente (Requisito 2: dropdown con búsqueda, no input FK) ── -->
        <label for="buscar-cliente-compra">Buscar cliente</label>
        <!-- Buscar ya no borra la selección: hacerlo ocultaba el formulario
             (está bajo v-if="clienteId") y se perdía el monto ya escrito. -->
        <input
          id="buscar-cliente-compra"
          v-model="busquedaCliente"
          type="search"
          class="search-inline"
          placeholder="Buscar cliente por nombre o correo…"
        />

        <label for="select-cliente-compra">
          Cliente <span class="required-mark" aria-hidden="true">*</span>
        </label>

        <select
          id="select-cliente-compra"
          v-model.number="clienteId"
          size="5"
          class="select-list"
          required
        >
          <option v-if="clientesFiltrados.length === 0" disabled value="">Sin resultados</option>
          <option
            v-for="c in clientesFiltrados"
            :key="c.id"
            :value="c.id"
          >
            {{ c.nombre }} — {{ c.email }}
          </option>
        </select>

        <p class="helper-text" v-if="!clienteId">Busca y selecciona un cliente de la lista.</p>

        <template v-if="clienteId">
          <label for="compra-monto">
            Monto ($) <span class="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="compra-monto"
            v-model.number="monto"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required
            aria-describedby="ayuda-puntos"
          />

          <!-- max impide registrar compras con fecha futura -->
          <label for="compra-fecha">Fecha</label>
          <input id="compra-fecha" v-model="fecha" type="date" :max="maxFecha" required />

          <div class="points-preview" id="ayuda-puntos" aria-live="polite">
            <span>Puntos a generar</span>
            <strong>{{ puntosGenerados }} pts</strong>
          </div>

          <div class="actions-row">
            <button class="primary-btn" @click="registrar" :disabled="guardando">
              {{ guardando ? 'Registrando…' : 'Registrar compra' }}
            </button>
            <button class="ghost-btn" @click="limpiar" :disabled="guardando">Limpiar</button>
          </div>
        </template>
      </article>

      <article class="panel-card profile-card" v-if="cliente">
        <h2>Perfil del cliente</h2>
        <div class="profile-head">
          <div class="avatar">{{ iniciales(cliente.nombre) }}</div>
          <div>
            <h3>{{ cliente.nombre }}</h3>
            <p>{{ cliente.email }}</p>
          </div>
          <span class="status" :class="cliente.estado === 'Activo' ? 'ok' : 'warn'">{{ cliente.estado }}</span>
        </div>

        <div class="info-list">
          <p><span>Nivel interno</span><strong><em class="badge" :class="nivelClass(cliente.nivel)">{{ cliente.nivel }}</em></strong></p>
          <p><span>Puntos acumulados</span><strong>{{ cliente.puntos }} pts</strong></p>
          <p><span>Frecuencia</span><strong>{{ cliente.frecuencia }}</strong></p>
          <p><span>Última compra</span><strong>{{ cliente.ultimaCompra }}</strong></p>
          <p><span>Próxima esperada</span><strong>{{ cliente.proximaCompra }}</strong></p>
          <p><span>Probabilidad de regreso</span><strong>{{ cliente.probabilidadRetorno }}%</strong></p>
        </div>
      </article>
    </div>

    <div v-if="error" class="alert-error" role="alert">
      <span aria-hidden="true">⚠</span> {{ error }}
    </div>
    <div v-if="mensajeExito" class="alert-success" role="status">
      <span aria-hidden="true">✔</span> {{ mensajeExito }}
    </div>
  </section>
</template>

<script>
import { hoy, cargarDatos, getClientesAnalizados, registrarCompra, nivelClass, mensajeDeError } from '../data/fidelidadStore'

export default {
  name: 'RegistrarCompra',
  data() {
    return {
      clienteId: null,
      busquedaCliente: '',
      monto: null,
      fecha: hoy(),
      guardando: false,
      error: '',
      mensajeExito: ''
    }
  },
  mounted() {
    cargarDatos()
  },
  computed: {
    clientes() {
      return getClientesAnalizados()
    },
    clientesFiltrados() {
      const term = this.busquedaCliente.trim().toLowerCase()
      if (!term) return this.clientes
      return this.clientes.filter(c =>
        (c.nombre + ' ' + c.email).toLowerCase().includes(term)
      )
    },
    cliente() {
      return this.clientes.find(c => c.id === this.clienteId) || null
    },
    puntosGenerados() {
      return this.monto > 0 ? Math.floor(this.monto) : 0
    },
    maxFecha() {
      return hoy()
    }
  },
  methods: {
    nivelClass,
    iniciales(nombre) {
      return String(nombre).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()
    },
    async registrar() {
      this.error = ''
      this.mensajeExito = ''

      if (!this.clienteId) {
        this.error = 'Seleccioná un cliente'
        return
      }
      if (!this.monto || this.monto <= 0) {
        this.error = 'El monto debe ser mayor a cero'
        return
      }
      if (this.fecha > hoy()) {
        this.error = 'La fecha no puede ser posterior a hoy'
        return
      }

      this.guardando = true
      try {
        await registrarCompra(this.clienteId, this.monto, this.fecha)
        this.mensajeExito = 'Compra registrada correctamente'
        this.monto = null
        setTimeout(() => { this.mensajeExito = '' }, 4000)
      } catch (err) {
        this.error = mensajeDeError(err, 'No se pudo registrar la compra')
      } finally {
        this.guardando = false
      }
    },
    limpiar() {
      this.monto = null
      this.fecha = hoy()
      this.clienteId = null
      this.busquedaCliente = ''
      this.error = ''
      this.mensajeExito = ''
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

.required-mark {
  color: #e74c3c;
  font-size: 0.85em;
  margin-left: 2px;
}
.search-inline {
  width: 100%;
  margin-bottom: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  font-size: 0.9rem;
}
.select-list {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border, #ddd);
  padding: 4px;
  font-size: 0.9rem;
  margin-bottom: 10px;
}
.select-list option {
  padding: 6px 8px;
}
</style>
