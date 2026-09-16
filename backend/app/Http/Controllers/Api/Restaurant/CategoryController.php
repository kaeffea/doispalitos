<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Listagem de categorias do cardápio do restaurante autenticado.
     *
     * GET /api/v1/restaurant/categories
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $categories = Category::where('tenant_id', $tenantId)
            ->withCount('products')
            ->orderBy('sort_order', 'asc')
            ->get();

        return response()->json([
            'categories' => $categories,
            'total'      => $categories->count(),
        ]);
    }

    /**
     * Cadastro de nova categoria.
     *
     * POST /api/v1/restaurant/categories
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active'   => ['sometimes', 'boolean'],
            'sort_order'  => ['sometimes', 'integer'],
        ]);

        $maxSort = Category::where('tenant_id', $tenantId)->max('sort_order') ?? 0;

        $category = Category::create([
            'tenant_id'   => $tenantId,
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active'   => $validated['is_active'] ?? true,
            'sort_order'  => $validated['sort_order'] ?? ($maxSort + 1),
        ]);

        return response()->json([
            'message'  => 'Categoria criada com sucesso.',
            'category' => $category,
        ], 201);
    }

    /**
     * Atualização de categoria.
     *
     * PUT /api/v1/restaurant/categories/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $category = Category::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active'   => ['sometimes', 'boolean'],
            'sort_order'  => ['sometimes', 'integer'],
        ]);

        $category->update($validated);

        return response()->json([
            'message'  => 'Categoria atualizada com sucesso.',
            'category' => $category->fresh(),
        ]);
    }

    /**
     * Reordenação das categorias.
     *
     * PATCH /api/v1/restaurant/categories/reorder
     */
    public function reorder(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'category_ids'   => ['required', 'array'],
            'category_ids.*' => ['required', 'uuid'],
        ]);

        foreach ($validated['category_ids'] as $index => $catId) {
            Category::where('tenant_id', $tenantId)
                ->where('id', $catId)
                ->update(['sort_order' => $index + 1]);
        }

        return response()->json([
            'message' => 'Ordem das categorias atualizada com sucesso.',
        ]);
    }

    /**
     * Exclusão de categoria.
     *
     * DELETE /api/v1/restaurant/categories/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $category = Category::where('tenant_id', $tenantId)->findOrFail($id);

        $category->products()->delete();
        $category->delete();

        return response()->json([
            'message' => 'Categoria excluída com sucesso.',
        ]);
    }
}
