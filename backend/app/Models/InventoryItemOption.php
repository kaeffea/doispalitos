<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryItemOption extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'inventory_item_id',
        'brand_name',
        'supplier_id',
        'cost_per_unit',
        'current_stock',
        'last_purchased_at',
        'is_default',
    ];

    protected $casts = [
        'cost_per_unit'     => 'float',
        'current_stock'     => 'float',
        'last_purchased_at' => 'date:Y-m-d',
        'is_default'        => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(InventorySupplier::class, 'supplier_id');
    }
}
