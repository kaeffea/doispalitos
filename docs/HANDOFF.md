# Guia de Handoff & Continuação do Projeto — Dois Palitos

Este documento contém todas as instruções práticas para que qualquer desenvolvedor ou agente de IA (como o **Gemini no Open Code**) assuma e continue o desenvolvimento do **Dois Palitos** sem qualquer perda de contexto.

---

## 1. Ambientes e URLs

### Produção:
- **Painel do Restaurante:** `https://app.doispalitos.tech` (Vercel)
- **Painel Super Admin:** `https://adm.doispalitos.tech` (Vercel)
- **API Backend:** `https://api.doispalitos.tech` (AWS EC2 via Cloudflare)
- **Instância AWS EC2:**
  - Configuração: Ubuntu 24.04 (Acesso via chave SSH privada)
  - Diretório do projeto: `~/doispalitos`
  - Docker Compose: containers `doispalitos-app`, `doispalitos-web`, `doispalitos-db`, `doispalitos-redis`

### Desenvolvimento Local (WSL2 / Linux / Docker):
```bash
# Iniciar todos os containers
docker compose up -d

# Rodar migrations
docker compose exec app php artisan migrate
```
- **Painel Restaurantes:** `http://localhost:5173`
- **Painel Super Admin:** `http://localhost:5174`
- **API Backend:** `http://localhost:8000/api/v1/ping`
- **Mailpit (E-mails):** `http://localhost:8025`
- **PostgreSQL:** `localhost:5432` (Usuário: `doispalitos`, Banco: `doispalitos`)

---

## 2. Estrutura do Monorepo

```
doispalitos/
├── backend/                  # API Laravel 11 (PHP 8.3 FPM)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/
│   │   │   │   ├── Admin/      # Super Admin (Auth, Tenant, ChangeRequest, Notification)
│   │   │   │   └── Restaurant/ # Auth, Settings, Category, Product, ProductRecipe, SubRecipe,
│   │   │   │                   # InventoryItem, InventoryPurchase, InventorySupplier,
│   │   │   │                   # InventoryFinancial, PurchasingSchedule, Notification, ChangeRequest
│   │   │   └── Middleware/     # EnsureSuperAdmin, EnsureTenantAdmin, TenantMiddleware
│   │   └── Models/             # Tenant, User, Category, Product, ProductOptionGroup, ProductOption,
│   │                           # InventoryItem, SubRecipe, ProductRecipe, InventoryPurchase, etc.
│   ├── database/migrations/    # 20 migrations com isolamento PostgreSQL RLS
│   └── routes/api.php          # Rotas /v1/admin, /v1/restaurant e /v1/storefront
├── frontend/
│   ├── superadmin/           # SPA React 18 + Vite (Porta 5174 / adm.doispalitos.tech)
│   │   └── src/pages/        # LoginPage, DashboardPage, RestaurantsPage
│   └── restaurant/           # SPA React 18 + Vite (Porta 5173 / app.doispalitos.tech)
│       ├── src/components/   # OnboardingWizard (Drawer direito), TimeInput (digitação livre), Header
│       └── src/pages/        # LoginPage, RestaurantDashboardPage, RestaurantSettingsPage,
│                             # MenuPage (Pizzas, Combos, Opcionais), InventoryPage (Estoque, CMV, Compras)
├── docker-compose.yml        # Orquestração dos containers locais
└── docs/                     # ARCHITECTURE.md, HANDOFF.md, ROADMAP_AND_AMBITIONS.md, PROMPT_GEMINI_OPEN_CODE.md
```

---

## 3. Comandos de Deploy e Manutenção

### Frontends (Vercel):
O deploy dos frontends é **100% automático** via Vercel ao dar push na branch `main`:
```bash
git add -A
git commit -m "feat: descrição da alteração"
git push origin main
```

