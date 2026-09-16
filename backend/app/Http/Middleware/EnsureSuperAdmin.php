<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    /**
     * Garante que a requisição seja feita exclusivamente por um Super Administrador da plataforma.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Acesso restrito a administradores da plataforma.',
            ], 403);
        }

        // Valida se o token possui a capacidade de super_admin
        if (method_exists($user, 'tokenCan') && ! $user->tokenCan('super_admin')) {
            return response()->json([
                'message' => 'Token sem permissão de governança global.',
            ], 403);
        }

        return $next($request);
    }
}
