<template>
  <nav
    v-if="totalItems > 0"
    class="paginacion"
    :aria-label="`Paginación de ${etiqueta}`"
  >
    <p class="paginacion-info" aria-live="polite">
      Mostrando {{ primerVisible }}–{{ ultimoVisible }} de {{ totalItems }} {{ etiqueta }}
    </p>

    <div class="paginacion-controles" v-if="totalPaginas > 1">
      <button
        type="button"
        :disabled="paginaActual === 1"
        :aria-label="`Ir a la página anterior de ${etiqueta}`"
        @click="ir(paginaActual - 1)"
      >
        <span aria-hidden="true">‹</span>
      </button>

      <button
        v-for="pagina in paginasVisibles"
        :key="pagina.clave"
        type="button"
        :disabled="pagina.numero === null"
        :aria-current="pagina.numero === paginaActual ? 'page' : undefined"
        :aria-label="pagina.numero ? `Ir a la página ${pagina.numero}` : undefined"
        @click="pagina.numero && ir(pagina.numero)"
      >
        {{ pagina.numero ?? '…' }}
      </button>

      <button
        type="button"
        :disabled="paginaActual === totalPaginas"
        :aria-label="`Ir a la página siguiente de ${etiqueta}`"
        @click="ir(paginaActual + 1)"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>

    <div class="paginacion-tamano">
      <label :for="idSelector">Por página</label>
      <select :id="idSelector" :value="porPagina" @change="cambiarTamano">
        <option v-for="opcion in opcionesTamano" :key="opcion" :value="opcion">{{ opcion }}</option>
      </select>
    </div>
  </nav>
</template>

<script>
let contadorIds = 0

export default {
  name: 'PaginacionTabla',
  props: {
    totalItems: { type: Number, required: true },
    paginaActual: { type: Number, required: true },
    porPagina: { type: Number, required: true },
    etiqueta: { type: String, default: 'resultados' },
    opcionesTamano: { type: Array, default: () => [10, 25, 50, 100] }
  },
  emits: ['cambiar-pagina', 'cambiar-tamano'],
  data() {
    contadorIds += 1
    return { idSelector: `paginacion-tamano-${contadorIds}` }
  },
  computed: {
    totalPaginas() {
      return Math.max(1, Math.ceil(this.totalItems / this.porPagina))
    },
    primerVisible() {
      return this.totalItems === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1
    },
    ultimoVisible() {
      return Math.min(this.paginaActual * this.porPagina, this.totalItems)
    },
    /**
     * Ventana de páginas alrededor de la actual, con elipsis.
     * Con 200 páginas, pintarlas todas llenaría la pantalla de botones.
     */
    paginasVisibles() {
      const total = this.totalPaginas
      const actual = this.paginaActual
      const numeros = new Set([1, total, actual, actual - 1, actual + 1])

      const ordenadas = [...numeros].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)

      const resultado = []
      let anterior = 0
      for (const numero of ordenadas) {
        if (numero - anterior > 1) {
          resultado.push({ clave: `hueco-${numero}`, numero: null })
        }
        resultado.push({ clave: `p-${numero}`, numero })
        anterior = numero
      }
      return resultado
    }
  },
  methods: {
    ir(pagina) {
      const destino = Math.min(Math.max(1, pagina), this.totalPaginas)
      if (destino !== this.paginaActual) this.$emit('cambiar-pagina', destino)
    },
    cambiarTamano(evento) {
      this.$emit('cambiar-tamano', Number(evento.target.value))
    }
  }
}
</script>
