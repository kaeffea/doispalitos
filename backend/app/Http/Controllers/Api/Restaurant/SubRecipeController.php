<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\SubRecipe;
use App\Models\SubRecipeIngredient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SubRecipeController extends Controller
{
    /**
     * Listagem de pré-preparos da cozinha.
     * GET /api/v1/restaurant/inventory/sub-recipes
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $recipes = SubRecipe::where('tenant_id', $tenantId)
            ->with(['ingredients.item'])
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'sub_recipes' => $recipes,
            'total'       => $recipes->count(),
        ]);
    }

    /**
     * Cadastro de pré-preparo / receita em lote.
     * POST /api/v1/restaurant/inventory/sub-recipes
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'                 => ['required', 'string', 'max:255'],
            'batch_yield_quantity' => ['required', 'numeric', 'min:0.001'],
            'yield_unit'           => ['required', 'string', 'in:un,L,ml,kg,g'],
            'min_stock'            => ['sometimes', 'numeric', 'min:0'],
            'instructions'         => ['nullable', 'string', 'max:1500'],
            'ingredients'          => ['required', 'array', 'min:1'],
            'ingredients.*.inventory_item_id' => ['required', 'uuid', Rule::exists('inventory_items', 'id')->where('tenant_id', $tenantId)],
            'ingredients.*.quantity_consumed' => ['required', 'numeric', 'min:0.001'],
        ]);

        $subRecipe = DB::transaction(function () use ($tenantId, $validated) {
            $totalBatchCost = 0;

            foreach ($validated['ingredients'] as $ing) {
                $item = InventoryItem::where('tenant_id', $tenantId)->find($ing['inventory_item_id']);
                if ($item) {
                    $totalBatchCost += ($ing['quantity_consumed'] * $item->average_cost_per_unit);
                }
            }

            $yield = $validated['batch_yield_quantity'];
            $unitCost = $yield > 0 ? ($totalBatchCost / $yield) : 0;

            $recipe = SubRecipe::create([
                'tenant_id'            => $tenantId,
                'name'                 => $validated['name'],
                'batch_yield_quantity' => $yield,
                'yield_unit'           => $validated['yield_unit'],
                'total_batch_cost'     => round($totalBatchCost, 2),
                'unit_cost'            => round($unitCost, 4),
                'current_stock'        => 0,
                'min_stock'            => $validated['min_stock'] ?? 0,
                'instructions'         => $validated['instructions'] ?? null,
                'is_active'            => true,
            ]);

            foreach ($validated['ingredients'] as $ing) {
                SubRecipeIngredient::create([
                    'tenant_id'         => $tenantId,
                    'sub_recipe_id'     => $recipe->id,
                    'inventory_item_id' => $ing['inventory_item_id'],
                    'quantity_consumed' => $ing['quantity_consumed'],
                ]);
            }

            return $recipe;
        });

        return response()->json([
            'message'    => 'Pré-preparo cadastrado com sucesso.',
            'sub_recipe' => $subRecipe->load(['ingredients.item']),
        ], 201);
    }

    /**
     * Atualização de pré-preparo.
     * PUT /api/v1/restaurant/inventory/sub-recipes/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $recipe = SubRecipe::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'name'                 => ['sometimes', 'required', 'string', 'max:255'],
            'batch_yield_quantity' => ['sometimes', 'required', 'numeric', 'min:0.001'],
            'yield_unit'           => ['sometimes', 'required', 'string', 'in:un,L,ml,kg,g'],
            'min_stock'            => ['sometimes', 'numeric', 'min:0'],
            'instructions'         => ['nullable', 'string', 'max:1500'],
            'ingredients'          => ['sometimes', 'required', 'array', 'min:1'],
            'ingredients.*.inventory_item_id' => ['required', 'uuid', Rule::exists('inventory_items', 'id')->where('tenant_id', $tenantId)],
            'ingredients.*.quantity_consumed' => ['required', 'numeric', 'min:0.001'],
        ]);

        DB::transaction(function () use ($tenantId, $recipe, $validated) {
            $recipe->update([
                'name'                 => $validated['name'] ?? $recipe->name,
                'batch_yield_quantity' => $validated['batch_yield_quantity'] ?? $recipe->batch_yield_quantity,
                'yield_unit'           => $validated['yield_unit'] ?? $recipe->yield_unit,
                'min_stock'            => array_key_exists('min_stock', $validated) ? $validated['min_stock'] : $recipe->min_stock,
                'instructions'         => array_key_exists('instructions', $validated) ? $validated['instructions'] : $recipe->instructions,
            ]);

            if (array_key_exists('ingredients', $validated)) {
                $recipe->ingredients()->delete();

                $totalBatchCost = 0;
                foreach ($validated['ingredients'] as $ing) {
                    $item = InventoryItem::where('tenant_id', $tenantId)->find($ing['inventory_item_id']);
                    if ($item) {
                        $totalBatchCost += ($ing['quantity_consumed'] * $item->average_cost_per_unit);
                    }

                    SubRecipeIngredient::create([
                        'tenant_id'         => $tenantId,
                        'sub_recipe_id'     => $recipe->id,
                        'inventory_item_id' => $ing['inventory_item_id'],
                        'quantity_consumed' => $ing['quantity_consumed'],
                    ]);
                }

                $yield = $recipe->batch_yield_quantity;
                $unitCost = $yield > 0 ? ($totalBatchCost / $yield) : 0;

                $recipe->update([
                    'total_batch_cost' => round($totalBatchCost, 2),
                    'unit_cost'        => round($unitCost, 4),
                ]);
            }
        });

        return response()->json([
            'message'    => 'Pré-preparo atualizado com sucesso.',
            'sub_recipe' => $recipe->fresh()->load(['ingredients.item']),
        ]);
    }

    /**
     * Produzir Lote de Pré-preparo (Abate insumos brutos e credita lote pronto).
     * POST /api/v1/restaurant/inventory/sub-recipes/{id}/produce
     */
    public function produceBatch(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'multiplier' => ['sometimes', 'numeric', 'min:0.1', 'max:50'], // Número de lotes (padrão: 1)
        ]);

        $multiplier = $validated['multiplier'] ?? 1;

        $recipe = SubRecipe::where('tenant_id', $tenantId)->with('ingredients.item')->findOrFail($id);

        DB::transaction(function () use ($tenantId, $recipe, $multiplier) {
            $totalBatchCost = 0;

            // Abate cada ingrediente
            foreach ($recipe->ingredients as $ing) {
                $item = $ing->item;
                $qtyNeeded = $ing->quantity_consumed * $multiplier;

                $newStock = max(0, $item->current_stock - $qtyNeeded);
                $item->update(['current_stock' => $newStock]);

                $costDeducted = $qtyNeeded * $item->average_cost_per_unit;
                $totalBatchCost += $costDeducted;

                InventoryTransaction::create([
                    'tenant_id'         => $tenantId,
                    'inventory_item_id' => $item->id,
                    'type'              => 'producao_lote',
                    'quantity'          => -$qtyNeeded,
                    'unit_cost'         => $item->average_cost_per_unit,
                    'total_cost'        => $costDeducted,
                    'notes'             => "Consumido na produção de {$multiplier}x lote(s) de '{$recipe->name}'.",
                ]);
            }

            $yieldProduced = $recipe->batch_yield_quantity * $multiplier;
            $newRecipeStock = $recipe->current_stock + $yieldProduced;
            $unitCost = $yieldProduced > 0 ? ($totalBatchCost / $yieldProduced) : $recipe->unit_cost;

            $recipe->update([
                'current_stock'    => $newRecipeStock,
                'total_batch_cost' => round($totalBatchCost / $multiplier, 2),
                'unit_cost'        => round($unitCost, 4),
            ]);

            InventoryTransaction::create([
                'tenant_id'     => $tenantId,
                'sub_recipe_id' => $recipe->id,
                'type'          => 'producao_lote',
                'quantity'      => $yieldProduced,
                'unit_cost'     => round($unitCost, 4),
                'total_cost'    => $totalBatchCost,
                'notes'         => "Lote de produção finalizado ({$multiplier}x lote(s)).",
            ]);
        });

        return response()->json([
            'message'    => "Lote de '{$recipe->name}' produzido com sucesso! Estoque atualizado.",
            'sub_recipe' => $recipe->fresh()->load(['ingredients.item']),
        ]);
    }

    /**
     * Exclusão de pré-preparo.
     * DELETE /api/v1/restaurant/inventory/sub-recipes/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $recipe = SubRecipe::where('tenant_id', $tenantId)->findOrFail($id);
        $recipe->delete();

        return response()->json([
            'message' => 'Pré-preparo removido com sucesso.',
        ]);
    }
}
