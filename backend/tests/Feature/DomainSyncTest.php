<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class DomainSyncTest extends TestCase
{
    use DatabaseTransactions;

    protected function superToken(): string
    {
        $user = User::create([
            'name'     => 'Super',
            'email'    => 'super-'.Str::lower(Str::random(8)).'@teste.com',
            'password' => 'password123',
            'role'     => 'super_admin',
        ]);

        return $user->createToken('admin', ['super_admin'])->plainTextToken;
    }

    protected function tenantPayload(string $slug): array
    {
        return [
            'name'        => 'Loja Domínio',
            'slug'        => $slug,
            'admin_name'  => 'Gestor',
            'admin_email' => 'gestor-'.Str::lower(Str::random(8)).'@teste.com',
        ];
    }

    public function test_creating_tenant_registers_subdomain_on_vercel(): void
    {
        Config::set('services.vercel.token', 'fake-token');
        Config::set('services.vercel.project', 'doispalitos-storefront');
        Http::fake(['api.vercel.com/*' => Http::response(['name' => 'x'], 200)]);

        $slug = 'doceria-'.Str::lower(Str::random(6));
        $this->postJson('/api/v1/admin/tenants', $this->tenantPayload($slug), [
            'Authorization' => 'Bearer '.$this->superToken(),
        ])->assertCreated();

        Http::assertSent(function ($request) use ($slug) {
            return $request->method() === 'POST'
                && str_ends_with($request->url(), '/domains')
                && $request['name'] === $slug.'.doispalitos.tech';
        });
    }

    public function test_updating_slug_syncs_new_domain(): void
    {
        Config::set('services.vercel.token', 'fake-token');
        Config::set('services.vercel.project', 'doispalitos-storefront');
        Http::fake(['api.vercel.com/*' => Http::response(['name' => 'x'], 200)]);

        $slug = 'padaria-'.Str::lower(Str::random(6));
        $created = $this->postJson('/api/v1/admin/tenants', $this->tenantPayload($slug), [
            'Authorization' => 'Bearer '.$this->superToken(),
        ])->assertCreated();

        $newSlug = 'padaria-nova-'.Str::lower(Str::random(6));
        $this->putJson('/api/v1/admin/tenants/'.$created->json('tenant.id'), [
            'domain_type' => 'subdomain',
            'slug'        => $newSlug,
        ], ['Authorization' => 'Bearer '.$this->superToken()])->assertOk();

        Http::assertSent(function ($request) use ($newSlug) {
            return $request->method() === 'POST' && ($request['name'] ?? null) === $newSlug.'.doispalitos.tech';
        });
    }

    public function test_without_token_nothing_is_sent(): void
    {
        Config::set('services.vercel.token', null);
        Http::fake();

        $this->postJson('/api/v1/admin/tenants', $this->tenantPayload('sem-token-'.Str::lower(Str::random(6))), [
            'Authorization' => 'Bearer '.$this->superToken(),
        ])->assertCreated();

        Http::assertNothingSent();
    }

    public function test_vercel_conflict_counts_as_synced(): void
    {
        Config::set('services.vercel.token', 'fake-token');
        Config::set('services.vercel.project', 'doispalitos-storefront');
        Http::fake(['api.vercel.com/*' => Http::response(['error' => ['code' => 'domain_already_in_use']], 409)]);

        $res = $this->postJson('/api/v1/admin/tenants', $this->tenantPayload('duplo-'.Str::lower(Str::random(6))), [
            'Authorization' => 'Bearer '.$this->superToken(),
        ])->assertCreated();

        $this->assertContains(
            $res->json('storefront_domains.already.0'),
            [$res->json('tenant.subdomain')]
        );
        $this->assertTrue(Tenant::where('slug', $res->json('tenant.slug'))->exists());
    }

    public function test_transient_vercel_error_is_retried_once(): void
    {
        Config::set('services.vercel.token', 'fake-token');
        Config::set('services.vercel.project', 'doispalitos-storefront');
        Http::fake([
            'api.vercel.com/*' => Http::sequence()
                ->pushStatus(500)
                ->push(['name' => 'x'], 200),
        ]);

        $slug = 'instavel-'.Str::lower(Str::random(6));
        $res = $this->postJson('/api/v1/admin/tenants', $this->tenantPayload($slug), [
            'Authorization' => 'Bearer '.$this->superToken(),
        ])->assertCreated();

        $this->assertContains($slug.'.doispalitos.tech', $res->json('storefront_domains.added'));
        Http::assertSentCount(2);
    }
}
