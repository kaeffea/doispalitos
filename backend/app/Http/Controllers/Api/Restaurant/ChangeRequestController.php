<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantChangeRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChangeRequestController extends Controller
{
    /**
     * Retorna a solicitação mais recente do restaurante (pendente ou respondida).
     *
     * GET /api/v1/restaurant/change-requests/latest
     */
    public function latest(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        if (! $tenantId) {
            return response()->json(['message' => 'Restaurante não identificado.'], 403);
        }

        $latestRequest = TenantChangeRequest::where('tenant_id', $tenantId)
            ->with(['requester:id,name,email', 'reviewer:id,name,email'])
            ->latest()
            ->first();

        return response()->json([
            'change_request' => $latestRequest,
        ]);
    }

    /**
     * Cria uma nova solicitação de alteração cadastral para aprovação do Super Admin.
     *
     * POST /api/v1/restaurant/change-requests
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;
        if (! $tenantId) {
            return response()->json(['message' => 'Restaurante não identificado.'], 403);
        }

        // Verifica se já existe uma solicitação pendente
        $existingPending = TenantChangeRequest::where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->first();

        if ($existingPending) {
            return response()->json([
                'message' => 'Já existe uma solicitação de alteração cadastral pendente de análise para este restaurante.',
            ], 422);
        }

        $tenant = Tenant::findOrFail($tenantId);
        $owner = User::where('tenant_id', $tenant->id)->where('role', 'admin')->first() 
              ?? $user;

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
        ]);

        $currentData = [
            'name'           => $tenant->name,
            'legal_name'     => $tenant->legal_name,
            'document'       => $tenant->document,
            'domain_type'    => $tenant->custom_domain ? 'custom_domain' : 'subdomain',
            'slug'           => $tenant->slug,
            'custom_domain'  => $tenant->custom_domain,
            'email'          => $tenant->email,
            'phone'          => $tenant->phone,
            'postal_code'    => $tenant->postal_code,
            'street'         => $tenant->street,
            'number'         => $tenant->number,
            'complement'     => $tenant->complement,
            'neighborhood'   => $tenant->neighborhood,
            'city'           => $tenant->city,
            'state'          => $tenant->state,
            'latitude'       => $tenant->latitude,
            'longitude'      => $tenant->longitude,
            'owner_name'     => $owner->name,
            'owner_email'    => $owner->email,
            'owner_phone'    => $owner->phone,
            'owner_document' => $owner->document,
        ];

        $requestedData = [
            'name'           => $validated['name'],
            'legal_name'     => $validated['legal_name'] ?? null,
            'document'       => $validated['document'] ?? null,
            'domain_type'    => $validated['domain_type'],
            'slug'           => $validated['domain_type'] === 'subdomain' ? Str::lower($validated['slug'] ?? '') : null,
            'custom_domain'  => $validated['domain_type'] === 'custom_domain' ? Str::lower($validated['custom_domain'] ?? '') : null,
            'email'          => $validated['email'] ?? null,
            'phone'          => $validated['phone'] ?? null,
            'postal_code'    => $validated['postal_code'] ?? null,
            'street'         => $validated['street'] ?? null,
            'number'         => $validated['number'] ?? null,
            'complement'     => $validated['complement'] ?? null,
            'neighborhood'   => $validated['neighborhood'] ?? null,
            'city'           => $validated['city'] ?? null,
            'state'          => $validated['state'] ?? null,
            'latitude'       => $validated['latitude'] ?? null,
            'longitude'      => $validated['longitude'] ?? null,
            'owner_name'     => $validated['owner_name'],
            'owner_email'    => $validated['owner_email'],
            'owner_phone'    => $validated['owner_phone'] ?? null,
            'owner_document' => $validated['owner_document'] ?? null,
        ];

        $changeRequest = TenantChangeRequest::create([
            'tenant_id'            => $tenant->id,
            'requested_by_user_id' => $user->id,
            'status'               => 'pending',
            'current_data'         => $currentData,
            'requested_data'       => $requestedData,
        ]);

        return response()->json([
            'message'        => 'Solicitação de alteração cadastral enviada com sucesso para análise do Super Admin.',
            'change_request' => $changeRequest,
        ], 201);
    }
}
