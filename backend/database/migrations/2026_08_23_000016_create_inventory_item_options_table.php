<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_item_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->index();
            $table->uuid('inventory_item_id')->index();
            $table->string('brand_name')->nullable();
            $table->uuid('supplier_id')->nullable()->index();
            $table->decimal('cost_per_unit', 10, 4)->default(0);
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->date('last_purchased_at')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->onDelete('cascade');
            $table->foreign('supplier_id')->references('id')->on('inventory_suppliers')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_item_options');
    }
};
