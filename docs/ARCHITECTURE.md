# Arquitetura do Sistema — Dois Palitos

O **Dois Palitos** é uma plataforma SaaS multi-tenant de hiperprecisão operacional para a gastronomia, criada para libertar restaurantes das taxas abusivas de marketplaces (iFood, Rappi). Integra:
1. Site de pedidos próprio do restaurante (subdomínio ou domínio customizado).
2. Gestão de cardápio avançada com arquétipos gastronômicos (pizzarias meio-a-meio, hamburguerias, marmitarias).
3. Motor de engenharia de cardápio, controle de estoque (Kardex), sub-receitas e fichas técnicas com CMV em tempo real.
4. Logística de entrega flexível (raio fixo, km dinâmico, bairros manuais), retirada no balcão e mesas/salão.
5. Painel de comando operacional diário com controle em tempo real de status da loja e tempo de preparo da cozinha.
6. Sequenciamento de produção na cozinha (KDS preditivo por etapas) e despacho inteligente de entregadores.

---

## 1. Stack Tecnológica

| Componente | Tecnologia | Versão / Configuração | Responsabilidade |
| :--- | :--- | :--- | :--- |
| **Backend** | PHP / Laravel | Laravel 11.x (PHP 8.3 FPM) | API REST stateless, regras de negócio e autenticação Sanctum |
| **Banco de Dados** | PostgreSQL | 16.x | Instância única com isolamento rigoroso via **Row Level Security (RLS)** |
| **Cache & Filas** | Redis | 7.x | Filas de processamento, websockets e cache de configuração |
| **Servidor Web & Proxy** | Nginx | Alpine | Proxy reverso, FastCGI PHP-FPM, terminação HTTP e restauração de Real-IP |
| **Hospedagem Backend** | AWS EC2 | Ubuntu 24.04 | Docker Compose com containers `app`, `web`, `db`, `redis` |
| **Borda & Segurança** | Cloudflare | Anti-Bypass, Bot Fight Mode, SSL Full | Proteção DDoS, terminação SSL, restrição de acesso direto ao IP de origem |
| **Frontend Super Admin** | React 18 + Vite | TypeScript + Tailwind CSS v4 | SPA de governança global da plataforma (`adm.doispalitos.tech` via Vercel) |
| **Frontend Restaurante** | React 18 + Vite | TypeScript + Tailwind CSS v4 | SPA do gestor/operador da loja (`app.doispalitos.tech` via Vercel) |
| **Frontend Storefront** | *(Próxima Fase)* | React 18 / Next.js SSR / Vite | Cardápio público do cliente final (`*.doispalitos.tech` ou domínio próprio) |

---

## 2. Topologia de Rede e Infraestrutura

```
[ Usuários / Clientes / Gestores ]
              │
              ▼
   ┌──────────────────────┐
   │      Cloudflare      │ (Proxy Reverso, Anti-DDoS, SSL, Real-IP)
   └──────────┬───────────┘
              │ (Somente IPs Oficiais da Cloudflare autorizados)
              ├─────────────────────────────────────────┐
              ▼                                         ▼
   ┌──────────────────────┐                  ┌──────────────────────┐
   │     Vercel Edge      │                  │   AWS EC2 Backend    │
   │  adm.doispalitos.tech│                  │ (Servidor de Origem) │
   │  app.doispalitos.tech│                  ├──────────────────────┤
   │  *.doispalitos.tech  │                  │ • Nginx (Porta 80)   │
   └──────────────────────┘                  │ • PHP-FPM 8.3 (app)  │
              │                              │ • PostgreSQL 16 (db) │
              │ (Chamadas /api/v1/*)         │ • Redis 7 (cache)    │
              └─────────────────────────────►│ • Docker Compose     │
                                             └──────────────────────┘
```

---

## 3. Isolamento Multi-Tenant via PostgreSQL RLS

Em vez de isolamento frágil com `where tenant_id = ?` manual em cada controller, o Dois Palitos utiliza **Row Level Security (RLS)** nativo no kernel do PostgreSQL:

1. **Contexto de Sessão**:
   Ao autenticar um usuário ou resolver o subdomínio da requisição, o middleware `TenantMiddleware` executa no banco de dados:
   ```sql
   SET app.current_tenant_id = '<uuid-do-tenant>';
   ```
2. **Políticas de RLS**:
   Todas as tabelas que contêm dados do restaurante (`users`, `categories`, `products`, `product_options`, `inventory_items`, `sub_recipes`, `product_recipes`, `purchases`, `orders`, etc.) possuem a policy:
   ```sql
   CREATE POLICY tenant_isolation_policy ON <table>
   FOR ALL
   USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
   ```
3. **Garantia Absoluta**: Nenhuma query consegue vazar dados de um restaurante para outro, mesmo que ocorra algum erro lógico de filtragem na camada PHP.

---

## 4. Estrutura de Domínios e Roteamento

| Domínio | Destino | Função |
| :--- | :--- | :--- |
| `adm.doispalitos.tech` | Vercel (`frontend/superadmin`) | Painel do Super Admin (Governança, criação de restaurantes, aprovação de cadastros) |
| `app.doispalitos.tech` | Vercel (`frontend/restaurant`) | Painel Operacional do Restaurante (Gestão, cardápio, estoque, relatórios) |
| `api.doispalitos.tech` | AWS EC2 (Nginx) | API REST Laravel (`/api/v1/admin/*`, `/api/v1/restaurant/*`, `/api/v1/storefront/*`) |
| `{slug}.doispalitos.tech` | Vercel / Cloudflare | Cardápio Digital Público do Cliente Final |
| `{custom_domain}` | Cloudflare for SaaS | Domínio Próprio do Restaurante (ex: `pizzariadojose.com.br`) |

---

## 5. Diretrizes de Design System (Human-First / Editorial)

- **Estética Brutalista Minimalista**: Fundo limpo off-white (`#F8F7F4`) ou dark zinc (`#0F1012`), com linhas de demarcação finas (`border-zinc-200 / border-zinc-800`).
- **Sem Neons ou Gradientes Artificiais**: Proibido o uso de tons neons, gradientes amarelos saturados ou caixas com sombras pesadas.
- **Tipografia**: Títulos e textos em `font-sans`, metadados, valores, horários e códigos em `font-mono`. Destaques sutis na cor primária Amarelo Manteiga Pastel (`#F5DC55`).
- **Zero Jargões de Desenvolvimento**: A interface não deve exibir termos como "instâncias", "fatias", "RLS", "backend" ou "etapas de roadmap". A linguagem deve ser 100% comercial e operacional para o dono do restaurante.
- **Gavetas Laterais (Drawers)**: Preferência por gavetas deslizantes à direita em vez de modais invasivos para fluxos densos (como o Onboarding).
- **Digitação Livre de Horários**: O componente `TimeInput.tsx` permite apagar completamente os campos, com máscara numérica automática `HH:MM`, sem valores pré-fixados.
- **Modo Claro & Escuro Nativo:** Suporte automático e alternável em todos os painéis internos.
