<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('custom_domain')->nullable()->unique()->after('slug');
            
            // Endereço
            $table->string('postal_code', 10)->nullable()->after('phone');
            $table->string('street')->nullable()->after('postal_code');
            $table->string('number', 20)->nullable()->after('street');
            $table->string('complement')->nullable()->after('number');
            $table->string('neighborhood')->nullable()->after('complement');
            $table->string('city')->nullable()->after('neighborhood');
            $table->string('state', 2)->nullable()->after('city');
            $table->decimal('latitude', 10, 7)->nullable()->after('state');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');

            // Configurações operacionais em JSONB (regras de entrega, horários, pedido mínimo, tempo base)
            $table->jsonb('settings')->nullable()->after('is_active');

            // Soft deletes para arquivamento seguro
            $table->softDeletes()->after('updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'custom_domain',
                'postal_code',
                'street',
                'number',
                'complement',
                'neighborhood',
                'city',
                'state',
                'latitude',
                'longitude',
                'settings',
            ]);
            $table->dropSoftDeletes();
        });
    }
};
