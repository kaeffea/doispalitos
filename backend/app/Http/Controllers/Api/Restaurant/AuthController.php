<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login do Operador / Gestor do Restaurante.
     *
     * POST /api/v1/restaurant/login
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['E-mail ou senha inválidos.'],
            ]);
        }

        if (! in_array($user->role, ['admin', 'manager', 'kitchen'])) {
            return response()->json([
                'message' => 'Acesso não autorizado para esta área.',
            ], 403);
        }

        if (! $user->tenant_id) {
            return response()->json([
                'message' => 'Usuário não está vinculado a nenhum restaurante.',
            ], 403);
        }

        $tenant = Tenant::find($user->tenant_id);

        if (! $tenant || ! $tenant->is_active) {
            return response()->json([
                'message' => 'Este restaurante está inativo ou suspenso na plataforma.',
            ], 403);
        }

        // Se a requisição veio por um subdomínio/domínio específico (TenantMiddleware), valida se o usuário pertence a este tenant
        if ($request->has('_tenant') && $request->_tenant->id !== $tenant->id) {
            return response()->json([
                'message' => 'Credenciais não pertencem a este restaurante.',
            ], 403);
        }

        // Cria o token de sessão do Sanctum com escopo tenant
        $token = $user->createToken('restaurant-session-token', ['tenant:' . $tenant->id])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'                   => $user->id,
                'name'                 => $user->name,
                'email'                => $user->email,
                'role'                 => $user->role,
                'must_change_password' => (bool) $user->must_change_password,
            ],
            'tenant' => [
                'id'            => $tenant->id,
                'name'          => $tenant->name,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'subdomain'     => $tenant->slug . '.' . config('app.domain', 'doispalitos.tech'),
                'is_active'     => $tenant->is_active,
                'settings'      => $tenant->settings,
            ],
        ]);
    }

    /**
     * Retorna os dados do usuário autenticado e seu restaurante.
     *
     * GET /api/v1/restaurant/me
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = Tenant::find($user->tenant_id);

        return response()->json([
            'user' => [
                'id'                   => $user->id,
                'name'                 => $user->name,
                'email'                => $user->email,
                'role'                 => $user->role,
                'must_change_password' => (bool) $user->must_change_password,
            ],
            'tenant' => $tenant ? [
                'id'            => $tenant->id,
                'name'          => $tenant->name,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'subdomain'     => $tenant->slug . '.' . config('app.domain', 'doispalitos.tech'),
                'is_active'     => $tenant->is_active,
                'settings'      => $tenant->settings,
            ] : null,
        ]);
    }

    /**
     * Altera a senha do usuário autenticado (primeiro acesso ou redefinição forçada).
     *
     * POST /api/v1/restaurant/change-password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.required'  => 'A nova senha é obrigatória.',
            'password.min'       => 'A nova senha deve conter pelo menos 8 caracteres.',
            'password.confirmed' => 'A confirmação de senha não confere.',
        ]);

        $user = $request->user();
        $user->password = Hash::make($request->password);
        $user->must_change_password = false;
        $user->save();

        return response()->json([
            'message' => 'Senha alterada com sucesso.',
            'user'    => [
                'id'                   => $user->id,
                'name'                 => $user->name,
                'email'                => $user->email,
                'role'                 => $user->role,
                'must_change_password' => false,
            ],
        ]);
    }

    /**
     * Encerra a sessão do usuário.
     *
     * POST /api/v1/restaurant/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sessão encerrada com sucesso.',
        ]);
    }
}
