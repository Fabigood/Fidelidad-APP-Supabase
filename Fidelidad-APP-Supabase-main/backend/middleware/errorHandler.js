const AppError = require('../core/AppError');
const config = require('../core/config');

// Códigos de PostgreSQL que corresponden a errores del cliente, no del servidor.
const ERRORES_POSTGRES = {
  '23505': { statusCode: 409, mensaje: 'El registro ya existe' },
  '23503': { statusCode: 400, mensaje: 'El registro referenciado no existe' },
  '23502': { statusCode: 400, mensaje: 'Faltan campos obligatorios' },
  '23514': { statusCode: 422, mensaje: 'Los datos no cumplen las restricciones de la base' },
  '22P02': { statusCode: 400, mensaje: 'Formato de dato inválido' },
  '22003': { statusCode: 422, mensaje: 'Un valor numérico está fuera de rango' }
};

function clasificar(err) {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, mensaje: err.message, esperado: true };
  }

  const porCodigo = ERRORES_POSTGRES[err?.code];
  if (porCodigo) {
    return { statusCode: porCodigo.statusCode, mensaje: porCodigo.mensaje, esperado: true };
  }

  // Body malformado: lo lanza express.json(), es un 400 y no un 500.
  if (err?.type === 'entity.parse.failed') {
    return { statusCode: 400, mensaje: 'El cuerpo de la petición no es JSON válido', esperado: true };
  }
  if (err?.type === 'entity.too.large') {
    return { statusCode: 413, mensaje: 'El cuerpo de la petición es demasiado grande', esperado: true };
  }

  return { statusCode: 500, mensaje: 'Error interno del servidor', esperado: false };
}

module.exports = function errorHandler(err, req, res, next) {
  const { statusCode, mensaje, esperado } = clasificar(err);

  // Sin esto no queda ningún rastro para diagnosticar en el servidor.
  if (!esperado || statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);
  }

  // Si la respuesta ya empezó a enviarse no se puede cambiar el estado ni el
  // cuerpo: intentarlo lanzaría ERR_HTTP_HEADERS_SENT y tumbaría la petición.
  if (res.headersSent) {
    return next(err);
  }

  // err.details puede ser un string (los errores de Supabase lo son): hacer spread
  // de un string lo desarma carácter por carácter y corrompe la respuesta.
  const details =
    err?.details && typeof err.details === 'object' && !Array.isArray(err.details)
      ? err.details
      : {};

  const payload = { error: mensaje, ...details };

  // Nunca se filtra el error interno al cliente salvo que se active a proposito
  // con EXPOSE_ERROR_DETAILS=true (solo para depurar en local).
  if (!esperado && config.exponerDetallesDeError) {
    payload.debug = err?.message;
  }

  res.status(statusCode).json(payload);
};
