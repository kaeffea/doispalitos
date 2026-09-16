<?php

namespace App\Http\Controllers\Api\Restaurant;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SettingsController extends Controller
{
    /**
     * Retorna as configurações operacionais e dados do restaurante autenticado.
     *
     * GET /api/v1/restaurant/settings
     */
    public function show(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($request->user()->tenant_id);
        $owner = \App\Models\User::where('tenant_id', $tenant->id)->where('role', 'admin')->first()
              ?? $request->user();

        return response()->json([
            'tenant'   => [
                'id'            => $tenant->id,
                'name'          => $tenant->name,
                'legal_name'    => $tenant->legal_name,
                'document'      => $tenant->document,
                'slug'          => $tenant->slug,
                'custom_domain' => $tenant->custom_domain,
                'subdomain'     => $tenant->slug . '.' . config('app.domain', 'doispalitos.tech'),
                'email'         => $tenant->email,
                'phone'         => $tenant->phone,
                'street'        => $tenant->street,
                'number'        => $tenant->number,
                'complement'    => $tenant->complement,
                'neighborhood'  => $tenant->neighborhood,
                'city'          => $tenant->city ?: 'São Paulo',
                'state'         => $tenant->state ?: 'SP',
                'postal_code'   => $tenant->postal_code,
                'latitude'      => $tenant->latitude,
                'longitude'     => $tenant->longitude,
                'owner'         => [
                    'name'     => $owner->name,
                    'email'    => $owner->email,
                    'phone'    => $owner->phone,
                    'document' => $owner->document,
                ],
            ],
            'settings' => $tenant->settings,
        ]);
    }

    /**
     * Retorna a lista de bairros disponíveis para a cidade do restaurante.
     *
     * GET /api/v1/restaurant/neighborhoods
     */
    public function neighborhoods(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($request->user()->tenant_id);
        $city = $tenant->city ?: 'São Paulo';
        $state = $tenant->state ?: 'SP';

        $neighborhoods = $this->getNeighborhoodsForCity($city, $state);

        return response()->json([
            'city'          => $city,
            'state'         => $state,
            'neighborhoods' => $neighborhoods,
        ]);
    }

    /**
     * Atualiza as regras operacionais (entrega, retirada, horários, pagamentos, geolocalização).
     *
     * PUT /api/v1/restaurant/settings
     */
    public function update(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($request->user()->tenant_id);

        $validated = $request->validate([
            'latitude'                                        => ['nullable', 'numeric'],
            'longitude'                                       => ['nullable', 'numeric'],
            'settings'                                        => ['required', 'array'],
            'settings.delivery'                               => ['sometimes', 'array'],
            'settings.delivery.enabled'                       => ['sometimes', 'boolean'],
            'settings.delivery.fee_mode'                      => ['nullable', 'in:fixed_radius,dynamic_km,custom_neighborhoods'],
            'settings.delivery.max_distance_km'               => ['nullable', 'numeric', 'min:0'],
            'settings.delivery.fixed_fee'                     => ['nullable', 'numeric', 'min:0'],
            'settings.delivery.dynamic_base_fee'              => ['nullable', 'numeric', 'min:0'],
            'settings.delivery.dynamic_fee_per_km'            => ['nullable', 'numeric', 'min:0'],
            'settings.delivery.min_order_amount'              => ['nullable', 'numeric', 'min:0'],
            'settings.delivery.neighborhood_fees'             => ['sometimes', 'array'],
            'settings.delivery.neighborhood_fees.*.name'      => ['required', 'string'],
            'settings.delivery.neighborhood_fees.*.fee'       => ['required', 'numeric', 'min:0'],
            'settings.delivery.neighborhood_fees.*.enabled'   => ['required', 'boolean'],
            'settings.delivery.neighborhood_fees.*.latitude'  => ['nullable', 'numeric'],
            'settings.delivery.neighborhood_fees.*.longitude' => ['nullable', 'numeric'],
            'settings.pickup'                                 => ['sometimes', 'array'],
            'settings.pickup.enabled'                         => ['sometimes', 'boolean'],
            'settings.dine_in'                                => ['sometimes', 'array'],
            'settings.dine_in.enabled'                        => ['sometimes', 'boolean'],
            'settings.opening_hours'                          => ['sometimes', 'array'],
            'settings.opening_hours.*.open'                   => ['sometimes', 'boolean'],
            'settings.opening_hours.*.start'                  => ['nullable', 'string'],
            'settings.opening_hours.*.end'                    => ['nullable', 'string'],
            'settings.payment_methods'                        => ['sometimes', 'array'],
            'settings.onboarding_completed'                   => ['sometimes', 'boolean'],
            'settings.live_status'                            => ['sometimes', 'array'],
        ]);

        $currentSettings = $tenant->settings ?? [];
        $mergedSettings = array_replace_recursive($currentSettings, $validated['settings']);

        // Preserve explicit booleans for onboarding_completed and flags
        if (array_key_exists('onboarding_completed', $validated['settings'])) {
            $mergedSettings['onboarding_completed'] = (bool) $validated['settings']['onboarding_completed'];
        }

        $tenantUpdates = ['settings' => $mergedSettings];
        if (array_key_exists('latitude', $validated)) {
            $tenantUpdates['latitude'] = $validated['latitude'];
        }
        if (array_key_exists('longitude', $validated)) {
            $tenantUpdates['longitude'] = $validated['longitude'];
        }

        $tenant->update($tenantUpdates);

        return response()->json([
            'message'  => 'Configurações operacionais salvas com sucesso.',
            'settings' => $tenant->fresh()->settings,
            'tenant'   => $tenant->fresh(),
        ]);
    }

