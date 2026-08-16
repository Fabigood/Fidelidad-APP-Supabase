<template>
  <div
    v-if="visible"
    class="tarjeta-modal-overlay"
    @click.self="$emit('close')"
  >
    <div
      ref="caja"
      class="tarjeta-modal-box"
      role="dialog"
      aria-modal="true"
      :aria-label="`Vista previa de la tarjeta de fidelidad`"
      @keydown.esc="$emit('close')"
      @keydown.tab="atraparFoco"
    >
      <button
        ref="cerrar"
        class="tarjeta-modal-close"
        type="button"
        aria-label="Cerrar la vista previa"
        @click="$emit('close')"
      >
        <span aria-hidden="true">✕</span>
      </button>

      <div v-if="cargando" class="tarjeta-modal-loading" role="status">
        Cargando vista previa…
      </div>
      <div v-else-if="error" class="tarjeta-modal-error" role="alert">
        <span aria-hidden="true">⚠</span> {{ error }}
      </div>
      <iframe
        v-else
        :srcdoc="html"
        class="tarjeta-modal-frame"
        title="Vista previa de tarjeta de fidelidad"
        sandbox=""
      ></iframe>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TarjetaPreviewModal',
  props: {
    visible: { type: Boolean, default: false },
    html: { type: String, default: '' },
    cargando: { type: Boolean, default: false },
    error: { type: String, default: '' }
  },
  emits: ['close'],
  data() {
    return { elementoPrevio: null }
  },
  watch: {
    visible(abierto) {
      if (abierto) this.alAbrir()
      else this.alCerrar()
    }
  },
  beforeUnmount() {
    this.alCerrar()
  },
  methods: {
    alAbrir() {
      // Se recuerda quién tenía el foco para devolvérselo al cerrar: si no, el
      // foco vuelve al principio del documento y hay que tabular de nuevo
      // hasta donde estabas.
      this.elementoPrevio = document.activeElement
      document.body.style.overflow = 'hidden'
      this.$nextTick(() => this.$refs.cerrar?.focus())
    },
    alCerrar() {
      document.body.style.overflow = ''
      if (this.elementoPrevio?.focus) this.elementoPrevio.focus()
      this.elementoPrevio = null
    },
    /**
     * Mantiene el tabulador dentro del diálogo. Sin esto se puede tabular
     * hasta los controles de detrás, que están tapados por la superposición.
     */
    atraparFoco(evento) {
      const enfocables = this.$refs.caja?.querySelectorAll(
        'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])'
      )
      if (!enfocables?.length) return

      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }
  }
}
</script>

<style scoped>
.tarjeta-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}
.tarjeta-modal-box {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}
.tarjeta-modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.tarjeta-modal-close:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}
.tarjeta-modal-frame {
  width: 100%;
  height: 560px;
  border: none;
  display: block;
}
.tarjeta-modal-loading,
.tarjeta-modal-error {
  padding: 40px 24px;
  text-align: center;
  color: #555;
}
.tarjeta-modal-error {
  color: #c0392b;
}
</style>
