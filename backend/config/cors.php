<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5173'),
        env('SUPERADMIN_URL', 'http://localhost:5174'),
        'https://app.doispalitos.tech',
        'https://adm.doispalitos.tech',
    ],

    'allowed_origins_patterns' => [
        '#^https://[a-zA-Z0-9-]+\.doispalitos\.tech$#',
        '#^http://localhost:\d+$#',
        '#^http://127\.0\.0\.1:\d+$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
