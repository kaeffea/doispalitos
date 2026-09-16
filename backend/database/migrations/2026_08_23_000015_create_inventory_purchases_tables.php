<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Adicionar campos de ciclo e agendamento em inventory_items ─────
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->unsignedInteger('frequency_days')->default(7)->after('ideal_stock'); // A cada X dias (0 = Sob demanda)
            $table->decimal('cycle_consumption_qty', 12, 3)->default(10.0)->after('frequency_days'); // Consumo do ciclo
            $table->unsignedInteger('lead_time_days')->default(0)->after('cycle_consumption_qty'); // Prazo de entrega em dias
            $table->date('last_purchased_at')->nullable()->after('lead_time_days'); // Data da última compra efetuada
            $table->date('next_scheduled_purchase_date')->nullable()->after('last_purchased_at'); // Próxima compra projetada
        });

        // ─── 2. Tabela de Compras (Inventory Purchases) ────────────────────────
        Schema::create('inventory_purchases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->date('purchase_date'); // Data em que a compra foi realizada
            $table->string('purchase_type')->default('scheduled'); // 'scheduled' (Compra de Ciclo) ou 'urgent' (Reposição de Urgência)
            $table->decimal('total_cost', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // ─── 3. Itens da Compra (Inventory Purchase Items) ─────────────────────
        Schema::create('inventory_purchase_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('purchase_id')->index();
            $table->uuid('inventory_item_id')->index();
            $table->uuid('supplier_id')->nullable()->index();
            $table->string('brand_name')->nullable();
            $table->decimal('quantity', 12, 3); // Quantidade comprada na base_unit
            $table->decimal('unit_cost', 10, 4); // Custo unitário calculado
            $table->decimal('total_cost', 10, 2); // Preço total pago pelo item
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('purchase_id')->references('id')->on('inventory_purchases')->onDelete('cascade');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->onDelete('cascade');
            $table->foreign('supplier_id')->references('id')->on('inventory_suppliers')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_purchase_items');
        Schema::dropIfExists('inventory_purchases');

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn([
                'frequency_days',
                'cycle_consumption_qty',
                'lead_time_days',
                'last_purchased_at',
                'next_scheduled_purchase_date',
            ]);
        });
    }
};
