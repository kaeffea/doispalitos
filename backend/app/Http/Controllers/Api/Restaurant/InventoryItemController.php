<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventorySupplierPackaging;
use App\Models\InventoryTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryItemController extends Controller
{
    /**
     * Listagem de insumos com filtros e métricas de estoque.
     * GET /api/v1/restaurant/inventory/items
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $query = InventoryItem::where('tenant_id', $tenantId)
            ->with(['primarySupplier', 'options.supplier', 'packagings.supplier', 'purchaseItems.supplier', 'purchaseItems.purchase'])
            ->orderBy('name', 'asc');

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        if ($search = $request->input('search')) {
            $query->where('name', 'ilike', "%{$search}%");
        }

        $items = $query->get();

        // Métricas globais e cálculo de risco dinâmico
        $today = now()->startOfDay();
        $itemsWithMetrics = $items->map(function ($i) use ($today, $tenantId) {
            $freq = (int) ($i->frequency_days ?? 7);
            $cycleQty = (float) ($i->cycle_consumption_qty ?? ($i->ideal_stock ?? 10));
            $dailyRate = $freq > 0 ? ($cycleQty / $freq) : 0;
            $leadTime = (int) ($i->lead_time_days ?? 0);
            
            $nextDate = $i->next_scheduled_purchase_date ? \Carbon\Carbon::parse($i->next_scheduled_purchase_date)->startOfDay() : null;
            
            // Dias até a próxima entrega
            if ($nextDate) {
                $daysUntilDelivery = max(0, $today->diffInDays($nextDate, false)) + $leadTime;
            } else {
                $daysUntilDelivery = $freq + $leadTime;
            }
            
            // Demanda futura a cobrir (dias futuros que ainda virão até a entrega, descontando o dia de hoje que já está em consumo ativo):
            $futureDaysToCover = max(0, $daysUntilDelivery - 1);
            $neededStock = $dailyRate * $futureDaysToCover;
            $currentStock = (float) $i->current_stock;
            
            // 1. Crítico se estoque é 0 ou se o estoque atual não aguenta cobrir os dias futuros até a entrega
            $isCritical = ($currentStock <= 0) || ($dailyRate > 0 && $currentStock < $neededStock);
            
            // 2. Repor se a compra/entrega está agendada para hoje ou amanhã (dias 0 ou 1)
            $isReorder = !$isCritical && ($daysUntilDelivery <= 1);
            
            $status = $isCritical ? 'critical' : ($isReorder ? 'reorder' : 'healthy');
            
            $i->computed_status = $status;
            $i->is_critical = $isCritical;
            $i->daily_consumption = round($dailyRate, 3);
            $i->days_until_delivery = $daysUntilDelivery;

            // ─── OPÇÕES / MARCAS HOMOLOGADAS DO INSUMO ───
            $optionsList = [];
            if ($i->options && $i->options->isNotEmpty()) {
                $optionsList = $i->options->map(function ($opt) {
                    return [
                        'id'                 => $opt->id,
                        'brand_name'         => $opt->brand_name,
                        'supplier_id'        => $opt->supplier_id,
                        'supplier_name'      => $opt->supplier?->name ?? null,
                        'cost_per_unit'      => (float) $opt->cost_per_unit,
                        'current_stock'      => (float) $opt->current_stock,
                        'last_purchased_at'  => $opt->last_purchased_at ? \Carbon\Carbon::parse($opt->last_purchased_at)->toDateString() : null,
                        'is_default'         => (bool) $opt->is_default,
                    ];
                })->toArray();
            } else {
                // Auto-inicializa a 1ª opção caso ainda não exista no banco
                $opt = \App\Models\InventoryItemOption::create([
                    'tenant_id'         => $tenantId,
                    'inventory_item_id' => $i->id,
                    'brand_name'        => $i->brand_name,
                    'supplier_id'       => $i->primary_supplier_id,
                    'cost_per_unit'     => (float) $i->average_cost_per_unit,
                    'current_stock'     => (float) $i->current_stock,
                    'last_purchased_at' => $i->last_purchased_at,
                    'is_default'        => true,
                ]);
                $optionsList[] = [
                    'id'                 => $opt->id,
                    'brand_name'         => $opt->brand_name,
                    'supplier_id'        => $opt->supplier_id,
                    'supplier_name'      => $i->primarySupplier?->name ?? null,
                    'cost_per_unit'      => (float) $opt->cost_per_unit,
                    'current_stock'      => (float) $opt->current_stock,
                    'last_purchased_at'  => $opt->last_purchased_at ? \Carbon\Carbon::parse($opt->last_purchased_at)->toDateString() : null,
                    'is_default'         => true,
                ];
            }

            $i->options_list = $optionsList;
            $i->brands_in_stock = $optionsList;
            
            return $i;
        });

        $totalItems = $itemsWithMetrics->count();
        $criticalCount = $itemsWithMetrics->filter(fn ($i) => $i->computed_status === 'critical')->count();
        $totalStockValue = $itemsWithMetrics->reduce(fn ($acc, $i) => $acc + ($i->current_stock * $i->average_cost_per_unit), 0);

        return response()->json([
            'items'              => $itemsWithMetrics,
            'total'              => $totalItems,
            'critical_count'     => $criticalCount,
            'total_stock_value'  => round($totalStockValue, 2),
        ]);
    }

    /**
     * Cadastro de insumo / matéria-prima.
     * POST /api/v1/restaurant/inventory/items
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'                  => [
                'required',
                'string',
                'max:255',
                Rule::unique('inventory_items')->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId)->whereNull('deleted_at');
                }),
            ],
            'brand_name'            => ['nullable', 'string', 'max:120'],
            'description'           => ['nullable', 'string', 'max:1000'],
            'category'              => ['required', 'string', 'max:50'],
            'base_unit'             => ['required', 'string', 'in:kg,g,L,ml,un'],
            'current_stock'         => ['sometimes', 'numeric', 'min:0'],
            'min_stock'             => ['sometimes', 'numeric', 'min:0'],
            'ideal_stock'           => ['sometimes', 'numeric', 'min:0'],
            'frequency_days'        => ['sometimes', 'integer', 'min:0'],
            'cycle_consumption_qty' => ['sometimes', 'numeric', 'min:0'],
            'lead_time_days'        => ['sometimes', 'integer', 'min:0'],
            'last_purchased_at'     => ['nullable', 'date'],
            'next_scheduled_purchase_date' => ['nullable', 'date'],
            'purchase_frequency'    => ['sometimes', 'string', 'in:weekly,daily,biweekly,monthly,on_demand'],
            'purchase_day_of_week'  => ['nullable', 'string', 'max:20'],
            'critical_stock_days'   => ['sometimes', 'numeric', 'min:0'],
            'average_cost_per_unit' => ['sometimes', 'numeric', 'min:0'],
            'primary_supplier_id'   => ['nullable', 'uuid', Rule::exists('inventory_suppliers', 'id')->where('tenant_id', $tenantId)],
            'is_active'             => ['sometimes', 'boolean'],
            'initial_packaging'     => ['sometimes', 'array'],
            'initial_packaging.supplier_id'           => ['required_with:initial_packaging', 'uuid', Rule::exists('inventory_suppliers', 'id')->where('tenant_id', $tenantId)],
            'initial_packaging.brand_name'            => ['nullable', 'string', 'max:120'],
            'initial_packaging.package_name'          => ['required_with:initial_packaging', 'string', 'max:120'],
            'initial_packaging.package_base_quantity' => ['required_with:initial_packaging', 'numeric', 'min:0.001'],
            'initial_packaging.price_paid'            => ['required_with:initial_packaging', 'numeric', 'min:0'],
        ], [
            'name.unique' => 'Já existe um insumo cadastrado com este nome.',
        ]);

        $item = DB::transaction(function () use ($tenantId, $validated) {
            $cost = $validated['average_cost_per_unit'] ?? 0;
            $freqDays = isset($validated['frequency_days']) ? (int) $validated['frequency_days'] : 7;
            $lastPurchased = !empty($validated['last_purchased_at']) ? \Carbon\Carbon::parse($validated['last_purchased_at'])->toDateString() : null;
            
            $nextScheduled = null;
            if (!empty($validated['next_scheduled_purchase_date'])) {
                $nextScheduled = \Carbon\Carbon::parse($validated['next_scheduled_purchase_date'])->toDateString();
            } elseif ($lastPurchased && $freqDays > 0) {
                $nextScheduled = \Carbon\Carbon::parse($lastPurchased)->addDays($freqDays)->toDateString();
            }

            $cycleQty = isset($validated['cycle_consumption_qty']) ? (float) $validated['cycle_consumption_qty'] : (isset($validated['ideal_stock']) ? (float) $validated['ideal_stock'] : 10.0);

            $newItem = InventoryItem::create([
                'tenant_id'             => $tenantId,
                'name'                  => $validated['name'],
                'brand_name'            => $validated['brand_name'] ?? null,
                'description'           => $validated['description'] ?? null,
                'category'              => $validated['category'],
                'base_unit'             => $validated['base_unit'],
                'current_stock'         => $validated['current_stock'] ?? 0,
                'min_stock'             => $validated['min_stock'] ?? 0,
                'ideal_stock'           => $cycleQty,
                'frequency_days'        => $freqDays,
                'cycle_consumption_qty' => $cycleQty,
                'lead_time_days'        => $validated['lead_time_days'] ?? 0,
                'last_purchased_at'     => $lastPurchased,
                'next_scheduled_purchase_date' => $nextScheduled,
                'purchase_frequency'    => $validated['purchase_frequency'] ?? 'weekly',
                'purchase_day_of_week'  => $validated['purchase_day_of_week'] ?? 'monday',
                'critical_stock_days'   => $validated['critical_stock_days'] ?? 1.0,
                'average_cost_per_unit' => $cost,
                'last_cost_per_unit'    => $cost,
                'primary_supplier_id'   => $validated['primary_supplier_id'] ?? null,
                'is_active'             => $validated['is_active'] ?? true,
            ]);

            if (! empty($validated['initial_packaging'])) {
                $pkg = $validated['initial_packaging'];
                $qty = $pkg['package_base_quantity'];
                $price = $pkg['price_paid'];
                $unitEquiv = $qty > 0 ? ($price / $qty) : 0;

                InventorySupplierPackaging::create([
                    'tenant_id'             => $tenantId,
                    'inventory_item_id'     => $newItem->id,
                    'supplier_id'           => $pkg['supplier_id'],
                    'brand_name'            => $pkg['brand_name'] ?? $newItem->brand_name ?? null,
                    'package_name'          => $pkg['package_name'],
                    'package_base_quantity' => $qty,
                    'price_paid'            => $price,
                    'unit_cost_equivalent'  => round($unitEquiv, 4),
                    'is_preferred'          => true,
                ]);

                // Atualiza o custo do item com a embalagem se custo inicial for zero
                if ($cost == 0 && $unitEquiv > 0) {
                    $newItem->update([
                        'average_cost_per_unit' => round($unitEquiv, 4),
                        'last_cost_per_unit'    => round($unitEquiv, 4),
                    ]);
                }
            }

            // Registra saldo inicial se > 0
            if (($validated['current_stock'] ?? 0) > 0) {
                InventoryTransaction::create([
                    'tenant_id'         => $tenantId,
                    'inventory_item_id' => $newItem->id,
                    'type'              => 'ajuste_inventario',
                    'quantity'          => $validated['current_stock'],
                    'unit_cost'         => $newItem->average_cost_per_unit,
                    'total_cost'        => $validated['current_stock'] * $newItem->average_cost_per_unit,
                    'notes'             => 'Saldo inicial de estoque.',
                ]);
            }

            // Cria a 1ª opção padrão do insumo
            \App\Models\InventoryItemOption::create([
                'tenant_id'         => $tenantId,
                'inventory_item_id' => $newItem->id,
                'brand_name'        => !empty($validated['brand_name']) ? trim($validated['brand_name']) : null,
                'supplier_id'       => $validated['primary_supplier_id'] ?? null,
                'cost_per_unit'     => (float) $newItem->average_cost_per_unit,
                'current_stock'     => (float) ($validated['current_stock'] ?? 0),
                'last_purchased_at' => $lastPurchased,
                'is_default'        => true,
            ]);

            return $newItem;
        });

        return response()->json([
            'message' => 'Insumo cadastrado com sucesso.',
            'item'    => $item->load(['primarySupplier', 'options.supplier', 'packagings.supplier']),
        ], 201);
    }

    /**
     * Atualização de insumo.
     * PUT /api/v1/restaurant/inventory/items/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'name'                  => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('inventory_items')->where(function ($query) use ($tenantId) {
                    return $query->where('tenant_id', $tenantId)->whereNull('deleted_at');
                })->ignore($item->id),
            ],
            'brand_name'            => ['nullable', 'string', 'max:120'],
            'description'           => ['nullable', 'string', 'max:1000'],
            'category'              => ['sometimes', 'required', 'string', 'max:50'],
            'base_unit'             => ['sometimes', 'required', 'string', 'in:kg,g,L,ml,un'],
            'current_stock'         => ['sometimes', 'numeric', 'min:0'],
            'min_stock'             => ['sometimes', 'numeric', 'min:0'],
            'ideal_stock'           => ['sometimes', 'numeric', 'min:0'],
            'frequency_days'        => ['sometimes', 'integer', 'min:0'],
            'cycle_consumption_qty' => ['sometimes', 'numeric', 'min:0'],
            'lead_time_days'        => ['sometimes', 'integer', 'min:0'],
            'last_purchased_at'     => ['nullable', 'date'],
            'next_scheduled_purchase_date' => ['nullable', 'date'],
            'purchase_frequency'    => ['sometimes', 'string', 'in:weekly,daily,biweekly,monthly,on_demand'],
            'purchase_day_of_week'  => ['nullable', 'string', 'max:20'],
            'critical_stock_days'   => ['sometimes', 'numeric', 'min:0'],
            'average_cost_per_unit' => ['sometimes', 'numeric', 'min:0'],
            'primary_supplier_id'   => ['nullable', 'uuid', Rule::exists('inventory_suppliers', 'id')->where('tenant_id', $tenantId)],
            'is_active'             => ['sometimes', 'boolean'],
        ], [
            'name.unique' => 'Já existe um insumo cadastrado com este nome.',
        ]);

        // Protege o estoque atual contra alterações manuais sem compra ou ajuste
        unset($validated['current_stock']);

        if (isset($validated['frequency_days']) && $validated['frequency_days'] > 0 && empty($validated['next_scheduled_purchase_date'])) {
            $baseDate = $validated['last_purchased_at'] ?? $item->last_purchased_at ?? now();
            $validated['next_scheduled_purchase_date'] = \Carbon\Carbon::parse($baseDate)->addDays((int) $validated['frequency_days'])->toDateString();
        }

        if (isset($validated['cycle_consumption_qty'])) {
            $validated['ideal_stock'] = $validated['cycle_consumption_qty'];
        }

        $item->update($validated);

        return response()->json([
            'message' => 'Insumo atualizado com sucesso.',
            'item'    => $item->fresh()->load(['primarySupplier', 'options.supplier', 'packagings.supplier']),
        ]);
    }

    /**
     * Adiciona nova opção (Marca / Fornecedor / Preço / Estoque) ao insumo.
     * POST /api/v1/restaurant/inventory/items/{id}/options
     */
    public function addOption(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'brand_name'    => ['nullable', 'string', 'max:120'],
            'supplier_id'   => ['nullable', 'uuid', Rule::exists('inventory_suppliers', 'id')->where('tenant_id', $tenantId)],
            'cost_per_unit' => ['sometimes', 'numeric', 'min:0'],
            'current_stock' => ['sometimes', 'numeric', 'min:0'],
        ]);

        $option = DB::transaction(function () use ($tenantId, $item, $validated) {
            $totalItemStock = (float) $item->current_stock;
            $optStock = isset($validated['current_stock']) ? (float) $validated['current_stock'] : 0;

            if ($optStock > $totalItemStock) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'current_stock' => ["O estoque desta opção ({$optStock} {$item->base_unit}) não pode ultrapassar o estoque total do insumo ({$totalItemStock} {$item->base_unit})."],
                ]);
            }

            // Se for informada uma quantidade de estoque para esta nova opção, redistribui tirando das opções existentes
            if ($optStock > 0) {
                $otherOptions = $item->options()->orderBy('is_default', 'desc')->orderBy('current_stock', 'desc')->get();
                $needed = $optStock;
                foreach ($otherOptions as $other) {
                    if ($needed <= 0) break;
                    $deduct = min($needed, (float) $other->current_stock);
                    if ($deduct > 0) {
                        $other->current_stock -= $deduct;
                        $other->save();
                        $needed -= $deduct;
                    }
                }
            }

            return \App\Models\InventoryItemOption::create([
                'tenant_id'         => $tenantId,
                'inventory_item_id' => $item->id,
                'brand_name'        => !empty($validated['brand_name']) ? trim($validated['brand_name']) : null,
                'supplier_id'       => $validated['supplier_id'] ?? null,
                'cost_per_unit'     => $validated['cost_per_unit'] ?? 0,
                'current_stock'     => $optStock,
                'last_purchased_at' => null,
                'is_default'        => false,
            ]);
        });

        return response()->json([
            'message' => 'Opção adicionada com sucesso.',
            'option'  => $option->load('supplier'),
        ], 201);
    }

    /**
     * Edição de uma opção do insumo (Marca, Fornecedor, Preço e Estoque da opção).
     * PUT /api/v1/restaurant/inventory/items/{itemId}/options/{optionId}
     */
    public function updateOption(Request $request, string $itemId, string $optionId): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($itemId);
        $option = \App\Models\InventoryItemOption::where('tenant_id', $tenantId)
            ->where('inventory_item_id', $item->id)
            ->findOrFail($optionId);

        $validated = $request->validate([
            'brand_name'    => ['nullable', 'string', 'max:120'],
            'supplier_id'   => ['nullable', 'uuid', Rule::exists('inventory_suppliers', 'id')->where('tenant_id', $tenantId)],
            'cost_per_unit' => ['sometimes', 'numeric', 'min:0'],
            'current_stock' => ['sometimes', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($item, $option, $validated) {
            $totalItemStock = (float) $item->current_stock;
            $newOptStock = isset($validated['current_stock']) ? (float) $validated['current_stock'] : (float) $option->current_stock;

            if ($newOptStock > $totalItemStock) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'current_stock' => ["O estoque desta opção ({$newOptStock} {$item->base_unit}) não pode ultrapassar o estoque total do insumo ({$totalItemStock} {$item->base_unit})."],
                ]);
            }

            $diff = $newOptStock - (float) $option->current_stock;
            if ($diff > 0) {
                // Precisa tirar $diff de outras opções
                $otherOptions = $item->options()->where('id', '!=', $option->id)->orderBy('current_stock', 'desc')->get();
                $needed = $diff;
                foreach ($otherOptions as $other) {
                    if ($needed <= 0) break;
                    $deduct = min($needed, (float) $other->current_stock);
                    if ($deduct > 0) {
                        $other->current_stock -= $deduct;
                        $other->save();
                        $needed -= $deduct;
                    }
                }
            } elseif ($diff < 0) {
                // Sobrou saldo, devolve para a opção padrão ou primeira outra opção
                $returnQty = abs($diff);
                $defaultOther = $item->options()->where('id', '!=', $option->id)->orderBy('is_default', 'desc')->first();
                if ($defaultOther) {
                    $defaultOther->current_stock += $returnQty;
                    $defaultOther->save();
                }
            }

            $option->update([
                'brand_name'    => isset($validated['brand_name']) ? (!empty($validated['brand_name']) ? trim($validated['brand_name']) : null) : $option->brand_name,
                'supplier_id'   => array_key_exists('supplier_id', $validated) ? $validated['supplier_id'] : $option->supplier_id,
                'cost_per_unit' => isset($validated['cost_per_unit']) ? (float) $validated['cost_per_unit'] : $option->cost_per_unit,
                'current_stock' => $newOptStock,
            ]);
        });

        return response()->json([
            'message' => 'Opção atualizada com sucesso.',
            'option'  => $option->fresh()->load('supplier'),
        ]);
    }

    /**
     * Remove uma opção do insumo.
     * DELETE /api/v1/restaurant/inventory/items/{itemId}/options/{optionId}
     */
    public function deleteOption(Request $request, string $itemId, string $optionId): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($itemId);
        $option = \App\Models\InventoryItemOption::where('tenant_id', $tenantId)
            ->where('inventory_item_id', $item->id)
            ->findOrFail($optionId);

        DB::transaction(function () use ($item, $option) {
            $stockToReturn = (float) $option->current_stock;
            if ($stockToReturn > 0) {
                $other = $item->options()->where('id', '!=', $option->id)->orderBy('is_default', 'desc')->first();
                if ($other) {
                    $other->current_stock += $stockToReturn;
                    $other->save();
                }
            }
            $option->delete();
        });

        return response()->json([
            'message' => 'Opção removida com sucesso.',
        ]);
    }

    /**
     * Cadastro de embalagem/marca de fornecedor para o insumo.
     * POST /api/v1/restaurant/inventory/items/{id}/packagings
     */
    public function addPackaging(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'supplier_id'           => ['required', 'uuid', 'exists:inventory_suppliers,id'],
            'brand_name'            => ['nullable', 'string', 'max:120'],
            'package_name'          => ['required', 'string', 'max:120'],
            'package_base_quantity' => ['required', 'numeric', 'min:0.001'],
            'price_paid'            => ['required', 'numeric', 'min:0'],
            'is_preferred'          => ['sometimes', 'boolean'],
        ]);

        $qty = $validated['package_base_quantity'];
        $price = $validated['price_paid'];
        $unitEquiv = $qty > 0 ? ($price / $qty) : 0;

        if ($validated['is_preferred'] ?? false) {
            InventorySupplierPackaging::where('tenant_id', $tenantId)
                ->where('inventory_item_id', $item->id)
                ->update(['is_preferred' => false]);
        }

        $packaging = InventorySupplierPackaging::create([
            'tenant_id'             => $tenantId,
            'inventory_item_id'     => $item->id,
            'supplier_id'           => $validated['supplier_id'],
            'brand_name'            => $validated['brand_name'] ?? null,
            'package_name'          => $validated['package_name'],
            'package_base_quantity' => $qty,
            'price_paid'            => $price,
            'unit_cost_equivalent'  => round($unitEquiv, 4),
            'is_preferred'          => $validated['is_preferred'] ?? false,
        ]);

        return response()->json([
            'message'   => 'Embalagem cadastrada com sucesso.',
            'packaging' => $packaging->load('supplier'),
        ], 201);
    }

    /**
     * Entrada Rápida de Compra (1 clique para repor estoque).
     * POST /api/v1/restaurant/inventory/quick-entry
     */
    public function quickEntry(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'inventory_item_id' => ['required', 'uuid', 'exists:inventory_items,id'],
            'quantity_added'    => ['required', 'numeric', 'min:0.001'],
            'total_cost_paid'   => ['required', 'numeric', 'min:0'],
            'notes'             => ['nullable', 'string', 'max:500'],
        ]);

        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($validated['inventory_item_id']);

        DB::transaction(function () use ($tenantId, $item, $validated) {
            $qtyAdded = $validated['quantity_added'];
            $totalCost = $validated['total_cost_paid'];
            $unitCost = $qtyAdded > 0 ? ($totalCost / $qtyAdded) : 0;

            // Recalcula custo médio ponderado
            $oldStock = $item->current_stock;
            $newStock = $oldStock + $qtyAdded;
            $newAvgCost = $newStock > 0
                ? (($oldStock * $item->average_cost_per_unit) + $totalCost) / $newStock
                : $unitCost;

            $item->update([
                'current_stock'         => $newStock,
                'last_cost_per_unit'    => round($unitCost, 4),
                'average_cost_per_unit' => round($newAvgCost, 4),
            ]);

            InventoryTransaction::create([
                'tenant_id'         => $tenantId,
                'inventory_item_id' => $item->id,
                'type'              => 'compra_entrada',
                'quantity'          => $qtyAdded,
                'unit_cost'         => round($unitCost, 4),
                'total_cost'        => $totalCost,
                'notes'             => $validated['notes'] ?? 'Entrada rápida de compras.',
            ]);
        });

        return response()->json([
            'message' => 'Entrada de compra registrada com sucesso.',
            'item'    => $item->fresh()->load(['primarySupplier', 'packagings.supplier']),
        ]);
    }

    /**
     * Histórico de Movimentações (Kardex).
     * GET /api/v1/restaurant/inventory/transactions
     */
    public function transactions(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $transactions = InventoryTransaction::where('tenant_id', $tenantId)
            ->with(['item', 'subRecipe'])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json([
            'transactions' => $transactions,
        ]);
    }

    /**
     * Exclusão de insumo.
     * DELETE /api/v1/restaurant/inventory/items/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $item = InventoryItem::where('tenant_id', $tenantId)->findOrFail($id);
        $item->delete();

        return response()->json([
            'message' => 'Insumo removido com sucesso.',
        ]);
    }

    /**
     * Listagem de marcas cadastradas/utilizadas na loja.
     * GET /api/v1/restaurant/inventory/brands
     */
    public function brands(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $itemBrands = InventoryItem::where('tenant_id', $tenantId)
            ->whereNotNull('brand_name')
            ->where('brand_name', '!=', '')
            ->pluck('brand_name');

        $pkgBrands = InventorySupplierPackaging::where('tenant_id', $tenantId)
            ->whereNotNull('brand_name')
            ->where('brand_name', '!=', '')
            ->pluck('brand_name');

        $brands = $itemBrands->concat($pkgBrands)
            ->map(fn ($b) => trim($b))
            ->filter()
            ->unique()
            ->values();

        return response()->json([
            'brands' => $brands,
        ]);
    }
}
