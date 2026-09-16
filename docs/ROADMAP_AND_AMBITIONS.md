# Visão de Produto, Ambições & Roadmap — Doispalitos

## 1. Visão e Proposta de Valor

O **Doispalitos** nasceu para libertar restaurantes das taxas abusivas de marketplaces (como iFood e Rappi), oferecendo uma solução própria completa que não se resume a um "cardápio digital simples", mas sim a um **motor de hiperprecisão operacional ponta a ponta**.

### Os 3 Pilares Fundamentais:

1. **Independência Real:**
   - Cada restaurante possui seu subdomínio padrão (`*.doispalitos.com.br`) ou seu próprio domínio customizado (`pizzariadojose.com.br`), sem cobrança de comissões por pedido.
2. **O Coração do Sistema: Sequenciamento de Produção (A Killer Feature):**
   - Os concorrentes tratam pratos como caixas pretas com tempos genéricos (ex: "tempo estimado: 40 min").
   - No Doispalitos, cada item do cardápio é decomposto nas suas **etapas reais de cozinha** (ex: *Montagem [3 min]* ➔ *Forno/Cocção [10 min]* ➔ *Embalagem/Expedição [2 min]*).
   - O sistema calcula o **tempo preditivo exato de preparo** baseado no gargalo atual de cada estação da cozinha, sincronizando o despacho do entregador para que a comida nunca esfrie esperando motoboy, nem o motoboy fique ocioso esperando o prato.
3. **Logística e Aplicativo de Entregadores para Baixa Latência:**
   - Solução pensada para o cenário real brasileiro: motoboys com celulares de baixo custo e regiões com instabilidade de sinal 3G/4G.
   - Comunicação leve e resiliente com suporte a operação offline transitória.

---

## 2. Roadmap Estruturado de Fases

### **Fase 0 — Fundação, Infraestrutura & Segurança** ✅ *(100% Concluída)*
- [x] Monorepo Dockerizado (PHP 8.3 FPM, Nginx, PostgreSQL 16, Redis 7, Mailpit, Vite / Node 20).
- [x] Banco de dados Multi-tenant com PostgreSQL Row Level Security (RLS) nativo no kernel.
- [x] Autenticação Stateless Sanctum (Super Admin e Gestores de Restaurante).
- [x] Deploy em Produção na AWS EC2 e Vercel (`adm.doispalitos.tech` e `app.doispalitos.tech`).
- [x] Camada de Segurança Cloudflare: Anti-Bypass de IP, Real-IP restore no Nginx e Bot Fight Mode.

---

### **Fase 1 — Governança da Plataforma (Super Admin)** ✅ *(100% Concluída)*
- [x] Cadastro de instâncias de restaurantes com gestor inicial e envio de senha provisória por e-mail.
- [x] Roteamento de subdomínios (`{slug}.doispalitos.tech`) e domínios próprios (`custom_domain`).
- [x] Soft deletes e arquivamento seguro com recriação autorizada.
- [x] Moderação e aprovação de solicitações de alteração cadastral dos restaurantes (`change-requests`).
- [x] Sanitização editorial completa: purga de todos os jargões internos e técnicos no frontend do Super Admin.

---

### **Fase 2 — Onboarding, Configurações, Cardápio & Engenharia de Custos** ✅ *(100% Concluída)*
- [x] **Onboarding em Gaveta Lateral (Right-Side Drawer)**:
  - Ativado automaticamente no primeiro login (`must_change_password` ou `onboarding_completed: false`).
  - Redefinição obrigatória de senha provisória (mínimo 8 dígitos).
  - Configuração de canais, horários, taxas e pagamentos sem dados mockados ou templates genéricos.
- [x] **Componente de Horário com Digitação Livre (`TimeInput.tsx`)**:
  - Digitação livre sem presets, permitindo apagar tudo com Backspace.
  - Máscara numérica automática `HH:MM` e validação estrita de 24h.
  - Remoção definitiva de botões *"Preencher padrão"* e relógios escuros em fundo escuro.
- [x] **Canais Operacionais Independentes**:
  - *Delivery Próprio*: Opcional (pode ser desmarcado para lojas com motoboys terceiros ou balcão).
  - *Retirada no Balcão (`pickup`)* e *Consumo no Salão / Mesas (`dine_in`)*.
