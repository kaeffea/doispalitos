FROM php:8.3-fpm-alpine

# ─── Dependências do sistema ─────────────────────────────────────────────────
RUN apk add --no-cache \
    bash \
    curl \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    icu-dev \
    oniguruma-dev \
    linux-headers \
    $PHPIZE_DEPS

# ─── Extensões PHP ───────────────────────────────────────────────────────────
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo \
        pdo_pgsql \
        pgsql \
        zip \
        gd \
        bcmath \
        intl \
        mbstring \
        opcache \
        pcntl \
        sockets

# ─── Redis extension (via PECL) ──────────────────────────────────────────────
RUN pecl install redis \
    && docker-php-ext-enable redis

# ─── Composer ────────────────────────────────────────────────────────────────
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# ─── Usuário não-root (segurança) ────────────────────────────────────────────
RUN addgroup -g 1000 appgroup \
    && adduser -u 1000 -G appgroup -s /bin/bash -D appuser

WORKDIR /var/www/backend

# ─── Entrypoint ───────────────────────────────────────────────────────────────
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Entrypoint roda como root para poder instalar pacotes e ajustar permissões.
# O processo php-fpm dentro do container ainda servirá como appuser.
EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm"]
