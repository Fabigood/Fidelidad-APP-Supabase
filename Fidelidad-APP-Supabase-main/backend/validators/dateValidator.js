const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida una fecha en formato YYYY-MM-DD y comprueba que exista de verdad.
 * new Date() acepta desbordamientos en silencio: '2026-02-30' se convertía en
 * el 2 de marzo sin avisar, corrompiendo los datos.
 */
function validarFechaISO(valor) {
  const fecha = String(valor || '').trim();

  if (!fecha) return { valida: false, error: 'La fecha es obligatoria' };
  if (!FORMATO_ISO.test(fecha)) {
    return { valida: false, error: 'La fecha debe tener el formato AAAA-MM-DD' };
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(anio, mes - 1, dia));

  const existe =
    date.getUTCFullYear() === anio &&
    date.getUTCMonth() === mes - 1 &&
    date.getUTCDate() === dia;

  if (!existe) {
    return { valida: false, error: 'La fecha indicada no existe en el calendario' };
  }

  if (anio < 2000 || anio > 2100) {
    return { valida: false, error: 'La fecha está fuera del rango permitido' };
  }

  return { valida: true, fecha, anio, mes, dia };
}

module.exports = { validarFechaISO };
