<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderFlowTest extends TestCase
{
    use DatabaseTransactions;

    protected function makeStore(): array
    {
        $tenant = Tenant::create([
            'name'      => 'Loja Kanban',
            'slug'      => 'loja-kanban-'.Str::lower(Str::random(8)),
            'is_active' => true,
        ]);

        $category = Category::create(['tenant_id' => $tenant->id, 'name' => 'Pizzas', 'is_active' => true]);
        $product = Product::create([
            'tenant_id'   => $tenant->id,
            'category_id' => $category->id,
            'name'        => 'Calabresa',
            'price'       => 50,
            'is_available' => true,
        ]);

        $user = User::create([
            'name'      => 'Cozinha',
            'email'     => 'cozinha-'.Str::lower(Str::random(8)).'@teste.com',
            'password'  => 'password123',
            'tenant_id' => $tenant->id,
            'role'      => 'manager',
        ]);
        $token = $user->createToken('kanban', ['tenant:'.$tenant->id])->plainTextToken;

        $orderRes = $this->postJson("/api/v1/storefront/{$tenant->slug}/orders", [
            'customer_name'  => 'Cliente',
            'customer_phone' => '11999998888',
            'channel'        => 'pickup',
            'payment_method' => 'cash',
            'items'          => [['product_id' => $product->id, 'quantity' => 1]],
        ]);
        $orderRes->assertCreated();

        return [$tenant, $token, $orderRes->json('order.id')];
    }

    public function test_kitchen_lists_active_orders(): void
    {
        [$tenant, $token] = $this->makeStore();

        $this->getJson('/api/v1/restaurant/orders', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonCount(1, 'orders')
            ->assertJsonPath('orders.0.status', 'received');

        // Loja vizinha não vaza
        [$other, $otherToken] = $this->makeStore();
        $this->getJson('/api/v1/restaurant/orders', ['Authorization' => "Bearer {$otherToken}"])
            ->assertOk()
            ->assertJsonCount(1, 'orders');
    }

    public function test_full_kanban_flow_with_history(): void
    {
        [$tenant, $token, $id] = $this->makeStore();
        $h = ['Authorization' => "Bearer {$token}"];

        foreach (['preparing', 'ready_for_dispatch', 'dispatched', 'delivered'] as $next) {
            $this->patchJson("/api/v1/restaurant/orders/{$id}/status", ['status' => $next], $h)
                ->assertOk()
                ->assertJsonPath('order.status', $next);
        }

        $show = $this->getJson("/api/v1/restaurant/orders/{$id}", $h)->assertOk();
        // 1 criação + 4 transições
        $this->assertCount(5, $show->json('order.history'));

        // Finalizado sai do ativo e entra no histórico
        $this->getJson('/api/v1/restaurant/orders?scope=active', $h)->assertJsonCount(0, 'orders');
        $this->getJson('/api/v1/restaurant/orders?scope=history', $h)->assertJsonCount(1, 'orders');
    }

    public function test_invalid_transition_is_rejected(): void
    {
        [$tenant, $token, $id] = $this->makeStore();
        $h = ['Authorization' => "Bearer {$token}"];

        // received → delivered pula etapas
        $this->patchJson("/api/v1/restaurant/orders/{$id}/status", ['status' => 'delivered'], $h)
            ->assertStatus(422);

        // cancelar funciona e trava o pedido
        $this->patchJson("/api/v1/restaurant/orders/{$id}/status", ['status' => 'canceled'], $h)->assertOk();
        $this->patchJson("/api/v1/restaurant/orders/{$id}/status", ['status' => 'preparing'], $h)
            ->assertStatus(422);
    }

    public function test_orders_require_restaurant_auth(): void
    {
        [$tenant, $token, $id] = $this->makeStore();

        $this->getJson('/api/v1/restaurant/orders')->assertUnauthorized();
        $this->patchJson("/api/v1/restaurant/orders/{$id}/status", ['status' => 'preparing'])
            ->assertUnauthorized();
    }
}
