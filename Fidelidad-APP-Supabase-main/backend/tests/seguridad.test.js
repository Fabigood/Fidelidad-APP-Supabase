/**
 * Pruebas de regresión de los fallos detectados en la auditoría.
 * Ejecutar con: npm test
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-1234';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejemplo.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'clave-de-pruebas';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validarEmail } = require('../validators/emailValidator');
const { validarFechaISO } = require('../validators/dateValidator');
const { buildTarjetaHtml, escapeHtml } = require('../utils/tarjetaTemplate');
const { getMonthAndYear } = require('../utils/dateFormatter');
const AppError = require('../core/AppError');
const AuthService = require('../services/AuthService');
const FidelidadService = require('../services/FidelidadService');
const { ThresholdLevelStrategy } = require('../services/strategies/levelStrategy');
const { MontoEnteroPointsStrategy } = require('../services/strategies/pointsStrategy');

// ─── Validación de correo ────────────────────────────────────────────────────
test('rechaza dominios desechables en subdominios', () => {
  assert.ok(validarEmail('MAIL@Sub.Mailinator.com'), 'sub.mailinator.com debe rechazarse');
  assert.ok(validarEmail('x@mailinator.com'));
});

test('rechaza dominios con puntos consecutivos', () => {
  assert.ok(validarEmail('a@b..co'));
});

test('acepta correos legítimos', () => {
  assert.equal(validarEmail('usuario+etiqueta@gmail.com'), null);
  assert.equal(validarEmail('a@b.co'), null);
});

test('rechaza correos que superan la longitud máxima', () => {
  assert.ok(validarEmail(`a@${'x'.repeat(300)}.com`));
});

// ─── Validación de fecha ─────────────────────────────────────────────────────
test('rechaza fechas que no existen en el calendario', () => {
  assert.equal(validarFechaISO('2026-02-30').valida, false);
  assert.equal(validarFechaISO('2026-13-45').valida, false);
  assert.equal(validarFechaISO('no-es-fecha').valida, false);
  assert.equal(validarFechaISO('').valida, false);
});

test('acepta fechas válidas y devuelve mes y año correctos', () => {
  const resultado = validarFechaISO('2026-02-28');
  assert.equal(resultado.valida, true);
  assert.equal(resultado.mes, 2);
  assert.equal(resultado.anio, 2026);
});

test('getMonthAndYear lanza en vez de devolver NaN', () => {
  assert.throws(() => getMonthAndYear('2026-02-30'));
  assert.deepEqual(getMonthAndYear('2026-05-10'), { mes: 5, anio: 2026 });
});

// ─── Plantilla de tarjeta ────────────────────────────────────────────────────
test('escapa comillas además de los signos de mayor y menor', () => {
  const escapado = escapeHtml(`a" onmouseover='x'`);
  assert.ok(!escapado.includes('"'));
  assert.ok(!escapado.includes("'"));
});

test('escapa etiquetas HTML inyectadas en el nombre', () => {
  const html = buildTarjetaHtml({
    nombre: '<img src=x onerror=alert(1)>',
    nivel: 'Oro',
    puntos: 10,
    id: 1
  });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
});

test('no revienta con claves del prototipo como nivel', () => {
  for (const nivel of ['constructor', 'toString', '__proto__', null, undefined]) {
    assert.doesNotThrow(() => buildTarjetaHtml({ nombre: 'X', nivel, puntos: 1, id: 1 }));
  }
});

// ─── Autenticación ───────────────────────────────────────────────────────────
test('login rechaza credenciales incorrectas con el mismo mensaje', async () => {
  const hash = await AuthService.hashPassword('claveCorrecta123');
  const service = new AuthService({
    userRepository: {
      async findByUsername(username) {
        return username === 'admin' ? { id: 1, username: 'admin', password: hash } : null;
      }
    },
    jwtConfig: { secret: process.env.JWT_SECRET, expiresIn: '1h', algorithm: 'HS256' }
  });

  const inexistente = await service.login({ username: 'nadie', password: 'x' }).catch((e) => e);
  const claveMala = await service.login({ username: 'admin', password: 'mala' }).catch((e) => e);

  assert.equal(inexistente.statusCode, 401);
  assert.equal(claveMala.statusCode, 401);
  assert.equal(inexistente.message, claveMala.message);
});

test('login devuelve un token válido con la contraseña correcta', async () => {
  const jwt = require('jsonwebtoken');
  const hash = await AuthService.hashPassword('claveCorrecta123');
  const service = new AuthService({
    userRepository: { async findByUsername() { return { id: 1, username: 'admin', password: hash }; } },
    jwtConfig: { secret: process.env.JWT_SECRET, expiresIn: '1h', algorithm: 'HS256' }
  });

  const token = await service.login({ username: 'admin', password: 'claveCorrecta123' });
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

  assert.equal(decoded.username, 'admin');
  assert.equal(typeof decoded.exp, 'number');
});

test('la contraseña nunca se guarda en claro', async () => {
  const hash = await AuthService.hashPassword('miClaveSecreta');
  assert.ok(hash.startsWith('$2'));
  assert.ok(!hash.includes('miClaveSecreta'));
});

// ─── Reglas de negocio ───────────────────────────────────────────────────────
function crearFidelidadService(overrides = {}) {
  return new FidelidadService({
    clienteRepository: { async findById() { return { id: 1, nombre: 'X', email: 'x@y.com' }; } },
    compraRepository: {},
    recompensaRepository: { async findById() { return { id: 1 }; } },
    reclamoRepository: {},
    pointsStrategy: new MontoEnteroPointsStrategy(),
    levelStrategy: new ThresholdLevelStrategy(),
    ...overrides
  });
}

test('rechaza niveles y tipos fuera de la lista blanca', () => {
  const service = crearFidelidadService();
  assert.throws(() => service.normalizeRecompensa({ nombre: 'X', nivel: 'Platino' }), AppError);
  assert.throws(() => service.normalizeRecompensa({ nombre: 'X', tipo: 'Cualquiera' }), AppError);
  assert.doesNotThrow(() => service.normalizeRecompensa({ nombre: 'X', nivel: 'Oro', tipo: 'Descuento' }));
});

test('interpreta correctamente el booleano activo', () => {
  const service = crearFidelidadService();
  assert.equal(service.normalizarBooleano(undefined), true);
  assert.equal(service.normalizarBooleano(false), false);
  assert.equal(service.normalizarBooleano('false'), false);
  assert.equal(service.normalizarBooleano(0), false);
  assert.equal(service.normalizarBooleano(true), true);
});

test('rechaza montos inválidos o fuera de rango', () => {
  const service = crearFidelidadService();
  for (const monto of [0, -5, 'abc', Infinity, NaN, 1e12]) {
    assert.throws(() => service.validarMonto(monto), AppError, `monto ${monto} debe rechazarse`);
  }
  assert.equal(service.validarMonto('150.567'), 150.57);
});

test('rechaza identificadores no enteros o negativos', () => {
  const service = crearFidelidadService();
  for (const id of [0, -1, 'abc', 1.5, null, undefined]) {
    assert.throws(() => service.validateId(id, 'inválido'), AppError);
  }
  assert.equal(service.validateId('7', 'inválido'), 7);
});

test('agrupa compras por cliente sin recorrer todo por cada uno', () => {
  const service = crearFidelidadService();
  const mapa = service.agruparPor(
    [{ cliente_id: 1 }, { cliente_id: 2 }, { cliente_id: 1 }],
    'cliente_id'
  );
  assert.equal(mapa.get(1).length, 2);
  assert.equal(mapa.get(2).length, 1);
});

test('un intervalo de cero días no marca al cliente como inactivo', () => {
  const service = crearFidelidadService();
  const hoy = new Date().toISOString().slice(0, 10);
  const resultado = service.analizarEstadoCliente({
    id: 1,
    compras: [
      { fecha: hoy, monto: 10, puntos_generados: 10 },
      { fecha: hoy, monto: 20, puntos_generados: 20 }
    ]
  });
  assert.equal(resultado.estado, 'Activo');
});

test('los niveles coinciden con los umbrales definidos', () => {
  const nivel = new ThresholdLevelStrategy();
  assert.equal(nivel.calculate(0), 'Bronce');
  assert.equal(nivel.calculate(89), 'Bronce');
  assert.equal(nivel.calculate(90), 'Plata');
  assert.equal(nivel.calculate(179), 'Plata');
  assert.equal(nivel.calculate(180), 'Oro');
});

// ─── Manejo de errores ───────────────────────────────────────────────────────
test('errorHandler no desarma un details de tipo string', () => {
  const errorHandler = require('../middleware/errorHandler');
  const err = Object.assign(new Error('fallo interno'), { details: 'texto plano de Supabase' });

  let cuerpo = null;
  const res = {
    status() { return this; },
    json(payload) { cuerpo = payload; return this; }
  };

  const consoleError = console.error;
  console.error = () => {};
  errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, () => {});
  console.error = consoleError;

  assert.equal(cuerpo['0'], undefined, 'el string no debe expandirse carácter por carácter');
  assert.equal(cuerpo.error, 'Error interno del servidor');
  assert.ok(!JSON.stringify(cuerpo).includes('fallo interno'), 'no debe filtrar el mensaje interno');
});

test('errorHandler traduce los códigos de PostgreSQL', () => {
  const errorHandler = require('../middleware/errorHandler');
  let estado = null;
  const res = {
    status(codigo) { estado = codigo; return this; },
    json() { return this; }
  };

  errorHandler({ code: '23505' }, { method: 'POST', originalUrl: '/x' }, res, () => {});
  assert.equal(estado, 409);

  errorHandler({ type: 'entity.parse.failed' }, { method: 'POST', originalUrl: '/x' }, res, () => {});
  assert.equal(estado, 400);
});

// ─── Paginación ──────────────────────────────────────────────────────────────
test('fetchAll pagina hasta agotar los resultados', async () => {
  const { fetchAll } = require('../repositories/fetchAll');
  const total = 2500;

  const filas = await fetchAll(async (desde, hasta) => ({
    data: Array.from({ length: Math.max(0, Math.min(hasta, total - 1) - desde + 1) }, (_, i) => ({
      id: desde + i
    })),
    error: null
  }));

  assert.equal(filas.length, total, 'no debe truncarse en las primeras 1000 filas');
});
