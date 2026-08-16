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

module.exports = {
  isProduction,
  // Adjuntar el error interno a la respuesta es opt-in explicito. Depender de
  // NODE_ENV significaria filtrar detalles internos si alguien olvida definirlo.
  exponerDetallesDeError: String(process.env.EXPOSE_ERROR_DETAILS || '').trim() === 'true',
  port: Number(process.env.PORT) || 3000,
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  corsOrigins: lista('CORS_ORIGINS', isProduction ? [] : ['http://localhost:5173']),
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
