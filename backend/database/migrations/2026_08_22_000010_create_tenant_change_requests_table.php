<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_change_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('requested_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            
            $table->string('status')->default('pending'); // 'pending', 'approved', 'rejected', 'edited_and_approved'
            $table->jsonb('current_data'); // Snapshot dos dados antes da solicitação
            $table->jsonb('requested_data'); // Dados propostos pelo gestor
            $table->jsonb('applied_data')->nullable(); // Dados efetivamente aplicados na aprovação
            $table->text('admin_notes')->nullable(); // Justificativa de recusa ou notas do admin
            
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_change_requests');
    }
};
