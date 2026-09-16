<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    /**
     * Listagem de produtos do cardápio com opções e categoria.
     *
     * GET /api/v1/restaurant/products
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $query = Product::where('tenant_id', $tenantId)
            ->with(['category', 'optionGroups.options'])
            ->orderBy('sort_order', 'asc')
            ->latest();

        if ($categoryId = $request->input('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        if ($request->has('is_available')) {
            $query->where('is_available', filter_var($request->input('is_available'), FILTER_VALIDATE_BOOLEAN));
        }

        $products = $query->get();

        return response()->json([
            'products' => $products,
            'total'    => $products->count(),
        ]);
    }

    /**
     * Cadastro de produto com grupos de opcionais/adicionais.
     *
     * POST /api/v1/restaurant/products
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $validated = $request->validate([
            'category_id'             => ['required', 'uuid', Rule::exists('categories', 'id')->where('tenant_id', $tenantId)],
            'name'                    => ['required', 'string', 'max:255'],
            'description'             => ['nullable', 'string', 'max:1000'],
            'price'                   => ['required', 'numeric', 'min:0'],
            'product_type'            => ['sometimes', 'string', 'max:50'],
            'metadata'                => ['nullable', 'array'],
            'image_url'               => ['nullable', 'string', 'max:1000'],
            'is_available'            => ['sometimes', 'boolean'],
            'is_featured'             => ['sometimes', 'boolean'],
            'sort_order'              => ['sometimes', 'integer'],
            'option_groups'           => ['sometimes', 'array'],
            'option_groups.*.name'    => ['required', 'string', 'max:120'],
            'option_groups.*.min'     => ['required', 'integer', 'min:0'],
            'option_groups.*.max'     => ['required', 'integer', 'min:1'],
            'option_groups.*.is_req'  => ['sometimes', 'boolean'],
            'option_groups.*.options' => ['sometimes', 'array'],
            'option_groups.*.options.*.name'      => ['required', 'string', 'max:120'],
            'option_groups.*.options.*.price'     => ['required', 'numeric', 'min:0'],
            'option_groups.*.options.*.image_url' => ['nullable', 'string', 'max:1000'],
        ]);

        $product = DB::transaction(function () use ($tenantId, $validated) {
            $maxSort = Product::where('tenant_id', $tenantId)->max('sort_order') ?? 0;

            $prod = Product::create([
                'tenant_id'    => $tenantId,
                'category_id'  => $validated['category_id'],
                'name'         => $validated['name'],
                'description'  => $validated['description'] ?? null,
                'price'        => $validated['price'],
                'product_type' => $validated['product_type'] ?? 'standard',
                'metadata'     => $validated['metadata'] ?? null,
                'image_url'    => $validated['image_url'] ?? null,
                'is_available' => $validated['is_available'] ?? true,
                'is_featured'  => $validated['is_featured'] ?? false,
                'sort_order'   => $validated['sort_order'] ?? ($maxSort + 1),
            ]);

            if (! empty($validated['option_groups'])) {
                foreach ($validated['option_groups'] as $gIndex => $gData) {
                    $group = ProductOptionGroup::create([
                        'tenant_id'   => $tenantId,
                        'product_id'  => $prod->id,
                        'name'        => $gData['name'],
                        'min_options' => $gData['min'] ?? 0,
                        'max_options' => $gData['max'] ?? 1,
                        'is_required' => $gData['is_req'] ?? (($gData['min'] ?? 0) > 0),
                        'sort_order'  => $gIndex + 1,
                    ]);

                    if (! empty($gData['options'])) {
                        foreach ($gData['options'] as $oIndex => $oData) {
                            ProductOption::create([
                                'tenant_id'      => $tenantId,
                                'group_id'       => $group->id,
                                'name'           => $oData['name'],
                                'price_modifier' => $oData['price'] ?? 0,
                                'image_url'      => $oData['image_url'] ?? null,
                                'is_available'   => true,
                                'sort_order'     => $oIndex + 1,
                            ]);
                        }
                    }
                }
            }

            return $prod;
        });

        return response()->json([
            'message' => 'Produto criado com sucesso.',
            'product' => $product->load(['category', 'optionGroups.options']),
        ], 201);
    }

    /**
     * Consulta detalhada de produto.
     *
     * GET /api/v1/restaurant/products/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $product = Product::where('tenant_id', $tenantId)
            ->with(['category', 'optionGroups.options'])
            ->findOrFail($id);

        return response()->json([
            'product' => $product,
        ]);
    }

    /**
     * Atualização completa de produto e seus grupos de opcionais.
     *
     * PUT /api/v1/restaurant/products/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $product = Product::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'category_id'             => ['sometimes', 'required', 'uuid', Rule::exists('categories', 'id')->where('tenant_id', $tenantId)],
            'name'                    => ['sometimes', 'required', 'string', 'max:255'],
            'description'             => ['nullable', 'string', 'max:1000'],
            'price'                   => ['sometimes', 'required', 'numeric', 'min:0'],
            'product_type'            => ['sometimes', 'string', 'max:50'],
            'metadata'                => ['nullable', 'array'],
            'image_url'               => ['nullable', 'string', 'max:1000'],
            'is_available'            => ['sometimes', 'boolean'],
            'is_featured'             => ['sometimes', 'boolean'],
            'sort_order'              => ['sometimes', 'integer'],
            'option_groups'           => ['sometimes', 'array'],
            'option_groups.*.name'    => ['required', 'string', 'max:120'],
            'option_groups.*.min'     => ['required', 'integer', 'min:0'],
            'option_groups.*.max'     => ['required', 'integer', 'min:1'],
            'option_groups.*.is_req'  => ['sometimes', 'boolean'],
            'option_groups.*.options' => ['sometimes', 'array'],
            'option_groups.*.options.*.name'      => ['required', 'string', 'max:120'],
            'option_groups.*.options.*.price'     => ['required', 'numeric', 'min:0'],
            'option_groups.*.options.*.image_url' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($tenantId, $product, $validated) {
            $product->update([
                'category_id'  => $validated['category_id'] ?? $product->category_id,
                'name'         => $validated['name'] ?? $product->name,
                'description'  => array_key_exists('description', $validated) ? $validated['description'] : $product->description,
                'price'        => $validated['price'] ?? $product->price,
                'product_type' => $validated['product_type'] ?? $product->product_type,
                'metadata'     => array_key_exists('metadata', $validated) ? $validated['metadata'] : $product->metadata,
                'image_url'    => array_key_exists('image_url', $validated) ? $validated['image_url'] : $product->image_url,
                'is_available' => $validated['is_available'] ?? $product->is_available,
                'is_featured'  => $validated['is_featured'] ?? $product->is_featured,
                'sort_order'   => $validated['sort_order'] ?? $product->sort_order,
            ]);

            if (array_key_exists('option_groups', $validated)) {
                $existingGroups = $product->optionGroups;
                foreach ($existingGroups as $eg) {
                    $eg->options()->delete();
                    $eg->delete();
                }

                foreach ($validated['option_groups'] as $gIndex => $gData) {
                    $group = ProductOptionGroup::create([
                        'tenant_id'   => $tenantId,
                        'product_id'  => $product->id,
                        'name'        => $gData['name'],
                        'min_options' => $gData['min'] ?? 0,
                        'max_options' => $gData['max'] ?? 1,
                        'is_required' => $gData['is_req'] ?? (($gData['min'] ?? 0) > 0),
                        'sort_order'  => $gIndex + 1,
                    ]);

                    if (! empty($gData['options'])) {
                        foreach ($gData['options'] as $oIndex => $oData) {
                            ProductOption::create([
                                'tenant_id'      => $tenantId,
                                'group_id'       => $group->id,
                                'name'           => $oData['name'],
                                'price_modifier' => $oData['price'] ?? 0,
                                'image_url'      => $oData['image_url'] ?? null,
                                'is_available'   => true,
                                'sort_order'     => $oIndex + 1,
                            ]);
                        }
                    }
                }
            }
        });

        return response()->json([
            'message' => 'Produto atualizado com sucesso.',
            'product' => $product->fresh()->load(['category', 'optionGroups.options']),
        ]);
    }

    /**
     * Alternar disponibilidade de produto com 1 clique (para esgotados).
     *
     * PATCH /api/v1/restaurant/products/{id}/toggle-availability
     */
    public function toggleAvailability(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $product = Product::where('tenant_id', $tenantId)->findOrFail($id);
        $product->update(['is_available' => ! $product->is_available]);

        return response()->json([
            'message'      => $product->is_available ? 'Produto ativado para pedidos.' : 'Produto marcado como esgotado/pausado.',
            'is_available' => $product->is_available,
        ]);
    }

    /**
     * Upload seguro de foto para pratos do cardápio.
     *
     * POST /api/v1/restaurant/products/upload-image
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $request->validate([
            'image' => [
                'required',
                'file',
                'image',
                'mimes:jpeg,png,jpg,webp,avif',
                'max:5120', // Máximo 5MB
            ],
        ]);

        $file = $request->file('image');

        // Validação estrita de tipo MIME binário real
        $mime = $file->getMimeType();
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
        if (! in_array($mime, $allowedMimes)) {
            return response()->json([
                'message' => 'Tipo de arquivo inválido. Envie apenas imagens JPG, PNG ou WEBP.',
            ], 422);
        }

        // Sanitização de nome com hash aleatório
        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $safeExtension = in_array(strtolower($extension), ['jpg', 'jpeg', 'png', 'webp', 'avif']) ? strtolower($extension) : 'jpg';
        $filename = \Illuminate\Support\Str::random(32) . '.' . $safeExtension;

        // Salva na pasta do tenant em storage/app/public/products/{tenantId}
        $path = $file->storeAs("products/{$tenantId}", $filename, 'public');

        $imageUrl = \Illuminate\Support\Facades\Storage::disk('public')->url($path);

        return response()->json([
            'message'   => 'Foto enviada com sucesso.',
            'image_url' => $imageUrl,
            'path'      => $path,
        ]);
    }

    /**
     * Exclusão de produto (Soft Delete) e seus grupos de opcionais.
     *
     * DELETE /api/v1/restaurant/products/{id}
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $product = Product::where('tenant_id', $tenantId)->findOrFail($id);

        DB::transaction(function () use ($product) {
            foreach ($product->optionGroups as $group) {
                $group->options()->delete();
                $group->delete();
            }
            $product->delete();
        });

        return response()->json([
            'message' => 'Produto removido do cardápio com sucesso.',
        ]);
    }
}
