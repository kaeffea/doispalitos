<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SubRecipe extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'batch_yield_quantity',
        'yield_unit',
        'total_batch_cost',
        'unit_cost',
        'current_stock',
        'min_stock',
        'instructions',
        'is_active',
    ];

    protected $casts = [
        'batch_yield_quantity' => 'float',
        'total_batch_cost'     => 'float',
        'unit_cost'            => 'float',
        'current_stock'        => 'float',
        'min_stock'            => 'float',
        'is_active'            => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function ingredients(): HasMany
    {
        return $this->hasMany(SubRecipeIngredient::class, 'sub_recipe_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'sub_recipe_id');
    }
}
