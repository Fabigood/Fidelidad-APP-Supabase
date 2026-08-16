const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

function requerido(nombre) {
  const valor = String(process.env[nombre] || '').trim();
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiá backend/.env.example a backend/.env y completala.`
    );
  }
  return valor;
}

function lista(nombre, porDefecto = []) {
  const valor = String(process.env[nombre] || '').trim();
  if (!valor) return porDefecto;
  return valor.split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean);
}

/** Entero validado: un valor no numérico daba NaN en silencio. */
function entero(nombre, porDefecto, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const bruto = process.env[nombre];
  if (bruto === undefined || String(bruto).trim() === '') return porDefecto;

  const valor = Number(String(bruto).trim());

  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(
      `${nombre} debe ser un número entero entre ${min} y ${max}. Valor recibido: "${bruto}".`
    );
  }

  return valor;
}

const jwtSecret = requerido('JWT_SECRET');

// El secreto de ejemplo circula en el README y en el repositorio publico:
// permitirlo en produccion equivale a no tener autenticacion.
const SECRETOS_PROHIBIDOS = ['claveSecreta123', 'CAMBIAME_generar_con_openssl_rand_base64_48'];

if (isProduction) {
  if (SECRETOS_PROHIBIDOS.includes(jwtSecret)) {
    throw new Error(
      'JWT_SECRET tiene un valor de ejemplo conocido publicamente. ' +
      'Generá uno nuevo con: openssl rand -base64 48'
    );
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
  }
}

// Con RLS activo el backend necesita la service role key. La anon key solo
// sirve como respaldo para desarrollo local.
const supabaseKey =
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() ||
  String(process.env.SUPABASE_ANON_KEY || '').trim();

if (!supabaseKey) {
  throw new Error(
    'Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY para desarrollo). ' +
    'Copiá backend/.env.example a backend/.env y completala.'
  );
}

const usandoServiceRole = Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());

if (isProduction && !usandoServiceRole) {
  throw new Error(
    'En produccion el backend debe usar SUPABASE_SERVICE_ROLE_KEY. La anon key es publica ' +
    'por diseño y solo es segura si hay politicas RLS que la restrinjan.'
  );
}

// Zona horaria del negocio. Las fechas de compra las envia el navegador en hora
// local, pero el VPS suele estar en UTC: sin esto, cada tarde el servidor
// considera que ya es manana y calcula un dia de mas desde la ultima compra.
const zonaHoraria = String(process.env.APP_TIMEZONE || 'UTC').trim();

try {
  new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria });
} catch {
  throw new Error(
    `APP_TIMEZONE="${zonaHoraria}" no es una zona horaria valida. Ejemplo: America/Guayaquil.`
  );
}

const corsOrigins = lista('CORS_ORIGINS', isProduction ? [] : ['http://localhost:5173']);

// Sin origenes permitidos el navegador bloquea todas las peticiones del panel.
// Arrancar igual dejaba una aplicacion viva pero inutilizable, con un fallo
// dificil de diagnosticar desde el lado del cliente.
if (isProduction && corsOrigins.length === 0) {
  throw new Error(
    'CORS_ORIGINS está vacío. Definí el dominio del frontend, por ejemplo: ' +
    'CORS_ORIGINS=https://tudominio.com'
  );
}

module.exports = {
  isProduction,
  // Adjuntar el error interno a la respuesta es opt-in explicito. Depender de
  // NODE_ENV significaria filtrar detalles internos si alguien olvida definirlo.
  exponerDetallesDeError: String(process.env.EXPOSE_ERROR_DETAILS || '').trim() === 'true',
  port: entero('PORT', 3000, { min: 1, max: 65535 }),
  // Debe coincidir con la cantidad real de proxies delante (nginx = 1).
  trustProxy: entero('TRUST_PROXY', 1, { min: 0, max: 10 }),
  corsOrigins,
  zonaHoraria,
  jwt: {
    secret: jwtSecret,
    expiresIn: String(process.env.JWT_EXPIRES_IN || '8h'),
    algorithm: 'HS256'
  },
  supabase: {
    url: requerido('SUPABASE_URL'),
    key: supabaseKey,
    usandoServiceRole
  },
  brevo: {
    apiKey: String(process.env.BREVO_API_KEY || '').trim(),
    senderEmail: String(process.env.BREVO_SENDER_EMAIL || '').trim(),
    senderName: String(process.env.BREVO_SENDER_NAME || '').trim() || 'Fidelidad APP'
  }
};
