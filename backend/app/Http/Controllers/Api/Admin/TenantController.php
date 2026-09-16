<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Mail\ManagerAccessMail;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StorefrontDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TenantController extends Controller
{
    /**
     * Listagem de restaurantes (tenants) cadastrados na plataforma.
     *
     * GET /api/v1/admin/tenants
     */
    public function index(Request $request): JsonResponse
    {
        $appDomain = config('app.domain', 'doispalitos.tech');
        $query = Tenant::withCount('users')->latest();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('legal_name', 'ilike', "%{$search}%")
                  ->orWhere('document', 'ilike', "%{$search}%")
                  ->orWhere('slug', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%")
                  ->orWhere('custom_domain', 'ilike', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $tenants = $query->get()->map(function (Tenant $tenant) use ($appDomain) {
            $primaryUrl = $tenant->custom_domain 
                ? $tenant->custom_domain 
                : ($tenant->slug ? $tenant->slug . '.' . $appDomain : null);

            return [
                'id'            => $tenant->id,
                'name'          => $tenant->name,
                'legal_name'    => $tenant->legal_name,
                'document'      => $tenant->document,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'email'         => $tenant->email,
                'phone'         => $tenant->phone,
                'city'          => $tenant->city,
                'state'         => $tenant->state,
                'is_active'     => $tenant->is_active,
                'users_count'   => $tenant->users_count,
                'subdomain'     => $tenant->slug ? $tenant->slug . '.' . $appDomain : null,
                'primary_url'   => $primaryUrl,
                'created_at'    => $tenant->created_at?->format('d/m/Y H:i'),
            ];
        });

        return response()->json([
            'tenants' => $tenants,
            'total'   => $tenants->count(),
        ]);
    }

    /**
     * Cadastro de um novo restaurante + geração automática de senha e envio de e-mail ao gestor.
     *
     * POST /api/v1/admin/tenants
     */
    public function store(Request $request): JsonResponse
    {
        $domainType = $request->input('domain_type', 'subdomain');

        $rules = [
            'name'           => ['required', 'string', 'max:255'],
            'legal_name'     => ['nullable', 'string', 'max:255'],
            'document'       => ['nullable', 'string', 'max:20'],
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
            'admin_name'     => ['required', 'string', 'max:255'],
            'admin_email'    => [
                'required', 'email', 'max:255',
                Rule::unique('users', 'email')->whereNull('deleted_at')
            ],
            'admin_phone'    => ['nullable', 'string', 'max:30'],
            'admin_document' => ['nullable', 'string', 'max:20'],
        ];

        if ($domainType === 'custom_domain') {
            $rules['custom_domain'] = [
                'required', 'string', 'max:255',
                Rule::unique('tenants', 'custom_domain')->whereNull('deleted_at')
            ];
            $rules['slug'] = [
                'nullable', 'string', 'max:64', 'alpha_dash',
                Rule::unique('tenants', 'slug')->whereNull('deleted_at')
            ];
        } else {
            $rules['slug'] = [
                'required', 'string', 'max:64', 'alpha_dash',
                Rule::unique('tenants', 'slug')->whereNull('deleted_at')
            ];
            $rules['custom_domain'] = [
                'nullable', 'string', 'max:255',
                Rule::unique('tenants', 'custom_domain')->whereNull('deleted_at')
            ];
        }

        $validated = $request->validate($rules, [
            'slug.required'          => 'Informe o subdomínio desejado para o restaurante.',
            'slug.unique'            => 'Este subdomínio já está em uso por outro restaurante ativo.',
            'slug.alpha_dash'        => 'O subdomínio deve conter apenas letras, números e hífens.',
            'custom_domain.required' => 'Informe o domínio próprio completo (ex: pedidos.sualoja.com.br).',
            'custom_domain.unique'   => 'Este domínio customizado já está vinculado a outro restaurante ativo.',
            'admin_email.unique'     => 'Este e-mail de gestor já está cadastrado para outro usuário ativo no sistema.',
        ]);

        // Se escolheu domínio próprio e não informou slug, gera um slug técnico único
        $slug = $validated['slug'] ?? null;
        if (! $slug) {
            $baseSlug = Str::slug($validated['name']);
            $slug = $baseSlug;
            $counter = 1;
            while (Tenant::where('slug', $slug)->whereNull('deleted_at')->exists()) {
                $slug = $baseSlug . '-' . $counter++;
            }
        } else {
            $slug = Str::lower($slug);
        }

        $customDomain = ($domainType === 'custom_domain') ? ($validated['custom_domain'] ?? null) : null;

        // Gera senha aleatória segura
        $generatedPassword = Str::password(10, true, true, false, false);

        $result = DB::transaction(function () use ($validated, $slug, $customDomain, $generatedPassword) {
            $tenant = Tenant::create([
                'name'          => $validated['name'],
                'legal_name'    => $validated['legal_name'] ?? null,
                'document'      => $validated['document'] ?? null,
                'slug'          => $slug,
                'custom_domain' => $customDomain,
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
                'is_active'     => true,
            ]);

            $adminUser = User::create([
                'name'      => $validated['admin_name'],
                'email'     => $validated['admin_email'],
                'phone'     => $validated['admin_phone'] ?? null,
                'document'  => $validated['admin_document'] ?? null,
                'password'  => Hash::make($generatedPassword),
                'role'      => 'admin',
                'tenant_id' => $tenant->id,
                'must_change_password' => true,
            ]);

            return [$tenant, $adminUser];
        });

        [$tenant, $adminUser] = $result;
        $appDomain = config('app.domain', 'doispalitos.tech');

        // Dispara e-mail com as credenciais para o gestor
        try {
            Mail::to($adminUser->email)->send(new ManagerAccessMail($tenant, $adminUser, $generatedPassword, false));
        } catch (\Throwable $e) {
            Log::error("Erro ao enviar e-mail de boas-vindas para o gestor {$adminUser->email}: " . $e->getMessage());
        }

        // Registra {slug}.doispalitos.tech (+ domínio próprio) na Vercel
        $domainResult = app(StorefrontDomainService::class)->syncTenant($tenant);

        return response()->json([
            'message'            => 'Restaurante cadastrado com sucesso. E-mail de acesso enviado ao gestor.',
            'generated_password' => $generatedPassword,
            'storefront_domains' => $domainResult,
            'tenant'             => [
                'id'            => $tenant->id,
                'name'          => $tenant->name,
                'legal_name'    => $tenant->legal_name,
                'document'      => $tenant->document,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'subdomain'     => $tenant->slug . '.' . $appDomain,
                'primary_url'   => $tenant->custom_domain ?: ($tenant->slug . '.' . $appDomain),
            ],
            'admin_user'         => [
                'id'       => $adminUser->id,
                'name'     => $adminUser->name,
                'email'    => $adminUser->email,
                'phone'    => $adminUser->phone,
                'document' => $adminUser->document,
                'role'     => $adminUser->role,
            ],
        ], 201);
    }

    /**
     * Detalhes de um restaurante específico (Registro).
     *
     * GET /api/v1/admin/tenants/{id}
     */
    public function show(string $id): JsonResponse
    {
        $appDomain = config('app.domain', 'doispalitos.tech');
        $tenant = Tenant::with(['users' => function ($q) {
            $q->select('id', 'tenant_id', 'name', 'email', 'phone', 'document', 'role', 'created_at');
        }])->findOrFail($id);

        $owner = $tenant->users->firstWhere('role', 'admin') ?? $tenant->users->first();

        return response()->json([
            'tenant' => [
                'id'            => $tenant->id,
                'name'          => $tenant->name,
                'legal_name'    => $tenant->legal_name,
                'document'      => $tenant->document,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'email'         => $tenant->email,
                'phone'         => $tenant->phone,
                'postal_code'   => $tenant->postal_code,
                'street'        => $tenant->street,
                'number'        => $tenant->number,
                'complement'    => $tenant->complement,
                'neighborhood'  => $tenant->neighborhood,
                'city'          => $tenant->city,
                'state'         => $tenant->state,
                'latitude'      => $tenant->latitude,
                'longitude'     => $tenant->longitude,
                'is_active'     => $tenant->is_active,
                'subdomain'     => $tenant->slug ? $tenant->slug . '.' . $appDomain : null,
                'primary_url'   => $tenant->custom_domain ?: ($tenant->slug ? $tenant->slug . '.' . $appDomain : null),
                'settings'      => $tenant->settings,
                'owner'         => $owner ? [
                    'id'         => $owner->id,
                    'name'       => $owner->name,
                    'email'      => $owner->email,
                    'phone'      => $owner->phone,
                    'document'   => $owner->document,
                    'role'       => $owner->role,
                    'created_at' => $owner->created_at?->format('d/m/Y H:i'),
                ] : null,
                'users'         => $tenant->users,
                'created_at'    => $tenant->created_at?->format('d/m/Y H:i'),
                'updated_at'    => $tenant->updated_at?->format('d/m/Y H:i'),
            ],
        ]);
    }

    /**
     * Atualização dos dados cadastrais, domínio, endereço e dados do gestor.
     *
     * PUT /api/v1/admin/tenants/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $owner = User::where('tenant_id', $tenant->id)->where('role', 'admin')->first() 
              ?? User::where('tenant_id', $tenant->id)->first();

        $rules = [
            'name'           => ['sometimes', 'required', 'string', 'max:255'],
            'legal_name'     => ['nullable', 'string', 'max:255'],
            'document'       => ['nullable', 'string', 'max:20'],
            'domain_type'    => ['sometimes', 'required', 'in:subdomain,custom_domain'],
            'slug'           => [
                'nullable', 'string', 'max:64', 'alpha_dash',
                Rule::unique('tenants', 'slug')->ignore($tenant->id)->whereNull('deleted_at')
            ],
            'custom_domain'  => [
                'nullable', 'string', 'max:255',
                Rule::unique('tenants', 'custom_domain')->ignore($tenant->id)->whereNull('deleted_at')
            ],
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
            'is_active'      => ['sometimes', 'boolean'],
            'settings'       => ['sometimes', 'array'],
            // Dados do Gestor
            'owner_name'     => ['sometimes', 'required', 'string', 'max:255'],
            'owner_phone'    => ['nullable', 'string', 'max:30'],
            'owner_document' => ['nullable', 'string', 'max:20'],
            'owner_email'    => [
                'sometimes', 'required', 'email', 'max:255',
                $owner 
                    ? Rule::unique('users', 'email')->ignore($owner->id)->whereNull('deleted_at') 
                    : Rule::unique('users', 'email')->whereNull('deleted_at')
            ],
        ];

        $validated = $request->validate($rules, [
            'slug.unique'          => 'Este subdomínio já está em uso por outro restaurante ativo.',
            'custom_domain.unique' => 'Este domínio customizado já está em uso por outro restaurante ativo.',
            'owner_email.unique'   => 'Este e-mail já pertence a outro usuário ativo no sistema.',
        ]);

        DB::transaction(function () use ($tenant, $owner, $validated, $request) {
            $tenantUpdates = [];

            if (isset($validated['name'])) $tenantUpdates['name'] = $validated['name'];
            if (array_key_exists('legal_name', $validated)) $tenantUpdates['legal_name'] = $validated['legal_name'];
            if (array_key_exists('document', $validated)) $tenantUpdates['document'] = $validated['document'];
            if (array_key_exists('email', $validated)) $tenantUpdates['email'] = $validated['email'];
            if (array_key_exists('phone', $validated)) $tenantUpdates['phone'] = $validated['phone'];
            if (array_key_exists('postal_code', $validated)) $tenantUpdates['postal_code'] = $validated['postal_code'];
            if (array_key_exists('street', $validated)) $tenantUpdates['street'] = $validated['street'];
            if (array_key_exists('number', $validated)) $tenantUpdates['number'] = $validated['number'];
            if (array_key_exists('complement', $validated)) $tenantUpdates['complement'] = $validated['complement'];
            if (array_key_exists('neighborhood', $validated)) $tenantUpdates['neighborhood'] = $validated['neighborhood'];
            if (array_key_exists('city', $validated)) $tenantUpdates['city'] = $validated['city'];
            if (array_key_exists('state', $validated)) $tenantUpdates['state'] = $validated['state'];
            if (array_key_exists('latitude', $validated)) $tenantUpdates['latitude'] = $validated['latitude'];
            if (array_key_exists('longitude', $validated)) $tenantUpdates['longitude'] = $validated['longitude'];
            if (isset($validated['is_active'])) $tenantUpdates['is_active'] = $validated['is_active'];
            if (isset($validated['settings'])) $tenantUpdates['settings'] = $validated['settings'];

            $domainType = $request->input('domain_type');
            if ($domainType === 'subdomain') {
                if (! empty($validated['slug'])) {
                    $tenantUpdates['slug'] = Str::lower($validated['slug']);
                }
                $tenantUpdates['custom_domain'] = null;
            } elseif ($domainType === 'custom_domain') {
                if (! empty($validated['custom_domain'])) {
                    $tenantUpdates['custom_domain'] = Str::lower($validated['custom_domain']);
                }
            } elseif (array_key_exists('slug', $validated) || array_key_exists('custom_domain', $validated)) {
                if (isset($validated['slug'])) $tenantUpdates['slug'] = Str::lower($validated['slug']);
                if (array_key_exists('custom_domain', $validated)) $tenantUpdates['custom_domain'] = $validated['custom_domain'];
            }

            if (! empty($tenantUpdates)) {
                $tenant->update($tenantUpdates);
            }

            if ($owner) {
                $ownerUpdates = [];
                if (isset($validated['owner_name'])) $ownerUpdates['name'] = $validated['owner_name'];
                if (isset($validated['owner_email'])) $ownerUpdates['email'] = $validated['owner_email'];
                if (array_key_exists('owner_phone', $validated)) $ownerUpdates['phone'] = $validated['owner_phone'];
                if (array_key_exists('owner_document', $validated)) $ownerUpdates['document'] = $validated['owner_document'];

                if (! empty($ownerUpdates)) {
                    $owner->update($ownerUpdates);
                }
            }
        });

        $appDomain = config('app.domain', 'doispalitos.tech');
        $freshTenant = $tenant->fresh();
        $freshOwner = User::where('tenant_id', $tenant->id)->where('role', 'admin')->first() 
                   ?? User::where('tenant_id', $tenant->id)->first();

        // Slug/domínio podem ter mudado: garante na Vercel
        app(StorefrontDomainService::class)->syncTenant($freshTenant);

        return response()->json([
            'message' => 'Ficha do restaurante e dados do gestor atualizados com sucesso.',
            'tenant'  => [
                'id'            => $freshTenant->id,
                'name'          => $freshTenant->name,
                'legal_name'    => $freshTenant->legal_name,
                'document'      => $freshTenant->document,
                'slug'          => $freshTenant->slug,
                'custom_domain' => $freshTenant->custom_domain,
                'subdomain'     => $freshTenant->slug ? $freshTenant->slug . '.' . $appDomain : null,
                'primary_url'   => $freshTenant->custom_domain ?: ($freshTenant->slug ? $freshTenant->slug . '.' . $appDomain : null),
                'email'         => $freshTenant->email,
                'phone'         => $freshTenant->phone,
                'is_active'     => $freshTenant->is_active,
                'owner'         => $freshOwner ? [
                    'id'       => $freshOwner->id,
                    'name'     => $freshOwner->name,
                    'email'    => $freshOwner->email,
                    'phone'    => $freshOwner->phone,
                    'document' => $freshOwner->document,
                    'role'     => $freshOwner->role,
                ] : null,
            ],
        ]);
    }

    /**
     * Gera uma nova senha aleatória e dispara por e-mail para o gestor.
     *
     * POST /api/v1/admin/tenants/{id}/reset-password
     */
    public function resetPassword(string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $owner = User::where('tenant_id', $tenant->id)->where('role', 'admin')->first() 
              ?? User::where('tenant_id', $tenant->id)->first();

        if (! $owner) {
            return response()->json([
                'message' => 'Nenhum usuário gestor encontrado para este restaurante.',
            ], 404);
        }

        $newPassword = Str::password(10, true, true, false, false);
        $owner->update([
            'password' => Hash::make($newPassword),
            'must_change_password' => true,
        ]);

        // Revoga tokens anteriores de sessão do gestor
        $owner->tokens()->delete();

        try {
            Mail::to($owner->email)->send(new ManagerAccessMail($tenant, $owner, $newPassword, true));
        } catch (\Throwable $e) {
            Log::error("Erro ao enviar e-mail de redefinição de senha para {$owner->email}: " . $e->getMessage());
        }

        return response()->json([
            'message'            => "Uma nova senha foi gerada e enviada para {$owner->email}.",
            'generated_password' => $newPassword,
        ]);
    }

    /**
     * Alternar status de ativação do restaurante.
     *
     * PATCH /api/v1/admin/tenants/{id}/toggle-status
     */
    public function toggleStatus(string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $tenant->update(['is_active' => ! $tenant->is_active]);

        return response()->json([
            'message'   => $tenant->is_active ? 'Restaurante ativado.' : 'Restaurante desativado.',
            'is_active' => $tenant->is_active,
        ]);
    }

    /**
     * Exclusão segura (Soft Delete) do restaurante e seus usuários associados.
     *
     * DELETE /api/v1/admin/tenants/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        DB::transaction(function () use ($tenant) {
            // Revoga tokens de todos os usuários do restaurante
            $tenant->users()->each(fn($u) => $u->tokens()->delete());
            // Soft delete dos usuários do restaurante
            $tenant->users()->delete();
            // Soft delete do restaurante
            $tenant->delete();
        });

        return response()->json([
            'message' => 'Restaurante arquivado com sucesso.',
        ]);
    }
}
