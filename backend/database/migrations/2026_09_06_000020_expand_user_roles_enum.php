<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Alinha o CHECK de users.role com os papéis usados no código
     * (EnsureTenantAdmin + login do restaurante: admin, manager, kitchen).
     * Antes só aceitava super_admin, admin, cook e driver — qualquer
     * operador manager/kitchen estourava 500 na criação.
     */
    public function up(): void
    {
        DB::unprepared('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::unprepared("
            ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('super_admin', 'admin', 'manager', 'kitchen', 'cook', 'driver'))
        ");
    }

    public function down(): void
    {
        DB::unprepared('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::unprepared("
            ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('super_admin', 'admin', 'cook', 'driver'))
        ");
    }
};
