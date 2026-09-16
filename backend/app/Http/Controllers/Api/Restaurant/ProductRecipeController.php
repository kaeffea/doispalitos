<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductRecipe;
use App\Models\SubRecipe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductRecipeController extends Controller
{
    /**
     * Listagem de todos os produtos do cardápio com ficha técnica, CMV e margem bruta.
     * GET /api/v1/restaurant/inventory/recipes/products
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $products = Product::where('tenant_id', $tenantId)
            ->with(['category'])
            ->orderBy('sort_order', 'asc')
            ->get();

        $allRecipes = ProductRecipe::where('tenant_id', $tenantId)
            ->with(['item', 'subRecipe'])
            ->get()
            ->groupBy('product_id');

        $result = $products->map(function ($p) use ($allRecipes) {
            $recipes = $allRecipes->get($p->id, collect());
            $isPizza = str_contains(strtolower($p->category?->name ?? ''), 'pizza');

            $itemsCost = 0;
            foreach ($recipes as $r) {
                $unitCost = 0;
                if ($r->inventory_item_id && $r->item) {
                    $unitCost = $r->item->average_cost_per_unit;
                } elseif ($r->sub_recipe_id && $r->subRecipe) {
                    $unitCost = $r->subRecipe->unit_cost;
                }
                $itemsCost += ($r->quantity_consumed * $unitCost);
            }

            $sellingPrice = (float) $p->price;
            $grossProfit = max(0, $sellingPrice - $itemsCost);
            $grossMarginPercent = $sellingPrice > 0 ? (($grossProfit / $sellingPrice) * 100) : 0;
            $cmvPercent = $sellingPrice > 0 ? (($itemsCost / $sellingPrice) * 100) : 0;

            return [
                'id'                   => $p->id,
                'name'                 => $p->name,
                'category_name'        => $p->category?->name ?? 'Sem Categoria',
                'is_pizza'             => $isPizza,
                'price'                => $sellingPrice,
                'calculated_cost'      => round($itemsCost, 2),
                'gross_profit'         => round($grossProfit, 2),
                'gross_margin_percent' => round($grossMarginPercent, 1),
                'cmv_percent'          => round($cmvPercent, 1),
                'recipes_count'        => $recipes->count(),
                'recipes'              => $recipes,
            ];
        });

        // Métricas globais da engenharia de cardápio
        $totalItemsWithRecipe = $result->filter(fn ($r) => $r['recipes_count'] > 0)->count();
        $avgCMV = $totalItemsWithRecipe > 0
            ? $result->filter(fn ($r) => $r['recipes_count'] > 0)->avg('cmv_percent')
            : 0;

        return response()->json([
            'products'                => $result,
            'total_products'          => $result->count(),
            'configured_recipes'      => $totalItemsWithRecipe,
            'average_cmv_percentage'  => round($avgCMV, 1),
        ]);
    }

    /**
     * Consulta da ficha técnica de um produto específico.
     * GET /api/v1/restaurant/inventory/recipes/products/{productId}
     */
    public function show(Request $request, string $productId): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $product = Product::where('tenant_id', $tenantId)->with('category')->findOrFail($productId);

        $recipes = ProductRecipe::where('tenant_id', $tenantId)
            ->where('product_id', $productId)
            ->with(['item', 'subRecipe'])
            ->get();

        $totalCost = 0;
        $detailedIngredients = $recipes->map(function ($r) use (&$totalCost) {
            $name = '';
            $unit = '';
            $unitCost = 0;

            if ($r->inventory_item_id && $r->item) {
                $name = $r->item->name;
                $unit = $r->item->base_unit;
                $unitCost = $r->item->average_cost_per_unit;
            } elseif ($r->sub_recipe_id && $r->subRecipe) {
                $name = "{$r->subRecipe->name} (Pré-preparo)";
                $unit = $r->subRecipe->yield_unit;
                $unitCost = $r->subRecipe->unit_cost;
            }

            $cost = $r->quantity_consumed * $unitCost;
            $totalCost += $cost;

            return [
                'id'                => $r->id,
                'flavor_id'         => $r->flavor_id,
                'size_id'           => $r->size_id,
                'option_id'         => $r->option_id,
                'inventory_item_id' => $r->inventory_item_id,
                'sub_recipe_id'     => $r->sub_recipe_id,
                'name'              => $name,
                'unit'              => $unit,
                'quantity_consumed' => (float) $r->quantity_consumed,
                'unit_cost'         => round($unitCost, 4),
                'cost'              => round($cost, 2),
            ];
        });

        $price = (float) $product->price;
        $profit = max(0, $price - $totalCost);
        $margin = $price > 0 ? (($profit / $price) * 100) : 0;

        return response()->json([
            'product'      => $product,
            'total_cost'   => round($totalCost, 2),
            'gross_profit' => round($profit, 2),
            'margin'       => round($margin, 1),
            'ingredients'  => $detailedIngredients,
        ]);
    }

    /**
     * Salvar / Atualizar ficha técnica do produto.
     * POST /api/v1/restaurant/inventory/recipes/attach
     */
    public function attach(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'product_id'                      => ['required', 'uuid', Rule::exists('products', 'id')->where('tenant_id', $tenantId)],
            'ingredients'                     => ['required', 'array'],
            'ingredients.*.flavor_id'         => ['nullable', 'string', 'max:50'],
            'ingredients.*.size_id'           => ['nullable', 'string', 'max:50'],
            'ingredients.*.option_id'         => ['nullable', 'uuid'],
            'ingredients.*.inventory_item_id' => ['nullable', 'uuid', Rule::exists('inventory_items', 'id')->where('tenant_id', $tenantId)],
            'ingredients.*.sub_recipe_id'     => ['nullable', 'uuid', Rule::exists('sub_recipes', 'id')->where('tenant_id', $tenantId)],
            'ingredients.*.quantity_consumed' => ['required', 'numeric', 'min:0.0001'],
        ]);

        $productId = $validated['product_id'];
        $product = Product::where('tenant_id', $tenantId)->findOrFail($productId);

        DB::transaction(function () use ($tenantId, $productId, $validated) {
            ProductRecipe::where('tenant_id', $tenantId)->where('product_id', $productId)->delete();

            foreach ($validated['ingredients'] as $ing) {
                if (empty($ing['inventory_item_id']) && empty($ing['sub_recipe_id'])) {
                    continue;
                }

                ProductRecipe::create([
                    'tenant_id'         => $tenantId,
                    'product_id'        => $productId,
                    'flavor_id'         => $ing['flavor_id'] ?? null,
                    'size_id'           => $ing['size_id'] ?? null,
                    'option_id'         => $ing['option_id'] ?? null,
                    'inventory_item_id' => $ing['inventory_item_id'] ?? null,
                    'sub_recipe_id'     => $ing['sub_recipe_id'] ?? null,
                    'quantity_consumed' => $ing['quantity_consumed'],
                ]);
            }
        });

        return response()->json([
            'message' => 'Ficha técnica salva com sucesso.',
        ]);
    }
}
