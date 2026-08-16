<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Configuración</p>
        <h1>Catálogo de recompensas</h1>
      </div>
      <button class="primary-btn" @click="nuevo">Nueva recompensa</button>
    </div>

    <div v-if="error" class="alert-error" role="alert">
      <span aria-hidden="true">⚠</span> {{ error }}
    </div>

    <div class="crud-grid">
      <article class="panel-card form-card">
        <h2 id="titulo-form-recompensa">{{ form.id ? 'Editar recompensa' : 'Crear recompensa' }}</h2>

        <form aria-labelledby="titulo-form-recompensa" @submit.prevent="guardar">
          <label for="recompensa-nombre">
            Nombre de recompensa <span class="required-mark" aria-hidden="true">*</span>
          </label>
          <input
            id="recompensa-nombre"
            v-model="form.nombre"
            required
            maxlength="120"
            placeholder="Ej. Sticker, chocolate, pan extra"
          />

          <label for="recompensa-nivel">Nivel sugerido</label>
          <select id="recompensa-nivel" v-model="form.nivel">
            <option v-for="nivel in NIVELES" :key="nivel" :value="nivel">{{ nivel }}</option>
          </select>

          <!-- Las opciones salen de la misma lista que valida el backend.
               Estaban escritas a mano: ofrecían "Promoción", que el servidor
               rechaza con 422, y omitían "Experiencia", que sí usa el catálogo
               inicial. -->
          <label for="recompensa-tipo">Tipo de recompensa</label>
          <select id="recompensa-tipo" v-model="form.tipo">
            <option v-for="tipo in TIPOS_RECOMPENSA" :key="tipo" :value="tipo">{{ tipo }}</option>
          </select>

          <label for="recompensa-detalle">Detalle</label>
          <input
            id="recompensa-detalle"
            v-model="form.detalle"
            maxlength="500"
            placeholder="Descripción corta"
          />

          <label class="check-line" for="recompensa-activo">
            <input id="recompensa-activo" type="checkbox" v-model="form.activo" /> Activo
          </label>

          <div class="actions-row">
            <button class="primary-btn" type="submit" :disabled="guardando">
              {{ guardando ? 'Guardando…' : 'Guardar' }}
            </button>
            <button class="ghost-btn" type="button" @click="nuevo" :disabled="guardando">Limpiar</button>
          </div>
        </form>
      </article>

      <article class="panel-card table-card">
        <h2 id="titulo-catalogo">Recompensas disponibles</h2>

        <p v-if="!totalItems" class="helper-text">Todavía no hay recompensas en el catálogo.</p>

        <template v-else>
          <table aria-describedby="titulo-catalogo">
            <caption class="sr-only">Recompensas del catálogo, con su nivel, tipo y estado</caption>
            <thead>
              <tr>
                <th scope="col">Recompensa</th>
                <th scope="col">Nivel</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in itemsPagina" :key="r.id">
                <th scope="row">
                  <strong>{{ r.nombre }}</strong><br /><small>{{ r.detalle }}</small>
                </th>
                <td><span class="badge" :class="nivelClass(r.nivel)">{{ r.nivel }}</span></td>
                <td>{{ r.tipo }}</td>
                <td>
                  <span class="status" :class="r.activo ? 'ok' : 'warn'">
                    {{ r.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="row-actions">
                  <button @click="editar(r)">
                    Editar<span class="sr-only"> {{ r.nombre }}</span>
                  </button>
                  <button class="delete" @click="eliminar(r)">
                    Eliminar<span class="sr-only"> {{ r.nombre }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <PaginacionTabla
            :total-items="totalItems"
            :pagina-actual="paginaActual"
            :por-pagina="porPagina"
            etiqueta="recompensas"
            @cambiar-pagina="cambiarPagina"
            @cambiar-tamano="cambiarTamano"
          />
        </template>
      </article>
    </div>
  </section>
</template>

<script>
import { state, cargarDatos, guardarRecompensa, eliminarRecompensa, nivelClass, mensajeDeError, NIVELES, TIPOS_RECOMPENSA } from '../data/fidelidadStore'
import PaginacionTabla from '../components/PaginacionTabla.vue'
import { paginacionMixin } from '../utils/paginacion'

const emptyForm = () => ({ id: null, nombre: '', nivel: 'Bronce', tipo: 'Producto', detalle: '', activo: true })

export default {
  name: 'CatalogoRegalos',
  components: { PaginacionTabla },
  mixins: [paginacionMixin],
  data() {
    return { form: emptyForm(), error: '', guardando: false, NIVELES, TIPOS_RECOMPENSA }
  },
  mounted() {
    cargarDatos()
  },
  computed: {
    itemsPaginables() {
      return state.catalogo
    }
  },
  methods: {
    nivelClass,
    nuevo() {
      this.form = emptyForm()
      this.error = ''
    },
    editar(r) {
      this.form = { ...r }
      this.$nextTick(() => document.getElementById('recompensa-nombre')?.focus())
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
    async eliminar(r) {
      if (!confirm(`¿Eliminar la recompensa "${r.nombre}"?`)) return
      this.error = ''
      try {
        await eliminarRecompensa(r.id)
      } catch (err) {
        this.error = mensajeDeError(err, 'No se pudo eliminar la recompensa')
      }
    }
  }
}
</script>

<style scoped>
.required-mark {
  color: #e74c3c;
  font-size: 0.85em;
  margin-left: 2px;
}
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
