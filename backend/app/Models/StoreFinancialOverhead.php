<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreFinancialOverhead extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'payroll_expenses',
        'rent_expense',
        'utilities_expense',
        'other_fixed_expenses',
        'estimated_monthly_revenue',
        'fixed_cost_percentage',
    ];

    protected $casts = [
        'payroll_expenses'          => 'float',
        'rent_expense'              => 'float',
        'utilities_expense'         => 'float',
        'other_fixed_expenses'      => 'float',
        'estimated_monthly_revenue' => 'float',
        'fixed_cost_percentage'     => 'float',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
