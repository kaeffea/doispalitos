<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventorySupplier;
use App\Models\PurchasingSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchasingScheduleController extends Controller
{
    /**
     * Listagem de agendas de compra configuradas.
     * GET /api/v1/restaurant/inventory/purchasing-schedules
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $schedules = PurchasingSchedule::where('tenant_id', $tenantId)
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'schedules' => $schedules,
            'total'     => $schedules->count(),
        ]);
    }

    /**
     * Cadastro de rotina de compra personalizada.
     * POST /api/v1/restaurant/inventory/purchasing-schedules
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'frequency_type'  => ['required', 'string', 'in:daily,weekly,biweekly,monthly,on_demand'],
            'schedule_days'   => ['nullable', 'array'],
            'item_categories' => ['nullable', 'array'],
            'is_active'       => ['sometimes', 'boolean'],
        ]);

        $schedule = PurchasingSchedule::create([
            'tenant_id'       => $tenantId,
            'name'            => $validated['name'],
            'frequency_type'  => $validated['frequency_type'],
            'schedule_days'   => $validated['schedule_days'] ?? null,
            'item_categories' => $validated['item_categories'] ?? null,
            'is_active'       => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message'  => 'Rotina de compras cadastrada com sucesso.',
            'schedule' => $schedule,
        ], 201);
    }

    /**
     * Atualização de rotina de compras.
     * PUT /api/v1/restaurant/inventory/purchasing-schedules/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $schedule = PurchasingSchedule::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'name'            => ['sometimes', 'required', 'string', 'max:255'],
            'frequency_type'  => ['sometimes', 'required', 'string', 'in:daily,weekly,biweekly,monthly,on_demand'],
            'schedule_days'   => ['nullable', 'array'],
            'item_categories' => ['nullable', 'array'],
            'is_active'       => ['sometimes', 'boolean'],
        ]);

        $schedule->update($validated);

        return response()->json([
            'message'  => 'Rotina de compras atualizada com sucesso.',
            'schedule' => $schedule->fresh(),
        ]);
    }

    /**
     * Exclusão de rotina de compras.
     * DELETE /api/v1/restaurant/inventory/purchasing-schedules/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $schedule = PurchasingSchedule::where('tenant_id', $tenantId)->findOrFail($id);
        $schedule->delete();

        return response()->json([
            'message' => 'Rotina de compras removida com sucesso.',
        ]);
    }

    /**
     * Motor de Geração de Lista de Compras Inteligente (Smart Shopping List).
     * GET /api/v1/restaurant/inventory/smart-shopping-list
     */
    public function generateShoppingList(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $scheduleId = $request->input('schedule_id');

        $query = InventoryItem::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->with(['primarySupplier', 'packagings.supplier']);

        // Se filtrou por agenda específica
        if ($scheduleId && $scheduleId !== 'all') {
            $schedule = PurchasingSchedule::where('tenant_id', $tenantId)->find($scheduleId);
            if ($schedule && ! empty($schedule->item_categories)) {
                $query->whereIn('category', $schedule->item_categories);
            }
        }

        $items = $query->get();

        // Agrupa itens que precisam de compra (current_stock < ideal_stock ou current_stock <= min_stock)
        $neededItems = $items->filter(function ($item) {
            $deficit = $item->ideal_stock - $item->current_stock;
            return $deficit > 0 || $item->current_stock <= $item->min_stock;
        });

        $supplierGroups = [];
        $totalEstimatedCost = 0;

        foreach ($neededItems as $item) {
            $neededBaseQty = max(0, $item->ideal_stock - $item->current_stock);
            if ($neededBaseQty <= 0 && $item->current_stock <= $item->min_stock) {
                $neededBaseQty = max(1, $item->min_stock * 1.5);
            }

            // Seleciona embalagem preferencial ou mais barata
            $preferredPkg = $item->packagings->where('is_preferred', true)->first()
                ?? $item->packagings->sortBy('unit_cost_equivalent')->first();

            $supplier = $preferredPkg?->supplier ?? $item->primarySupplier;
            $supplierName = $supplier?->name ?? 'Fornecedor Avulso / Sem Cadastro';
            $supplierPhone = $supplier?->phone_whatsapp ?? '';
            $supplierId = $supplier?->id ?? 'unassigned';

            // Calcula quantidade sugerida em pacotes comerciais
            $pkgBaseQty = $preferredPkg?->package_base_quantity ?? 1;
            $packagesToOrder = $pkgBaseQty > 0 ? (int) ceil($neededBaseQty / $pkgBaseQty) : 1;
            $totalBuyBaseQty = $packagesToOrder * $pkgBaseQty;
            $itemEstimatedCost = $preferredPkg
                ? ($packagesToOrder * $preferredPkg->price_paid)
                : ($totalBuyBaseQty * $item->average_cost_per_unit);

            $totalEstimatedCost += $itemEstimatedCost;

            if (! isset($supplierGroups[$supplierId])) {
                $supplierGroups[$supplierId] = [
                    'supplier_id'          => $supplierId,
                    'supplier_name'        => $supplierName,
                    'supplier_phone'       => $supplierPhone,
                    'min_order_value'      => $supplier?->min_order_value ?? 0,
                    'items'                => [],
                    'total_estimated_cost' => 0,
                ];
            }

            $supplierGroups[$supplierId]['items'][] = [
                'item_id'              => $item->id,
                'name'                 => $item->name,
                'category'             => $item->category,
                'base_unit'            => $item->base_unit,
                'current_stock'        => (float) $item->current_stock,
                'min_stock'            => (float) $item->min_stock,
                'ideal_stock'          => (float) $item->ideal_stock,
                'needed_base_qty'      => round($neededBaseQty, 2),
                'package_name'         => $preferredPkg?->package_name ?? "{$item->base_unit} Avulso",
                'brand_name'           => $preferredPkg?->brand_name ?? '',
                'packages_to_order'    => $packagesToOrder,
                'total_buy_base_qty'   => round($totalBuyBaseQty, 2),
                'estimated_cost'       => round($itemEstimatedCost, 2),
            ];

            $supplierGroups[$supplierId]['total_estimated_cost'] += $itemEstimatedCost;
        }

        // Formata mensagem de WhatsApp para cada fornecedor
        $formattedSuppliers = array_values(array_map(function ($group) use ($request) {
            $storeName = $request->user()->tenant->name ?? 'Restaurante';
            $dateStr = now()->format('d/m/Y');

            $lines = [];
            $lines[] = "*PEDIDO DE COMPRAS - {$storeName}*";
            $lines[] = "Data: {$dateStr}";
            $lines[] = "Para: {$group['supplier_name']}";
            $lines[] = "──────────────────────────";
            $lines[] = "*ITENS SOLICITADOS:*";

            foreach ($group['items'] as $it) {
                $brandStr = ! empty($it['brand_name']) ? " (Marca: {$it['brand_name']})" : '';
                $lines[] = "- *{$it['packages_to_order']}x* {$it['package_name']} de *{$it['name']}*{$brandStr}";
            }

            $lines[] = "──────────────────────────";
            $lines[] = "*Total Estimado: R$ " . number_format($group['total_estimated_cost'], 2, ',', '.') . "*";
            $lines[] = "\nFavor confirmar o recebimento e previsão de entrega. Obrigado!";

            $group['whatsapp_text'] = implode("\n", $lines);
            $group['total_estimated_cost'] = round($group['total_estimated_cost'], 2);

            return $group;
        }, $supplierGroups));

        return response()->json([
            'shopping_list'        => $formattedSuppliers,
            'total_suppliers'      => count($formattedSuppliers),
            'total_items_to_order' => $neededItems->count(),
            'total_estimated_cost' => round($totalEstimatedCost, 2),
        ]);
    }
}
