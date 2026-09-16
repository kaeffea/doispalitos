<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductOptionGroup extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'name',
        'min_options',
        'max_options',
        'is_required',
        'sort_order',
    ];

    protected $casts = [
        'min_options' => 'integer',
        'max_options' => 'integer',
        'is_required' => 'boolean',
        'sort_order'  => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(ProductOption::class, 'group_id')->orderBy('sort_order', 'asc');
    }
}
