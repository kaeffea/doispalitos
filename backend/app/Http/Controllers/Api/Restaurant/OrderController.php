<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    /**
     * Transições permitidas por status (Kanban da cozinha).
     */
    public const TRANSITIONS = [
        Order::STATUS_PENDING_PAYMENT => [Order::STATUS_RECEIVED, Order::STATUS_CANCELED],
        Order::STATUS_RECEIVED        => [Order::STATUS_PREPARING, Order::STATUS_CANCELED],
        Order::STATUS_PREPARING       => [Order::STATUS_READY, Order::STATUS_CANCELED],
        Order::STATUS_READY           => [Order::STATUS_DISPATCHED, Order::STATUS_CANCELED],
        Order::STATUS_DISPATCHED      => [Order::STATUS_DELIVERED, Order::STATUS_CANCELED],
        Order::STATUS_DELIVERED       => [],
        Order::STATUS_CANCELED        => [],
    ];

    /**
     * Lista pedidos da loja (scope=active | history).
     *
     * GET /api/v1/restaurant/orders?scope=active
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $scope = $request->input('scope', 'active');

        $query = Order::where('tenant_id', $tenantId)->with(['items.options']);

        if ($scope === 'history') {
            $query->whereIn('status', [Order::STATUS_DELIVERED, Order::STATUS_CANCELED])
                ->orderBy('created_at', 'desc')
                ->limit(50);
        } else {
            $query->whereNotIn('status', [Order::STATUS_DELIVERED, Order::STATUS_CANCELED])
                ->orderBy('created_at', 'asc');
        }

        if ($channel = $request->input('channel')) {
            $query->where('channel', $channel);
        }

        $orders = $query->get();

        return response()->json([
            'orders' => $orders,
            'total'  => $orders->count(),
        ]);
    }

    /**
     * Detalhe do pedido.
     *
     * GET /api/v1/restaurant/orders/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $order = Order::where('tenant_id', $request->user()->tenant_id)
            ->with(['items.options', 'history'])
            ->findOrFail($id);

        return response()->json(['order' => $order]);
    }

    /**
     * Avança (ou cancela) o pedido registrando no histórico.
     *
     * PATCH /api/v1/restaurant/orders/{id}/status
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $order = Order::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', Rule::in(Order::STATUSES)],
            'notes'  => ['nullable', 'string', 'max:280'],
        ]);

        $allowed = self::TRANSITIONS[$order->status] ?? [];

        if (! in_array($validated['status'], $allowed, true)) {
            return response()->json([
                'message' => "Não dá para levar de {$order->status} para {$validated['status']}.",
            ], 422);
        }

        $from = $order->status;

        DB::transaction(function () use ($order, $tenantId, $validated, $from, $request) {
            $order->update(['status' => $validated['status']]);
            $order->history()->create([
                'tenant_id'   => $tenantId,
                'from_status' => $from,
                'to_status'   => $validated['status'],
                'changed_by'  => $request->user()->id,
                'notes'       => $validated['notes'] ?? null,
            ]);
        });

        return response()->json([
            'message' => 'Pedido atualizado.',
            'order'   => $order->fresh()->load(['items.options', 'history']),
        ]);
    }
}
