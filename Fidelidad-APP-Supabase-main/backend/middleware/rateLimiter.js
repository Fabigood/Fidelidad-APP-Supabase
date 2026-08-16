const config = require('../core/config');

/**
 * Limitador por ventana fija, en memoria.
 *
 * Nota de despliegue: la clave es req.ip, que detrás de un proxy proviene de
 * X-Forwarded-For. Solo es fiable si TRUST_PROXY coincide con la cantidad real
 * de proxies y nginx reescribe la cabecera. Con TRUST_PROXY=0 se usa la IP del
 * socket, que no se puede falsificar.
 *
 * El estado vive en el proceso: con PM2 en modo cluster hay que migrarlo a Redis
 * o dejar el limite en nginx.
 */
function crearRateLimiter({
  maxIntentos,
  ventanaMs,
  mensaje,
  soloContarFallos = false
}) {
  const registros = new Map();

  const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, registro] of registros) {
      if (ahora >= registro.resetAt) registros.delete(clave);
    }
  }, ventanaMs);
  limpieza.unref();

  return function rateLimiter(req, res, next) {
    const clave = req.ip || 'desconocida';
    const ahora = Date.now();
    let registro = registros.get(clave);

    if (!registro || ahora >= registro.resetAt) {
      registro = { count: 0, resetAt: ahora + ventanaMs };
      registros.set(clave, registro);
    }

    if (registro.count >= maxIntentos) {
      const segundosRestantes = Math.ceil((registro.resetAt - ahora) / 1000);
      res.set('Retry-After', String(segundosRestantes));
      return res.status(429).json({
        error: mensaje(Math.ceil(segundosRestantes / 60))
      });
    }

    if (soloContarFallos) {
      // Cuenta solo credenciales invalidas y reinicia el contador al autenticar bien.
      res.on('finish', () => {
        if (res.statusCode === 401) registro.count += 1;
        else if (res.statusCode < 400) registros.delete(clave);
      });
    } else {
      registro.count += 1;
    }

    next();
  };
}

const loginRateLimiter = crearRateLimiter({
  maxIntentos: 5,
  ventanaMs: 10 * 60 * 1000,
  soloContarFallos: true,
  mensaje: (min) => `Demasiados intentos de inicio de sesión. Probá de nuevo en ${min} minuto(s).`
});

const apiRateLimiter = crearRateLimiter({
  maxIntentos: config.isProduction ? 300 : 10000,
  ventanaMs: 60 * 1000,
  mensaje: () => 'Demasiadas peticiones. Esperá un momento antes de reintentar.'
});

// El envio de correos consume cuota de Brevo y reputacion del remitente:
// necesita un limite mucho mas estricto que el resto de la API.
const emailRateLimiter = crearRateLimiter({
  maxIntentos: config.isProduction ? 20 : 1000,
  ventanaMs: 60 * 60 * 1000,
  mensaje: (min) => `Se alcanzó el límite de envíos de tarjetas por hora. Probá de nuevo en ${min} minuto(s).`
});

const publicRateLimiter = crearRateLimiter({
  maxIntentos: 30,
  ventanaMs: 60 * 1000,
  mensaje: () => 'Demasiadas peticiones al resumen público. Esperá un momento.'
});

module.exports = {
  crearRateLimiter,
  loginRateLimiter,
  apiRateLimiter,
  emailRateLimiter,
  publicRateLimiter
};
