-- ============================================================================
-- Fidelidad APP - Esquema para Supabase PostgreSQL
--
-- IMPORTANTE: el backend se conecta con la SERVICE ROLE KEY, que por diseño
-- omite las políticas RLS. RLS se activa aquí para que la ANON KEY -que es
-- pública- no tenga acceso a ninguna tabla. Sin esto, cualquiera con esa clave
-- lee y escribe la base entera saltándose el backend.
-- ============================================================================

-- ─── Usuarios ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,          -- hash bcrypt, NUNCA texto plano
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El usuario admin se crea con `npm run crear-admin`, que genera el hash bcrypt.
-- Ya no se inserta admin/1234 desde este script.

-- ─── Clientes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL CHECK (length(trim(nombre)) > 0),
  email VARCHAR(254) NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Recompensas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recompensas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL CHECK (length(trim(nombre)) > 0),
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('Bronce', 'Plata', 'Oro')),
  tipo VARCHAR(60) NOT NULL DEFAULT 'Producto'
    CHECK (tipo IN ('Producto', 'Descuento', 'Experiencia', 'Servicio')),
  detalle TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO recompensas (nombre, nivel, tipo, detalle)
VALUES
  ('Café gratis', 'Bronce', 'Producto', 'Un café de cortesía'),
  ('Descuento 5%', 'Bronce', 'Descuento', '5% en tu próxima compra'),
  ('Postre gratis', 'Plata', 'Producto', 'Postre de temporada'),
  ('Descuento 15%', 'Plata', 'Descuento', '15% en cualquier producto'),
  ('Cena para dos', 'Oro', 'Experiencia', 'Cena especial para dos personas'),
  ('Descuento 30%', 'Oro', 'Descuento', '30% en tu próxima visita')
ON CONFLICT DO NOTHING;

-- ─── Compras ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compras (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  puntos_generados INTEGER NOT NULL DEFAULT 0 CHECK (puntos_generados >= 0)
);

-- ─── Reclamos de recompensa ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reclamos_recompensa (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  recompensa_id INTEGER NOT NULL REFERENCES recompensas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL CHECK (anio BETWEEN 2000 AND 2100)
);

-- ─── Tarjetas de fidelidad enviadas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarjetas_fidelidad (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('Bronce', 'Plata', 'Oro')),
  puntos INTEGER NOT NULL DEFAULT 0 CHECK (puntos >= 0),
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_compras_cliente ON compras(cliente_id);
-- Las consultas ordenan siempre por fecha; sin este índice es un sort completo.
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_reclamos_cliente ON reclamos_recompensa(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarjetas_cliente ON tarjetas_fidelidad(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarjetas_fecha ON tarjetas_fidelidad(fecha_envio DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- Se activa sin crear políticas: eso deniega TODO acceso a los roles anon y
-- authenticated. La service role key que usa el backend omite RLS y sigue
-- funcionando con normalidad.
-- ============================================================================
ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recompensas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclamos_recompensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarjetas_fidelidad  ENABLE ROW LEVEL SECURITY;

-- FORCE aplica RLS incluso al propietario de la tabla.
ALTER TABLE usuarios            FORCE ROW LEVEL SECURITY;
ALTER TABLE clientes            FORCE ROW LEVEL SECURITY;
ALTER TABLE recompensas         FORCE ROW LEVEL SECURITY;
ALTER TABLE compras             FORCE ROW LEVEL SECURITY;
ALTER TABLE reclamos_recompensa FORCE ROW LEVEL SECURITY;
ALTER TABLE tarjetas_fidelidad  FORCE ROW LEVEL SECURITY;

-- Revoca los permisos que PostgREST concede por defecto a los roles públicos.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ============================================================================
-- VERIFICACIÓN
-- Todas las filas deben mostrar rowsecurity = true:
--
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- Y esta llamada debe devolver un error de permisos, no datos:
--
--   curl "https://TU_PROYECTO.supabase.co/rest/v1/usuarios?select=*" \
--        -H "apikey: TU_ANON_KEY"
-- ============================================================================

-- ============================================================================
-- MIGRACIÓN desde una instalación anterior
-- Si ya tenías la tabla usuarios con contraseñas en texto plano:
--
--   1. DELETE FROM usuarios;   -- descartar las credenciales en claro
--   2. Ejecutar este script completo
--   3. npm run crear-admin     -- crear el admin con hash bcrypt
-- ============================================================================
