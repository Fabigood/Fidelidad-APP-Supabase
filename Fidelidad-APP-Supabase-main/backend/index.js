const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./core/config');
const AppError = require('./core/AppError');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { apiRateLimiter, publicRateLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const fidelidadRoutes = require('./routes/fidelidad');
const asyncHandler = require('./utils/asyncHandler');
const { fidelidadController, clienteRepository } = require('./core/container');

const app = express();

// No anunciar el stack: 'X-Powered-By: Express' solo sirve al atacante.
app.disable('x-powered-by');

// Debe coincidir con la cantidad real de proxies (nginx = 1). Si Node queda
// expuesto directo, TRUST_PROXY=0 evita que se falsifique req.ip y con ello
// los limitadores por IP.
app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: config.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    crossOriginResourcePolicy: { policy: 'same-site' }
  })
);

app.use(compression());
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// Un origen no permitido es un error del cliente (403), no del servidor.
// Lanzarlo como excepción genérica producía un 500 y volcaba una traza completa
// en el log por cada petición: ruido que enmascara los fallos reales.
const corsOptions = {
  origin(origin, callback) {
    // Sin cabecera Origin: peticiones del mismo origen, curl o health checks.
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || config.corsOrigins.includes(origin.replace(/\/$/, ''))) return next();
  next(new AppError('Origen no permitido', 403));
});

app.use(express.json({ limit: '100kb' }));

// Sonda de vida: responde mientras el proceso siga en pie. La usan PM2 y systemd
// para decidir si reiniciar.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Sonda de disponibilidad: comprueba además que la base responda. Antes /health
// devolvía "ok" con Supabase caído, así que ningún monitor detectaba la avería.
app.get(
  '/api/health/ready',
  asyncHandler(async (req, res) => {
    const inicio = Date.now();
    try {
      await clienteRepository.findDuplicatedEmail('__healthcheck__');
      res.json({
        status: 'ok',
        baseDeDatos: 'ok',
        latenciaMs: Date.now() - inicio,
        uptime: Math.round(process.uptime())
      });
    } catch (err) {
      console.error('[HEALTH] La base de datos no responde:', err.message);
      res.status(503).json({ status: 'degradado', baseDeDatos: 'sin respuesta' });
    }
  })
);

app.get('/', (req, res) => {
  res.json({ mensaje: 'Backend de Fidelidad APP', apiHealth: '/api/health' });
});

app.use('/api', apiRateLimiter);

app.get(
  '/api/fidelidad/resumen-publico',
  publicRateLimiter,
  asyncHandler(fidelidadController.getResumenPublico)
);

app.use('/api/auth', authRoutes);
app.use('/api/clientes', authMiddleware, clientesRoutes);
app.use('/api/fidelidad', authMiddleware, fidelidadRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`Servidor corriendo en puerto ${config.port} (${process.env.NODE_ENV || 'development'})`);
});

// Cierre ordenado: sin esto, un reinicio de PM2 o systemd corta las peticiones en curso.
function apagar(senal) {
  console.log(`${senal} recibido, cerrando servidor...`);
  server.close(() => {
    console.log('Servidor cerrado correctamente');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Promesa rechazada sin manejar:', err);
});

module.exports = app;
