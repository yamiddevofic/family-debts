-- Esquema — plan §4.
--
-- Cinco tablas de HECHOS. Ninguna columna de saldo, obligación, "pagado" ni "saldado":
-- todo eso se deriva en `@deudas/core` en cada consulta (Artículo IV). Si alguna vez
-- aparece aquí una columna de saldo, es que se violó un principio, no que se optimizó.
--
-- Todas las tablas llevan `grupo_id` y todas las consultas lo filtran (Artículo VI).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS grupo (
  id                   TEXT PRIMARY KEY,
  nombre               TEXT    NOT NULL,
  moneda_codigo        TEXT    NOT NULL,
  moneda_exponente     INTEGER NOT NULL,
  -- Nunca el token: solo su SHA-256 (DT-09). Si alguien se lleva el archivo .db,
  -- no obtiene enlaces utilizables.
  hash_enlace_edicion  TEXT    NOT NULL UNIQUE,
  hash_enlace_lectura  TEXT    NOT NULL UNIQUE,
  creado_en            TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS miembro (
  id        TEXT PRIMARY KEY,
  grupo_id  TEXT    NOT NULL REFERENCES grupo(id),
  nombre    TEXT    NOT NULL,
  activo    INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS objetivo (
  id           TEXT PRIMARY KEY,
  grupo_id     TEXT    NOT NULL REFERENCES grupo(id),
  nombre       TEXT    NOT NULL,
  descripcion  TEXT,
  monto_total  INTEGER NOT NULL CHECK (monto_total > 0),
  modalidad    TEXT    NOT NULL CHECK (modalidad IN ('REPARTO_UNICO','CUOTAS_PERIODICAS')),
  estado       TEXT    NOT NULL CHECK (estado IN ('ACTIVO','CANCELADO','ARCHIVADO')),
  periodicidad TEXT             CHECK (periodicidad IS NULL OR periodicidad = 'MENSUAL'),
  fecha_inicio TEXT,
  fecha_limite TEXT,
  version      INTEGER NOT NULL DEFAULT 1,
  creado_en    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS involucrado (
  objetivo_id TEXT    NOT NULL REFERENCES objetivo(id),
  miembro_id  TEXT    NOT NULL REFERENCES miembro(id),
  tipo_parte  TEXT    NOT NULL CHECK (tipo_parte IN ('IGUAL','PORCENTAJE','MONTO_FIJO')),
  valor_parte INTEGER NOT NULL DEFAULT 0,
  orden       INTEGER NOT NULL,
  PRIMARY KEY (objetivo_id, miembro_id)
);

CREATE TABLE IF NOT EXISTS aporte (
  id               TEXT PRIMARY KEY,
  grupo_id         TEXT    NOT NULL REFERENCES grupo(id),
  objetivo_id      TEXT    NOT NULL REFERENCES objetivo(id),
  acreditado_a     TEXT    NOT NULL REFERENCES miembro(id),
  pagado_por       TEXT    NOT NULL REFERENCES miembro(id),
  monto            INTEGER NOT NULL CHECK (monto > 0),
  fecha_valor      TEXT    NOT NULL,
  periodo_indice   INTEGER,
  metodo           TEXT,
  nota             TEXT,
  -- Auto-declarado. NO es autenticación (RN-17): sirve para recordar, no para probar.
  registrado_por   TEXT    NOT NULL,
  registrado_en    TEXT    NOT NULL,
  -- RN-13 y Artículo V: se anula, jamás se borra.
  anulado_en       TEXT,
  anulado_por      TEXT,
  anulacion_motivo TEXT
);

CREATE INDEX IF NOT EXISTS idx_miembro_grupo     ON miembro(grupo_id);
CREATE INDEX IF NOT EXISTS idx_objetivo_grupo    ON objetivo(grupo_id);
CREATE INDEX IF NOT EXISTS idx_involucrado_obj   ON involucrado(objetivo_id);
CREATE INDEX IF NOT EXISTS idx_aporte_grupo      ON aporte(grupo_id);
CREATE INDEX IF NOT EXISTS idx_aporte_objetivo   ON aporte(objetivo_id);
