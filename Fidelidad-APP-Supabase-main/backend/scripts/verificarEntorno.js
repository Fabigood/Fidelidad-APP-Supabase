/**
 * Comprobación previa al despliegue.
 *
 *   npm run verificar
 *
 * Valida la configuración, la conexión a Supabase, el estado de RLS y el
 * hasheo de contraseñas. Sale con código 1 si algo bloquea el despliegue.
 */
const problemas = [];
const avisos = [];
const correctos = [];

function ok(mensaje) {
  correctos.push(mensaje);
}
function aviso(mensaje) {
  avisos.push(mensaje);
}
function error(mensaje) {
  problemas.push(mensaje);
}

async function main() {
  let config;

  try {
    config = require('../core/config');
    ok('Configuración cargada');
  } catch (err) {
    error(`No se pudo cargar la configuración: ${err.message}`);
    return imprimir();
  }

  // ─── Entorno ──────────────────────────────────────────────────────────────
  if (config.isProduction) ok('NODE_ENV=production');
  else aviso(`NODE_ENV=${process.env.NODE_ENV || 'development'} (en el VPS debe ser "production")`);

  // ─── JWT ──────────────────────────────────────────────────────────────────
  if (config.jwt.secret.length >= 32) ok(`JWT_SECRET tiene ${config.jwt.secret.length} caracteres`);
  else error(`JWT_SECRET es demasiado corto (${config.jwt.secret.length}). Generalo con: openssl rand -base64 48`);

  if (config.jwt.secret === 'claveSecreta123') {
    error('JWT_SECRET usa el valor de ejemplo publicado en el README');
  }

  // ─── Supabase ─────────────────────────────────────────────────────────────
  if (config.supabase.usandoServiceRole) ok('Supabase usa SUPABASE_SERVICE_ROLE_KEY');
  else aviso('Supabase usa la ANON KEY: solo es seguro si RLS está activo');

  // ─── CORS ─────────────────────────────────────────────────────────────────
  if (config.corsOrigins.length) ok(`CORS restringido a: ${config.corsOrigins.join(', ')}`);
  else error('CORS_ORIGINS está vacío: el frontend no podrá conectarse');

  // ─── Proxy ────────────────────────────────────────────────────────────────
  if (config.trustProxy === 0) {
    ok('TRUST_PROXY=0 (req.ip viene del socket y no se puede falsificar)');
  } else {
    aviso(
      `TRUST_PROXY=${config.trustProxy}: verificá que nginx reescriba X-Forwarded-For, ` +
      'o los limitadores por IP son evadibles'
    );
  }

  // ─── Correo ───────────────────────────────────────────────────────────────
  const { emailProvider } = require('../core/container');
  if (emailProvider.configurado) ok('Brevo configurado');
  else aviso('Brevo sin configurar: el envío de tarjetas fallará');

  // ─── Conexión y RLS ───────────────────────────────────────────────────────
  const supabase = require('../supabase');

  try {
    const { error: errorConsulta } = await supabase.from('clientes').select('id').limit(1);
    if (errorConsulta) throw errorConsulta;
    ok('Conexión con Supabase correcta');
  } catch (err) {
    error(`No se pudo consultar Supabase: ${err.message}`);
  }

  // Las contraseñas deben ser hashes bcrypt ($2a$/$2b$/$2y$)
  try {
    const { data, error: errorUsuarios } = await supabase.from('usuarios').select('id, password');
    if (errorUsuarios) throw errorUsuarios;

    if (!data || data.length === 0) {
      error('No hay usuarios. Creá el administrador con: npm run crear-admin');
    } else {
      const enClaro = data.filter((u) => !/^\$2[aby]\$/.test(String(u.password || '')));
      if (enClaro.length) {
        error(
          `${enClaro.length} usuario(s) con contraseña sin hashear. ` +
          'Ejecutá: npm run crear-admin'
        );
      } else {
        ok(`${data.length} usuario(s), todas las contraseñas hasheadas con bcrypt`);
      }
    }
  } catch (err) {
    error(`No se pudo verificar la tabla usuarios: ${err.message}`);
  }

  // Con RLS activo la anon key no debe poder leer nada.
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (anonKey && config.supabase.usandoServiceRole) {
    try {
      const respuesta = await fetch(
        `${config.supabase.url}/rest/v1/usuarios?select=id&limit=1`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
      );
      const cuerpo = await respuesta.json().catch(() => null);

      if (Array.isArray(cuerpo) && cuerpo.length > 0) {
        error('RLS NO está activo: la anon key puede leer la tabla usuarios. Ejecutá supabase.sql');
      } else {
        ok('RLS activo: la anon key no accede a la tabla usuarios');
      }
    } catch {
      aviso('No se pudo comprobar RLS automáticamente; verificalo a mano');
    }
  } else {
    aviso('Sin SUPABASE_ANON_KEY definida no se puede comprobar RLS automáticamente');
  }

  imprimir();
}

function imprimir() {
  console.log('');
  correctos.forEach((m) => console.log(`  [OK]     ${m}`));
  avisos.forEach((m) => console.log(`  [AVISO]  ${m}`));
  problemas.forEach((m) => console.log(`  [ERROR]  ${m}`));
  console.log('');

  if (problemas.length) {
    console.log(`  ${problemas.length} problema(s) bloquean el despliegue.`);
    process.exit(1);
  }

  console.log('  Listo para desplegar.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fallo inesperado en la verificación:', err);
  process.exit(1);
});
