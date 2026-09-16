<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('category_type')->default('standard')->after('name');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('product_type')->default('standard')->after('price');
            $table->json('metadata')->nullable()->after('product_type');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('category_type');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['product_type', 'metadata']);
        });
    }
};
