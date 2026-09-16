-- ─────────────────────────────────────────────────────────────────────────────
-- Doispalitos — Inicialização do PostgreSQL
-- Executado automaticamente na primeira criação do container
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUIDs nativos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Funções criptográficas

-- ─── Função helper para RLS ───────────────────────────────────────────────────
-- Retorna o tenant_id da sessão atual (definido pelo middleware Laravel)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::uuid;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
