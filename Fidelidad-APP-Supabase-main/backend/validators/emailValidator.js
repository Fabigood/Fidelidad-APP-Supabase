const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LONGITUD_MAXIMA = 254;

const DOMINIOS_DESECHABLES = [
  'mailinator.com',
  'trashmail.com',
  'guerrillamail.com',
  'tempmail.com',
  'yopmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'sharklasers.com',
  'dispostable.com',
  'getnada.com'
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function esDominioDesechable(dominio) {
  // Coincidencia por sufijo: la comparación exacta se evade con un subdominio
  // (sub.mailinator.com entregaba igual).
  return DOMINIOS_DESECHABLES.some(
    (bloqueado) => dominio === bloqueado || dominio.endsWith(`.${bloqueado}`)
  );
}

function validarEmail(email) {
  if (!email || typeof email !== 'string') return 'El correo es obligatorio';

  const limpio = normalizeEmail(email);

  // La longitud se comprueba antes que el regex para no evaluarlo sobre entradas enormes.
  if (limpio.length > LONGITUD_MAXIMA) {
    return 'El correo excede la longitud máxima permitida';
  }

  if (!EMAIL_REGEX.test(limpio)) {
    return 'El formato del correo no es válido';
  }

  const [local, dominio] = limpio.split('@');

  if (local.length > 64) {
    return 'La parte local del correo es demasiado larga';
  }

  // ".." y los puntos al inicio o final no forman un dominio válido.
  if (dominio.includes('..') || dominio.startsWith('.') || dominio.endsWith('.')) {
    return 'El formato del correo no es válido';
  }

  if (esDominioDesechable(dominio)) {
    return 'No se permiten correos temporales o desechables';
  }

  return null;
}

module.exports = {
  normalizeEmail,
  validarEmail
};
