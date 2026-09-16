<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class TenantMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = $this->resolveTenant($request);

        if (! $tenant) {
            return response()->json([
                'message' => 'Restaurante não encontrado.',
            ], 404);
        }

        if (! $tenant->is_active) {
            return response()->json([
                'message' => 'Este restaurante está temporariamente inativo.',
            ], 503);
        }

        DB::statement("SELECT set_config('app.current_tenant_id', ?, false)", [(string) $tenant->id]);
        $request->merge(['_tenant' => $tenant]);

        return $next($request);
    }

    private function resolveTenant(Request $request): ?Tenant
    {
        $host = $request->getHost();
        $appDomain = config('app.domain', 'doispalitos.tech');

        // 1. Resolução por subdomínio padrão (*.doispalitos.tech)
        if (str_ends_with($host, '.' . $appDomain)) {
            $slug = str_replace('.' . $appDomain, '', $host);

            return Tenant::where('slug', $slug)
                ->where('is_active', true)
                ->first();
        }

        // 2. Resolução por domínio customizado próprio (ex: pizzariajose.com.br)
        return Tenant::where('custom_domain', $host)
            ->where('is_active', true)
            ->first();
    }
}
