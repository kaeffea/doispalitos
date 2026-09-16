<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransaction extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'inventory_item_id',
        'sub_recipe_id',
        'type',
        'quantity',
        'unit_cost',
        'total_cost',
        'reference_id',
        'notes',
    ];

    protected $casts = [
        'quantity'   => 'float',
        'unit_cost'  => 'float',
        'total_cost' => 'float',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function subRecipe(): BelongsTo
    {
        return $this->belongsTo(SubRecipe::class, 'sub_recipe_id');
    }
}
