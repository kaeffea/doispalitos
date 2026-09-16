<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryItem extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'brand_name',
        'description',
        'category',
        'base_unit',
        'current_stock',
        'min_stock',
        'ideal_stock',
        'frequency_days',
        'cycle_consumption_qty',
        'lead_time_days',
        'last_purchased_at',
        'next_scheduled_purchase_date',
        'purchase_frequency',
        'purchase_day_of_week',
        'critical_stock_days',
        'average_cost_per_unit',
        'last_cost_per_unit',
        'primary_supplier_id',
        'is_active',
    ];

    protected $casts = [
        'current_stock'         => 'float',
        'min_stock'             => 'float',
        'ideal_stock'           => 'float',
        'frequency_days'        => 'integer',
        'cycle_consumption_qty' => 'float',
        'lead_time_days'        => 'integer',
        'last_purchased_at'     => 'date:Y-m-d',
        'next_scheduled_purchase_date' => 'date:Y-m-d',
        'critical_stock_days'   => 'float',
        'average_cost_per_unit' => 'float',
        'last_cost_per_unit'    => 'float',
        'is_active'             => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function primarySupplier(): BelongsTo
    {
        return $this->belongsTo(InventorySupplier::class, 'primary_supplier_id');
    }

    public function packagings(): HasMany
    {
        return $this->hasMany(InventorySupplierPackaging::class, 'inventory_item_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'inventory_item_id');
    }

    public function purchaseItems(): HasMany
    {
        return $this->hasMany(InventoryPurchaseItem::class, 'inventory_item_id')->orderBy('created_at', 'desc');
    }

    public function options(): HasMany
    {
        return $this->hasMany(InventoryItemOption::class, 'inventory_item_id')->orderBy('created_at', 'asc');
    }
}
