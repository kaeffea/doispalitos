import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { RestaurantHeader } from '@/components/RestaurantHeader'
import api from '@/lib/api'
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  Plus,
  Minus,
  Check,
  ExternalLink,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  UtensilsCrossed,
  Boxes,
  Truck,
  CreditCard,
  ShoppingBag,
  Calendar,
  Settings as SettingsIcon,
  ChevronRight,
  Bell,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface OperationalStats {
  totalProducts: number
  availableProducts: number
  pausedProducts: number
  totalCategories: number
  totalInventoryItems: number
  criticalInventoryItems: number
  recentNotifications: any[]
}

export default function RestaurantDashboardPage() {
  const { tenant, updateTenantSettings } = useAuth()
  const [settings, setSettings] = useState<any>(null)
  const [livePrepTime, setLivePrepTime] = useState<number>(30)
  const [isManuallyClosed, setIsManuallyClosed] = useState(false)
  const [isUpdatingPrepTime, setIsUpdatingPrepTime] = useState(false)
  const [prepTimeSuccess, setPrepTimeSuccess] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  // Store status
  const [isOpenNow, setIsOpenNow] = useState(false)
  const [nextOpeningText, setNextOpeningText] = useState('')
  const [todayHoursText, setTodayHoursText] = useState('')

  // Stats
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [stats, setStats] = useState<OperationalStats>({
    totalProducts: 0,
    availableProducts: 0,
    pausedProducts: 0,
    totalCategories: 0,
    totalInventoryItems: 0,
    criticalInventoryItems: 0,
    recentNotifications: [],
  })

  // Load Dashboard Data
  useEffect(() => {
    loadSettings()
    loadOperationalData()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await api.get('/restaurant/settings')
      const s = res.data.settings
      setSettings(s)
      const currentLiveTime = s?.live_status?.delivery_prep_time || 30
      setLivePrepTime(currentLiveTime)
      setIsManuallyClosed(Boolean(s?.live_status?.is_manually_closed))
      evaluateStoreStatus(s?.opening_hours)
    } catch (err) {
      console.error('Erro ao buscar configurações:', err)
    }
  }

  const loadOperationalData = async () => {
    setIsLoadingStats(true)
    try {
      const [productsRes, categoriesRes, inventoryRes, notificationsRes] = await Promise.allSettled([
        api.get('/restaurant/products'),
        api.get('/restaurant/categories'),
        api.get('/restaurant/inventory/items'),
        api.get('/restaurant/notifications'),
      ])

      let totalProducts = 0
      let availableProducts = 0
      let pausedProducts = 0
      if (productsRes.status === 'fulfilled' && productsRes.value.data?.products) {
        const prods: any[] = productsRes.value.data.products
        totalProducts = prods.length
        availableProducts = prods.filter((p) => p.is_available).length
        pausedProducts = prods.filter((p) => !p.is_available).length
      }

      let totalCategories = 0
      if (categoriesRes.status === 'fulfilled' && categoriesRes.value.data?.categories) {
        totalCategories = categoriesRes.value.data.categories.length
      }

      let totalInventoryItems = 0
      let criticalInventoryItems = 0
      if (inventoryRes.status === 'fulfilled' && Array.isArray(inventoryRes.value.data)) {
        const items: any[] = inventoryRes.value.data
        totalInventoryItems = items.length
        criticalInventoryItems = items.filter(
          (i) => i.risk_level === 'critical' || Number(i.current_stock) <= Number(i.minimum_stock)
        ).length
      }

      let recentNotifications: any[] = []
      if (notificationsRes.status === 'fulfilled' && notificationsRes.value.data?.notifications) {
        recentNotifications = notificationsRes.value.data.notifications.slice(0, 4)
      }

      setStats({
        totalProducts,
        availableProducts,
        pausedProducts,
        totalCategories,
        totalInventoryItems,
        criticalInventoryItems,
        recentNotifications,
      })
    } catch (err) {
      console.error('Erro ao carregar dados operacionais:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Calculates if open right now based on day of week and current hour
  const evaluateStoreStatus = (openingHours: any) => {
    if (!openingHours) return
    const now = new Date()
    const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    const currentDayIndex = now.getDay()
    const currentDayKey = daysMap[currentDayIndex]
    const todayConfig = openingHours[currentDayKey]

    if (!todayConfig || !todayConfig.open || !todayConfig.start || !todayConfig.end) {
      setIsOpenNow(false)
      setNextOpeningText('Fechado hoje')
      setTodayHoursText(`${dayNames[currentDayIndex]}: Fechado`)
      return
    }

    setTodayHoursText(`${dayNames[currentDayIndex]}: ${todayConfig.start} às ${todayConfig.end}`)

    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const [startH, startM] = (todayConfig.start || '18:00').split(':').map(Number)
    const [endH, endM] = (todayConfig.end || '23:30').split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH === 0 ? 24 * 60 : endH * 60 + endM

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      setIsOpenNow(true)
      setNextOpeningText(`Aberto hoje até as ${todayConfig.end}`)
    } else {
      setIsOpenNow(false)
      if (currentMinutes < startMinutes) {
        setNextOpeningText(`Abre hoje às ${todayConfig.start}`)
      } else {
        setNextOpeningText('Encerrado por hoje')
      }
    }
  }

  const handleAdjustPrepTime = async (newTime: number) => {
    if (newTime < 5 || newTime > 180) return
    setLivePrepTime(newTime)
    setIsUpdatingPrepTime(true)

    try {
      await api.patch('/restaurant/live-status', {
        delivery_prep_time: newTime,
      })
      setPrepTimeSuccess(true)
      setTimeout(() => setPrepTimeSuccess(false), 1800)
    } catch (err) {
      console.error('Erro ao atualizar tempo de preparo:', err)
    } finally {
      setIsUpdatingPrepTime(false)
    }
  }

  const handleToggleManualPause = async () => {
    const nextStatus = !isManuallyClosed
    setIsTogglingStatus(true)
    try {
      const res = await api.patch('/restaurant/live-status', {
        is_manually_closed: nextStatus,
      })
      setIsManuallyClosed(nextStatus)
      if (res.data?.settings) {
        updateTenantSettings(res.data.settings)
      }
    } catch (err) {
      console.error('Erro ao alternar pausa da loja:', err)
    } finally {
      setIsTogglingStatus(false)
    }
  }

  const delivery = settings?.delivery || {}
  const feeMode = delivery.fee_mode || 'fixed_radius'
  const activeNeighborhoods = delivery.neighborhood_fees?.filter((n: any) => n.enabled) || []

  const getDeliverySummary = () => {
    if (!delivery.enabled) return 'Delivery Desativado'
    if (feeMode === 'custom_neighborhoods') {
      return `${activeNeighborhoods.length} ${activeNeighborhoods.length === 1 ? 'bairro atendido' : 'bairros atendidos'}`
    }
    if (feeMode === 'dynamic_km') {
      return `R$ ${Number(delivery.dynamic_base_fee || 0).toFixed(2)} + R$ ${Number(delivery.dynamic_fee_per_km || 0).toFixed(2)}/km`
    }
    return `Taxa Fixa R$ ${Number(delivery.fixed_fee || 0).toFixed(2)}`
  }

  const storeUrl = tenant
    ? tenant.custom_domain
      ? tenant.custom_domain.startsWith('http')
        ? tenant.custom_domain
        : `https://${tenant.custom_domain}`
      : `https://${tenant.subdomain}.doispalitos.tech`
    : '#'

  const isStoreLiveActive = isOpenNow && !isManuallyClosed

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-[#F5DC55] selection:text-zinc-950">
      
      {/* Header Unificado */}
      <RestaurantHeader activeTab="dashboard" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10 space-y-8">
        
        {/* Onboarding Notice Banner (If settings not completed) */}
        {settings && settings.onboarding_completed === false && (
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
                  Configuração Inicial Pendente
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Defina os canais de atendimento, horários da semana e formas de pagamento para sua loja.
                </p>
              </div>
            </div>
            <Link
              to="/settings"
              className="px-4 py-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg text-xs font-mono font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0 shadow-sm"
            >
              <span>Concluir Configuração</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Live Operational Command Bar */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Store Identification & Real-time Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Painel Operacional
              </span>

              {/* Status Pill */}
              {isManuallyClosed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pausa Manual Ativada</span>
                </span>
              ) : isStoreLiveActive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Restaurante Aberto Agora</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-zinc-400" />
                  <span>Restaurante Fechado Agora</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              {tenant?.name || 'Dois Palitos'}
            </h1>

            <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 flex-wrap">
              <span>{todayHoursText || nextOpeningText || 'Horários em configuração'}</span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#997E0A] dark:text-[#F5DC55] hover:underline inline-flex items-center gap-1"
              >
                <span>Ver cardápio do restaurante</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Quick Real-Time Controls: Kitchen Prep Time + Store Pause */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* Kitchen Prep Time Adjuster - only visible when store is actively open */}
            {isStoreLiveActive && (
              <div className="flex items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>Preparo:</span>
                  </div>
                  <div className="h-3.5 text-[10px] font-mono text-zinc-400 mt-0.5">
                    {prepTimeSuccess ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Salvo
                      </span>
                    ) : (
                      'Estimativa ao vivo'
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustPrepTime(livePrepTime - 5)}
                    disabled={livePrepTime <= 5 || isUpdatingPrepTime}
                    className="w-7 h-7 rounded border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 cursor-pointer"
                    title="Diminuir 5 minutos"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <div className="w-16 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-mono font-bold text-xs rounded text-center select-none">
                    {livePrepTime}m
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdjustPrepTime(livePrepTime + 5)}
                    disabled={livePrepTime >= 180 || isUpdatingPrepTime}
                    className="w-7 h-7 rounded border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 cursor-pointer"
                    title="Aumentar 5 minutos"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Manual Store Pause Toggle */}
            <button
              type="button"
              onClick={handleToggleManualPause}
              disabled={isTogglingStatus}
              className={`px-4 py-3 rounded-xl border font-mono text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isManuallyClosed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:border-amber-500 text-zinc-800 dark:text-zinc-200'
              }`}
            >
              {isTogglingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isManuallyClosed ? (
                <PlayCircle className="w-4 h-4" />
              ) : (
                <PauseCircle className="w-4 h-4 text-amber-500" />
              )}
              <span>{isManuallyClosed ? 'Reabrir Loja' : 'Pausar Atendimento'}</span>
            </button>

          </div>

        </div>

        {/* Operational Overview Grid (KPI Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Card 1: Cardápio Digital */}
          <Link
            to="/menu"
            className="p-5 rounded-2xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-zinc-800/80 shadow-sm hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Itens no Cardápio
              </span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 group-hover:bg-[#F5DC55]/20 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55] transition-colors">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                  {isLoadingStats ? '—' : stats.totalProducts}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  ({stats.totalCategories} {stats.totalCategories === 1 ? 'categoria' : 'categorias'})
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-500 mt-2 flex items-center justify-between">
                <span>{stats.availableProducts} ativos</span>
                {stats.pausedProducts > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {stats.pausedProducts} pausados
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55]">
              <span>Gerenciar pratos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 2: Controle de Estoque & Insumos */}
          <Link
            to="/inventory"
            className="p-5 rounded-2xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-zinc-800/80 shadow-sm hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Insumos & Estoque
              </span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 group-hover:bg-[#F5DC55]/20 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55] transition-colors">
                <Boxes className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                  {isLoadingStats ? '—' : stats.totalInventoryItems}
                </span>
                <span className="text-xs text-zinc-500 font-mono">cadastrados</span>
              </div>
              <div className="text-xs font-mono mt-2">
                {stats.criticalInventoryItems > 0 ? (
                  <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {stats.criticalInventoryItems} com reposição crítica
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Estoque regularizado
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55]">
              <span>Controle de insumos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 3: Logística & Entrega */}
          <Link
            to="/settings"
            className="p-5 rounded-2xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-zinc-800/80 shadow-sm hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Modelo de Entrega
              </span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 group-hover:bg-[#F5DC55]/20 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55] transition-colors">
                <Truck className="w-4 h-4" />
              </div>
            </div>

            <div>
              <span className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white block truncate">
                {delivery.enabled
                  ? feeMode === 'custom_neighborhoods'
                    ? 'Por Bairros'
                    : feeMode === 'dynamic_km'
                    ? 'Dinâmica/Km'
                    : 'Taxa Fixa'
                  : 'Desativado'}
              </span>
              <div className="text-xs font-mono text-zinc-500 mt-2 truncate">
                {getDeliverySummary()}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55]">
              <span>Configurar entrega</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 4: Canais & Pagamentos */}
          <Link
            to="/settings"
            className="p-5 rounded-2xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-zinc-800/80 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-700 transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Canais & Pagamento
              </span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {delivery.enabled && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium">Delivery</span>
                )}
                {settings?.pickup?.enabled && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-mono font-medium">Balcão</span>
                )}
                {settings?.dine_in?.enabled && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-mono font-medium">Salão</span>
                )}
                {!delivery.enabled && !settings?.pickup?.enabled && !settings?.dine_in?.enabled && (
                  <span className="text-zinc-400 text-xs font-mono">Nenhum canal ativo</span>
                )}
              </div>
              <div className="text-xs font-mono text-zinc-500 mt-2.5 flex items-center gap-1.5 flex-wrap">
                {settings?.payment_methods?.pix && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">Pix</span>
                )}
                {settings?.payment_methods?.credit_card && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">Crédito</span>
                )}
                {settings?.payment_methods?.debit_card && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">Débito</span>
                )}
                {settings?.payment_methods?.cash && (
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">Dinheiro</span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-zinc-100">
              <span>Gerenciar canais</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>

        </div>

        {/* Quick Actions & Recent Operational Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Quick Actions Hub */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-950 dark:text-zinc-100 font-semibold">
                Atalhos Rápidos de Gestão
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Action 1: Add item to menu */}
              <Link
                to="/menu"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141518] hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all flex items-start gap-3.5 group shadow-sm"
              >
                <div className="w-9 h-9 rounded-lg bg-[#F5DC55]/20 text-[#997E0A] dark:text-[#F5DC55] flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-950 dark:text-white block group-hover:text-[#997E0A] dark:group-hover:text-[#F5DC55] transition-colors">
                    Adicionar Item ao Cardápio
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Cadastrar novos pratos, pizzas, bebidas ou grupos de adicionais.
                  </p>
                </div>
              </Link>

              {/* Action 2: Fast input purchase */}
              <Link
                to="/inventory"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141518] hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all flex items-start gap-3.5 group shadow-sm"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-950 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Entrada de Insumos / Compra
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Lançar novas compras, notas e atualizar o estoque real da cozinha.
                  </p>
                </div>
              </Link>

              {/* Action 3: Purchase Calendar */}
              <Link
                to="/inventory"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141518] hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all flex items-start gap-3.5 group shadow-sm"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-950 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Calendário de Compras
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Previsões de reabastecimento semanal e agenda por fornecedor.
                  </p>
                </div>
              </Link>

              {/* Action 4: Adjust hours & deliveries */}
              <Link
                to="/settings"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141518] hover:border-[#F5DC55] dark:hover:border-[#F5DC55]/60 transition-all flex items-start gap-3.5 group shadow-sm"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-950 dark:text-white block group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    Horários & Configurações
                  </span>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Alterar taxa de entrega, raio no mapa e dias de abertura da loja.
                  </p>
                </div>
              </Link>

            </div>
          </div>

          {/* Right Column: Notifications / Activity Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-950 dark:text-zinc-100 font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-zinc-400" />
                <span>Atualizações da Loja</span>
              </h2>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-[#141518] divide-y divide-zinc-200 dark:divide-zinc-800/80 overflow-hidden shadow-sm">
              {stats.recentNotifications.length > 0 ? (
                stats.recentNotifications.map((n: any) => (
                  <div key={n.id} className="p-4 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px]">
                      <span>{n.title || 'Notificação'}</span>
                      <span>
                        {n.created_at ? new Date(n.created_at).toLocaleDateString('pt-BR') : ''}
                      </span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
                      {n.message || n.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    Tudo em dia
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Nenhum alerta ou notificação pendente no momento.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
        <span>doispalitos.tech // {tenant?.name || 'Restaurante'}</span>
        <span>Doispalitos — Hiperprecisão Gastronômica</span>
      </footer>

    </div>
  )
}