    /**
     * Ajuste rápido do tempo dinâmico de preparo da cozinha em tempo real.
     *
     * PATCH /api/v1/restaurant/prep-time
     */
    public function updatePrepTime(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($request->user()->tenant_id);

        $validated = $request->validate([
            'delivery_prep_time' => ['required', 'integer', 'min:5', 'max:240'],
        ]);

        $currentSettings = $tenant->settings;
        $currentSettings['live_status'] = $currentSettings['live_status'] ?? [];
        $currentSettings['live_status']['delivery_prep_time'] = $validated['delivery_prep_time'];

        $tenant->update(['settings' => $currentSettings]);

        return response()->json([
            'message'     => 'Tempo de cozinha atualizado.',
            'live_status' => $currentSettings['live_status'],
        ]);
    }

    /**
     * Atualização do status ao vivo (abertura/pausa manual e tempo de cozinha).
     *
     * PATCH /api/v1/restaurant/live-status
     */
    public function updateLiveStatus(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail($request->user()->tenant_id);

        $validated = $request->validate([
            'is_manually_closed' => ['sometimes', 'boolean'],
            'delivery_prep_time' => ['sometimes', 'nullable', 'integer', 'min:5', 'max:240'],
        ]);

        $currentSettings = $tenant->settings ?? [];
        $currentSettings['live_status'] = $currentSettings['live_status'] ?? [];

        if (array_key_exists('is_manually_closed', $validated)) {
            $currentSettings['live_status']['is_manually_closed'] = (bool) $validated['is_manually_closed'];
        }
        if (array_key_exists('delivery_prep_time', $validated)) {
            $currentSettings['live_status']['delivery_prep_time'] = $validated['delivery_prep_time'];
        }

        $tenant->update(['settings' => $currentSettings]);

        return response()->json([
            'message'     => 'Status operacional atualizado com sucesso.',
            'live_status' => $currentSettings['live_status'],
            'settings'    => $tenant->fresh()->settings,
        ]);
    }

