import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RestaurantHeader } from '@/components/RestaurantHeader'
import api from '@/lib/api'
import {
  ArrowLeft,
  Bike,
  Check,
  Clock,
  Loader2,
  Phone,
  RefreshCw,
  Store,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

interface OrderOption {
  group_name: string
  option_name: string
  price_modifier: number
}

interface OrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  subtotal: number
  notes?: string | null
  options: OrderOption[]
}

interface Order {
  id: string
  public_uuid: string
  customer_name: string
  customer_phone: string
  channel: string
  table_number?: string | null
  payment_method: string
  payment_detail?: { change_for?: number } | null
  subtotal: number
  delivery_fee: number
  total: number
  status: string
  prep_time_min?: number | null
  notes?: string | null
  created_at: string
  items: OrderItem[]
}

const COLUMNS: Array<{ id: string; title: string; statuses: string[] }> = [
  { id: 'novos', title: 'Novos', statuses: ['pending_payment', 'received'] },
  { id: 'preparo', title: 'Em preparo', statuses: ['preparing'] },
  { id: 'prontos', title: 'Prontos', statuses: ['ready_for_dispatch'] },
  { id: 'rota', title: 'Em rota', statuses: ['dispatched'] },
  { id: 'final', title: 'Finalizados', statuses: ['delivered', 'canceled'] },
]

const NEXT_ACTION: Record<string, { to: string; label: string } | null> = {
  pending_payment: { to: 'received', label: 'Confirmar pagamento' },
  received: { to: 'preparing', label: 'Aceitar e preparar' },
  preparing: { to: 'ready_for_dispatch', label: 'Marcar pronto' },
  ready_for_dispatch: { to: 'dispatched', label: 'Despachar' },
  dispatched: { to: 'delivered', label: 'Finalizar' },
}

const CHANNEL_LABEL: Record<string, string> = { delivery: 'Entrega', pickup: 'Retirada', dine_in: 'Mesa' }
const PAY_LABEL: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', credit_card: 'Crédito', debit_card: 'Débito' }
const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Aguard. pagto',
  received: 'Recebido',
  preparing: 'Preparo',
  ready_for_dispatch: 'Pronto',
  dispatched: 'Em rota',
  delivered: 'Entregue',
  canceled: 'Cancelado',
}

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    ;[0, 0.25, 0.5].forEach((delay) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.frequency.value = 880
      const t = ctx.currentTime + delay
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      o.start(t)
      o.stop(t + 0.22)
    })
  } catch {
    /* sem áudio, segue visual */
  }
}

function elapsed(createdAt: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `há ${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ''}`
}

