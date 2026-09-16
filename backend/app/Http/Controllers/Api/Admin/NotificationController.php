<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Retorna a lista de notificações e eventos da plataforma para o Super Admin.
     *
     * GET /api/v1/admin/notifications
     */
    public function index(Request $request): JsonResponse
    {
        $requests = TenantChangeRequest::with(['tenant', 'requester'])
            ->orderBy('created_at', 'desc')
            ->take(30)
            ->get();

        $notifications = [];

        foreach ($requests as $req) {
            $statusLabels = [
                'pending'             => 'Pendente de Análise',
                'approved'            => 'Aprovada',
                'edited_and_approved' => 'Editada e Aprovada',
                'rejected'            => 'Recusada',
            ];

            $tenantName = $req->tenant?->name ?? 'Restaurante';

            $notifications[] = [
                'id'          => 'cr_' . $req->id,
                'type'        => 'change_request',
                'category'    => 'solicitacao',
                'status'      => $req->status,
                'title'       => "Solicitação de {$tenantName}",
                'message'     => "Solicitação em estado: " . ($statusLabels[$req->status] ?? $req->status) . " por {$req->requester?->name}",
                'admin_notes' => $req->admin_notes,
                'tenant_name' => $tenantName,
                'created_at'  => $req->created_at->toIso8601String(),
                'reviewed_at' => $req->reviewed_at?->toIso8601String(),
            ];
        }

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => count(array_filter($notifications, fn ($n) => $n['status'] === 'pending')),
        ]);
    }
}
