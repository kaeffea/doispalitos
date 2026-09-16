import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Package,
  Plus,
  Loader2,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrencyBRL } from '@/components/CurrencyInput'

export interface ScheduledItem {
  item_id: string
  name: string
  brand_name?: string | null
  category: string
  base_unit: string
  current_stock: number
  frequency_days: number
  cycle_consumption_qty: number
  daily_consumption: number
  lead_time_days: number
  suggested_buy_qty: number
  unit_cost: number
  estimated_cost: number
  is_risk: boolean
  primary_supplier_id?: string | null
  primary_supplier?: any
  packagings?: any[]
}

export interface DayCalendarData {
  date: string
  day_number: number
  day_of_week: number
  is_today: boolean
  is_past: boolean
  realized_purchases: any[]
  scheduled_items: ScheduledItem[]
  total_cost_spent: number
  estimated_cost: number
  has_risk: boolean
}

interface PurchasingCalendarProps {
  onOpenDayBatch: (dayData: DayCalendarData, mode: 'scheduled' | 'urgent' | 'manual') => void
  onRefreshTrigger?: number
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function PurchasingCalendar({ onOpenDayBatch, onRefreshTrigger }: PurchasingCalendarProps) {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1)
  const [days, setDays] = useState<DayCalendarData[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const loadCalendarData = async (year: number, month: number) => {
    try {
      setIsLoading(true)
      const res = await api.get('/restaurant/inventory/purchases/calendar', {
        params: { year, month },
      })
      setDays(res.data.days || [])
    } catch (err) {
      console.error('Erro ao carregar calendário de compras:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCalendarData(currentYear, currentMonth)
  }, [currentYear, currentMonth, onRefreshTrigger])

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
  }

  // Preenchimento de dias vazios antes do dia 1 do mês
  const firstDayOfWeek = days[0]?.day_of_week || 0
  const emptyPrefixDays = Array.from({ length: firstDayOfWeek })

  // Totais do mês
  const totalSpentMonth = days.reduce((acc, d) => acc + (d.total_cost_spent || 0), 0)
  const totalScheduledMonth = days.reduce((acc, d) => acc + (d.scheduled_items?.length || 0), 0)
  const totalRisksMonth = days.filter((d) => d.has_risk).length

  return (
    <div className="space-y-4 font-mono">
      {/* ─── Topo de Controle & Resumo do Mês ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
        
        {/* Navegação do Mês */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <span>{MONTH_NAMES[currentMonth - 1]}</span>
              <span className="text-zinc-400 font-normal">{currentYear}</span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />}
            </h2>
            <p className="text-[11px] text-zinc-500">
              Planejamento automatizado e registro em lote de compras
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-2.5 py-1 text-xs border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors cursor-pointer ml-2"
          >
            Ir para Hoje
          </button>
        </div>

        {/* Resumo Rápido em Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Realizado: <strong>R$ {formatCurrencyBRL(totalSpentMonth)}</strong></span>
          </div>

          <div className="px-3 py-1.5 bg-[#F5DC55]/15 border border-[#F5DC55]/30 rounded-xl flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <Package className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55] shrink-0" />
            <span>{totalScheduledMonth} compras programadas</span>
          </div>

          {totalRisksMonth > 0 && (
            <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{totalRisksMonth} dias com risco de ruptura</span>
            </div>
          )}
        </div>

      </div>

      {/* ─── Grid do Calendário Grandão ───────────────────────────────────── */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-[#121316] shadow-sm">
        
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 text-center text-[11px] font-bold uppercase text-zinc-400">
          {WEEK_DAYS.map((wd, i) => (
            <div key={wd} className={`py-3 ${i === 0 || i === 6 ? 'text-zinc-400/70' : ''}`}>
              {wd}
            </div>
          ))}
        </div>

        {/* Grade dos Dias */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-200 dark:divide-zinc-800/80">
          
          {/* Células Vazias no Início */}
          {emptyPrefixDays.map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-[115px] bg-zinc-50/30 dark:bg-zinc-900/20 p-2" />
          ))}

          {/* Dias do Mês */}
          {days.map((day) => {
            const hasPurchases = day.realized_purchases.length > 0
            const hasScheduled = day.scheduled_items.length > 0

            return (
              <div
                key={day.date}
                onClick={() => onOpenDayBatch(day, hasScheduled ? 'scheduled' : 'manual')}
                className={`min-h-[120px] p-2.5 flex flex-col justify-between transition-all cursor-pointer group relative ${
                  day.is_today
                    ? 'bg-[#F5DC55]/5 ring-2 ring-[#F5DC55] ring-inset z-10'
                    : day.has_risk
                    ? 'bg-red-500/5 hover:bg-red-500/10'
                    : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50'
                }`}
              >
                {/* Número do Dia & Indicadores de Status */}
                <div className="flex items-center justify-between">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold ${
                      day.is_today
                        ? 'bg-[#F5DC55] text-zinc-950 shadow-xs'
                        : day.is_past
                        ? 'text-zinc-400'
                        : 'text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {day.day_number}
                  </span>

                  <div className="flex items-center gap-1">
                    {day.has_risk && (
                      <span className="p-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold" title="Risco de acabar o estoque antes desta compra!">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {hasPurchases && (
                      <span className="p-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Compras realizadas">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Conteúdo do Dia (Cards / Pills) */}
                <div className="space-y-1 my-1.5 flex-1">
                  
                  {/* Compras Realizadas */}
                  {hasPurchases && (
                    <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                      R$ {formatCurrencyBRL(day.total_cost_spent)} ({day.realized_purchases.reduce((acc, p) => acc + (p.items?.length || 0), 0)} itens)
                    </div>
                  )}

                  {/* Insumos Programados */}
                  {hasScheduled && (
                    <div
                      className={`px-2 py-1 rounded-md text-[10px] font-medium border truncate flex items-center justify-between ${
                        day.has_risk
                          ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="truncate">
                        {day.scheduled_items.length} insumo{day.scheduled_items.length > 1 ? 's' : ''}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400 shrink-0 ml-1">
                        ~R${Math.round(day.estimated_cost)}
                      </span>
                    </div>
                  )}

                  {/* Exibição rápida dos primeiros 2 insumos */}
                  {hasScheduled && (
                    <div className="text-[10px] text-zinc-400 space-y-0.5 truncate hidden sm:block">
                      {day.scheduled_items.slice(0, 2).map((si) => (
                        <div key={si.item_id} className="truncate flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-[#F5DC55]" />
                          <span className="truncate">{si.name}</span>
                        </div>
                      ))}
                      {day.scheduled_items.length > 2 && (
                        <span className="text-[9px] text-zinc-400 italic">+{day.scheduled_items.length - 2} outros...</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Botão de Ação Rápida no Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-1 flex justify-end">
                  <span className="text-[10px] text-[#D4B316] dark:text-[#F5DC55] font-bold flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />
                    <span>{hasPurchases ? 'Ver / Registrar' : 'Registrar'}</span>
                  </span>
                </div>

              </div>
            )
          })}

        </div>

      </div>
    </div>
  )
}
