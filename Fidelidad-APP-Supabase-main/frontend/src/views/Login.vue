<template>
  <main class="login-page">
    <section class="login-card">
      <div class="login-info">
        <h1>Fidelización</h1>
        <p>Administra las recompensas y el programa de fidelización de tu local</p>
      </div>

      <form class="login-form" aria-labelledby="titulo-login" @submit.prevent="login">
        <h2 id="titulo-login">Iniciar sesión</h2>
        <p>Acceso administrativo del local</p>

        <label for="login-usuario">Usuario</label>
        <input
          id="login-usuario"
          v-model="username"
          name="username"
          placeholder="admin"
          autocomplete="username"
          required
          maxlength="50"
          :aria-invalid="error ? 'true' : 'false'"
        />

        <label for="login-password">Contraseña</label>
        <input
          id="login-password"
          v-model="password"
          name="password"
          placeholder="••••••••"
          type="password"
          autocomplete="current-password"
          required
          maxlength="128"
          :aria-invalid="error ? 'true' : 'false'"
          :aria-describedby="error ? 'error-login' : undefined"
        />

        <button class="primary-btn full" type="submit" :disabled="loading">
          {{ loading ? 'Validando...' : 'Entrar al sistema' }}
        </button>

        <p v-if="error" class="error-msg" id="error-login" role="alert">{{ error }}</p>
      </form>
    </section>
  </main>
</template>

<script>
import api from '../services/api'
import { saveToken } from '../utils/auth'

export default {
  data() {
    return {
      username: '',
      password: '',
      error: '',
      loading: false
    }
  },
  methods: {
    async login() {
      this.error = ''
      this.loading = true

      try {
        const res = await api.post('/auth/login', {
          username: this.username,
          password: this.password
        })

        saveToken(res.data.token)
        this.$router.push('/admin/dashboard')
      } catch (err) {
        this.error = err?.response?.data?.error || 'Usuario o contraseña incorrectos'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>