<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionGroup;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class StorefrontTest extends TestCase
{
    use DatabaseTransactions;

    protected function makeStore(array $settings = []): Tenant
    {
        $tenant = Tenant::create([
            'name'      => 'Loja Teste',
            'slug'      => 'loja-teste-'.Str::lower(Str::random(8)),
            'is_active' => true,
        ]);

        $base = $tenant->settings;
        $base['delivery'] = array_merge($base['delivery'], [
            'enabled'   => true,
            'fee_mode'  => 'fixed_radius',
            'fixed_fee' => 6.5,
        ]);
        foreach (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as $day) {
            $base['opening_hours'][$day] = ['open' => true, 'start' => '00:00', 'end' => '23:59'];
        }
        foreach ($settings as $k => $v) {
            $base[$k] = $v;
        }
        $tenant->update(['settings' => $base]);

        return $tenant->fresh();
    }

    protected function makeMenu(Tenant $tenant): Product
    {
        $category = Category::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Pizzas',
            'is_active' => true,
        ]);

        $product = Product::create([
            'tenant_id'   => $tenant->id,
            'category_id' => $category->id,
            'name'        => 'Calabresa',
            'price'       => 50,
            'is_available' => true,
        ]);

        $group = ProductOptionGroup::create([
            'tenant_id'   => $tenant->id,
            'product_id'  => $product->id,
            'name'        => 'Borda',
            'min_options' => 1,
            'max_options' => 1,
            'is_required' => true,
        ]);

        ProductOption::create([
            'tenant_id'      => $tenant->id,
            'group_id'       => $group->id,
            'name'           => 'Sem borda',
            'price_modifier' => 0,
            'is_available'   => true,
        ]);

        ProductOption::create([
            'tenant_id'      => $tenant->id,
            'group_id'       => $group->id,
            'name'           => 'Catupiry',
            'price_modifier' => 10,
            'is_available'   => true,
        ]);

        return $product->fresh();
    }

    protected function authToken(Tenant $tenant): string
    {
        $user = User::create([
            'name'      => 'Gestor',
            'email'     => 'gestor-'.Str::lower(Str::random(8)).'@teste.com',
            'password'  => 'password123',
            'tenant_id' => $tenant->id,
            'role'      => 'admin',
        ]);

        return $user->createToken('studio', ['tenant:'.$tenant->id])->plainTextToken;
    }

    public function test_resolve_returns_store_menu_and_open_status(): void
    {
        $tenant = $this->makeStore();
        $this->makeMenu($tenant);

        $res = $this->getJson("/api/v1/storefront/{$tenant->slug}/resolve");

        $res->assertOk()
            ->assertJsonPath('tenant.slug', $tenant->slug)
            ->assertJsonPath('live.is_open', true)
            ->assertJsonPath('menu.products.0.name', 'Calabresa')
            ->assertJsonCount(1, 'menu.categories');
    }

    public function test_resolve_404_for_unknown_slug(): void
    {
        $this->getJson('/api/v1/storefront/loja-que-nao-existe/resolve')->assertNotFound();
    }

    public function test_delivery_fee_fixed_radius(): void
    {
        $tenant = $this->makeStore();

        $res = $this->postJson("/api/v1/storefront/{$tenant->slug}/delivery-fee", [
            'neighborhood' => 'Centro',
        ]);

        $res->assertOk()->assertJsonPath('delivery_fee', 6.5);
    }

    protected function orderPayload(Product $product, array $extra = []): array
    {
        $group = $product->optionGroups->first();
        $option = $group->options()->where('price_modifier', 10)->first();

        return array_merge([
            'customer_name'  => 'Zé Teste',
            'customer_phone' => '11999998888',
            'channel'        => 'pickup',
            'payment_method' => 'cash',
            'items'          => [
                [
                    'product_id' => $product->id,
                    'quantity'   => 2,
                    'options'    => [
                        ['group_id' => $group->id, 'option_ids' => [$option->id]],
                    ],
                ],
            ],
        ], $extra);
    }

    public function test_store_order_recalculates_totals_on_server(): void
    {
        $tenant = $this->makeStore();
        $product = $this->makeMenu($tenant);

        $res = $this->postJson("/api/v1/storefront/{$tenant->slug}/orders", $this->orderPayload($product));

        $res->assertCreated()
            ->assertJsonPath('order.status', 'received')
            ->assertJsonPath('order.subtotal', 120) // (50 + 10) x 2
            ->assertJsonPath('order.delivery_fee', 0)
            ->assertJsonPath('order.total', 120);

        $order = $res->json('order');
        $this->assertNotEmpty($order['public_uuid']);
        $this->assertCount(1, $order['items']);
        $this->assertCount(1, $order['items'][0]['options']);
        $this->assertCount(1, $order['history']);
    }

    public function test_store_order_pix_starts_pending_payment(): void
    {
        $tenant = $this->makeStore();
        $product = $this->makeMenu($tenant);

        $res = $this->postJson(
            "/api/v1/storefront/{$tenant->slug}/orders",
            $this->orderPayload($product, ['payment_method' => 'pix'])
        );

        $res->assertCreated()->assertJsonPath('order.status', 'pending_payment');
    }

    public function test_store_order_rejects_missing_required_options(): void
    {
        $tenant = $this->makeStore();
        $product = $this->makeMenu($tenant);

        $payload = $this->orderPayload($product);
        $payload['items'][0]['options'] = [];

        $this->postJson("/api/v1/storefront/{$tenant->slug}/orders", $payload)
            ->assertStatus(422);
    }

    public function test_track_order_by_uuid(): void
    {
        $tenant = $this->makeStore();
        $product = $this->makeMenu($tenant);

        $created = $this->postJson("/api/v1/storefront/{$tenant->slug}/orders", $this->orderPayload($product));
        $uuid = $created->json('order.public_uuid');

        $this->getJson("/api/v1/storefront/orders/{$uuid}")
            ->assertOk()
            ->assertJsonPath('order.customer_name', 'Zé Teste')
            ->assertJsonPath('store.name', 'Loja Teste');

        $this->getJson('/api/v1/storefront/orders/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }

    public function test_studio_draft_and_publish_flow(): void
    {
        $tenant = $this->makeStore();
        $token = $this->authToken($tenant);

        // Sem token → 401
        $this->getJson('/api/v1/restaurant/storefront')->assertUnauthorized();

        $headers = ['Authorization' => "Bearer {$token}"];

        $draft = [
            'theme'     => ['id' => 'editorial', 'colors' => ['primary' => '#F5DC55']],
            'sections'  => [['id' => 'hero', 'type' => 'hero', 'visible' => true]],
            'overrides' => ['productBadges' => []],
        ];

        $this->putJson('/api/v1/restaurant/storefront', $draft, $headers)->assertOk();

        $show = $this->getJson('/api/v1/restaurant/storefront', $headers)->assertOk();
        $this->assertSame('editorial', $show->json('draft.theme.id'));
        $this->assertNull($show->json('published'));

        // Vitrine pública ainda sem customização
        $resolve = $this->getJson("/api/v1/storefront/{$tenant->slug}/resolve")->assertOk();
        $this->assertNull($resolve->json('storefront'));

        $this->postJson('/api/v1/restaurant/storefront/publish', [], $headers)->assertOk();

        $resolve = $this->getJson("/api/v1/storefront/{$tenant->slug}/resolve")->assertOk();
        $this->assertSame('editorial', $resolve->json('storefront.theme.id'));
        $this->assertSame('hero', $resolve->json('storefront.sections.0.type'));
    }
}
