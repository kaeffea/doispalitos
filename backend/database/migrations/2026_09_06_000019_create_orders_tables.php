<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Pedidos ─────────────────────────────────────────────────────
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            // Rastreio público (UUID imprevisível, sem auth)
            $table->uuid('public_uuid')->unique();

            // Cliente (identificação rápida: nome + WhatsApp)
            $table->string('customer_name');
            $table->string('customer_phone', 30);

            // Canal: delivery | pickup | dine_in
            $table->string('channel', 20)->default('delivery');
            $table->jsonb('address')->nullable();
            $table->string('table_number', 20)->nullable();

            // Pagamento: pix | credit_card | debit_card | cash (+ troco)
            $table->string('payment_method', 20);
            $table->jsonb('payment_detail')->nullable();

            // Totais (sempre recalculados no servidor)
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);

            // pending_payment | received | preparing | ready_for_dispatch
            // | dispatched | delivered | canceled
            $table->string('status', 30)->default('received');
            $table->integer('prep_time_min')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
        });

        // ─── 2. Itens (snapshot do prato no momento da compra) ──────────────
        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            $table->uuid('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');

            $table->uuid('product_id')->nullable();
            $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');

            $table->string('name');
            $table->decimal('unit_price', 10, 2);
            $table->integer('quantity')->default(1);
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->text('notes')->nullable();

            $table->timestamps();
        });

        // ─── 3. Opcionais do item ───────────────────────────────────────────
        Schema::create('order_item_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            $table->uuid('order_item_id');
            $table->foreign('order_item_id')->references('id')->on('order_items')->onDelete('cascade');

            $table->string('group_name');
            $table->string('option_name');
            $table->decimal('price_modifier', 10, 2)->default(0);

            $table->timestamps();
        });

        // ─── 4. Histórico de status ─────────────────────────────────────────
        Schema::create('order_status_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            $table->uuid('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');

            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();

            $table->timestamps();
        });

        // ─── RLS nas 4 tabelas ──────────────────────────────────────────────
        foreach (['orders', 'order_items', 'order_item_options', 'order_status_history'] as $t) {
            DB::unprepared("
                ALTER TABLE {$t} ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_policy ON {$t};
                CREATE POLICY tenant_isolation_policy ON {$t}
                    FOR ALL
                    USING (tenant_id = current_tenant_id());
            ");
        }
    }

    public function down(): void
    {
        foreach (['order_status_history', 'order_item_options', 'order_items', 'orders'] as $t) {
            DB::unprepared("DROP POLICY IF EXISTS tenant_isolation_policy ON {$t}");
            Schema::dropIfExists($t);
        }
    }
};
