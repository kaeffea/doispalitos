<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasUuids;

    public const STATUS_PENDING_PAYMENT = 'pending_payment';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_PREPARING = 'preparing';
    public const STATUS_READY = 'ready_for_dispatch';
    public const STATUS_DISPATCHED = 'dispatched';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_CANCELED = 'canceled';

    public const STATUSES = [
        self::STATUS_PENDING_PAYMENT,
        self::STATUS_RECEIVED,
        self::STATUS_PREPARING,
        self::STATUS_READY,
        self::STATUS_DISPATCHED,
        self::STATUS_DELIVERED,
        self::STATUS_CANCELED,
    ];

    public const CHANNELS = ['delivery', 'pickup', 'dine_in'];
    public const PAYMENTS = ['pix', 'credit_card', 'debit_card', 'cash'];

    protected $fillable = [
        'tenant_id',
        'public_uuid',
        'customer_name',
        'customer_phone',
        'channel',
        'address',
        'table_number',
        'payment_method',
        'payment_detail',
        'subtotal',
        'delivery_fee',
        'discount',
        'total',
        'status',
        'prep_time_min',
        'notes',
    ];

    protected $casts = [
        'address'        => 'array',
        'payment_detail' => 'array',
        'subtotal'       => 'float',
        'delivery_fee'   => 'float',
        'discount'       => 'float',
        'total'          => 'float',
        'prep_time_min'  => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at', 'asc');
    }
}
