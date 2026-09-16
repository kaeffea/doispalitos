<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantAdmin
{
    /**
     * Garante que a requisição pertença a um usuário do restaurante (Admin/Manager/Kitchen)
     * com restaurante ativo e define o contexto de Row Level Security (RLS) do PostgreSQL.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Não autenticado.',
            ], 401);
        }

        if (! in_array($user->role, ['admin', 'manager', 'kitchen']) || ! $user->tenant_id) {
            return response()->json([
                'message' => 'Acesso não autorizado para esta área do restaurante.',
            ], 403);
        }

        $tenant = $user->tenant;

        if (! $tenant || ! $tenant->is_active) {
            return response()->json([
                'message' => 'Este restaurante está inativo ou suspenso na plataforma.',
            ], 403);
        }

        // Valida se o token possui a capacidade do tenant específico
        if (method_exists($user, 'tokenCan') && ! $user->tokenCan('tenant:' . $tenant->id)) {
            return response()->json([
                'message' => 'Token não autorizado para operar este restaurante.',
            ], 403);
        }

        // Define a variável de sessão do PostgreSQL RLS de forma segura e parametrizada
        DB::statement("SELECT set_config('app.current_tenant_id', ?, false)", [(string) $tenant->id]);

        $request->merge(['_tenant' => $tenant]);

        return $next($request);
    }
}
