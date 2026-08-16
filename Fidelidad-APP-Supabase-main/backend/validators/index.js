const { normalizeEmail, validarEmail } = require('./emailValidator');
const { validarFechaISO } = require('./dateValidator');

const NIVELES = Object.freeze(['Bronce', 'Plata', 'Oro']);
const TIPOS_RECOMPENSA = Object.freeze(['Producto', 'Descuento', 'Experiencia', 'Servicio']);

module.exports = {
  NIVELES,
  TIPOS_RECOMPENSA,
  normalizeEmail,
  validarEmail,
  validarFechaISO
};
