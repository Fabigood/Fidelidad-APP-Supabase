/**
 * Pruebas de las reglas de negocio de fidelización.
 * Cubren las divergencias detectadas entre el cálculo del backend y el que
 * antes duplicaba el frontend.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-suficientemente-largo-1234';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejemplo.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'clave-de-pruebas';

const test = require('node:test');
const assert = require('node:assert/strict');

const FidelidadService = require('../services/FidelidadService');
const { ThresholdLevelStrategy } = require('../services/strategies/levelStrategy');
const { MontoEnteroPointsStrategy } = require('../services/strategies/pointsStrategy');

const HOY = '2026-08-15';

function diasAntes(n, desde = HOY) {
  const d = new Date(`${desde}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function crearService({ clientes = [], compras = [], reclamos = [] } = {}) {
  const service = new FidelidadService({
    clienteRepository: {
      async findAll() { return clientes; },
      async findById(id) { return clientes.find((c) => c.id === Number(id)) || null; }
    },
    compraRepository: {
      async findAllOrdered() { return compras; },
      async findByClienteId(id) { return compras.filter((c) => c.cliente_id === Number(id)); }
    },
    recompensaRepository: { async findAll() { return []; }, async findById() { return { id: 1 }; } },
    reclamoRepository: {
      async findAllWithReward() { return reclamos; },
      async findByClienteId(id) { return reclamos.filter((r) => r.cliente_id === Number(id)); }
    },
    pointsStrategy: new MontoEnteroPointsStrategy(),
    levelStrategy: new ThresholdLevelStrategy()
  });

  // Fecha fija para que las pruebas no dependan del día en que se ejecuten.
  service.hoy = () => HOY;
  return service;
}

function compra(clienteId, fecha, monto) {
  return { id: Math.random(), cliente_id: clienteId, fecha, monto, puntos_generados: Math.floor(monto) };
}

// ─── Estado del cliente ──────────────────────────────────────────────────────
test('un cliente sin compras queda "Sin datos"', async () => {
  const service = crearService({ clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }] });
  const [cliente] = await service.getClientesConDetalle();

  assert.equal(cliente.estado, 'Sin datos');
  assert.equal(cliente.probabilidadRetorno, 20);
  assert.equal(cliente.intervalo, null);
});

test('una sola compra queda "En observación" (el frontend decía "Sin datos")', async () => {
  const service = crearService({
    clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }],
    compras: [compra(1, diasAntes(5), 50)]
  });
  const [cliente] = await service.getClientesConDetalle();

  assert.equal(cliente.estado, 'En observación');
  assert.equal(cliente.probabilidadRetorno, 45);
  assert.equal(cliente.diasDesdeUltima, 5);
});

test('dos compras el mismo día quedan "Activo" (el frontend decía "Sin datos")', async () => {
  const service = crearService({
    clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }],
    compras: [compra(1, HOY, 30), compra(1, HOY, 40)]
  });
  const [cliente] = await service.getClientesConDetalle();

  assert.equal(cliente.estado, 'Activo');
  assert.equal(cliente.probabilidadRetorno, 90);
  assert.equal(cliente.intervalo, 0, 'intervalo 0 es válido, no ausencia de dato');
});

test('clasifica en riesgo e inactivo según el ritmo de compra', async () => {
  const casos = [
    // intervalo medio 8,3 d y ultima compra hace 5 -> dentro de su ritmo
    { dias: [30, 20, 10, 5], estado: 'Activo' },
    // intervalo medio 10 d y ultima compra hace 12 -> se pasa un poco
    { dias: [32, 22, 12], estado: 'En riesgo' },
    // intervalo medio 10 d y ultima compra hace 80 -> muy por encima de 2,2x
    { dias: [100, 90, 80], estado: 'Inactivo' }
  ];

  for (const caso of casos) {
    const service = crearService({
      clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }],
      compras: caso.dias.map((d) => compra(1, diasAntes(d), 20))
    });
    const [cliente] = await service.getClientesConDetalle();
    assert.equal(cliente.estado, caso.estado, `días ${caso.dias.join(',')}`);
  }
});

test('estima la próxima compra a partir del intervalo medio', async () => {
  const service = crearService({
    clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }],
    compras: [compra(1, diasAntes(20), 10), compra(1, diasAntes(10), 10), compra(1, diasAntes(0), 10)]
  });
  const [cliente] = await service.getClientesConDetalle();

  assert.equal(cliente.intervalo, 10);
  assert.equal(cliente.proximaCompra, '2026-08-25');
});

test('getClienteDetalle devuelve el mismo estado que el listado', async () => {
  const datos = {
    clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }],
    compras: [compra(1, diasAntes(5), 50)]
  };
  const service = crearService(datos);

  const [delListado] = await service.getClientesConDetalle();
  const delDetalle = await service.getClienteDetalle(1);

  assert.equal(delDetalle.estado, delListado.estado);
  assert.equal(delDetalle.probabilidadRetorno, delListado.probabilidadRetorno);
  assert.equal(delDetalle.puntos, delListado.puntos);
});

// ─── Puntos y niveles ────────────────────────────────────────────────────────
test('los puntos se acumulan por cliente sin mezclarse', async () => {
  const service = crearService({
    clientes: [
      { id: 1, nombre: 'A', email: 'a@a.com' },
      { id: 2, nombre: 'B', email: 'b@b.com' }
    ],
    compras: [compra(1, diasAntes(3), 100.9), compra(2, diasAntes(2), 50.4), compra(1, diasAntes(1), 95)]
  });

  const clientes = await service.getClientesConDetalle();
  const a = clientes.find((c) => c.id === 1);
  const b = clientes.find((c) => c.id === 2);

  assert.equal(a.puntos, 195, 'floor(100.9) + floor(95)');
  assert.equal(a.nivel, 'Oro');
  assert.equal(b.puntos, 50);
  assert.equal(b.nivel, 'Bronce');
});

// ─── Resumen administrativo ──────────────────────────────────────────────────
test('el total de clientes en riesgo no se recorta a los 5 mostrados', async () => {
  const clientes = [];
  const compras = [];
  // 8 clientes inactivos
  for (let i = 1; i <= 8; i += 1) {
    clientes.push({ id: i, nombre: `C${i}`, email: `c${i}@x.com` });
    compras.push(compra(i, diasAntes(200), 10), compra(i, diasAntes(190), 10));
  }

  const service = crearService({ clientes, compras });
  const resumen = await service.getResumenAdministrativo();

  assert.equal(resumen.clientesEnRiesgo.length, 5, 'la lista se muestra recortada');
  assert.equal(resumen.totalClientesEnRiesgo, 8, 'el contador debe reflejar el total real');
});

test('el resumen calcula ventas y ticket promedio correctamente', async () => {
  const service = crearService({
    clientes: [{ id: 1, nombre: 'A', email: 'a@a.com' }],
    compras: [compra(1, diasAntes(2), 100), compra(1, diasAntes(1), 50)]
  });
  const resumen = await service.getResumenAdministrativo();

  assert.equal(resumen.totalVentas, 150);
  assert.equal(resumen.ticketPromedio, 75);
  assert.equal(resumen.totalCompras, 2);
  assert.equal(resumen.puntosGenerados, 150);
});

test('el reparto por nivel suma el total de clientes', async () => {
  const service = crearService({
    clientes: [
      { id: 1, nombre: 'A', email: 'a@a.com' },
      { id: 2, nombre: 'B', email: 'b@b.com' },
      { id: 3, nombre: 'C', email: 'c@c.com' }
    ],
    compras: [compra(1, diasAntes(1), 200), compra(2, diasAntes(1), 100)]
  });
  const resumen = await service.getResumenAdministrativo();

  const total = resumen.clientesPorNivel.reduce((t, n) => t + n.total, 0);
  assert.equal(total, 3);
  assert.equal(resumen.clientesPorNivel.find((n) => n.nivel === 'Oro').total, 1);
  assert.equal(resumen.clientesPorNivel.find((n) => n.nivel === 'Plata').total, 1);
  assert.equal(resumen.clientesPorNivel.find((n) => n.nivel === 'Bronce').total, 1);
});

// ─── Zona horaria ────────────────────────────────────────────────────────────
test('hoy() respeta la zona horaria configurada', () => {
  const enUtc = new FidelidadService({
    clienteRepository: {}, compraRepository: {}, recompensaRepository: {}, reclamoRepository: {},
    pointsStrategy: new MontoEnteroPointsStrategy(),
    levelStrategy: new ThresholdLevelStrategy(),
    zonaHoraria: 'UTC'
  });
  const enGuayaquil = new FidelidadService({
    clienteRepository: {}, compraRepository: {}, recompensaRepository: {}, reclamoRepository: {},
    pointsStrategy: new MontoEnteroPointsStrategy(),
    levelStrategy: new ThresholdLevelStrategy(),
    zonaHoraria: 'America/Guayaquil'
  });

  assert.match(enUtc.hoy(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(enGuayaquil.hoy(), /^\d{4}-\d{2}-\d{2}$/);
  // Guayaquil (UTC-5) nunca va por delante de UTC.
  assert.ok(enGuayaquil.hoy() <= enUtc.hoy());
});
