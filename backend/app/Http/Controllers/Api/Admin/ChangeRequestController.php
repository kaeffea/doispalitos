<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantChangeRequest;
use App\Models\User;
use App\Services\StorefrontDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChangeRequestController extends Controller
{
    /**
     * Listagem de solicitações de alteração cadastral.
     *
     * GET /api/v1/admin/change-requests
     */
    public function index(Request $request): JsonResponse
    {
        $query = TenantChangeRequest::with([
            'tenant:id,name,slug,custom_domain',
            'requester:id,name,email',
            'reviewer:id,name,email',
        ])->latest();

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $totalPending = TenantChangeRequest::where('status', 'pending')->count();
        $requests = $query->get();

        return response()->json([
            'change_requests' => $requests,
            'total_pending'   => $totalPending,
            'total'           => $requests->count(),
        ]);
    }

    /**
     * Detalhes de uma solicitação com comparação campo a campo.
     *
     * GET /api/v1/admin/change-requests/{id}
     */
    public function show(string $id): JsonResponse
    {
        $changeRequest = TenantChangeRequest::with([
            'tenant',
            'requester:id,name,email',
            'reviewer:id,name,email',
        ])->findOrFail($id);

        return response()->json([
            'change_request' => $changeRequest,
        ]);
    }

    /**
     * Aprovação direta da solicitação (aplica os dados solicitados no banco).
     *
     * POST /api/v1/admin/change-requests/{id}/approve
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $changeRequest = TenantChangeRequest::findOrFail($id);
        if ($changeRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Esta solicitação já foi analisada anteriormente.',
            ], 422);
        }

        $data = $changeRequest->requested_data;
        $tenant = Tenant::findOrFail($changeRequest->tenant_id);
        $owner = User::where('tenant_id', $tenant->id)->where('role', 'admin')->first() 
              ?? User::where('tenant_id', $tenant->id)->first();

        DB::transaction(function () use ($changeRequest, $tenant, $owner, $data, $request) {
            // Atualiza tenant
            $tenantUpdates = [
                'name'          => $data['name'] ?? $tenant->name,
                'legal_name'    => $data['legal_name'] ?? null,
                'document'      => $data['document'] ?? null,
                'email'         => $data['email'] ?? null,
                'phone'         => $data['phone'] ?? null,
                'postal_code'   => $data['postal_code'] ?? null,
                'street'        => $data['street'] ?? null,
                'number'        => $data['number'] ?? null,
                'complement'    => $data['complement'] ?? null,
                'neighborhood'  => $data['neighborhood'] ?? null,
                'city'          => $data['city'] ?? null,
                'state'         => $data['state'] ?? null,
                'latitude'      => $data['latitude'] ?? null,
                'longitude'     => $data['longitude'] ?? null,
            ];

            if (($data['domain_type'] ?? 'subdomain') === 'subdomain') {
                if (! empty($data['slug'])) {
                    $tenantUpdates['slug'] = Str::lower($data['slug']);
                }
                $tenantUpdates['custom_domain'] = null;
            } else {
                if (! empty($data['custom_domain'])) {
                    $tenantUpdates['custom_domain'] = Str::lower($data['custom_domain']);
                }
            }

            $tenant->update($tenantUpdates);

            // Atualiza gestor
            if ($owner) {
                $owner->update([
                    'name'     => $data['owner_name'] ?? $owner->name,
                    'email'    => $data['owner_email'] ?? $owner->email,
                    'phone'    => $data['owner_phone'] ?? null,
                    'document' => $data['owner_document'] ?? null,
                ]);
            }

            $changeRequest->update([
                'status'               => 'approved',
                'applied_data'         => $data,
                'reviewed_by_user_id'  => $request->user()->id,
                'reviewed_at'          => now(),
            ]);
        });

        // Slug/domínio podem ter mudado: garante na Vercel
        app(StorefrontDomainService::class)->syncTenant($tenant->fresh());

        return response()->json([
            'message'        => 'Solicitação aprovada e dados do restaurante atualizados com sucesso.',
            'change_request' => $changeRequest->fresh(['reviewer']),
        ]);
    }

    /**
     * Recusa da solicitação com justificativa opcional.
     *
     * POST /api/v1/admin/change-requests/{id}/reject
     */
    public function reject(Request $request, string $id): JsonResponse
    {
        $changeRequest = TenantChangeRequest::findOrFail($id);
        if ($changeRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Esta solicitação já foi analisada anteriormente.',
            ], 422);
        }

        $validated = $request->validate([
            'admin_notes' => ['required', 'string', 'min:3', 'max:1000'],
        ], [
            'admin_notes.required' => 'O motivo da recusa é obrigatório.',
            'admin_notes.min'      => 'O motivo deve conter pelo menos 3 caracteres.',
        ]);

        $changeRequest->update([
            'status'               => 'rejected',
            'admin_notes'          => $validated['admin_notes'],
            'reviewed_by_user_id'  => $request->user()->id,
            'reviewed_at'          => now(),
        ]);

        return response()->json([
            'message'        => 'Solicitação de alteração recusada.',
            'change_request' => $changeRequest->fresh(['reviewer']),
        ]);
    }

    /**
     * Edição e aprovação da solicitação pelo Admin.
     *
     * POST /api/v1/admin/change-requests/{id}/edit-and-approve
     */
    public function editAndApprove(Request $request, string $id): JsonResponse
    {
        $changeRequest = TenantChangeRequest::findOrFail($id);
        if ($changeRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Esta solicitação já foi analisada anteriormente.',
            ], 422);
        }

        $tenant = Tenant::findOrFail($changeRequest->tenant_id);
        $owner = User::where('tenant_id', $tenant->id)->where('role', 'admin')->first() 
              ?? User::where('tenant_id', $tenant->id)->first();

        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:255'],
            'legal_name'     => ['nullable', 'string', 'max:255'],
            'document'       => ['nullable', 'string', 'max:20'],
            'domain_type'    => ['required', 'in:subdomain,custom_domain'],
            'slug'           => ['nullable', 'string', 'max:64', 'alpha_dash'],
            'custom_domain'  => ['nullable', 'string', 'max:255'],
            'email'          => ['nullable', 'email', 'max:255'],
            'phone'          => ['nullable', 'string', 'max:30'],
            'postal_code'    => ['nullable', 'string', 'max:10'],
            'street'         => ['nullable', 'string', 'max:255'],
            'number'         => ['nullable', 'string', 'max:20'],
            'complement'     => ['nullable', 'string', 'max:255'],
            'neighborhood'   => ['nullable', 'string', 'max:255'],
            'city'           => ['nullable', 'string', 'max:255'],
            'state'          => ['nullable', 'string', 'max:2'],
            'latitude'       => ['nullable', 'numeric'],
            'longitude'      => ['nullable', 'numeric'],
            'owner_name'     => ['required', 'string', 'max:255'],
            'owner_email'    => ['required', 'email', 'max:255'],
            'owner_phone'    => ['nullable', 'string', 'max:30'],
            'owner_document' => ['nullable', 'string', 'max:20'],
            'admin_notes'    => ['required', 'string', 'min:3', 'max:1000'],
        ], [
            'admin_notes.required' => 'A justificativa das edições realizadas é obrigatória.',
            'admin_notes.min'      => 'A justificativa deve conter pelo menos 3 caracteres.',
        ]);

        DB::transaction(function () use ($changeRequest, $tenant, $owner, $validated, $request) {
            $tenantUpdates = [
                'name'          => $validated['name'],
                'legal_name'    => $validated['legal_name'] ?? null,
                'document'      => $validated['document'] ?? null,
                'email'         => $validated['email'] ?? null,
                'phone'         => $validated['phone'] ?? null,
                'postal_code'   => $validated['postal_code'] ?? null,
                'street'        => $validated['street'] ?? null,
                'number'        => $validated['number'] ?? null,
                'complement'    => $validated['complement'] ?? null,
                'neighborhood'  => $validated['neighborhood'] ?? null,
                'city'          => $validated['city'] ?? null,
                'state'         => $validated['state'] ?? null,
                'latitude'      => $validated['latitude'] ?? null,
                'longitude'     => $validated['longitude'] ?? null,
            ];

            if ($validated['domain_type'] === 'subdomain') {
                if (! empty($validated['slug'])) {
                    $tenantUpdates['slug'] = Str::lower($validated['slug']);
                }
                $tenantUpdates['custom_domain'] = null;
            } else {
                if (! empty($validated['custom_domain'])) {
                    $tenantUpdates['custom_domain'] = Str::lower($validated['custom_domain']);
                }
            }

            $tenant->update($tenantUpdates);

            if ($owner) {
                $owner->update([
                    'name'     => $validated['owner_name'],
                    'email'    => $validated['owner_email'],
                    'phone'    => $validated['owner_phone'] ?? null,
                    'document' => $validated['owner_document'] ?? null,
                ]);
            }

            $changeRequest->update([
                'status'               => 'edited_and_approved',
                'applied_data'         => $validated,
                'admin_notes'          => $validated['admin_notes'] ?? null,
                'reviewed_by_user_id'  => $request->user()->id,
                'reviewed_at'          => now(),
            ]);
        });

        // Slug/domínio podem ter mudado: garante na Vercel
        app(StorefrontDomainService::class)->syncTenant($tenant->fresh());

        return response()->json([
            'message'        => 'Solicitação editada e aprovada com sucesso.',
            'change_request' => $changeRequest->fresh(['reviewer']),
        ]);
    }
}
