const { createClient } = require('@supabase/supabase-js');
const config = require('./core/config');

if (!config.supabase.usandoServiceRole) {
  console.warn(
    '[AVISO] El backend está usando SUPABASE_ANON_KEY. Esa clave es pública por diseño: ' +
    'solo es segura si RLS está activo. Usá SUPABASE_SERVICE_ROLE_KEY.'
  );
}

const supabase = createClient(config.supabase.url, config.supabase.key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
