<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventorySupplierPackaging extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'inventory_item_id',
        'supplier_id',
        'brand_name',
        'package_name',
        'package_base_quantity',
        'price_paid',
        'unit_cost_equivalent',
        'is_preferred',
    ];

    protected $casts = [
        'package_base_quantity' => 'float',
        'price_paid'            => 'float',
        'unit_cost_equivalent'  => 'float',
        'is_preferred'          => 'boolean',
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
