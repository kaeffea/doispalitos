<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubRecipeIngredient extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'sub_recipe_id',
        'inventory_item_id',
        'quantity_consumed',
    ];

    protected $casts = [
        'quantity_consumed' => 'float',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function subRecipe(): BelongsTo
    {
        return $this->belongsTo(SubRecipe::class, 'sub_recipe_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
