<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductRecipe;
use App\Models\StoreFinancialOverhead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryFinancialController extends Controller
{
    /**
     * Obter visão geral de custos fixos e análise de margem real.
     * GET /api/v1/restaurant/inventory/financial-overview
     */
    public function show(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $overhead = StoreFinancialOverhead::firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'payroll_expenses'          => 0,
                'rent_expense'              => 0,
                'utilities_expense'         => 0,
                'other_fixed_expenses'      => 0,
                'estimated_monthly_revenue' => 10000.00,
                'fixed_cost_percentage'     => 0,
            ]
        );

        $totalFixedCosts = $overhead->payroll_expenses
            + $overhead->rent_expense
            + $overhead->utilities_expense
            + $overhead->other_fixed_expenses;

        $revenue = max(1, $overhead->estimated_monthly_revenue);
        $overheadPercent = ($totalFixedCosts / $revenue) * 100;

        // Atualiza a porcentagem calculada
        if (abs($overhead->fixed_cost_percentage - $overheadPercent) > 0.01) {
            $overhead->update(['fixed_cost_percentage' => round($overheadPercent, 2)]);
        }

        // Estatísticas do estoque
        $items = InventoryItem::where('tenant_id', $tenantId)->get();
        $totalStockValue = $items->reduce(fn ($acc, $i) => $acc + ($i->current_stock * $i->average_cost_per_unit), 0);

        // Estatísticas de CMV do Cardápio
        $products = Product::where('tenant_id', $tenantId)->get();
        $allRecipes = ProductRecipe::where('tenant_id', $tenantId)->with(['item', 'subRecipe'])->get()->groupBy('product_id');

        $cmvValues = [];
        foreach ($products as $p) {
            $recipes = $allRecipes->get($p->id, collect());
            if ($recipes->count() > 0 && $p->price > 0) {
                $cost = 0;
                foreach ($recipes as $r) {
                    $unitCost = $r->item ? $r->item->average_cost_per_unit : ($r->subRecipe ? $r->subRecipe->unit_cost : 0);
                    $cost += ($r->quantity_consumed * $unitCost);
                }
                $cmvPercent = ($cost / $p->price) * 100;
                $cmvValues[] = $cmvPercent;
            }
        }

        $avgCMV = count($cmvValues) > 0 ? (array_sum($cmvValues) / count($cmvValues)) : 0;
        $estimatedNetMarginPercent = max(0, 100 - $avgCMV - $overheadPercent);

        return response()->json([
            'overheads' => [
                'id'                        => $overhead->id,
                'payroll_expenses'          => (float) $overhead->payroll_expenses,
                'rent_expense'              => (float) $overhead->rent_expense,
                'utilities_expense'         => (float) $overhead->utilities_expense,
                'other_fixed_expenses'      => (float) $overhead->other_fixed_expenses,
                'total_fixed_costs'         => round($totalFixedCosts, 2),
                'estimated_monthly_revenue' => (float) $overhead->estimated_monthly_revenue,
                'fixed_cost_percentage'     => round($overheadPercent, 1),
            ],
            'metrics' => [
                'total_stock_value'            => round($totalStockValue, 2),
                'average_cmv_percentage'       => round($avgCMV, 1),
                'fixed_overhead_percentage'    => round($overheadPercent, 1),
                'estimated_net_margin_percent' => round($estimatedNetMarginPercent, 1),
            ],
        ]);
    }

    /**
     * Atualização dos custos fixos da loja.
     * PUT /api/v1/restaurant/inventory/financial-overheads
     */
    public function update(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'payroll_expenses'          => ['sometimes', 'numeric', 'min:0'],
            'rent_expense'              => ['sometimes', 'numeric', 'min:0'],
            'utilities_expense'         => ['sometimes', 'numeric', 'min:0'],
            'other_fixed_expenses'      => ['sometimes', 'numeric', 'min:0'],
            'estimated_monthly_revenue' => ['sometimes', 'numeric', 'min:1'],
        ]);

        $overhead = StoreFinancialOverhead::firstOrCreate(['tenant_id' => $tenantId]);
        $overhead->update($validated);

        $totalFixed = $overhead->payroll_expenses + $overhead->rent_expense + $overhead->utilities_expense + $overhead->other_fixed_expenses;
        $rev = max(1, $overhead->estimated_monthly_revenue);
        $pct = ($totalFixed / $rev) * 100;
        $overhead->update(['fixed_cost_percentage' => round($pct, 2)]);

        return response()->json([
            'message'   => 'Custos fixos e despesas atualizados com sucesso.',
            'overheads' => $overhead->fresh(),
        ]);
    }
}
