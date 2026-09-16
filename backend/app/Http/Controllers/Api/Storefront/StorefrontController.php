<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StorefrontController extends Controller
{
    /* ─── Resolução da loja pelo slug (subdomínio futuro) ─── */

    protected function resolveTenant(string $slug): Tenant
    {
        $slug = mb_strtolower(trim($slug));

        // Subdomínios são minúsculos por natureza: compara sem case
        // para nunca 404 por 'Pizzaria-Demo' vs 'pizzaria-demo'.
        $tenant = Tenant::whereRaw('LOWER(slug) = ?', [$slug])
            ->where('is_active', true)
            ->first();

        if (! $tenant) {
            abort(response()->json(['message' => 'Restaurante não encontrado.'], 404));
        }

        return $tenant;
    }

    protected function isOpenNow(Tenant $tenant): bool
    {
        $settings = $tenant->settings;

        if (! empty($settings['live_status']['is_manually_closed'])) {
            return false;
        }

        $day = strtolower(now('America/Sao_Paulo')->format('l'));
        $hours = $settings['opening_hours'][$day] ?? null;

        if (empty($hours['open']) || empty($hours['start']) || empty($hours['end'])) {
            return false;
        }

        $now = now('America/Sao_Paulo')->format('H:i');

        // Suporta virada de dia (ex: 18:00 → 02:00)
        if ($hours['end'] < $hours['start']) {
            return $now >= $hours['start'] || $now <= $hours['end'];
        }

        return $now >= $hours['start'] && $now <= $hours['end'];
    }

    protected function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * $r * asin(sqrt($a));
    }

    /**
     * Loja + vitrine publicada + cardápio em 1 request (cacheável).
     *
     * GET /api/v1/storefront/{slug}/resolve
     */
    public function resolve(string $slug): JsonResponse
    {
        return response()->json($this->payload($this->resolveTenant($slug)));
    }

    /**
     * Mesma coisa, resolvendo pelo Host (subdomínio ou domínio próprio).
     * É o que a vitrine estática na Vercel usa: ela não tem servidor,
     * então manda o hostname e o backend diz qual loja é.
     *
     * GET /api/v1/storefront/by-host
     */
    public function resolveByHost(Request $request): JsonResponse
    {
        $host = strtolower($request->getHost());
        $appDomain = strtolower((string) config('app.domain', 'doispalitos.tech'));

        if (str_ends_with($host, '.'.$appDomain)) {
            $slug = substr($host, 0, -(strlen($appDomain) + 1));
            if ($slug !== '' && $slug !== 'www' && $slug !== 'api' && $slug !== 'app' && $slug !== 'adm') {
                return response()->json($this->payload($this->resolveTenant($slug)));
            }
        }

        $tenant = Tenant::whereRaw('LOWER(custom_domain) = ?', [$host])->where('is_active', true)->first();

        if (! $tenant) {
            abort(response()->json(['message' => 'Restaurante não encontrado.'], 404));
        }

        return response()->json($this->payload($tenant));
    }

    protected function payload(Tenant $tenant): array
    {
        $settings = $tenant->settings;

        $storefront = $tenant->storefront()->first();

        $categories = Category::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc')
            ->get(['id', 'name', 'description', 'sort_order']);

        $products = Product::where('tenant_id', $tenant->id)
            ->with(['optionGroups.options'])
            ->orderBy('sort_order', 'asc')
            ->get();

        return [
            'tenant' => [
                'name'          => $tenant->name,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'phone'         => $tenant->phone,
                'street'        => $tenant->street,
                'number'        => $tenant->number,
                'complement'    => $tenant->complement,
                'neighborhood'  => $tenant->neighborhood,
                'city'          => $tenant->city,
                'state'         => $tenant->state,
                'latitude'      => $tenant->latitude,
                'longitude'     => $tenant->longitude,
            ],
            'settings' => [
                'delivery'        => $settings['delivery'] ?? [],
                'pickup'          => $settings['pickup'] ?? [],
                'dine_in'         => $settings['dine_in'] ?? [],
                'opening_hours'   => $settings['opening_hours'] ?? [],
                'payment_methods' => $settings['payment_methods'] ?? [],
            ],
            'live' => [
                'is_open'          => $this->isOpenNow($tenant),
                'prep_time_min'    => $settings['live_status']['delivery_prep_time'] ?? null,
                'is_manually_closed' => (bool) ($settings['live_status']['is_manually_closed'] ?? false),
            ],
            'storefront' => $storefront && $storefront->is_published ? [
                'theme'     => $storefront->published_theme,
                'sections'  => $storefront->published_sections,
                'overrides' => $storefront->published_overrides,
            ] : null,
            'menu' => [
                'categories' => $categories,
                'products'   => $products,
            ],
        ];
    }

    /* ─── Cálculo de frete pelas regras da loja ─── */

    protected function calculateFee(Tenant $tenant, array $input): float
    {
        $delivery = $tenant->settings['delivery'] ?? [];

        if (empty($delivery['enabled'])) {
            throw ValidationException::withMessages(['channel' => 'Este restaurante não faz entregas no momento.']);
        }

        $mode = $delivery['fee_mode'] ?? 'fixed_radius';

        if ($mode === 'custom_neighborhoods') {
            $name = mb_strtolower(trim($input['neighborhood'] ?? ''));
            foreach ($delivery['neighborhood_fees'] ?? [] as $fee) {
                if (empty($fee['enabled'])) {
                    continue;
                }
                if (mb_strtolower(trim($fee['name'] ?? '')) === $name && $name !== '') {
                    return round((float) $fee['fee'], 2);
                }
            }
            throw ValidationException::withMessages(['address.neighborhood' => 'Ainda não entregamos neste bairro.']);
        }

        if ($mode === 'dynamic_km') {
            $distance = isset($input['distance_km'])
                ? (float) $input['distance_km']
                : $this->distanceFromCoords($tenant, $input);

            if ($distance === null) {
                throw ValidationException::withMessages(['address' => 'Não foi possível calcular a distância de entrega.']);
            }

            $max = $delivery['max_distance_km'] ?? null;
            if ($max !== null && $distance > (float) $max) {
                throw ValidationException::withMessages(['address' => 'Endereço fora da área de entrega.']);
            }

            $base = (float) ($delivery['dynamic_base_fee'] ?? 0);
            $perKm = (float) ($delivery['dynamic_fee_per_km'] ?? 0);

            return round($base + $perKm * $distance, 2);
        }

        // fixed_radius (padrão)
        if (isset($input['latitude'], $input['longitude']) && $tenant->latitude && $tenant->longitude) {
            $distance = $this->haversineKm(
                (float) $tenant->latitude, (float) $tenant->longitude,
                (float) $input['latitude'], (float) $input['longitude']
            );
            $max = $delivery['max_distance_km'] ?? null;
            if ($max !== null && $distance > (float) $max) {
                throw ValidationException::withMessages(['address' => 'Endereço fora da área de entrega.']);
            }
        }

        return round((float) ($delivery['fixed_fee'] ?? 0), 2);
    }

    protected function distanceFromCoords(Tenant $tenant, array $input): ?float
    {
        if (! isset($input['latitude'], $input['longitude']) || ! $tenant->latitude || ! $tenant->longitude) {
            return null;
        }

        return $this->haversineKm(
            (float) $tenant->latitude, (float) $tenant->longitude,
            (float) $input['latitude'], (float) $input['longitude']
        );
    }

    /**
     * POST /api/v1/storefront/{slug}/delivery-fee
     */
    public function deliveryFee(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolveTenant($slug);

        $validated = $request->validate([
            'neighborhood' => ['nullable', 'string', 'max:120'],
            'latitude'     => ['nullable', 'numeric'],
            'longitude'    => ['nullable', 'numeric'],
            'distance_km'  => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        return response()->json([
            'delivery_fee' => $this->calculateFee($tenant, $validated),
        ]);
    }

    /* ─── Criação de pedido (preços sempre recalculados no servidor) ─── */

    /**
     * POST /api/v1/storefront/{slug}/orders
     */
    public function storeOrder(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolveTenant($slug);

        $validated = $request->validate([
            'customer_name'  => ['required', 'string', 'max:120'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'channel'        => ['required', Rule::in(Order::CHANNELS)],
            'address'        => ['required_if:channel,delivery', 'nullable', 'array'],
            'address.street'       => ['nullable', 'string', 'max:255'],
            'address.number'       => ['nullable', 'string', 'max:20'],
            'address.complement'   => ['nullable', 'string', 'max:120'],
            'address.neighborhood' => ['nullable', 'string', 'max:120'],
            'address.city'         => ['nullable', 'string', 'max:120'],
            'address.postal_code'  => ['nullable', 'string', 'max:20'],
            'address.latitude'     => ['nullable', 'numeric'],
            'address.longitude'    => ['nullable', 'numeric'],
            'address.distance_km'  => ['nullable', 'numeric', 'min:0', 'max:100'],
            'table_number'   => ['required_if:channel,dine_in', 'nullable', 'string', 'max:20'],
            'payment_method' => ['required', Rule::in(Order::PAYMENTS)],
            'change_for'     => ['nullable', 'numeric', 'min:0'],
            'notes'          => ['nullable', 'string', 'max:500'],
            'items'          => ['required', 'array', 'min:1', 'max:30'],
            'items.*.product_id' => ['required', 'uuid', Rule::exists('products', 'id')->where('tenant_id', $tenant->id)],
            'items.*.quantity'   => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.notes'      => ['nullable', 'string', 'max:280'],
            'items.*.options'    => ['sometimes', 'array'],
            'items.*.options.*.group_id'   => ['required', 'uuid'],
            'items.*.options.*.option_ids' => ['required', 'array'],
            'items.*.options.*.option_ids.*' => ['required', 'uuid'],
        ]);

        $products = Product::where('tenant_id', $tenant->id)
            ->whereIn('id', collect($validated['items'])->pluck('product_id')->unique())
            ->with(['optionGroups.options'])
            ->get()
            ->keyBy('id');

        $subtotal = 0;
        $lines = [];

        foreach ($validated['items'] as $item) {
            $product = $products->get($item['product_id']);

            if (! $product || ! $product->is_available) {
                throw ValidationException::withMessages([
                    'items' => "O item {$item['product_id']} não está mais disponível.",
                ]);
            }

            $unit = (float) $product->price;
            $picked = [];

            foreach ($item['options'] ?? [] as $opt) {
                $group = $product->optionGroups->firstWhere('id', $opt['group_id']);

                if (! $group) {
                    throw ValidationException::withMessages(['items' => 'Grupo de opcional inválido.']);
                }

                $count = count($opt['option_ids']);
                if ($count < $group->min_options || $count > $group->max_options) {
                    throw ValidationException::withMessages([
                        'items' => "O grupo {$group->name} permite de {$group->min_options} a {$group->max_options} opções.",
                    ]);
                }

                foreach ($opt['option_ids'] as $optionId) {
                    $option = $group->options->firstWhere('id', $optionId);
                    if (! $option || ! $option->is_available) {
                        throw ValidationException::withMessages(['items' => 'Opção indisponível no momento.']);
                    }
                    $unit += (float) $option->price_modifier;
                    $picked[] = [
                        'group_name'     => $group->name,
                        'option_name'    => $option->name,
                        'price_modifier' => (float) $option->price_modifier,
                    ];
                }
            }

            // Grupos obrigatórios não enviados
            foreach ($product->optionGroups as $group) {
                if ($group->min_options > 0) {
                    $sent = collect($item['options'] ?? [])->firstWhere('group_id', $group->id);
                    if (! $sent) {
                        throw ValidationException::withMessages([
                            'items' => "Escolha ao menos {$group->min_options} opção em {$group->name}.",
                        ]);
                    }
                }
            }

            $lineTotal = round($unit * $item['quantity'], 2);
            $subtotal += $lineTotal;

            $lines[] = [
                'product' => $product,
                'quantity' => $item['quantity'],
                'notes'    => $item['notes'] ?? null,
                'unit'     => round($unit, 2),
                'total'    => $lineTotal,
                'picked'   => $picked,
            ];
        }

        $deliveryFee = 0;
        if ($validated['channel'] === 'delivery') {
            $addr = $validated['address'] ?? [];
            $deliveryFee = $this->calculateFee($tenant, [
                'neighborhood' => $addr['neighborhood'] ?? null,
                'latitude'     => $addr['latitude'] ?? null,
                'longitude'    => $addr['longitude'] ?? null,
                'distance_km'  => $addr['distance_km'] ?? null,
            ]);
        }

        $minOrder = $tenant->settings['delivery']['min_order_amount'] ?? null;
        if ($validated['channel'] === 'delivery' && $minOrder !== null && $subtotal < (float) $minOrder) {
            throw ValidationException::withMessages([
                'items' => 'Pedido mínimo para entrega: R$ '.number_format((float) $minOrder, 2, ',', '.'),
            ]);
        }

        $status = $validated['payment_method'] === 'pix'
            ? Order::STATUS_PENDING_PAYMENT
            : Order::STATUS_RECEIVED;

        $order = DB::transaction(function () use ($tenant, $validated, $lines, $subtotal, $deliveryFee, $status) {
            $order = Order::create([
                'tenant_id'      => $tenant->id,
                'public_uuid'    => (string) Str::uuid(),
                'customer_name'  => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'channel'        => $validated['channel'],
                'address'        => $validated['channel'] === 'delivery' ? ($validated['address'] ?? null) : null,
                'table_number'   => $validated['channel'] === 'dine_in' ? ($validated['table_number'] ?? null) : null,
                'payment_method' => $validated['payment_method'],
                'payment_detail' => isset($validated['change_for']) ? ['change_for' => (float) $validated['change_for']] : null,
                'subtotal'       => round($subtotal, 2),
                'delivery_fee'   => $deliveryFee,
                'discount'       => 0,
                'total'          => round($subtotal + $deliveryFee, 2),
                'status'         => $status,
                'prep_time_min'  => $tenant->settings['live_status']['delivery_prep_time'] ?? null,
                'notes'          => $validated['notes'] ?? null,
            ]);

            foreach ($lines as $line) {
                $orderItem = $order->items()->create([
                    'tenant_id'  => $tenant->id,
                    'product_id' => $line['product']->id,
                    'name'       => $line['product']->name,
                    'unit_price' => $line['unit'],
                    'quantity'   => $line['quantity'],
                    'subtotal'   => $line['total'],
                    'notes'      => $line['notes'],
                ]);

                foreach ($line['picked'] as $picked) {
                    $orderItem->options()->create([
                        'tenant_id'      => $tenant->id,
                        'group_name'     => $picked['group_name'],
                        'option_name'    => $picked['option_name'],
                        'price_modifier' => $picked['price_modifier'],
                    ]);
                }
            }

            $order->history()->create([
                'tenant_id'   => $tenant->id,
                'from_status' => null,
                'to_status'   => $status,
            ]);

            return $order;
        });

        return response()->json([
            'order' => $order->load(['items.options', 'history']),
        ], 201);
    }

    /**
     * Acompanhamento público do pedido.
     *
     * GET /api/v1/storefront/orders/{uuid}
     */
    public function track(string $uuid): JsonResponse
    {
        $order = Order::where('public_uuid', $uuid)
            ->with(['items.options', 'history'])
            ->firstOrFail();

        $tenant = $order->tenant;

        return response()->json([
            'order' => $order,
            'store' => [
                'name'  => $tenant->name,
                'phone' => $tenant->phone,
            ],
        ]);
    }
}
