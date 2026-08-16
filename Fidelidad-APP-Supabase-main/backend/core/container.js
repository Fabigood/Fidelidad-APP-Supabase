const config = require('./config');
const supabase = require('../supabase');
const UserRepository = require('../repositories/UserRepository');
const ClienteRepository = require('../repositories/ClienteRepository');
const CompraRepository = require('../repositories/CompraRepository');
const RecompensaRepository = require('../repositories/RecompensaRepository');
const ReclamoRepository = require('../repositories/ReclamoRepository');
const TarjetaRepository = require('../repositories/TarjetaRepository');
const AuthService = require('../services/AuthService');
const ClienteService = require('../services/ClienteService');
const FidelidadService = require('../services/FidelidadService');
const TarjetaFidelidadService = require('../services/TarjetaFidelidadService');
const BrevoEmailProvider = require('../services/email/BrevoEmailProvider');
const AuthController = require('../controllers/AuthController');
const ClienteController = require('../controllers/ClienteController');
const FidelidadController = require('../controllers/FidelidadController');
const { MontoEnteroPointsStrategy } = require('../services/strategies/pointsStrategy');
const { ThresholdLevelStrategy } = require('../services/strategies/levelStrategy');

function buildContainer() {
  const repositories = {
    userRepository: new UserRepository(supabase),
    clienteRepository: new ClienteRepository(supabase),
    compraRepository: new CompraRepository(supabase),
    recompensaRepository: new RecompensaRepository(supabase),
    reclamoRepository: new ReclamoRepository(supabase),
    tarjetaRepository: new TarjetaRepository(supabase)
  };

  const strategies = {
    pointsStrategy: new MontoEnteroPointsStrategy(),
    levelStrategy: new ThresholdLevelStrategy()
  };

  const emailProvider = new BrevoEmailProvider(config.brevo);

  if (!emailProvider.configurado) {
    console.warn('[AVISO] Brevo no está configurado: el envío de tarjetas por correo fallará.');
  }

  const services = {
    authService: new AuthService({
      userRepository: repositories.userRepository,
      jwtConfig: config.jwt
    }),
    clienteService: new ClienteService({
      clienteRepository: repositories.clienteRepository,
      levelStrategy: strategies.levelStrategy
    }),
    fidelidadService: new FidelidadService({
      clienteRepository: repositories.clienteRepository,
      compraRepository: repositories.compraRepository,
      recompensaRepository: repositories.recompensaRepository,
      reclamoRepository: repositories.reclamoRepository,
      pointsStrategy: strategies.pointsStrategy,
      levelStrategy: strategies.levelStrategy,
      zonaHoraria: config.zonaHoraria
    })
  };

  services.tarjetaFidelidadService = new TarjetaFidelidadService({
    fidelidadService: services.fidelidadService,
    emailProvider,
    tarjetaRepository: repositories.tarjetaRepository
  });

  return {
    ...repositories,
    ...strategies,
    ...services,
    emailProvider,
    authController: new AuthController(services.authService),
    clienteController: new ClienteController(services.clienteService),
    fidelidadController: new FidelidadController({
      clienteService: services.clienteService,
      fidelidadService: services.fidelidadService,
      tarjetaFidelidadService: services.tarjetaFidelidadService
    })
  };
}

module.exports = buildContainer();
