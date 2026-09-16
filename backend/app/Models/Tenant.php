<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'name',
        'legal_name',
        'document',
        'slug',
        'custom_domain',
        'email',
        'phone',
        'postal_code',
        'street',
        'number',
        'complement',
        'neighborhood',
        'city',
        'state',
        'latitude',
        'longitude',
        'is_active',
        'settings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'settings'  => 'array',
        'latitude'  => 'float',
        'longitude' => 'float',
    ];

    /**
     * Retorna as configurações com valores padrão caso não estejam preenchidas.
     */
    public function getSettingsAttribute($value): array
    {
        $default = [
            'delivery' => [
                'enabled'            => false,
                'fee_mode'           => null,
                'max_distance_km'    => null,
                'fixed_fee'          => null,
                'dynamic_base_fee'   => null,
                'dynamic_fee_per_km' => null,
                'min_order_amount'   => null,
                'neighborhood_fees'  => [],
            ],
            'pickup' => [
                'enabled' => false,
            ],
            'dine_in' => [
                'enabled' => false,
            ],
            'opening_hours' => [
                'monday'    => ['open' => false, 'start' => null, 'end' => null],
                'tuesday'   => ['open' => false, 'start' => null, 'end' => null],
                'wednesday' => ['open' => false, 'start' => null, 'end' => null],
                'thursday'  => ['open' => false, 'start' => null, 'end' => null],
                'friday'    => ['open' => false, 'start' => null, 'end' => null],
                'saturday'  => ['open' => false, 'start' => null, 'end' => null],
                'sunday'    => ['open' => false, 'start' => null, 'end' => null],
            ],
            'payment_methods' => [
                'pix'                     => false,
                'credit_card'             => false,
                'debit_card'              => false,
                'cash'                    => false,
                'credit_card_fee_percent' => 0,
                'debit_card_fee_percent'  => 0,
            ],
            'live_status' => [
                'delivery_prep_time' => null,
                'is_manually_closed' => false,
            ],
            'onboarding_completed' => false,
        ];

        if (empty($value)) {
            return $default;
        }

        $decoded = is_string($value) ? json_decode($value, true) : $value;
        return array_replace_recursive($default, $decoded ?: []);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function storefront(): HasOne
    {
        return $this->hasOne(TenantStorefront::class);
    }
}
