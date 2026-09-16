<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\TenantChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Retorna a lista de notificações e histórico de eventos para o restaurante.
     *
     * GET /api/v1/restaurant/notifications
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $requests = TenantChangeRequest::where('tenant_id', $tenantId)
            ->with(['reviewer'])
            ->orderBy('created_at', 'desc')
            ->take(30)
            ->get();

        $notifications = [];

        foreach ($requests as $req) {
            $statusTitles = [
                'pending'             => 'Solicitação em Análise',
                'approved'            => 'Solicitação de Alteração Aprovada',
                'edited_and_approved' => 'Solicitação Aprovada com Ajustes',
                'rejected'            => 'Solicitação de Alteração Recusada',
            ];

            $statusMessages = [
                'pending'             => 'Sua solicitação de alteração cadastral foi enviada e aguarda análise da administração.',
                'approved'            => 'As alterações solicitadas foram aprovadas e já estão ativas no seu restaurante.',
                'edited_and_approved' => 'As alterações foram aprovadas pela administração com ajustes pontuais.' . ($req->admin_notes ? " Justificativa: {$req->admin_notes}" : ''),
                'rejected'            => 'Sua solicitação foi recusada.' . ($req->admin_notes ? " Motivo informado: {$req->admin_notes}" : ''),
            ];

            $notifications[] = [
                'id'          => 'cr_' . $req->id,
                'type'        => 'change_request',
                'category'    => 'cadastro',
                'status'      => $req->status,
                'title'       => $statusTitles[$req->status] ?? 'Solicitação Cadastral',
                'message'     => $statusMessages[$req->status] ?? '',
                'admin_notes' => $req->admin_notes,
                'reviewer'    => $req->reviewer?->name,
                'created_at'  => $req->created_at->toIso8601String(),
                'reviewed_at' => $req->reviewed_at?->toIso8601String(),
            ];
        }

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => count(array_filter($notifications, fn ($n) => $n['status'] !== 'pending')),
        ]);
    }
}