- [x] **Logística de Entrega Flexível**:
  - Taxa Fixa por Raio, Taxa Dinâmica por Km e Taxa Manual por Bairro (com mapa e busca).
- [x] **Dashboard Operacional em Tempo Real**:
  - Indicador vivo: Aberto / Fechado / Pausa Manual.
  - Controle de tempo de preparo da cozinha contextual: **só aparece quando a loja está aberta**.
  - Atalhos operacionais e ledger de indicadores de cardápio e estoque.
- [x] **Gestão Avançada de Cardápio (`MenuPage.tsx`)**:
  - Categorias com ordenação, produtos com fotos e descrições.
  - Arquétipos: Pizzas meio-a-meio (critério de preço por maior valor ou média), Hambúrgueres/Combos com limites mín/máx de opcionais e preços adicionais.
- [x] **Módulo Completo de Estoque, Sub-receitas & Custos (`InventoryPage.tsx`)**:
  - Cadastro de matérias-primas, marcas, embalagens de compra e fornecedores.
  - Pré-preparos da cozinha (Sub-receitas) com cálculo de rendimento e custo de lote.
  - Ficha técnica completa de pratos vinculando insumos e sub-receitas.
  - Cálculo automático de CMV (Custo de Mercadoria Vendida) por produto e margem bruta.
  - Planilha ágil de compras, calendário com recorrência e lista inteligente para WhatsApp.
  - DRE operacional, custos fixos da loja e margem líquida real.

---

### **Fase 3 — O Storefront do Cliente Final (Cardápio Digital & Checkout Online)** 🎯 *(PRÓXIMO PASSO IMEDIATO)*
*Sem esta etapa, clientes não conseguem comprar. É o coração que alimenta todas as operações subsequentes.*
- [ ] **Resolução do Restaurante pelo Domínio/Subdomínio**:
  - O cliente acessa `{slug}.doispalitos.tech` ou o domínio próprio cadastrado.
  - Carregamento instantâneo do restaurante, horários de funcionamento, canais ativos e cardápio.
- [ ] **Interface Mobile-First do Cardápio**:
  - Navegação fluida por categorias (fixas no topo em rolagem horizontal).
  - Busca rápida de itens.
  - Modal/Gaveta inferior de personalização do prato:
    - Seleção de tamanho (Broto, Grande, Família, etc.).
    - Seleção de sabores meio-a-meio para pizzas.
    - Seleção de opcionais e adicionais (respeitando limites mínimos e máximos com feedback visual).
    - Campo de observações para a cozinha (ex: "Sem cebola").
- [ ] **Carrinho de Compras & Cálculo de Frete**:
  - Carrinho reativo persistido em local storage.
  - Escolha do canal pelo cliente: *Delivery*, *Retirada no Balcão* ou *Consumo na Mesa* (com número da mesa).
  - Digitação de CEP/endereço com autocompletar e cálculo automático do frete de acordo com a regra ativa da loja (raio fixo, km ou bairro).
  - Alerta caso o restaurante esteja fechado ou fora do raio/bairro de atendimento.
- [ ] **Checkout Transparente & Pagamentos**:
  - Identificação rápida do cliente: Nome e WhatsApp (para receber atualizações do pedido).
  - Meios de pagamento aceitos conforme configuração da loja:
    - **PIX Online**: Geração instantânea de QR Code e Copia-e-Cola com expiração e verificação via webhook.
    - **Pagamento na Entrega**: Cartão na maquininha ou Dinheiro (com campo "precisa de troco para quanto?").
- [ ] **Backend de Pedidos (`orders`)**:
  - Migrations e modelos para `orders`, `order_items`, `order_item_options`, `order_status_history`.
  - Endpoint `POST /api/v1/storefront/orders` (com isolamento RLS).
  - Status do pedido: `pending_payment`, `received`, `preparing`, `ready_for_dispatch`, `dispatched`, `delivered`, `canceled`.
