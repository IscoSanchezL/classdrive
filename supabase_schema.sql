-- ═══════════════════════════════════════════
-- CLASS DRIVE — Supabase Schema
-- ═══════════════════════════════════════════

-- Habilitar RLS (Row Level Security)
-- Tabla principal: todo el estado de la app por usuario
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  state JSONB DEFAULT '{}',
  trash JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida por email
CREATE INDEX IF NOT EXISTS idx_user_data_email ON user_data(user_email);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: Solo el usuario autenticado puede ver/editar sus datos
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Policy: el usuario solo accede a su fila
CREATE POLICY "Users can manage own data" ON user_data
  FOR ALL USING (user_email = current_setting('app.user_email', TRUE));

