<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\InventorySupplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventorySupplierController extends Controller
{
    /**
     * Listagem de fornecedores cadastrados na loja.
     * GET /api/v1/restaurant/inventory/suppliers
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $suppliers = InventorySupplier::where('tenant_id', $tenantId)
            ->withCount('packagings')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json([
            'suppliers' => $suppliers,
            'total'     => $suppliers->count(),
        ]);
    }

    /**
     * Cadastro de fornecedor ou canal de compra.
     * POST /api/v1/restaurant/inventory/suppliers
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'contact_name'    => ['nullable', 'string', 'max:255'],
            'phone_whatsapp'  => ['nullable', 'string', 'max:50'],
            'email'           => ['nullable', 'email', 'max:255'],
            'supplier_type'   => ['required', 'string', 'in:distributor,wholesaler,local_market,e_commerce,other'],
            'order_days'      => ['nullable', 'array'],
            'min_order_value' => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string', 'max:1000'],
            'is_active'       => ['sometimes', 'boolean'],
        ]);

        $supplier = InventorySupplier::create([
            'tenant_id'       => $tenantId,
            'name'            => $validated['name'],
            'contact_name'    => $validated['contact_name'] ?? null,
            'phone_whatsapp'  => $validated['phone_whatsapp'] ?? null,
            'email'           => $validated['email'] ?? null,
            'supplier_type'   => $validated['supplier_type'] ?? 'wholesaler',
            'order_days'      => $validated['order_days'] ?? null,
            'min_order_value' => $validated['min_order_value'] ?? 0,
            'notes'           => $validated['notes'] ?? null,
            'is_active'       => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message'  => 'Fornecedor cadastrado com sucesso.',
            'supplier' => $supplier,
        ], 201);
    }

    /**
     * Atualização de fornecedor.
     * PUT /api/v1/restaurant/inventory/suppliers/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $supplier = InventorySupplier::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'name'            => ['sometimes', 'required', 'string', 'max:255'],
            'contact_name'    => ['nullable', 'string', 'max:255'],
            'phone_whatsapp'  => ['nullable', 'string', 'max:50'],
            'email'           => ['nullable', 'email', 'max:255'],
            'supplier_type'   => ['sometimes', 'required', 'string', 'in:distributor,wholesaler,local_market,e_commerce,other'],
            'order_days'      => ['nullable', 'array'],
            'min_order_value' => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string', 'max:1000'],
            'is_active'       => ['sometimes', 'boolean'],
        ]);

        $supplier->update($validated);

        return response()->json([
            'message'  => 'Fornecedor atualizado com sucesso.',
            'supplier' => $supplier->fresh(),
        ]);
    }

    /**
     * Exclusão de fornecedor.
     * DELETE /api/v1/restaurant/inventory/suppliers/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $supplier = InventorySupplier::where('tenant_id', $tenantId)->findOrFail($id);
        $supplier->delete();

        return response()->json([
            'message' => 'Fornecedor removido com sucesso.',
        ]);
    }
}
