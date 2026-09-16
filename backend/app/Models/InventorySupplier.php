<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventorySupplier extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'contact_name',
        'phone_whatsapp',
        'email',
        'supplier_type',
        'order_days',
        'min_order_value',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'order_days'      => 'array',
        'min_order_value' => 'float',
        'is_active'       => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function packagings(): HasMany
    {
        return $this->hasMany(InventorySupplierPackaging::class, 'supplier_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryItem::class, 'primary_supplier_id');
    }
}
