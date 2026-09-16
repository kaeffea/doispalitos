<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemOption extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'order_item_id',
        'group_name',
        'option_name',
        'price_modifier',
    ];

    protected $casts = [
        'price_modifier' => 'float',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }
}