    /**
     * Retorna bairros pré-cadastrados ou descobertos para a cidade do restaurante.
     */
    private function getNeighborhoodsForCity(string $city, string $state): array
    {
        $cleanCity = trim($city);
        $cleanState = mb_strtoupper(trim($state));
        $normalizedCity = mb_strtolower($cleanCity);

        // Catálogo abrangente com cidades de AL, PE, BA, CE, SE, SP, RJ, MG, PR, RS, DF, etc.
        $database = [
            'são miguel dos campos' => [
                'Centro', 'Hélio Jatobá I', 'Hélio Jatobá II', 'Hélio Jatobá III', 'Humberto Alves (Terreno)',
                'Geraldo Sampaio (Loteamento)', 'Paraíso', 'Coité', 'Edgar Palmeira', 'Bela Vista',
                'Esther Soares Torres', 'Nova São Miguel', 'Jaciélio', 'Canto da Saudade', 'Aldeia', 'São Sebastião'
            ],
            'maceió' => [
                'Pajuçara', 'Ponta Verde', 'Jatiúca', 'Cruz das Almas', 'Mangabeiras', 'Farol', 'Pinheiro',
                'Pitanguinha', 'Gruta de Lourdes', 'Serraria', 'Antares', 'Barro Duro', 'Benedito Bentes',
                'Tabuleiro do Martins', 'Jaraguá', 'Centro', 'Poço', 'Jacintinho', 'Trapiche da Barra', 'Ponta da Terra'
            ],
            'arapiraca' => [
                'Centro', 'Alto do Cruzeiro', 'Baixa Grande', 'Brasília', 'Capiatã', 'Eldorado', 'Jardim Esperança',
                'Novo Horizonte', 'Planalto', 'Santa Edwiges', 'Senador Teotônio Vilela', 'São Luiz', 'Zélia Barbosa Rocha'
            ],
            'rio largo' => [
                'Centro', 'Aeroporto', 'Gustavo Paiva', 'Lourenço de Albuquerque', 'Mutirão', 'Taboão', 'Cachoeira'
            ],
            'palmeira dos índios' => [
                'Centro', 'São Francisco', 'Palmeira de Fora', 'Vila Maria', 'São Cristóvão', 'Jardim Brasil', 'Juca Sampaio'
            ],
            'penedo' => [
                'Centro Histórico', 'Santa Luzia', 'Senador Arnon de Mello', 'Dom Constantino', 'Raimundo Marinho', 'Santo Antônio'
            ],
            'união dos palmares' => [
                'Centro', 'Roberto Correia de Araújo', 'Nova Esperança', 'Rocha Cavalcante', 'Santa Fé', 'COHAB'
            ],
            'recife' => [
                'Boa Viagem', 'Pina', 'Setúbal', 'Graças', 'Espinheiro', 'Jaqueira', 'Casa Forte', 'Poço da Panela',
                'Parnamirim', 'Madalena', 'Torre', 'Derby', 'Ilha do Leite', 'Boa Vista', 'Santo Antônio', 'Recife Antigo'
            ],
            'salvador' => [
                'Barra', 'Graça', 'Vitória', 'Ondina', 'Rio Vermelho', 'Pituba', 'Itaigara', 'Caminho das Árvores',
                'Horto Florestal', 'Campo Grande', 'Brotas', 'Imbuí', 'Stella Maris', 'Cabula', 'Patamares'
            ],
            'fortaleza' => [
                'Aldeota', 'Meireles', 'Varjota', 'Mucuripe', 'Praia de Iracema', 'Cocó', 'Papicu', 'Dionísio Torres',
                'Fátima', 'Benfica', 'Centro', 'Montese', 'Parquelândia', 'Guararapes', 'Engenheiro Luciano Cavalcante'
            ],
            'aracaju' => [
                'Centro', 'Atalaia', '13 de Julho', 'Jardins', 'Grageru', 'Salgado Filho', 'Luzia', 'Farolândia', 'Aruana', 'Inácio Barbosa'
            ],
            'joão pessoa' => [
                'Tambaú', 'Cabo Branco', 'Manaíra', 'Bessa', 'Altiplano', 'Miramar', 'Bancários', 'Centro', 'Aeroclube', 'Torre'
            ],
            'natal' => [
                'Ponta Negra', 'Tirol', 'Petrópolis', 'Candelária', 'Capim Macio', 'Lagoa Nova', 'Centro', 'Alecrim'
            ],
            'são paulo' => [
                'Centro', 'Bela Vista', 'Consolação', 'Higienópolis', 'Liberdade', 'República', 'Santa Cecília',
                'Pinheiros', 'Vila Madalena', 'Jardins', 'Jardim Paulista', 'Itaim Bibi', 'Moema', 'Vila Mariana',
                'Perdizes', 'Pompeia', 'Lapa', 'Santana', 'Tatuapé', 'Mooca', 'Anália Franco', 'Morumbi', 'Brooklin', 'Vila Olímpia'
            ],
            'rio de janeiro' => [
                'Centro', 'Copacabana', 'Ipanema', 'Leblon', 'Botafogo', 'Flamengo', 'Laranjeiras', 'Tijuca',
                'Barra da Tijuca', 'Recreio dos Bandeirantes', 'Gávea', 'Humaitá', 'Leme', 'Santa Teresa', 'São Conrado',
                'Maracanã', 'Grajaú', 'Méier', 'Vila Isabel'
            ],
            'belo horizonte' => [
                'Centro', 'Savassi', 'Lourdes', 'Funcionários', 'Santo Agostinho', 'Sion', 'Anchieta',
                'Buritis', 'Belvedere', 'Mangabeiras', 'Pampulha', 'Castelo', 'Santa Efigênia', 'Floresta', 'Gutierrez'
            ],
            'curitiba' => [
                'Centro', 'Batel', 'Água Verde', 'Bigorrilho', 'Mercês', 'Cabral', 'Juvevê', 'Alto da XV',
                'Ecoville', 'Portão', 'Santa Felicidade', 'Jardim Botânico', 'Ahú', 'Prado Velho', 'Cristo Rei'
            ],
            'porto alegre' => [
                'Centro Histórico', 'Moinhos de Vento', 'Bela Vista', 'Petrópolis', 'Menino Deus', 'Cidade Baixa',
                'Mont Serrat', 'Rio Branco', 'Três Figueiras', 'Passo dAreia', 'Praia de Belas', 'Higienópolis'
            ],
            'brasília' => [
                'Asa Sul', 'Asa Norte', 'Sudoeste', 'Noroeste', 'Lago Sul', 'Lago Norte', 'Águas Claras',
                'Guará', 'Taguatinga', 'Park Way', 'Cruzeiro', 'Samambaia', 'Ceilândia'
            ],
            'campinas' => [
                'Cambuí', 'Taquaral', 'Guanabara', 'Nova Campinas', 'Barão Geraldo', 'Castelo', 'Botafogo',
                'Centro', 'Jardim Chapadão', 'Jardim Flamboyant', 'Parque Prado', 'Mansões Santo Antônio', 'Sousas'
            ],
            'santos' => [
                'Gonzaga', 'Boqueirão', 'Embaré', 'Ponta da Praia', 'Aparecida', 'Pompeia', 'José Menino', 'Centro', 'Encruzilhada', 'Marapé'
            ],
            'são josé dos campos' => [
                'Vila Ema', 'Vila Adyana', 'Jardim Aquarius', 'Jardim Esplanada', 'Urbanova', 'Jardim das Colinas',
                'Centro', 'Jardim Satélite', 'Bosque dos Eucaliptos', 'Parque Industrial', 'Jardim Oriente'
            ],
        ];

        if (isset($database[$normalizedCity])) {
            return $database[$normalizedCity];
        }

        // Cache de 24h para buscas dinâmicas em cidades não mapeadas no catálogo local
        $cacheKey = "neighborhoods_{$normalizedCity}_{$cleanState}";
        return Cache::remember($cacheKey, 86400, function () use ($cleanCity, $cleanState) {
            try {
                $response = Http::timeout(3)
                    ->withHeaders(['User-Agent' => 'DoisPalitosDelivery/1.0'])
                    ->get('https://nominatim.openstreetmap.org/search', [
                        'city'           => $cleanCity,
                        'state'          => $cleanState,
                        'country'        => 'Brazil',
                        'format'         => 'json',
                        'addressdetails' => 1,
                        'limit'          => 15,
                    ]);

                if ($response->successful() && !empty($response->json())) {
                    $found = [];
                    foreach ($response->json() as $item) {
                        if (!empty($item['address']['suburb'])) {
                            $found[] = $item['address']['suburb'];
                        }
                        if (!empty($item['address']['neighbourhood'])) {
                            $found[] = $item['address']['neighbourhood'];
                        }
                        if (!empty($item['address']['city_district'])) {
                            $found[] = $item['address']['city_district'];
                        }
                    }
                    $unique = array_values(array_unique($found));
                    if (count($unique) >= 2) {
                        sort($unique, SORT_LOCALE_STRING);
                        return $unique;
                    }
                }
            } catch (\Throwable $e) {
                // Fallback silencioso
            }

            return [
                'Centro', 'Bairro Novo', 'Bela Vista', 'São José', 'Santa Maria', 'Planalto',
                'Primavera', 'Industrial', 'Jardim América', 'Vila Nova', 'Parque das Nações'
            ];
        });
    }
}
