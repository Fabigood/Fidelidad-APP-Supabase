import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // En desarrollo se hace proxy de /api al backend local, así el frontend usa
    // siempre rutas relativas y no hace falta ninguna URL fija en el código.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    // Los sourcemaps publicarían el código fuente completo del panel.
    sourcemap: false
  }
})
