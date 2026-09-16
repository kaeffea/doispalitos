<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ─── Vitrine do restaurante (rascunho do Studio + snapshot publicado) ──
        Schema::create('tenant_storefronts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');

            // Rascunho editado no Studio (/site)
            $table->jsonb('theme')->nullable();
            $table->jsonb('sections')->nullable();
            $table->jsonb('overrides')->nullable();

            // Snapshot público (o que o cliente vê)
            $table->boolean('is_published')->default(false);
            $table->jsonb('published_theme')->nullable();
            $table->jsonb('published_sections')->nullable();
            $table->jsonb('published_overrides')->nullable();
            $table->timestamp('published_at')->nullable();

            $table->timestamps();
        });

        DB::unprepared("
            ALTER TABLE tenant_storefronts ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS tenant_isolation_policy ON tenant_storefronts;
            CREATE POLICY tenant_isolation_policy ON tenant_storefronts
                FOR ALL
                USING (tenant_id = current_tenant_id());
        ");
    }

    public function down(): void
    {
        DB::unprepared('DROP POLICY IF EXISTS tenant_isolation_policy ON tenant_storefronts');
        Schema::dropIfExists('tenant_storefronts');
    }
};
