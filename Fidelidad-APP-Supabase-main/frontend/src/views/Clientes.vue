<template>
  <section class="page fade-in">
    <div class="page-head">
      <div>
        <p class="eyebrow">Gestión</p>
        <h1>Clientes</h1>
      </div>
      <button class="primary-btn" @click="nuevo">Nuevo cliente</button>
    </div>

    <div class="crud-grid">
      <article class="panel-card form-card">
        <h2 id="titulo-formulario">{{ editando ? 'Editar cliente' : 'Registrar cliente' }}</h2>

        <form aria-labelledby="titulo-formulario" @submit.prevent="guardar">
          <label for="cliente-nombre">Nombre <span class="required-mark" aria-hidden="true">*</span></label>
          <input
            id="cliente-nombre"
            v-model="form.nombre"
            placeholder="Nombre completo"
            required
            maxlength="120"
            autocomplete="name"
            :class="{ 'input-error': errores.nombre }"
            :aria-invalid="errores.nombre ? 'true' : 'false'"
            :aria-describedby="errores.nombre ? 'error-nombre' : undefined"
            @input="errores.nombre = ''"
          />
          <p class="field-error" v-if="errores.nombre" id="error-nombre">{{ errores.nombre }}</p>

          <label for="cliente-email">Correo electrónico <span class="required-mark" aria-hidden="true">*</span></label>
          <input
            id="cliente-email"
            v-model="form.email"
            type="email"
            placeholder="correo@email.com"
            required
            maxlength="254"
            autocomplete="email"
            :class="{ 'input-error': errores.email }"
            :aria-invalid="errores.email ? 'true' : 'false'"
            aria-describedby="ayuda-email"
            @input="errores.email = ''"
          />
          <p class="field-error" v-if="errores.email" id="error-email" role="alert">{{ errores.email }}</p>

          <p class="helper-text" id="ayuda-email">
            El correo es un dato sensible único por cliente. Será validado en el servidor antes de guardarse.
          </p>

          <div v-if="errorGeneral" class="alert-error" role="alert">
            <span aria-hidden="true">⚠</span> {{ errorGeneral }}
          </div>
          <div v-if="mensajeExito" class="alert-success" role="status">
            <span aria-hidden="true">✔</span> {{ mensajeExito }}
          </div>

          <div class="actions-row">
            <button class="primary-btn" type="submit" :disabled="guardando">
              {{ guardando ? 'Guardando…' : (editando ? 'Actualizar' : 'Agregar') }}
            </button>
            <button class="ghost-btn" type="button" v-if="editando" @click="cancelar">Cancelar</button>
          </div>
        </form>
      </article>

      <article class="panel-card table-card">
        <div class="table-head">
          <h2 id="titulo-listado">Listado de clientes</h2>
          <div>
            <label for="buscar-cliente" class="sr-only">Buscar clientes por nombre, correo o nivel</label>
            <input
              id="buscar-cliente"
              v-model="filtro"
              type="search"
              class="search"
              placeholder="Buscar..."
            />
          </div>
        </div>

        <p v-if="state.loading" class="helper-text" role="status">Cargando clientes…</p>
        <p v-else-if="!totalItems" class="helper-text">
          {{ filtro ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes registrados.' }}
        </p>

        <table v-else aria-describedby="titulo-listado">
          <caption class="sr-only">
            Clientes registrados con sus puntos, nivel interno y probabilidad de retorno
          </caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Correo</th>
              <th scope="col">Puntos</th>
              <th scope="col">Nivel interno</th>
              <th scope="col">Prob. retorno</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in itemsPagina" :key="c.id">
              <th scope="row"><strong>{{ c.nombre }}</strong></th>
              <td>{{ c.email }}</td>
              <td>{{ c.puntos }} pts</td>
              <td><span class="badge" :class="nivelClass(c.nivel)">{{ c.nivel }}</span></td>
              <td><strong>{{ c.probabilidadRetorno }}%</strong></td>
              <td class="row-actions">
                <button @click="$router.push('/admin/clientes/' + c.id)">
                  Ver<span class="sr-only"> el perfil de {{ c.nombre }}</span>
                </button>
                <button @click="editar(c)">
                  Editar<span class="sr-only"> a {{ c.nombre }}</span>
                </button>
                <button :disabled="enviandoId === c.id" @click="enviarTarjetaCliente(c)">
                  {{ enviandoId === c.id ? 'Enviando…' : 'Enviar tarjeta' }}
                  <span class="sr-only"> a {{ c.nombre }}</span>
                </button>
                <button @click="verTarjeta(c)">
                  Vista previa<span class="sr-only"> de la tarjeta de {{ c.nombre }}</span>
                </button>
                <button class="delete" @click="eliminar(c)">
                  Eliminar<span class="sr-only"> a {{ c.nombre }}</span>
                </button>
              </td>
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
      </article>
    </div>

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
import { state, cargarDatos, getClientesAnalizados, guardarCliente, eliminarCliente, enviarTarjeta, previsualizarTarjetaCliente, nivelClass, mensajeDeError } from '../data/fidelidadStore'
import TarjetaPreviewModal from '../components/TarjetaPreviewModal.vue'
import PaginacionTabla from '../components/PaginacionTabla.vue'
import { paginacionMixin } from '../utils/paginacion'

export default {
  name: 'Clientes',
  components: { TarjetaPreviewModal, PaginacionTabla },
  mixins: [paginacionMixin],
  data() {
    return {
      state,
      filtro: '',
      form: { id: null, nombre: '', email: '' },
      editando: null,
      guardando: false,
      errores: { nombre: '', email: '' },
      errorGeneral: '',
      mensajeExito: '',
      enviandoId: null,
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
    clientes() {
      return getClientesAnalizados()
    },
    itemsPaginables() {
      const term = this.filtro.trim().toLowerCase()
      if (!term) return this.clientes
      return this.clientes.filter(c => (c.nombre + ' ' + c.email + ' ' + c.nivel).toLowerCase().includes(term))
    }
  },
  watch: {
    filtro() {
      this.reiniciarPaginacion()
    }
  },
  methods: {
    nivelClass,
    async guardar() {
      this.errores = { nombre: '', email: '' }
      this.errorGeneral = ''
      this.mensajeExito = ''

      if (!this.form.nombre.trim()) {
        this.errores.nombre = 'El nombre es obligatorio'
        return
      }
      if (!this.form.email.trim()) {
        this.errores.email = 'El correo es obligatorio'
        return
      }

      this.guardando = true
      const esNuevo = !this.form.id
      try {
        const resultado = await guardarCliente({ ...this.form })
        this.cancelar()
        if (esNuevo) {
          this.mensajeExito = resultado?.tarjetaEnviada
            ? 'Cliente creado y tarjeta de fidelidad enviada por correo.'
            : 'Cliente creado, pero no se pudo enviar la tarjeta por correo (revisá la configuración de Brevo).'
          setTimeout(() => { this.mensajeExito = '' }, 6000)
        }
      } catch (err) {
        const data = err?.response?.data
        if (data?.campo === 'email') {
          this.errores.email = data.error
        } else if (data?.campo === 'nombre') {
          this.errores.nombre = data.error
        } else {
          this.errorGeneral = mensajeDeError(err, 'Error al guardar el cliente')
        }
      } finally {
        this.guardando = false
      }
    },
    editar(c) {
      this.editando = c.id
      this.form = { id: c.id, nombre: c.nombre, email: c.email }
      this.errores = { nombre: '', email: '' }
      this.errorGeneral = ''
      this.$nextTick(() => document.getElementById('cliente-nombre')?.focus())
    },
    async eliminar(c) {
      if (!confirm(`¿Eliminar a ${c.nombre}? Se borrarán también sus compras y recompensas.`)) return
      this.errorGeneral = ''
      try {
        await eliminarCliente(c.id)
      } catch (err) {
        this.errorGeneral = mensajeDeError(err, 'No se pudo eliminar el cliente')
      }
    },
    async enviarTarjetaCliente(c) {
      this.errorGeneral = ''
      this.mensajeExito = ''
      this.enviandoId = c.id
      try {
        await enviarTarjeta(c.id)
        this.mensajeExito = `Tarjeta enviada a ${c.email}`
      } catch (err) {
        this.errorGeneral = mensajeDeError(err, 'No se pudo enviar la tarjeta de fidelidad')
      } finally {
        this.enviandoId = null
        setTimeout(() => { this.mensajeExito = '' }, 6000)
      }
    },
    async verTarjeta(c) {
      this.previewVisible = true
      this.previewCargando = true
      this.previewError = ''
      this.previewHtml = ''
      try {
        this.previewHtml = await previsualizarTarjetaCliente(c.id)
      } catch (err) {
        this.previewError = mensajeDeError(err, 'No se pudo cargar la vista previa')
      } finally {
        this.previewCargando = false
      }
    },
    cancelar() {
      this.editando = null
      this.form = { id: null, nombre: '', email: '' }
      this.errores = { nombre: '', email: '' }
      this.errorGeneral = ''
    },
    nuevo() {
      this.cancelar()
      this.$nextTick(() => document.getElementById('cliente-nombre')?.focus())
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
.input-error {
  border-color: #e74c3c !important;
  background: #fff5f5 !important;
}
.field-error {
  color: #e74c3c;
  font-size: 0.8rem;
  margin: -6px 0 6px;
}
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
