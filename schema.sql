-- ============================================================
-- Foro Estatal Agua en la Industria — Tamaulipas 2026
-- Esquema de base de datos (Cloudflare D1 / SQLite)
-- Ejecutar en: Cloudflare Dashboard → Workers & Pages → D1 →
--   tu base de datos → Console (pegar y ejecutar)
--   o por terminal: npx wrangler d1 execute foro-registro --file=schema.sql
-- ============================================================

-- 1. Todos los registrados (preregistro básico)
CREATE TABLE IF NOT EXISTS participantes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  folio             TEXT UNIQUE,                          -- FORO-2026-0001 (se genera al registrar)
  nombre            TEXT NOT NULL,
  apellidos         TEXT NOT NULL,
  correo            TEXT NOT NULL UNIQUE,                 -- un registro por correo
  telefono          TEXT NOT NULL,
  tipo_participante TEXT NOT NULL,                        -- empresa | gobierno | academia | organizacion | publico
  organizacion      TEXT,
  puesto            TEXT,
  municipio         TEXT,
  dias_asistencia   TEXT DEFAULT 'ambos',                 -- 24 | 25 | ambos
  interesa_b2b      INTEGER NOT NULL DEFAULT 0,           -- 0 = no, 1 = sí
  estado            TEXT DEFAULT 'registrado',            -- registrado | confirmado | asistio
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_participantes_correo ON participantes (correo);
CREATE INDEX IF NOT EXISTS idx_participantes_tipo   ON participantes (tipo_participante);
CREATE INDEX IF NOT EXISTS idx_participantes_b2b    ON participantes (interesa_b2b);

-- 2. Perfil de matchmaking (solo quienes respondieron SÍ al B2B)
CREATE TABLE IF NOT EXISTS b2b_perfiles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  participante_id    INTEGER NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  razon_social       TEXT NOT NULL,
  rfc                TEXT,
  sector             TEXT NOT NULL,
  tamanio_empresa    TEXT,
  sitio_web          TEXT,
  descripcion        TEXT NOT NULL,
  tipo_participacion TEXT NOT NULL,
  productos_ofrece   TEXT,
  productos_busca    TEXT,
  sectores_interes   TEXT,
  disponibilidad     TEXT,
  autoriza_contacto  INTEGER DEFAULT 0,
  created_at         TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_participante ON b2b_perfiles (participante_id);
CREATE INDEX IF NOT EXISTS idx_b2b_sector       ON b2b_perfiles (sector);

-- 3. Citas de networking 1 a 1 (operación del matchmaking)
CREATE TABLE IF NOT EXISTS b2b_citas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitante_id INTEGER NOT NULL REFERENCES b2b_perfiles(id) ON DELETE CASCADE,
  invitado_id    INTEGER NOT NULL REFERENCES b2b_perfiles(id) ON DELETE CASCADE,
  fecha_hora     TEXT,
  mesa           INTEGER,
  estado         TEXT DEFAULT 'pendiente',
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_citas_solicitante ON b2b_citas (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_citas_invitado    ON b2b_citas (invitado_id);
