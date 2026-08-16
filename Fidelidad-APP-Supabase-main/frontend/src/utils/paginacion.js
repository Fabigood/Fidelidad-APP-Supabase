/**
 * Mixin de paginación en cliente.
 *
 * La vista define un computed `itemsPaginables` con la lista completa (ya
 * filtrada) y recibe `itemsPagina` con el trozo visible.
 *
 * Al cambiar el filtro, la página vuelve a la 1: si estabas en la página 7 y
 * el filtro deja 3 resultados, seguirías viendo una tabla vacía.
 */
export const paginacionMixin = {
  data() {
    return {
      paginaActual: 1,
      porPagina: 25
    }
  },
  computed: {
    totalItems() {
      return this.itemsPaginables.length
    },
    totalPaginas() {
      return Math.max(1, Math.ceil(this.totalItems / this.porPagina))
    },
    itemsPagina() {
      const inicio = (this.paginaActual - 1) * this.porPagina
      return this.itemsPaginables.slice(inicio, inicio + this.porPagina)
    }
  },
  watch: {
    totalItems() {
      // Si al borrar registros la página actual queda fuera de rango,
      // se retrocede a la última existente en lugar de mostrar nada.
      if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas
    }
  },
  methods: {
    cambiarPagina(pagina) {
      this.paginaActual = pagina
    },
    cambiarTamano(tamano) {
      this.porPagina = tamano
      this.paginaActual = 1
    },
    reiniciarPaginacion() {
      this.paginaActual = 1
    }
  }
}
