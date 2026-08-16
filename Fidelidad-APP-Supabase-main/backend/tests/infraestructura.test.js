/**
 * Pruebas de la capa de infraestructura: configuración, límites de peticiones y
 * manejo de errores en casos límite.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-1234';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejemplo.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'clave-de-pruebas';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { crearRateLimiter } = require('../middleware/rateLimiter');

function crearRes(statusFinal = 401) {
  const res = new EventEmitter();
  res.statusCode = statusFinal;
  res.estadoEnviado = null;
  res.set = () => res;
  res.status = (codigo) => {
    res.estadoEnviado = codigo;
    return res;
  };
  res.json = () => res;
  return res;
}

// ─── Límite de peticiones ────────────────────────────────────────────────────
test('la concurrencia no evade el límite', () => {
  const limiter = crearRateLimiter({
    maxIntentos: 5,
    ventanaMs: 60000,
    liberarSiExito: true,
    mensaje: () => 'bloqueado'
  });

  const respuestas = [];
  // 20 peticiones simultáneas: todas entran antes de que ninguna termine.
  for (let i = 0; i < 20; i += 1) {
    const res = crearRes(401);
    limiter({ ip: '1.2.3.4' }, res, () => {});
    respuestas.push(res);
  }
  respuestas.forEach((res) => res.emit('finish'));

  const permitidas = respuestas.filter((res) => res.estadoEnviado !== 429).length;
  assert.equal(permitidas, 5, 'solo deben pasar 5, no todas las concurrentes');
});

test('un inicio de sesión correcto devuelve el cupo consumido', () => {
  const limiter = crearRateLimiter({
    maxIntentos: 3,
    ventanaMs: 60000,
    liberarSiExito: true,
    mensaje: () => 'bloqueado'
  });

  // Dos fallos
  for (let i = 0; i < 2; i += 1) {
    const res = crearRes(401);
    limiter({ ip: '5.5.5.5' }, res, () => {});
    res.emit('finish');
  }

  // Un acierto: limpia el contador
  const exito = crearRes(200);
  limiter({ ip: '5.5.5.5' }, exito, () => {});
  exito.emit('finish');

  // Debe poder volver a intentar sin bloqueo
  const siguiente = crearRes(401);
  limiter({ ip: '5.5.5.5' }, siguiente, () => {});
  assert.equal(siguiente.estadoEnviado, null, 'no debería estar bloqueado tras un acierto');
});

test('cada IP lleva su propio contador', () => {
  const limiter = crearRateLimiter({
    maxIntentos: 2,
    ventanaMs: 60000,
    mensaje: () => 'bloqueado'
  });

  for (let i = 0; i < 2; i += 1) limiter({ ip: '1.1.1.1' }, crearRes(200), () => {});

  const bloqueada = crearRes(200);
  limiter({ ip: '1.1.1.1' }, bloqueada, () => {});
  assert.equal(bloqueada.estadoEnviado, 429);

  const otraIp = crearRes(200);
  limiter({ ip: '2.2.2.2' }, otraIp, () => {});
  assert.equal(otraIp.estadoEnviado, null, 'otra IP no debe verse afectada');
});

test('el límite devuelve Retry-After', () => {
  const cabeceras = {};
  const limiter = crearRateLimiter({ maxIntentos: 1, ventanaMs: 60000, mensaje: () => 'x' });

  limiter({ ip: '9.9.9.9' }, crearRes(200), () => {});

  const res = crearRes(200);
  res.set = (clave, valor) => {
    cabeceras[clave] = valor;
    return res;
  };
  limiter({ ip: '9.9.9.9' }, res, () => {});

  assert.ok(cabeceras['Retry-After'], 'debe indicar cuándo reintentar');
});

// ─── Manejo de errores ───────────────────────────────────────────────────────
test('no intenta responder dos veces si las cabeceras ya se enviaron', () => {
  const errorHandler = require('../middleware/errorHandler');
  let siguienteLlamado = false;
  let intentoResponder = false;

  const res = {
    headersSent: true,
    status() { intentoResponder = true; return this; },
    json() { return this; }
  };

  const consoleError = console.error;
  console.error = () => {};
  errorHandler(new Error('x'), { method: 'GET', originalUrl: '/x' }, res, () => {
    siguienteLlamado = true;
  });
  console.error = consoleError;

  assert.equal(intentoResponder, false, 'responder de nuevo lanzaría ERR_HTTP_HEADERS_SENT');
  assert.equal(siguienteLlamado, true, 'debe delegar en el manejador por defecto');
});

test('traduce el desbordamiento numérico de Postgres', () => {
  const errorHandler = require('../middleware/errorHandler');
  let estado = null;
  const res = {
    headersSent: false,
    status(codigo) { estado = codigo; return this; },
    json() { return this; }
  };

  errorHandler({ code: '22003' }, { method: 'POST', originalUrl: '/x' }, res, () => {});
  assert.equal(estado, 422);
});

// ─── Configuración ───────────────────────────────────────────────────────────
test('un entero de configuración inválido falla en el arranque, no en silencio', () => {
  const ruta = require.resolve('../core/config');
  const original = process.env.TRUST_PROXY;

  delete require.cache[ruta];
  process.env.TRUST_PROXY = 'si';

  assert.throws(() => require('../core/config'), /TRUST_PROXY/);

  delete require.cache[ruta];
  if (original === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = original;
  require('../core/config');
});
