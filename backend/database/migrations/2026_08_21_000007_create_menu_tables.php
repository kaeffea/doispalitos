<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── 1. Categorias do Cardápio ──────────────────────────────────────────
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            
            $table->timestamps();
            $table->softDeletes();
        });

        // ─── 2. Produtos do Cardápio ───────────────────────────────────────────
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            
            $table->uuid('category_id');
            $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');

            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->text('image_url')->nullable();
            $table->boolean('is_available')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->integer('sort_order')->default(0);

            $table->timestamps();
            $table->softDeletes();
        });

        // ─── 3. Grupos de Opcionais / Adicionais ────────────────────────────────
        Schema::create('product_option_groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            $table->uuid('product_id');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');

            $table->string('name'); // ex: "Ponto da Carne", "Adicionais", "Borda Recheada"
            $table->integer('min_options')->default(0);
            $table->integer('max_options')->default(1);
            $table->boolean('is_required')->default(false);
            $table->integer('sort_order')->default(0);

            $table->timestamps();
        });

        // ─── 4. Opções / Itens do Grupo ─────────────────────────────────────────
        Schema::create('product_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            $table->uuid('group_id');
            $table->foreign('group_id')->references('id')->on('product_option_groups')->onDelete('cascade');

            $table->string('name'); // ex: "Ao Ponto", "Bacon Crocante", "Catupiry"
            $table->decimal('price_modifier', 10, 2)->default(0.00);
            $table->boolean('is_available')->default(true);
            $table->integer('sort_order')->default(0);

            $table->timestamps();
        });

        // ─── Habilitar Row Level Security (RLS) nas 4 tabelas ──────────────────
        $tables = ['categories', 'products', 'product_option_groups', 'product_options'];

        foreach ($tables as $t) {
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
        $tables = ['product_options', 'product_option_groups', 'products', 'categories'];
        foreach ($tables as $t) {
            DB::unprepared("DROP POLICY IF EXISTS tenant_isolation_policy ON {$t}");
            Schema::dropIfExists($t);
        }
    }
};