### Backend (AWS EC2):
Após o push, aplicar as alterações no servidor EC2 via SSH:
```bash
ssh -i ~/.ssh/<SUA_CHAVE>.pem <USUARIO>@<IP_DO_SERVIDOR> "cd ~/doispalitos && git pull origin main && chmod 644 backend/.env && docker compose exec -T app php artisan config:cache && docker compose exec -T app php artisan route:cache && docker compose exec -T app php artisan migrate --force"
```
> **Atenção:** O arquivo `backend/.env` na EC2 deve sempre manter permissão `chmod 644` para que o PHP-FPM (`www-data`) consiga ler as variáveis sem cair no fallback de sqlite.

---

## 4. O que está Concluído vs Onde Começar Agora

### 100% Pronto e Operacional:
1. **Infraestrutura & Segurança**: PostgreSQL RLS multi-tenant, Cloudflare Anti-bypass, Real-IP restore no Nginx, Vercel CI/CD e AWS EC2.
2. **Super Admin**: Governança de restaurantes, subdomínios, domínios próprios, moderação de alterações cadastrais e purga total de jargões técnicos.
3. **Painel do Restaurante**:
   - Onboarding em Gaveta Lateral Direita (`Drawer`) com troca obrigatória de senha inicial.
   - Digitação de horários totalmente livre (`TimeInput.tsx`) sem defaults mockados e com validação 24h.
   - Suporte a Delivery Próprio (opcional), Balcão (`pickup`) e Salão/Mesas (`dine_in`).
   - Gestão Logística de Entrega (Raio fixo, Km dinâmico, Bairros manuais).
   - Dashboard operacional em tempo real com indicador Aberto/Fechado/Pausa e controle de tempo de cozinha (visível apenas com loja aberta).
   - Cardápio Completo com arquétipos especiais (Pizzas meio-a-meio com precificação por maior valor ou média ponderada; Hambúrgueres e combos com limites de opcionais).
   - Módulo Completo de Estoque e Custos (Kardex, marcas, embalagens, fornecedores, sub-receitas de pré-preparo, ficha técnica, CMV automático, planilha ágil de compras, calendário de compras e DRE de margem líquida).

---

### 🎯 ONDE COMEÇAR AGORA:
👉 **Fase 3: O Storefront do Cliente Final (Cardápio Digital & Checkout) + Backend de Pedidos (`orders`)**:
O restaurante já tem cardápio, horários, configurações e estoque funcionando perfeitamente. **Falta o cliente final conseguir pedir!**

Passos imediatos para execução:
1. **Estrutura de Pedidos no Banco (`orders`)**:
   - Criar migrations: `orders`, `order_items`, `order_item_options`, `order_status_history` com PostgreSQL RLS habilitado.
   - Relacionamentos com `tenant_id`, cliente (nome, telefone/whatsapp), tipo de entrega (`delivery`, `pickup`, `dine_in`), endereço, taxas, forma de pagamento e status (`pending_payment`, `received`, `preparing`, `ready_for_dispatch`, `dispatched`, `delivered`, `canceled`).
2. **Endpoints da API Storefront (`/api/v1/storefront/*`)**:
   - `GET /api/v1/storefront/store-info` (dados da loja, status aberto/fechado, canais ativos, tempo de preparo).
   - `GET /api/v1/storefront/menu` (categorias, produtos ativos, opcionais).
   - `POST /api/v1/storefront/delivery-fee` (cálculo do frete baseado nas regras da loja).
   - `POST /api/v1/storefront/orders` (criação do pedido pelo cliente).
   - `GET /api/v1/storefront/orders/{uuid}` (rastreio ao vivo do pedido pelo cliente).
3. **Frontend do Cardápio do Cliente (`frontend/storefront` ou rota pública)**:
   - Interface mobile-first ultra-rápida.
   - Modal de montagem do item (tamanhos, meio-a-meio, adicionais).
   - Carrinho com cálculo de entrega e checkout (PIX ou Pagamento na Entrega).
   - Tela de acompanhamento do status do pedido em tempo real.

