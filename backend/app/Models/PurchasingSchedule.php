<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchasingSchedule extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'name',
        'frequency_type',
        'schedule_days',
        'item_categories',
        'is_active',
    ];

    protected $casts = [
        'schedule_days'   => 'array',
        'item_categories' => 'array',
        'is_active'       => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
