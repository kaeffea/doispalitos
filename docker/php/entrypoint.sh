#!/bin/bash
# ─── Entrypoint do container PHP ─────────────────────────────────────────────
# Instala o Laravel na primeira inicialização (vendor fica no Docker volume)

set -e

BACKEND_DIR="/var/www/backend"
VENDOR_DIR="$BACKEND_DIR/vendor"

# Garante que a estrutura de diretórios do storage existe com permissões corretas
init_storage() {
    mkdir -p \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache

    # 777 porque PHP-FPM roda como www-data e o entrypoint como root
    chmod -R 777 storage bootstrap/cache
    echo "✅ Permissões de storage configuradas."
}

# Verifica se o projeto Laravel já foi instalado
if [ ! -f "$BACKEND_DIR/artisan" ]; then
    echo "⚙️  Primeira inicialização: criando projeto Laravel..."
    composer create-project laravel/laravel /tmp/laravel_init --prefer-dist --no-interaction
    cp -rn /tmp/laravel_init/. "$BACKEND_DIR/" 2>/dev/null || cp -r /tmp/laravel_init/* "$BACKEND_DIR/"
    cp /tmp/laravel_init/.* "$BACKEND_DIR/" 2>/dev/null || true
    rm -rf /tmp/laravel_init
    init_storage
    echo "✅ Laravel instalado com sucesso!"
elif [ ! -f "$VENDOR_DIR/autoload.php" ]; then
    echo "⚙️  Instalando dependências (composer install)..."
    composer install --no-interaction --no-progress --prefer-dist
    init_storage
    echo "✅ Dependências instaladas!"
else
    # Garante permissões mesmo em reinicializações subsequentes
    init_storage
    echo "✅ Laravel pronto."
fi

# Inicia o PHP-FPM
exec "$@"
