<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductOption extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'group_id',
        'name',
        'price_modifier',
        'image_url',
        'is_available',
        'sort_order',
    ];

    protected $casts = [
        'price_modifier' => 'float',
        'is_available'   => 'boolean',
        'sort_order'     => 'integer',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(ProductOptionGroup::class, 'group_id');
    }
}