const money = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PedidosPage() {
  const { tenant } = useAuth()
  const [active, setActive] = useState<Order[]>([])
  const [history, setHistory] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [now, setNow] = useState(Date.now())
  const seenRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)

  const loadActive = useCallback(async (silent = false) => {
    try {
      const res = await api.get('/restaurant/orders', { params: { scope: 'active' } })
      const orders: Order[] = res.data.orders ?? []
      if (!silent || !firstLoadRef.current) {
        const fresh = orders.filter((o) => !seenRef.current.has(o.id) && ['pending_payment', 'received'].includes(o.status))
        if (fresh.length > 0 && !firstLoadRef.current && soundOn) beep()
        fresh.forEach((o) => seenRef.current.add(o.id))
      } else {
        orders.forEach((o) => seenRef.current.add(o.id))
      }
      firstLoadRef.current = false
      setActive(orders)
    } catch {
      /* mantém o que tem */
    }
  }, [soundOn])

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get('/restaurant/orders', { params: { scope: 'history' } })
      setHistory(res.data.orders ?? [])
    } catch {
      /* mantém */
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    Promise.all([loadActive(true), loadHistory()]).finally(() => setIsLoading(false))
    const poll = setInterval(() => loadActive(), 8000)
    const tick = setInterval(() => setNow(Date.now()), 30000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [loadActive, loadHistory])

  const act = async (order: Order, to: string) => {
    setActingId(order.id)
    try {
      await api.patch(`/restaurant/orders/${order.id}/status`, { status: to })
      await Promise.all([loadActive(), loadHistory()])
    } catch {
      /* toast simples via alert nativo do navegador seria feio; mantém */
    } finally {
      setActingId(null)
      setConfirmCancelId(null)
    }
  }

  const byStatus = (statuses: string[], pool: Order[]) => pool.filter((o) => statuses.includes(o.status))

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-[#F5DC55] selection:text-zinc-950 flex flex-col">
      <RestaurantHeader activeTab="orders" />

      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-8 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <Link to="/dashboard" className="text-xs font-mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao painel
            </Link>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">
              Pedidos {tenant ? <span className="font-mono text-xs align-middle ml-1 text-zinc-400">· atualiza sozinho</span> : null}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundOn((v) => !v)}
              className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700"
              title={soundOn ? 'Silenciar alerta de pedido novo' : 'Ativar alerta'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => Promise.all([loadActive(), loadHistory()])}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
            {COLUMNS.map((col) => {
              const list = col.id === 'final' ? byStatus(col.statuses, history) : byStatus(col.statuses, active)
              return (
                <section key={col.id} className="bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <header className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider">{col.title}</h2>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">{list.length}</span>
                  </header>
                  <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
                    {list.length === 0 && (
                      <p className="text-[11px] font-mono text-zinc-400 text-center py-4">— vazio —</p>
                    )}
                    {list.map((o) => {
                      const next = NEXT_ACTION[o.status]
                      const acting = actingId === o.id
                      return (
                        <article key={o.id} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-bold">#{o.id.slice(0, 8)}</span>
                            <span className="font-mono text-[10px] flex items-center gap-1 text-zinc-500">
                              <Clock className="w-3 h-3" /> {elapsed(o.created_at, now)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold leading-tight">{o.customer_name}</p>
                            <p className="font-mono text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {o.customer_phone}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 inline-flex items-center gap-1">
                              {o.channel === 'delivery' ? <Bike className="w-3 h-3" /> : o.channel === 'dine_in' ? <UtensilsCrossed className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                              {CHANNEL_LABEL[o.channel] ?? o.channel}{o.table_number ? ` ${o.table_number}` : ''}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                              {PAY_LABEL[o.payment_method] ?? o.payment_method}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F5DC55]/20">
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </div>
                          <div className="text-xs space-y-1 border-t border-zinc-100 dark:border-zinc-800/60 pt-2">
                            {o.items.map((it) => (
                              <div key={it.id}>
                                <p><b>{it.quantity}×</b> {it.name}</p>
                                {it.options.map((op, i) => (
                                  <p key={i} className="text-[11px] text-zinc-500 pl-3">+ {op.option_name}</p>
                                ))}
                                {it.notes && <p className="text-[11px] italic text-zinc-500 pl-3">“{it.notes}”</p>}
                              </div>
                            ))}
                            {o.notes && <p className="text-[11px] italic">Obs: {o.notes}</p>}
                          </div>
                          <p className="font-mono text-sm font-bold flex justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-2">
                            <span>Total</span><span>{money(o.total)}</span>
                          </p>
                          {col.id !== 'final' && (
                            <div className="flex gap-1.5">
                              {next && (
                                <button
                                  onClick={() => act(o, next.to)}
                                  disabled={acting}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-[#F5DC55] hover:bg-[#E5CB3C] disabled:opacity-50 text-zinc-950 text-[11px] font-bold"
                                >
                                  {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  {next.label}
                                </button>
                              )}
                              {confirmCancelId === o.id ? (
                                <>
                                  <button onClick={() => act(o, 'canceled')} disabled={acting} className="flex-1 px-2 py-2 rounded-lg bg-red-600 text-white text-[11px] font-bold">
                                    Confirmar?
                                  </button>
                                  <button onClick={() => setConfirmCancelId(null)} className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => setConfirmCancelId(o.id)} className="px-2.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-[11px] font-mono text-zinc-500" title="Cancelar pedido">
                                  Cancelar
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
