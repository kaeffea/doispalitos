<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\StorefrontDomainService;
use Illuminate\Console\Command;

class SyncStorefrontDomains extends Command
{
    protected $signature = 'tenants:sync-storefront-domains {--slug= : Sincroniza apenas este slug}';

    protected $description = 'Registra {slug}.doispalitos.tech (+ domínio próprio) de cada restaurante ativo no projeto storefront da Vercel';

    public function handle(StorefrontDomainService $service): int
    {
        if (! $service->enabled()) {
            $this->error('Configure VERCEL_TOKEN e VERCEL_PROJECT_ID no .env primeiro.');

            return self::FAILURE;
        }

        $query = Tenant::where('is_active', true)->orderBy('slug');
        if ($slug = $this->option('slug')) {
            $query->where('slug', $slug);
        }

        $rows = [];
        foreach ($query->get() as $tenant) {
            $result = $service->syncTenant($tenant);
            $rows[] = [
                $tenant->slug,
                $tenant->custom_domain ?? '—',
                implode(', ', $result['added']) ?: '—',
                implode(', ', $result['already']) ?: '—',
                implode(', ', $result['failed']) ?: '—',
            ];
        }

        $this->table(['Slug', 'Domínio próprio', 'Adicionados', 'Já existiam', 'Falhas'], $rows);

        return self::SUCCESS;
    }
}
