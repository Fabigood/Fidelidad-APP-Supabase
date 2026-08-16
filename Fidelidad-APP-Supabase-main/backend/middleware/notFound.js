const AppError = require('../core/AppError');

module.exports = function notFound(req, res, next) {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
};
