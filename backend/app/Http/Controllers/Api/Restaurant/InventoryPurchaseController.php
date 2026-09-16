<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryPurchase;
use App\Models\InventoryPurchaseItem;
use App\Models\InventorySupplier;
use App\Models\InventorySupplierPackaging;
use App\Models\InventoryTransaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryPurchaseController extends Controller
{
    /**
     * Calendário inteligente de compras com realizações e projeções.
     * GET /api/v1/restaurant/inventory/purchases/calendar?year=2026&month=8
     */
    public function calendar(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $now = Carbon::now();
        $year = (int) $request->input('year', $now->year);
        $month = (int) $request->input('month', $now->month);

        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = Carbon::createFromDate($year, $month, 1)->endOfMonth();

        // 1. Compras realizadas no mês
        $realizedPurchases = InventoryPurchase::where('tenant_id', $tenantId)
            ->whereBetween('purchase_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->with(['items.item', 'items.supplier'])
            ->orderBy('purchase_date', 'asc')
            ->get();

        // 2. Insumos ativos
        $allItems = InventoryItem::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->with(['primarySupplier', 'packagings.supplier'])
            ->get();

        // Agrupamento por data do mês
        $daysData = [];
        $currentCursor = $startDate->copy();

        while ($currentCursor->lte($endDate)) {
            $dateStr = $currentCursor->toDateString();
            $daysData[$dateStr] = [
                'date'               => $dateStr,
                'day_number'         => $currentCursor->day,
                'day_of_week'        => $currentCursor->dayOfWeek,
                'is_today'           => $currentCursor->isToday(),
                'is_past'            => $currentCursor->isPast() && !$currentCursor->isToday(),
                'realized_purchases' => [],
                'scheduled_items'    => [],
                'total_cost_spent'   => 0,
                'estimated_cost'     => 0,
                'has_risk'           => false,
            ];
            $currentCursor->addDay();
        }

        // Preenche compras realizadas
        foreach ($realizedPurchases as $purchase) {
            $pDate = Carbon::parse($purchase->purchase_date)->toDateString();
            if (isset($daysData[$pDate])) {
                $daysData[$pDate]['realized_purchases'][] = $purchase;
                $daysData[$pDate]['total_cost_spent'] += (float) $purchase->total_cost;
            }
        }

        // Projeta insumos agendados para os dias futuros/atuais do mês
        foreach ($allItems as $item) {
            $freqDays = (int) ($item->frequency_days ?? 7);
            $cycleQty = (float) ($item->cycle_consumption_qty > 0 ? $item->cycle_consumption_qty : ($item->ideal_stock > 0 ? $item->ideal_stock : 10.0));
            $dailyRate = $freqDays > 0 ? ($cycleQty / $freqDays) : 0;
            $leadTime = (int) ($item->lead_time_days ?? 0);

            // Data da próxima compra
            $nextDate = $item->next_scheduled_purchase_date
                ? Carbon::parse($item->next_scheduled_purchase_date)
                : ($item->last_purchased_at ? Carbon::parse($item->last_purchased_at)->addDays($freqDays) : $now->copy());

            // Projeta datas ao longo do mês
            $simDate = $nextDate->copy();
            
            // Se a data já passou e não houve compra, traz para o início do mês ou hoje
            if ($freqDays > 0) {
                while ($simDate->lt($startDate)) {
                    $simDate->addDays($freqDays);
                }
            }

            while ($simDate->lte($endDate)) {
                $dateKey = $simDate->toDateString();
                if (isset($daysData[$dateKey])) {
                    // Cálculo de risco de ruptura até esta data (dias futuros completos a cobrir)
                    $daysUntil = max(0, $now->diffInDays($simDate, false));
                    $futureDaysToCover = max(0, $daysUntil - 1) + $leadTime;
                    $neededQty = $futureDaysToCover * $dailyRate;
                    $isRisk = ($item->current_stock < $neededQty) && ($dailyRate > 0);

                    $estimatedItemCost = $cycleQty * (float) $item->average_cost_per_unit;

                    $daysData[$dateKey]['scheduled_items'][] = [
                        'item_id'              => $item->id,
                        'name'                 => $item->name,
                        'brand_name'           => $item->brand_name,
                        'category'             => $item->category,
                        'base_unit'            => $item->base_unit,
                        'current_stock'        => (float) $item->current_stock,
                        'frequency_days'       => $freqDays,
                        'cycle_consumption_qty'=> $cycleQty,
                        'daily_consumption'    => round($dailyRate, 3),
                        'lead_time_days'       => $leadTime,
                        'suggested_buy_qty'    => $cycleQty,
                        'unit_cost'            => (float) $item->average_cost_per_unit,
                        'estimated_cost'       => round($estimatedItemCost, 2),
                        'is_risk'              => $isRisk,
                        'primary_supplier_id'  => $item->primary_supplier_id,
                        'primary_supplier'     => $item->primarySupplier,
                        'packagings'           => $item->packagings,
                    ];

                    $daysData[$dateKey]['estimated_cost'] += $estimatedItemCost;
                    if ($isRisk) {
                        $daysData[$dateKey]['has_risk'] = true;
                    }
                }

                if ($freqDays <= 0) {
                    break;
                }
                $simDate->addDays($freqDays);
            }
        }

        return response()->json([
            'year'      => $year,
            'month'     => $month,
            'month_name'=> $startDate->locale('pt_BR')->monthName,
            'days'      => array_values($daysData),
            'items'     => $allItems,
        ]);
    }

    /**
     * Registro de Compra em Lote (Planilha Ágil com 1 Clique).
     * POST /api/v1/restaurant/inventory/purchases/batch
     */
    public function storeBatch(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'purchase_date'  => ['required', 'date', 'before_or_equal:today'],
            'purchase_type'  => ['required', 'string', 'in:scheduled,urgent'],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'items'          => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'uuid', Rule::exists('inventory_items', 'id')->where('tenant_id', $tenantId)],
            'items.*.supplier_id'       => ['nullable', 'uuid', Rule::exists('inventory_suppliers', 'id')->where('tenant_id', $tenantId)],
            'items.*.brand_name'        => ['nullable', 'string', 'max:120'],
            'items.*.quantity'          => ['required', 'numeric', 'min:0.001'],
            'items.*.unit_cost'         => ['sometimes', 'numeric', 'min:0'],
            'items.*.total_cost'        => ['required', 'numeric', 'min:0'],
            'items.*.reschedule_next'   => ['sometimes', 'boolean'],
            'items.*.custom_next_date'  => ['nullable', 'date'],
        ], [
            'purchase_date.before_or_equal' => 'Não é possível registrar compras com data futura. Registre com a data de hoje ou anterior.',
        ]);

        $purchaseDate = Carbon::parse($validated['purchase_date'])->toDateString();
        $isScheduled = ($validated['purchase_type'] === 'scheduled');

        $result = DB::transaction(function () use ($tenantId, $validated, $purchaseDate, $isScheduled) {
            $totalPurchaseCost = 0;
            foreach ($validated['items'] as $itemData) {
                $totalPurchaseCost += (float) $itemData['total_cost'];
            }

            // 1. Cria cabeçalho da compra
            $purchase = InventoryPurchase::create([
                'tenant_id'     => $tenantId,
                'purchase_date' => $purchaseDate,
                'purchase_type' => $validated['purchase_type'],
                'total_cost'    => $totalPurchaseCost,
                'notes'         => $validated['notes'] ?? null,
            ]);

            // 2. Processa cada item comprado
            foreach ($validated['items'] as $itemData) {
                $qty = (float) $itemData['quantity'];
                $totalCost = (float) $itemData['total_cost'];
                $unitCost = $qty > 0 ? round($totalCost / $qty, 4) : 0;

                // Registra linha do item na compra
                InventoryPurchaseItem::create([
                    'tenant_id'         => $tenantId,
                    'purchase_id'       => $purchase->id,
                    'inventory_item_id' => $itemData['inventory_item_id'],
                    'supplier_id'       => $itemData['supplier_id'] ?? null,
                    'brand_name'        => $itemData['brand_name'] ?? null,
                    'quantity'          => $qty,
                    'unit_cost'         => $unitCost,
                    'total_cost'        => $totalCost,
                ]);

                // Atualiza estoque físico e custo médio ponderado
                $invItem = InventoryItem::where('tenant_id', $tenantId)->findOrFail($itemData['inventory_item_id']);
                $oldStock = (float) $invItem->current_stock;
                $oldAvgCost = (float) $invItem->average_cost_per_unit;
                $newStock = $oldStock + $qty;

                $newAvgCost = $unitCost;
                if ($newStock > 0) {
                    $totalValue = ($oldStock * $oldAvgCost) + $totalCost;
                    $newAvgCost = round($totalValue / $newStock, 4);
                }

                $updatePayload = [
                    'current_stock'         => $newStock,
                    'average_cost_per_unit' => $newAvgCost,
                    'last_cost_per_unit'    => $unitCost,
                ];

                if (!empty($itemData['supplier_id'])) {
                    $updatePayload['primary_supplier_id'] = $itemData['supplier_id'];
                }
                if (!empty($itemData['brand_name'])) {
                    $updatePayload['brand_name'] = $itemData['brand_name'];
                }

                // Se for Compra de Ciclo (Scheduled) ou se o gestor marcou para recalcular ciclo
                $shouldReschedule = $itemData['reschedule_next'] ?? $isScheduled;
                if ($shouldReschedule) {
                    $freq = (int) ($invItem->frequency_days ?? 7);
                    $updatePayload['last_purchased_at'] = $purchaseDate;
                    if (!empty($itemData['custom_next_date'])) {
                        $updatePayload['next_scheduled_purchase_date'] = Carbon::parse($itemData['custom_next_date'])->toDateString();
                    } elseif ($freq > 0) {
                        $updatePayload['next_scheduled_purchase_date'] = Carbon::parse($purchaseDate)->addDays($freq)->toDateString();
                    }
                }

                $invItem->update($updatePayload);

                // Atualiza ou cria a InventoryItemOption correspondente
                $brandNameClean = !empty($itemData['brand_name']) ? trim($itemData['brand_name']) : null;
                $supplierIdClean = !empty($itemData['supplier_id']) ? $itemData['supplier_id'] : null;

                $optQuery = \App\Models\InventoryItemOption::where('tenant_id', $tenantId)
                    ->where('inventory_item_id', $invItem->id);

                if ($brandNameClean) {
                    $optQuery->whereRaw('LOWER(TRIM(COALESCE(brand_name, \'\'))) = ?', [strtolower($brandNameClean)]);
                } else {
                    $optQuery->whereNull('brand_name');
                }

                if ($supplierIdClean) {
                    $optQuery->where('supplier_id', $supplierIdClean);
                } else {
                    $optQuery->whereNull('supplier_id');
                }

                $matchingOption = $optQuery->first();

                if ($matchingOption) {
                    $matchingOption->current_stock += $qty;
                    $matchingOption->cost_per_unit = $unitCost;
                    $matchingOption->last_purchased_at = $purchaseDate;
                    $matchingOption->save();
                } else {
                    // Se a 1ª opção do item estava sem registro ("Sem registro") e com saldo 0, reaproveita-a
                    $firstEmpty = \App\Models\InventoryItemOption::where('tenant_id', $tenantId)
                        ->where('inventory_item_id', $invItem->id)
                        ->whereNull('brand_name')
                        ->whereNull('supplier_id')
                        ->first();

                    if ($firstEmpty && $firstEmpty->current_stock <= 0) {
                        $firstEmpty->brand_name = $brandNameClean;
                        $firstEmpty->supplier_id = $supplierIdClean;
                        $firstEmpty->cost_per_unit = $unitCost;
                        $firstEmpty->current_stock = $qty;
                        $firstEmpty->last_purchased_at = $purchaseDate;
                        $firstEmpty->save();
                    } else {
                        \App\Models\InventoryItemOption::create([
                            'tenant_id'         => $tenantId,
                            'inventory_item_id' => $invItem->id,
                            'brand_name'        => $brandNameClean,
                            'supplier_id'       => $supplierIdClean,
                            'cost_per_unit'     => $unitCost,
                            'current_stock'     => $qty,
                            'last_purchased_at' => $purchaseDate,
                            'is_default'        => false,
                        ]);
                    }
                }

                // Registra transação de entrada
                InventoryTransaction::create([
                    'tenant_id'         => $tenantId,
                    'inventory_item_id' => $invItem->id,
                    'type'              => 'compra',
                    'quantity'          => $qty,
                    'unit_cost'         => $unitCost,
                    'total_cost'        => $totalCost,
                    'supplier_id'       => $itemData['supplier_id'] ?? null,
                    'notes'             => ($isScheduled ? 'Compra Programada de Ciclo' : 'Reposição de Urgência') . ($purchase->notes ? " ({$purchase->notes})" : ''),
                ]);
            }

            return $purchase->load(['items.item', 'items.supplier']);
        });

        return response()->json([
            'message'  => 'Compra registrada com sucesso e estoque atualizado!',
            'purchase' => $result,
        ], 201);
    }

    /**
     * Histórico de compras registradas.
     * GET /api/v1/restaurant/inventory/purchases
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $purchases = InventoryPurchase::where('tenant_id', $tenantId)
            ->with(['items.item', 'items.supplier'])
            ->orderBy('purchase_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate(30);

        return response()->json([
            'purchases' => $purchases,
        ]);
    }
}
