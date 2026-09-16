<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\TenantStorefront;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StorefrontController extends Controller
{
    /**
     * Rascunho do Studio + snapshot publicado.
     *
     * GET /api/v1/restaurant/storefront
     */
    public function show(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $storefront = TenantStorefront::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['theme' => null, 'sections' => null, 'overrides' => null]
        );

        return response()->json([
            'draft' => [
                'theme'     => $storefront->theme,
                'sections'  => $storefront->sections,
                'overrides' => $storefront->overrides,
            ],
            'published' => $storefront->is_published ? [
                'theme'        => $storefront->published_theme,
                'sections'     => $storefront->published_sections,
                'overrides'    => $storefront->published_overrides,
                'published_at' => $storefront->published_at,
            ] : null,
        ]);
    }

    /**
     * Salva o rascunho do Studio (sem publicar).
     *
     * PUT /api/v1/restaurant/storefront
     */
    public function update(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'theme'     => ['nullable', 'array'],
            'sections'  => ['nullable', 'array'],
            'sections.*.id'      => ['required', 'string', 'max:120'],
            'sections.*.type'    => ['required', 'string', 'max:40'],
            'sections.*.variant' => ['nullable', 'string', 'max:40'],
            'sections.*.variantDesktop' => ['nullable', 'string', 'max:40'],
            'sections.*.width'   => ['nullable', 'string', 'max:10'],
            'sections.*.visible' => ['nullable', 'boolean'],
            'sections.*.showIf'  => ['nullable', 'string', 'max:20'],
            'sections.*.props'   => ['nullable', 'array'],
            'overrides' => ['nullable', 'array'],
        ]);

        $storefront = TenantStorefront::firstOrCreate(['tenant_id' => $tenantId]);

        $storefront->update([
            'theme'     => $validated['theme'] ?? $storefront->theme,
            'sections'  => array_key_exists('sections', $validated) ? $validated['sections'] : $storefront->sections,
            'overrides' => array_key_exists('overrides', $validated) ? $validated['overrides'] : $storefront->overrides,
        ]);

        return response()->json([
            'message' => 'Rascunho do site salvo.',
            'draft'   => [
                'theme'     => $storefront->fresh()->theme,
                'sections'  => $storefront->fresh()->sections,
                'overrides' => $storefront->fresh()->overrides,
            ],
        ]);
    }

    /**
     * Publica o rascunho (vira o site que o cliente vê).
     *
     * POST /api/v1/restaurant/storefront/publish
     */
    public function publish(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $storefront = TenantStorefront::firstOrCreate(['tenant_id' => $tenantId]);

        if (empty($storefront->sections)) {
            return response()->json([
                'message' => 'Monte ao menos um bloco no Studio antes de publicar.',
            ], 422);
        }

        $storefront->update([
            'is_published'        => true,
            'published_theme'     => $storefront->theme,
            'published_sections'  => $storefront->sections,
            'published_overrides' => $storefront->overrides,
            'published_at'        => now(),
        ]);

        return response()->json([
            'message'      => 'Site publicado com sucesso.',
            'published_at' => $storefront->fresh()->published_at,
        ]);
    }

    /**
     * Tira o site customizado do ar (volta ao modelo padrão).
     *
     * POST /api/v1/restaurant/storefront/unpublish
     */
    public function unpublish(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $storefront = TenantStorefront::firstOrCreate(['tenant_id' => $tenantId]);
        $storefront->update(['is_published' => false]);

        return response()->json(['message' => 'Site customizado pausado. O modelo padrão voltou ao ar.']);
    }
}
