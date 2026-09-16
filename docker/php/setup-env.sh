#!/bin/bash
# Script para configurar o .env do Laravel para Docker

ENV_FILE="/var/www/backend/.env"

# Função para setar ou adicionar uma variável no .env
set_env() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    elif grep -q "^# ${key}=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^# ${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

echo "Configurando .env..."

set_env "APP_NAME" '"Doispalitos"'
set_env "APP_TIMEZONE" "America/Sao_Paulo"
set_env "APP_LOCALE" "pt_BR"
set_env "APP_FALLBACK_LOCALE" "pt_BR"
set_env "APP_FAKER_LOCALE" "pt_BR"

set_env "DB_CONNECTION" "pgsql"
set_env "DB_HOST" "postgres"
set_env "DB_PORT" "5432"
set_env "DB_DATABASE" "doispalitos"
set_env "DB_USERNAME" "doispalitos"
set_env "DB_PASSWORD" "secret"

set_env "CACHE_STORE" "redis"
set_env "SESSION_DRIVER" "redis"
set_env "SESSION_ENCRYPT" "true"
set_env "QUEUE_CONNECTION" "redis"

set_env "REDIS_HOST" "redis"
set_env "REDIS_PASSWORD" "secret"
set_env "REDIS_PORT" "6379"

set_env "MAIL_HOST" "mailpit"
set_env "MAIL_PORT" "1025"
set_env "MAIL_FROM_ADDRESS" '"noreply@doispalitos.com.br"'

echo ""
echo "=== Verificação ==="
grep -E "APP_NAME|APP_TIMEZONE|DB_CONNECTION|DB_HOST|SESSION_DRIVER|CACHE_STORE|REDIS_HOST" "$ENV_FILE"
echo ""
echo "✅ .env configurado!"
