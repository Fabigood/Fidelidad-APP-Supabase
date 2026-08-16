const { validarFechaISO } = require('../validators/dateValidator');

function formatFecha(fecha) {
  if (!fecha) return fecha;
  return String(fecha).slice(0, 10);
}

/**
 * Devuelve mes y año de una fecha ya validada.
 * Antes usaba new Date() sin validar: con una fecha inválida devolvía NaN, que
 * viajaba como null a columnas INTEGER NOT NULL y reventaba en la base.
 */
function getMonthAndYear(fecha) {
  const resultado = validarFechaISO(fecha);

  if (!resultado.valida) {
    throw new Error(`Fecha inválida para getMonthAndYear: ${fecha}`);
  }

  return { mes: resultado.mes, anio: resultado.anio };
}

module.exports = {
  formatFecha,
  getMonthAndYear
};
