# Doispalitos 

Plataforma SaaS multi-tenant de hiperprecisão operacional para gastronomia independente.

---

## Documentação do Projeto

Toda a documentação técnica, estratégica e de continuidade está disponível na pasta [`docs/`](docs/):

- **[Arquitetura do Sistema (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)**: Detalhamento da stack, containers Docker, isolamento multi-tenant via PostgreSQL Row Level Security (RLS) e design system editorial.
- **[Visão, Ambições & Roadmap (`docs/ROADMAP_AND_AMBITIONS.md`)](docs/ROADMAP_AND_AMBITIONS.md)**: Proposta de valor, sequenciamento de produção na cozinha (KDS preditivo) e roadmap das Fases 0 a 7.
- **[Guia de Handoff & Continuação (`docs/HANDOFF.md`)](docs/HANDOFF.md)**: Passo a passo para rodar o projeto em uma nova máquina, credenciais de teste e próximo passo técnico a implementar.

---

## Como Rodar Localmente (Docker)

```bash
# 1. Clonar o repositório
git clone https://github.com/kaeffea/doispalitos.git
cd doispalitos

# 2. Configurar .env do backend
cp backend/.env.example backend/.env

# 3. Subir containers
docker compose up -d

# 4. Rodar migrations
docker compose exec app php artisan migrate
```

### URLs de Acesso:
- **Painel do Restaurante:** [http://localhost:5173/login](http://localhost:5173/login)
- **Painel do Super Admin (Isolado):** [http://localhost:5174/login](http://localhost:5174/login)
- **API Laravel:** [http://localhost:8000/api/v1/ping](http://localhost:8000/api/v1/ping)
- **Mailpit:** [http://localhost:8025](http://localhost:8025)

