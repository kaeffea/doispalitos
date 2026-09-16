<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantStorefront extends Model
{
    use HasUuids;

    protected $fillable = [
        'tenant_id',
        'theme',
        'sections',
        'overrides',
        'is_published',
        'published_theme',
        'published_sections',
        'published_overrides',
        'published_at',
    ];

    protected $casts = [
        'theme'               => 'array',
        'sections'            => 'array',
        'overrides'           => 'array',
        'is_published'        => 'boolean',
        'published_theme'     => 'array',
        'published_sections'  => 'array',
        'published_overrides' => 'array',
        'published_at'        => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
