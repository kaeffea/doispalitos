<?php

use App\Http\Controllers\Api\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Api\Admin\ChangeRequestController as AdminChangeRequestController;
use App\Http\Controllers\Api\Admin\NotificationController as AdminNotificationController;
use App\Http\Controllers\Api\Admin\TenantController as AdminTenantController;
use App\Http\Controllers\Api\Restaurant\AuthController as RestaurantAuthController;
use App\Http\Controllers\Api\Restaurant\CategoryController as RestaurantCategoryController;
use App\Http\Controllers\Api\Restaurant\ChangeRequestController as RestaurantChangeRequestController;
use App\Http\Controllers\Api\Restaurant\InventoryFinancialController;
use App\Http\Controllers\Api\Restaurant\InventoryItemController;
use App\Http\Controllers\Api\Restaurant\InventoryPurchaseController;
use App\Http\Controllers\Api\Restaurant\InventorySupplierController;
use App\Http\Controllers\Api\Restaurant\NotificationController as RestaurantNotificationController;
use App\Http\Controllers\Api\Restaurant\OrderController as RestaurantOrderController;
use App\Http\Controllers\Api\Restaurant\ProductController as RestaurantProductController;
use App\Http\Controllers\Api\Restaurant\ProductRecipeController;
use App\Http\Controllers\Api\Restaurant\PurchasingScheduleController;
use App\Http\Controllers\Api\Restaurant\SettingsController as RestaurantSettingsController;
use App\Http\Controllers\Api\Restaurant\StorefrontController as RestaurantStorefrontController;
use App\Http\Controllers\Api\Restaurant\SubRecipeController;
use App\Http\Controllers\Api\Storefront\StorefrontController as PublicStorefrontController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // ─── Health check ──────────────────────────────────────────────────────────
    Route::get('/ping', fn () => response()->json([
        'status'  => 'ok',
        'service' => 'doispalitos-api',
    ]));

    // ─── Super Admin (Governança Global da Plataforma) ─────────────────────────
    Route::prefix('admin')->group(function () {
        Route::post('/login', [AdminAuthController::class, 'login'])->middleware('throttle:login');

        Route::middleware(['auth:sanctum', 'super_admin'])->group(function () {
            Route::post('/logout', [AdminAuthController::class, 'logout']);
            Route::get('/me', [AdminAuthController::class, 'me']);

            // Gestão de Instâncias Multi-tenant
            Route::get('/tenants', [AdminTenantController::class, 'index']);
            Route::post('/tenants', [AdminTenantController::class, 'store']);
            Route::get('/tenants/{id}', [AdminTenantController::class, 'show']);
            Route::put('/tenants/{id}', [AdminTenantController::class, 'update']);
            Route::patch('/tenants/{id}/toggle-status', [AdminTenantController::class, 'toggleStatus']);
            Route::post('/tenants/{id}/reset-password', [AdminTenantController::class, 'resetPassword']);
            Route::delete('/tenants/{id}', [AdminTenantController::class, 'destroy']);

            // Solicitações de Alteração Cadastral (Aprovação / Recusa / Edição)
            Route::get('/change-requests', [AdminChangeRequestController::class, 'index']);
            Route::get('/change-requests/{id}', [AdminChangeRequestController::class, 'show']);
            Route::post('/change-requests/{id}/approve', [AdminChangeRequestController::class, 'approve']);
            Route::post('/change-requests/{id}/reject', [AdminChangeRequestController::class, 'reject']);
            Route::post('/change-requests/{id}/edit-and-approve', [AdminChangeRequestController::class, 'editAndApprove']);

            // Notificações e Feed de Eventos
            Route::get('/notifications', [AdminNotificationController::class, 'index']);
        });
    });

    // ─── Restaurante (Operação, Gestão, Cozinha e Entregas da Loja) ───────────
    Route::prefix('restaurant')->group(function () {
        // Login dos operadores e gestores do restaurante
        Route::post('/login', [RestaurantAuthController::class, 'login'])->middleware('throttle:login');

        // Rotas autenticadas do restaurante (RLS e tenant garantidos)
        Route::middleware(['auth:sanctum', 'tenant_admin'])->group(function () {
            Route::post('/logout', [RestaurantAuthController::class, 'logout']);
            Route::get('/me', [RestaurantAuthController::class, 'me']);
            Route::post('/change-password', [RestaurantAuthController::class, 'changePassword']);

            // Configurações Operacionais & Bairros
            Route::get('/settings', [RestaurantSettingsController::class, 'show']);
            Route::put('/settings', [RestaurantSettingsController::class, 'update']);
            Route::get('/neighborhoods', [RestaurantSettingsController::class, 'neighborhoods']);
            Route::patch('/prep-time', [RestaurantSettingsController::class, 'updatePrepTime']);
            Route::patch('/live-status', [RestaurantSettingsController::class, 'updateLiveStatus']);

            // Central de Pedidos (Kanban da cozinha)
            Route::get('/orders', [RestaurantOrderController::class, 'index']);
            Route::get('/orders/{id}', [RestaurantOrderController::class, 'show']);
            Route::patch('/orders/{id}/status', [RestaurantOrderController::class, 'updateStatus']);

            // Site do restaurante (Studio: rascunho + publicação)
            Route::get('/storefront', [RestaurantStorefrontController::class, 'show']);
            Route::put('/storefront', [RestaurantStorefrontController::class, 'update']);
            Route::post('/storefront/publish', [RestaurantStorefrontController::class, 'publish']);
            Route::post('/storefront/unpublish', [RestaurantStorefrontController::class, 'unpublish']);

            // Solicitação de Alteração Cadastral
            Route::get('/change-requests/latest', [RestaurantChangeRequestController::class, 'latest']);
            Route::post('/change-requests', [RestaurantChangeRequestController::class, 'store']);

            // Central de Notificações da Loja
            Route::get('/notifications', [RestaurantNotificationController::class, 'index']);

            // Categorias do Cardápio
            Route::get('/categories', [RestaurantCategoryController::class, 'index']);
            Route::post('/categories', [RestaurantCategoryController::class, 'store']);
            Route::put('/categories/{id}', [RestaurantCategoryController::class, 'update']);
            Route::patch('/categories/reorder', [RestaurantCategoryController::class, 'reorder']);
            Route::delete('/categories/{id}', [RestaurantCategoryController::class, 'destroy']);

            // Produtos & Opcionais do Cardápio
            Route::get('/products', [RestaurantProductController::class, 'index']);
            Route::post('/products', [RestaurantProductController::class, 'store']);
            Route::post('/products/upload-image', [RestaurantProductController::class, 'uploadImage']);
            Route::get('/products/{id}', [RestaurantProductController::class, 'show']);
            Route::put('/products/{id}', [RestaurantProductController::class, 'update']);
            Route::patch('/products/{id}/toggle-availability', [RestaurantProductController::class, 'toggleAvailability']);
            Route::delete('/products/{id}', [RestaurantProductController::class, 'destroy']);

            // ─── Controle de Estoque & Ficha Técnica ───────────────────────────
            Route::prefix('inventory')->group(function () {
                // Fornecedores & Canais de Compra
                Route::get('/suppliers', [InventorySupplierController::class, 'index']);
                Route::post('/suppliers', [InventorySupplierController::class, 'store']);
                Route::put('/suppliers/{id}', [InventorySupplierController::class, 'update']);
                Route::delete('/suppliers/{id}', [InventorySupplierController::class, 'destroy']);

                // Insumos, Matérias-Primas & Kardex
                Route::get('/items', [InventoryItemController::class, 'index']);
                Route::post('/items', [InventoryItemController::class, 'store']);
                Route::get('/brands', [InventoryItemController::class, 'brands']);
                Route::put('/items/{id}', [InventoryItemController::class, 'update']);
                Route::delete('/items/{id}', [InventoryItemController::class, 'destroy']);
                Route::post('/items/{id}/options', [InventoryItemController::class, 'addOption']);
                Route::put('/items/{id}/options/{optionId}', [InventoryItemController::class, 'updateOption']);
                Route::delete('/items/{id}/options/{optionId}', [InventoryItemController::class, 'deleteOption']);
                Route::post('/items/{id}/packagings', [InventoryItemController::class, 'addPackaging']);
                Route::post('/quick-entry', [InventoryItemController::class, 'quickEntry']);
                Route::get('/transactions', [InventoryItemController::class, 'transactions']);

                // Pré-preparos da Cozinha (Sub-receitas)
                Route::get('/sub-recipes', [SubRecipeController::class, 'index']);
                Route::post('/sub-recipes', [SubRecipeController::class, 'store']);
                Route::put('/sub-recipes/{id}', [SubRecipeController::class, 'update']);
                Route::delete('/sub-recipes/{id}', [SubRecipeController::class, 'destroy']);
                Route::post('/sub-recipes/{id}/produce', [SubRecipeController::class, 'produceBatch']);

                // Ficha Técnica do Cardápio & CMV
                Route::get('/recipes/products', [ProductRecipeController::class, 'index']);
                Route::get('/recipes/products/{productId}', [ProductRecipeController::class, 'show']);
                Route::post('/recipes/attach', [ProductRecipeController::class, 'attach']);

                // Agendas de Compra & Lista Inteligente (WhatsApp)
                Route::get('/purchasing-schedules', [PurchasingScheduleController::class, 'index']);
                Route::post('/purchasing-schedules', [PurchasingScheduleController::class, 'store']);
                Route::put('/purchasing-schedules/{id}', [PurchasingScheduleController::class, 'update']);
                Route::delete('/purchasing-schedules/{id}', [PurchasingScheduleController::class, 'destroy']);
                Route::get('/smart-shopping-list', [PurchasingScheduleController::class, 'generateShoppingList']);

                // Compras, Calendário & Planilha Ágil
                Route::get('/purchases/calendar', [InventoryPurchaseController::class, 'calendar']);
                Route::post('/purchases/batch', [InventoryPurchaseController::class, 'storeBatch']);
                Route::get('/purchases', [InventoryPurchaseController::class, 'index']);

                // Análise Financeira, Custos Fixos & Margem Real
                Route::get('/financial-overview', [InventoryFinancialController::class, 'show']);
                Route::put('/financial-overheads', [InventoryFinancialController::class, 'update']);
            });
        });
    });

    // ─── Cardápio Público do Cliente (Storefront / Pedidos Online) ────────────
    Route::prefix('storefront')->group(function () {
        Route::get('/by-host', [PublicStorefrontController::class, 'resolveByHost']);
        Route::get('/orders/{uuid}', [PublicStorefrontController::class, 'track']);
        Route::get('/{slug}/resolve', [PublicStorefrontController::class, 'resolve']);
        Route::post('/{slug}/delivery-fee', [PublicStorefrontController::class, 'deliveryFee']);
        Route::post('/{slug}/orders', [PublicStorefrontController::class, 'storeOrder'])->middleware('throttle:20,1');
    });
});
