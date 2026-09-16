<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Fornecedores e Canais de Compra ────────────────────────────────
        Schema::create('inventory_suppliers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('name');
            $table->string('contact_name')->nullable();
            $table->string('phone_whatsapp')->nullable();
            $table->string('email')->nullable();
            $table->string('supplier_type')->default('wholesaler'); // distributor, wholesaler, local_market, e_commerce, other
            $table->json('order_days')->nullable(); // ['monday', 'thursday']
            $table->decimal('min_order_value', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // ─── 2. Insumos e Matérias-Primas Base ─────────────────────────────────
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('name');
            $table->string('category')->default('outros'); // laticinios, carnes, hortifruti, secos, embalagens, bebidas, outros
            $table->string('base_unit')->default('kg'); // kg, g, L, ml, un
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->decimal('min_stock', 12, 3)->default(0); // Ponto crítico de ruptura
            $table->decimal('ideal_stock', 12, 3)->default(0); // Par level / Estoque ideal alvo
            $table->decimal('average_cost_per_unit', 10, 4)->default(0);
            $table->decimal('last_cost_per_unit', 10, 4)->default(0);
            $table->uuid('primary_supplier_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('primary_supplier_id')->references('id')->on('inventory_suppliers')->onDelete('set null');
        });

        // ─── 3. Embalagens e Marcas por Fornecedor (Multi-Vendor Packaging) ────
        Schema::create('inventory_supplier_packagings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('inventory_item_id')->index();
            $table->uuid('supplier_id')->index();
            $table->string('brand_name')->nullable();
            $table->string('package_name'); // ex: 'Barra 4kg', 'Caixa com 24 latas'
            $table->decimal('package_base_quantity', 12, 3); // Quantidade convertida em base_unit (ex: 4.0 para kg, 24 para un)
            $table->decimal('price_paid', 10, 2);
            $table->decimal('unit_cost_equivalent', 10, 4); // Calculado: price_paid / package_base_quantity
            $table->boolean('is_preferred')->default(false);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->onDelete('cascade');
            $table->foreign('supplier_id')->references('id')->on('inventory_suppliers')->onDelete('cascade');
        });

        // ─── 4. Sub-receitas / Pré-preparos da Cozinha (Batch Recipes) ──────────
        Schema::create('sub_recipes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('name'); // ex: 'Massa Artesanal de Pizza', 'Molho Pelati da Casa'
            $table->decimal('batch_yield_quantity', 12, 3); // ex: 30 (discos) ou 10 (litros)
            $table->string('yield_unit')->default('un'); // un, L, kg
            $table->decimal('total_batch_cost', 10, 2)->default(0);
            $table->decimal('unit_cost', 10, 4)->default(0); // total_batch_cost / batch_yield_quantity
            $table->decimal('current_stock', 12, 3)->default(0); // Lotes/unidades prontas em estoque
            $table->decimal('min_stock', 12, 3)->default(0);
            $table->text('instructions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // Ingredientes da Sub-receita
        Schema::create('sub_recipe_ingredients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('sub_recipe_id')->index();
            $table->uuid('inventory_item_id')->index();
            $table->decimal('quantity_consumed', 12, 3); // na base_unit do insumo
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('sub_recipe_id')->references('id')->on('sub_recipes')->onDelete('cascade');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->onDelete('cascade');
        });

        // ─── 5. Ficha Técnica do Cardápio (Product Recipes) ────────────────────
        Schema::create('product_recipes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('product_id')->index();
            $table->string('flavor_id')->nullable(); // Para sabores de pizzas (ex: 'calabresa')
            $table->string('size_id')->nullable();   // Para tamanhos de pizzas (ex: 'grande')
            $table->uuid('option_id')->nullable();   // Para opcionais ou bordas
            $table->uuid('inventory_item_id')->nullable()->index(); // Consumo direto de insumo
            $table->uuid('sub_recipe_id')->nullable()->index();     // Consumo de pré-preparo
            $table->decimal('quantity_consumed', 12, 3);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->onDelete('cascade');
            $table->foreign('sub_recipe_id')->references('id')->on('sub_recipes')->onDelete('cascade');
        });

        // ─── 6. Movimentações de Estoque (Transactions / Kardex) ───────────────
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('inventory_item_id')->nullable()->index();
            $table->uuid('sub_recipe_id')->nullable()->index();
            $table->string('type'); // compra_entrada, baixa_venda, producao_lote, perda_desperdicio, ajuste_inventario
            $table->decimal('quantity', 12, 3); // Positivo (entrada) ou Negativo (saída)
            $table->decimal('unit_cost', 10, 4)->default(0);
            $table->decimal('total_cost', 10, 2)->default(0);
            $table->string('reference_id')->nullable(); // ID do pedido ou lote
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->onDelete('cascade');
            $table->foreign('sub_recipe_id')->references('id')->on('sub_recipes')->onDelete('cascade');
        });

        // ─── 7. Agendas e Rotinas de Compra Personalizáveis ─────────────────────
        Schema::create('purchasing_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->string('name'); // ex: 'Feira Semanal', 'Laticínios & Frios', 'Compras Gerais de Segunda'
            $table->string('frequency_type')->default('weekly'); // daily, weekly, biweekly, monthly, on_demand
            $table->json('schedule_days')->nullable(); // ['monday', 'thursday']
            $table->json('item_categories')->nullable(); // ['hortifruti', 'laticinios'] ou null para tudo
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // ─── 8. Custos Fixos & Despesas Operacionais (Overheads) ───────────────
        Schema::create('store_financial_overheads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->decimal('payroll_expenses', 10, 2)->default(0); // Folha salarial total
            $table->decimal('rent_expense', 10, 2)->default(0);     // Aluguel do ponto
            $table->decimal('utilities_expense', 10, 2)->default(0); // Energia, água, gás, internet
            $table->decimal('other_fixed_expenses', 10, 2)->default(0); // Sistemas, taxas fixas, contador
            $table->decimal('estimated_monthly_revenue', 12, 2)->default(10000.00); // Faturamento médio mensal estimado
            $table->decimal('fixed_cost_percentage', 6, 2)->default(0); // Calculado: total_custos_fixos / faturamento * 100
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // ─── 9. Ativação de RLS (Row-Level Security) no PostgreSQL ─────────────
        $tables = [
            'inventory_suppliers',
            'inventory_items',
            'inventory_supplier_packagings',
            'sub_recipes',
            'sub_recipe_ingredients',
            'product_recipes',
            'inventory_transactions',
            'purchasing_schedules',
            'store_financial_overheads',
        ];

        foreach ($tables as $t) {
            DB::statement("ALTER TABLE {$t} ENABLE ROW LEVEL SECURITY;");
            DB::statement("
                CREATE POLICY {$t}_tenant_isolation ON {$t}
                FOR ALL
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
                WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
            ");
        }
    }

    public function down(): void
    {
        $tables = [
            'store_financial_overheads',
            'purchasing_schedules',
            'inventory_transactions',
            'product_recipes',
            'sub_recipe_ingredients',
            'sub_recipes',
            'inventory_supplier_packagings',
            'inventory_items',
            'inventory_suppliers',
        ];

        foreach ($tables as $t) {
            DB::statement("DROP POLICY IF EXISTS {$t}_tenant_isolation ON {$t};");
            Schema::dropIfExists($t);
        }
    }
};
