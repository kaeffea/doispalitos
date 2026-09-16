<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Registra os hostnames da vitrine ({slug}.doispalitos.tech e domínio
 * próprio) no projeto storefront da Vercel via API.
 *
 * Conta Hobby não tem wildcard, então cada restaurante precisa do seu
 * registro — este serviço torna isso automático e idempotente.
 * Nunca estoura exceção: falha de rede/API só gera log.
 */
class StorefrontDomainService
{
    public function enabled(): bool
    {
        return (bool) (config('services.vercel.token') && config('services.vercel.project'));
    }

    /**
     * Hostnames que a loja deve responder.
     *
     * @return string[]
     */
    public function desiredHostnames(Tenant $tenant): array
    {
        $hosts = [];
        $appDomain = strtolower((string) config('app.domain', 'doispalitos.tech'));

        if ($tenant->slug) {
            $hosts[] = strtolower($tenant->slug).'.'.$appDomain;
        }
        if ($tenant->custom_domain) {
            $hosts[] = strtolower($tenant->custom_domain);
        }

        return array_values(array_unique($hosts));
    }

    /**
     * Garante todos os hostnames no projeto. Idempotente.
     *
     * @return array{added: string[], already: string[], failed: string[], skipped: bool}
     */
    public function syncTenant(Tenant $tenant): array
    {
        $result = ['added' => [], 'already' => [], 'failed' => [], 'skipped' => false];

        if (! $this->enabled()) {
            $result['skipped'] = true;

            return $result;
        }

        foreach ($this->desiredHostnames($tenant) as $host) {
            try {
                $state = $this->addDomain($host);
            } catch (\Throwable $e) {
                // API da Vercel oscila: uma nova tentativa antes de desistir
                sleep(2);
                try {
                    $state = $this->addDomain($host);
                } catch (\Throwable $retry) {
                    Log::warning("Vercel: falha ao registrar {$host} (2 tentativas): ".$retry->getMessage());
                    $result['failed'][] = $host;
                    continue;
                }
            }
            $result[$state][] = $host;
        }

        return $result;
    }

    /**
     * Remove hostnames (best-effort, ex: restaurante arquivado).
     */
    public function removeTenant(Tenant $tenant): void
    {
        if (! $this->enabled()) {
            return;
        }

        foreach ($this->desiredHostnames($tenant) as $host) {
            try {
                $this->client()->delete($this->projectPath('/domains/'.urlencode($host)));
            } catch (\Throwable $e) {
                Log::warning("Vercel: falha ao remover {$host}: ".$e->getMessage());
            }
        }
    }

    /**
     * @return 'added'|'already'
     *
     * @throws \RuntimeException
     */
    protected function addDomain(string $host): string
    {
        $response = $this->client()->post($this->projectPath('/domains'), ['name' => $host]);

        if ($response->successful()) {
            return 'added';
        }

        $code = (string) $response->json('error.code', '');
        if (str_starts_with($code, 'domain_already')) {
            return 'already';
        }

        throw new \RuntimeException("Vercel {$response->status()}: {$response->body()}");
    }

    protected function projectPath(string $suffix): string
    {
        $url = 'https://api.vercel.com/v10/projects/'.config('services.vercel.project').$suffix;

        if ($teamId = config('services.vercel.team_id')) {
            $url .= '?teamId='.urlencode((string) $teamId);
        }

        return $url;
    }

    protected function client(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::withToken((string) config('services.vercel.token'))
            ->timeout(10)
            ->acceptJson();
    }
}
