# ─── Doispalitos — Makefile ───────────────────────────────────────────────────
# Atalhos para os comandos mais comuns do projeto.
# Uso: make <alvo>
# Exemplo: make up, make artisan cmd="migrate"

.PHONY: help up down build restart logs shell artisan composer test lint

# Exibe ajuda
help:
	@echo ""
	@echo "  Doispalitos — Comandos disponíveis"
	@echo "  ─────────────────────────────────────────"
	@echo "  make up           Sobe os containers"
	@echo "  make down         Para os containers"
	@echo "  make build        Reconstrói as imagens"
	@echo "  make restart      Para e sobe novamente"
	@echo "  make logs         Logs em tempo real"
	@echo "  make shell        Acessa o shell do PHP"
	@echo "  make artisan      Roda php artisan (cmd=<comando>)"
	@echo "  make composer     Roda composer (cmd=<comando>)"
	@echo "  make test         Roda os testes"
	@echo "  make lint         Roda o PHP CS Fixer"
	@echo "  make migrate      Roda as migrations"
	@echo "  make fresh        Recria o banco (apaga tudo!)"
	@echo ""

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose up -d --build

restart: down up

logs:
	docker compose logs -f app nginx

shell:
	docker compose exec app bash

artisan:
	docker compose exec app php artisan $(cmd)

composer:
	docker compose exec app composer $(cmd)

test:
	docker compose exec app php artisan test

lint:
	docker compose exec app vendor/bin/php-cs-fixer fix --dry-run --diff

lint-fix:
	docker compose exec app vendor/bin/php-cs-fixer fix

migrate:
	docker compose exec app php artisan migrate

fresh:
	@echo "⚠️  ATENÇÃO: Isso vai apagar todos os dados do banco!"
	docker compose exec app php artisan migrate:fresh --seed
