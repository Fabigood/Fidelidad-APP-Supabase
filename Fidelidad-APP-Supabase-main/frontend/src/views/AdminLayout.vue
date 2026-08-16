<template>
  <div class="admin-shell">
    <!-- Primer tabulador de la página: permite saltar el menú lateral -->
    <a class="skip-link" href="#contenido-principal">Saltar al contenido principal</a>

    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">F</div>
        <div>
          <strong>Fidelización</strong>
          <small>Panel interno</small>
        </div>
      </div>

      <nav class="menu" aria-label="Navegación principal">
        <RouterLink to="/admin/dashboard">Panel principal</RouterLink>
        <RouterLink to="/admin/clientes">Clientes</RouterLink>
        <RouterLink to="/admin/tarjetas">Tarjetas enviadas</RouterLink>
        <RouterLink to="/admin/registrar-compra">Registrar compra</RouterLink>
        <RouterLink to="/admin/recompensas">Recompensas</RouterLink>
        <RouterLink to="/admin/catalogo-regalos">Catálogo de regalos</RouterLink>
        <RouterLink to="/admin/estadisticas">Estadísticas</RouterLink>
      </nav>

      <div class="sidebar-footer">
        <small v-if="usuario" class="usuario-actual">Sesión: {{ usuario }}</small>
        <button class="logout" type="button" @click="logout">Cerrar sesión</button>
      </div>
    </aside>

    <main class="content" id="contenido-principal" tabindex="-1">
      <div v-if="avisoSesion" class="aviso-sesion" role="status">
        ⏳ Tu sesión expira en menos de {{ minutosRestantes }} minuto(s). Guardá los cambios.
      </div>

      <RouterView />
    </main>
  </div>
</template>

<script>
import { clearToken, tiempoRestanteMs, usuarioActual } from '../utils/auth'

const AVISO_ANTES_MS = 5 * 60 * 1000
const INTERVALO_COMPROBACION_MS = 30 * 1000

export default {
  name: 'AdminLayout',
  data() {
    return {
      usuario: usuarioActual(),
      avisoSesion: false,
      minutosRestantes: 0,
      temporizador: null
    }
  },
  mounted() {
    this.comprobarSesion()
    this.temporizador = setInterval(this.comprobarSesion, INTERVALO_COMPROBACION_MS)
  },
  beforeUnmount() {
    // Sin esto el intervalo sigue vivo tras salir del panel.
    if (this.temporizador) clearInterval(this.temporizador)
  },
  methods: {
    comprobarSesion() {
      const restante = tiempoRestanteMs()

      if (restante <= 0) {
        this.logout()
        return
      }

      this.avisoSesion = restante <= AVISO_ANTES_MS
      this.minutosRestantes = Math.ceil(restante / 60000)
    },
    logout() {
      clearToken()
      this.$router.push('/login')
    }
  }
}
</script>

<style scoped>
.sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.usuario-actual {
  opacity: 0.7;
  font-size: 0.75rem;
}
.aviso-sesion {
  background: #fff8e1;
  border: 1px solid #f0b429;
  color: #7a5100;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 0.875rem;
  margin-bottom: 16px;
}
</style>
