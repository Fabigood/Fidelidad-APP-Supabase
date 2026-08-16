/**
 * PM2 - Fidelidad APP
 *
 *   cd backend
 *   pm2 start ../deploy/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup          # genera el servicio systemd para que arranque al reiniciar
 *
 * Nota sobre el modo cluster: los limitadores de peticiones guardan su estado en
 * memoria del proceso. Con varias instancias cada una llevaría su propio
 * contador, multiplicando el límite real. Por eso se usa una sola instancia y el
 * límite duro queda en nginx. Para escalar, migrar los contadores a Redis.
 */
module.exports = {
  apps: [
    {
      name: 'fidelidad-api',
      script: 'index.js',
      cwd: '/var/www/fidelidad-backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      // Las variables sensibles viven en backend/.env, no aquí.
      max_memory_restart: '400M',
      autorestart: true,
      watch: false,
      // Si falla 10 veces seguidas, deja de reintentar en bucle.
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 2000,
      kill_timeout: 10000,        // deja terminar las peticiones en curso (SIGTERM)
      error_file: '/var/log/fidelidad/error.log',
      out_file: '/var/log/fidelidad/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
}
