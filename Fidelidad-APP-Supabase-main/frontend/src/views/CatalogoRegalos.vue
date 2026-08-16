<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Configuración</p>
        <h1>Catálogo de recompensas</h1>
      </div>
      <button class="primary-btn" @click="nuevo">Nueva recompensa</button>
    </div>

    <div v-if="error" class="alert-error">⚠ {{ error }}</div>

    <div class="crud-grid">
      <article class="panel-card form-card">
        <h2>{{ form.id ? 'Editar recompensa' : 'Crear recompensa' }}</h2>

        <label>Nombre de recompensa</label>
        <input v-model="form.nombre" placeholder="Ej. Sticker, chocolate, pan extra" />

        <label>Nivel sugerido</label>
        <select v-model="form.nivel">
          <option>Bronce</option>
          <option>Plata</option>
          <option>Oro</option>
        </select>

        <label>Tipo de recompensa</label>
        <select v-model="form.tipo">
          <option>Producto</option>
          <option>Descuento</option>
          <option>Servicio</option>
          <option>Promoción</option>
        </select>

        <label>Detalle</label>
        <input v-model="form.detalle" placeholder="Descripción corta" />

        <label class="check-line"><input type="checkbox" v-model="form.activo" /> Activo</label>

        <div class="actions-row">
          <button class="primary-btn" @click="guardar" :disabled="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
          <button class="ghost-btn" @click="nuevo" :disabled="guardando">Limpiar</button>
        </div>
      </article>

      <article class="panel-card table-card">
        <h2>Recompensas disponibles</h2>
        <table>
          <thead><tr><th>Recompensa</th><th>Nivel</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            <tr v-for="r in catalogo" :key="r.id">
              <td><strong>{{ r.nombre }}</strong><br><small>{{ r.detalle }}</small></td>
              <td><span class="badge" :class="nivelClass(r.nivel)">{{ r.nivel }}</span></td>
              <td>{{ r.tipo }}</td>
              <td><span class="status" :class="r.activo ? 'ok' : 'warn'">{{ r.activo ? 'Activo' : 'Inactivo' }}</span></td>
              <td class="row-actions"><button @click="editar(r)">Editar</button><button class="delete" @click="eliminar(r.id)">Eliminar</button></td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  </section>
</template>

<script>
import { state, cargarDatos, guardarRecompensa, eliminarRecompensa, nivelClass, mensajeDeError } from '../data/fidelidadStore'

const emptyForm = () => ({ id: null, nombre: '', nivel: 'Bronce', tipo: 'Producto', detalle: '', activo: true })

export default {
  name: 'CatalogoRegalos',
  data() {
    return { form: emptyForm(), error: '', guardando: false }
  },
  mounted() {
    cargarDatos()
  },
  computed: {
    catalogo() {
      return state.catalogo
    }
  },
  methods: {
    nivelClass,
    nuevo() {
      this.form = emptyForm()
    },
    editar(r) {
      this.form = { ...r }
    },
    async guardar() {
      this.error = ''
      if (!this.form.nombre.trim()) {
        this.error = 'El nombre de la recompensa es obligatorio'
        return
      }

      this.guardando = true
      try {
        await guardarRecompensa({ ...this.form })
        this.nuevo()
      } catch (err) {
        this.error = mensajeDeError(err, 'No se pudo guardar la recompensa')
      } finally {
        this.guardando = false
      }
    },
    async eliminar(id) {
      if (!confirm('¿Eliminar esta recompensa?')) return
      this.error = ''
      try {
        await eliminarRecompensa(id)
      } catch (err) {
        this.error = mensajeDeError(err, 'No se pudo eliminar la recompensa')
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
</style>
