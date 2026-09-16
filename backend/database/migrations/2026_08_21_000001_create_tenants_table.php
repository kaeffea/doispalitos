<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::unprepared("
            CREATE OR REPLACE FUNCTION current_tenant_id()
            RETURNS uuid AS \$\$
            BEGIN
                RETURN current_setting('app.current_tenant_id', true)::uuid;
            EXCEPTION
                WHEN others THEN
                    RETURN NULL;
            END;
            \$\$ LANGUAGE plpgsql STABLE;
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
        DB::unprepared('DROP FUNCTION IF EXISTS current_tenant_id()');
    }
};