- [ ] **Acompanhamento do Pedido pelo Cliente (`/pedido/:uuid`)**:
  - Linha do tempo visual mostrando o progresso: *Pedido Recebido* ➔ *Na Cozinha* ➔ *Saiu para Entrega* ➔ *Entregue*.
  - Tempo estimado de entrega baseado no tempo de preparo ao vivo da loja.

---

### **Fase 4 — Central de Pedidos em Tempo Real no Painel do Restaurante** ⏳ *(Planejado)*
- [ ] **Painel de Gestão de Pedidos (Kanban & Lista)**:
  - Notificação sonora (chime personalizável) e alerta visual instantâneo a cada novo pedido.
  - Colunas: *Novos (Aguardando Aceite)* ➔ *Em Preparo* ➔ *Pronto para Despacho / Retirada* ➔ *Em Rota / Finalizado*.
  - Ações em 1 clique: Aceitar pedido, Adiar tempo (+10 min, +15 min), Rejeitar com justificativa, Despachar.
- [ ] **Impressão Térmica de Comanda (ESC/POS)**:
  - Impressão automática ou sob demanda para impressoras térmicas de 80mm e 58mm (USB, Rede ou Bluetooth).
  - Layout limpo otimizado para a linha de produção: cabeçalho com número do pedido, itens, adicionais em negrito, observações destacadas e dados de entrega.

---

### **Fase 5 — PDV Rápido & Gestão de Mesas e Comandas (Salão / Balcão)** ⏳ *(Planejado)*
- [ ] **PDV Balcão & Telefone**:
  - Interface ágil com teclado numérico e atalhos rápidos para lançar pedidos presenciais de balcão ou recebidos por ligação/WhatsApp.
- [ ] **Gestão de Mesas e Comandas (`dine_in`)**:
  - Mapa visual de mesas do salão (Livre, Ocupada, Aguardando Conta).
  - Lançamento contínuo de itens na comanda da mesa.
  - Fechamento de mesa com divisão de conta por pessoas e emissão de conferência.

---

### **Fase 6 — KDS (Kitchen Display System) & Sequenciamento de Produção** ⏳ *(A Killer Feature)*
- [ ] **Decomposição da Ficha Técnica em Estações**:
  - Cada produto tem suas etapas de produção (ex: *Montagem* [3 min] ➔ *Forno* [10 min] ➔ *Expedição* [2 min]).
- [ ] **Telas de KDS por Estação de Trabalho**:
  - Telas dedicadas para tablets/monitores da cozinha: *Tela da Montagem*, *Tela do Forno*, *Tela da Embalagem*.
  - O pedido só aparece na estação seguinte após ser finalizado na anterior.
  - Alerta de atraso visual (cartões mudam de cor se excederem o tempo padrão da etapa).
- [ ] **Baixa Automática no Estoque**:
  - Ao concluir a produção do prato, o sistema baixa automaticamente os insumos e sub-receitas do estoque real (Kardex).

---

### **Fase 7 — Módulo de Logística & Aplicativo do Entregador** ⏳ *(Planejado)*
- [ ] **Gestão da Frota de Motoboys**:
  - Cadastro de entregadores próprios da loja (nome, telefone, placa, modelo de remuneração por taxa ou diária).
- [ ] **Despacho Preditivo Inteligente**:
  - O sistema calcula o tempo exato para o prato sair da embalagem e aciona o motoboy para chegar no minuto certo (sem comida fria, sem motoboy ocioso).
- [ ] **PWA do Entregador (Baixa Latência / Offline-Tolerant)**:
  - Interface ultraleve pensada para celulares modestos e conexões 3G/4G instáveis.
  - Visualização de corridas disponíveis, abertura de rota direta no Waze/Google Maps e confirmação de entrega com 1 toque.

---

### **Fase 8 — Gateways de Pagamento Integrados & Fechamento Financeiro** ⏳ *(Planejado)*
- [ ] **Integração Nativa de PIX**:
  - Conexão com gateways (Mercado Pago, Asaas, EFI/Gerencianet) para liquidação direta na conta do restaurante, sem intermediários.
- [ ] **Fechamento de Caixa do Turno / Dia**:
  - Sangrias, suprimentos e conferência física de valores (dinheiro, cartões e PIX).
  - Relatório de lucratividade do turno comparando vendas brutas x CMV consumido x despesas fixas proporcionais.

