<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Tenants: trocar constraints unicas por indices parciais ignorando soft deletes
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropUnique('tenants_slug_unique');
            $table->dropUnique('tenants_custom_domain_unique');
        });

        DB::unprepared('
            CREATE UNIQUE INDEX tenants_slug_unique ON tenants (slug) WHERE deleted_at IS NULL;
            CREATE UNIQUE INDEX tenants_custom_domain_unique ON tenants (custom_domain) WHERE deleted_at IS NULL;
        ');

        // 2. Users: adicionar soft deletes e trocar constraint de email por indice parcial
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes()->after('updated_at');
            $table->dropUnique('users_email_unique');
        });

        DB::unprepared('
            CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE deleted_at IS NULL;
        ');
    }

    public function down(): void
    {
        DB::unprepared('
            DROP INDEX IF EXISTS tenants_slug_unique;
            DROP INDEX IF EXISTS tenants_custom_domain_unique;
            DROP INDEX IF EXISTS users_email_unique;
        ');

        Schema::table('tenants', function (Blueprint $table) {
            $table->unique('slug');
            $table->unique('custom_domain');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->unique('email');
        });
    }
};
