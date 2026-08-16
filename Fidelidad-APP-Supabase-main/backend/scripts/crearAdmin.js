/**
 * Crea o actualiza un usuario administrador con la contraseña hasheada con bcrypt.
 *
 *   npm run crear-admin
 *   npm run crear-admin -- --usuario admin --password "TuClaveFuerte"
 *
 * Si no se pasa --password se genera una aleatoria y se muestra una sola vez.
 */
const crypto = require('crypto');
const AuthService = require('../services/AuthService');
const supabase = require('../supabase');

const LONGITUD_MINIMA = 12;

function leerArgumento(nombre) {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice !== -1 ? process.argv[indice + 1] : null;
}

async function main() {
  const usuario = String(leerArgumento('usuario') || 'admin').trim();
  const passwordIndicada = leerArgumento('password');
  const password = passwordIndicada || crypto.randomBytes(18).toString('base64url');

  if (password.length < LONGITUD_MINIMA) {
    console.error(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
    process.exit(1);
  }

  const passwordHash = await AuthService.hashPassword(password);

  const { data: existente, error: errorBusqueda } = await supabase
    .from('usuarios')
    .select('id')
    .eq('username', usuario)
    .maybeSingle();

  if (errorBusqueda) throw errorBusqueda;

  if (existente) {
    const { error } = await supabase
      .from('usuarios')
      .update({ password: passwordHash })
      .eq('id', existente.id);

    if (error) throw error;
    console.log(`Contraseña actualizada para el usuario "${usuario}".`);
  } else {
    const { error } = await supabase
      .from('usuarios')
      .insert([{ username: usuario, password: passwordHash }]);

    if (error) throw error;
    console.log(`Usuario "${usuario}" creado.`);
  }

  if (!passwordIndicada) {
    console.log('');
    console.log('  ---------------------------------------------');
    console.log(`  Contraseña generada: ${password}`);
    console.log('  Guardala ahora: no se vuelve a mostrar.');
    console.log('  ---------------------------------------------');
    console.log('');
  }
}

main().catch((err) => {
  console.error('Error al crear el administrador:', err.message);
  process.exit(1);
});
