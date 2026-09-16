<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('brand_name')->nullable()->after('name');
            $table->text('description')->nullable()->after('brand_name');
            $table->string('purchase_frequency')->default('weekly')->after('ideal_stock'); // weekly, daily, biweekly, monthly, on_demand
            $table->string('purchase_day_of_week')->default('monday')->nullable()->after('purchase_frequency');
            $table->decimal('critical_stock_days', 5, 2)->default(1.0)->after('purchase_day_of_week');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn([
                'brand_name',
                'description',
                'purchase_frequency',
                'purchase_day_of_week',
                'critical_stock_days',
            ]);
        });
    }
};
