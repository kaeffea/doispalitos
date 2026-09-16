import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, RefreshCw } from 'lucide-react'
import { money } from '../shop/cart'
import { trackOrder } from '../shop/api'

type Order = Record<string, unknown> & {
  status: string
  customer_name: string
  total: number
  prep_time_min?: number | null
  payment_method: string
  items: Array<{ name: string; quantity: number; unit_price: number; subtotal: number; options: Array<{ option_name: string }> }>
  history: Array<{ to_status: string; created_at: string }>
}

const STAGES = [
  { id: 'received', label: 'Recebido' },
  { id: 'preparing', label: 'Na cozinha' },
  { id: 'dispatch', label: 'A caminho' },
  { id: 'delivered', label: 'Entregue' },
]

function stageOf(status: string): number {
  if (status === 'preparing') return 1
  if (status === 'ready_for_dispatch' || status === 'dispatched') return 2
  if (status === 'delivered') return 3
  if (status === 'canceled') return -1
  return 0
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  received: 'Pedido recebido',
  preparing: 'Na cozinha',
  ready_for_dispatch: 'Pronto para entrega',
  dispatched: 'Saiu para entrega',
  delivered: 'Entregue',
  canceled: 'Cancelado',
}

export default function TrackPage() {
  const { uuid } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [storeName, setStoreName] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!uuid) return
    try {
      const data = await trackOrder(uuid)
      setOrder(data.order as Order)
      setStoreName(data.store.name)
      setStorePhone(data.store.phone)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [uuid])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  if (failed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Pedido não encontrado.</p>
        <Link to="/" className="text-sm underline">Voltar ao cardápio</Link>
      </div>
    )
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-sm text-zinc-500">Buscando seu pedido…</div>
  }

  const stage = stageOf(order.status)

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-zinc-900 font-sans px-5 py-8 max-w-md mx-auto">
      <Link to="/" className="text-xs font-mono text-zinc-400 inline-flex items-center gap-1">
        <ArrowLeft size={13} /> Cardápio
      </Link>
      <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 mt-4">{storeName}</p>
      <h1 className="text-2xl font-extrabold tracking-tight">{STATUS_LABEL[order.status] ?? order.status}</h1>
      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
        <Clock size={12} /> {order.prep_time_min ? `Preparo estimado: ~${order.prep_time_min} min` : 'Acompanhe por aqui'}
        <button onClick={load} aria-label="Atualizar" className="p-1"><RefreshCw size={12} /></button>
      </p>

      {order.status === 'pending_payment' && (
        <div className="mt-4 p-4 rounded-xl bg-amber-100 border border-amber-300 text-xs leading-relaxed">
          Pagamento via {order.payment_method === 'pix' ? 'PIX' : order.payment_method}: o restaurante confirma na entrega. Fique de olho no WhatsApp.
        </div>
      )}

      {stage >= 0 ? (
        <ol className="mt-6 space-y-0">
          {STAGES.map((s, i) => (
            <li key={s.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: i <= stage ? '#141416' : '#E5E4DC', color: i <= stage ? '#F5DC55' : '#A1A1AA' }}
                >
                  {i < stage ? <Check size={14} /> : <span className="font-mono text-[11px] font-bold">{i + 1}</span>}
                </span>
                {i < STAGES.length - 1 && <span className="w-0.5 flex-1" style={{ background: i < stage ? '#141416' : '#E5E4DC', minHeight: 22 }} />}
              </div>
              <p className={`text-sm pb-6 pt-1 ${i <= stage ? 'font-bold' : 'text-zinc-400'}`}>{s.label}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm font-bold text-red-600">Este pedido foi cancelado. Fale com {storeName} no {storePhone}.</p>
      )}

      <div className="mt-4 p-4 bg-white border border-zinc-200 rounded-xl">
        <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">Resumo · {order.customer_name}</p>
        <div className="mt-2 space-y-1.5 text-sm">
          {order.items.map((it, i) => (
            <div key={i}>
              <p>{it.quantity}× {it.name} — <span className="font-mono font-bold">{money(it.subtotal)}</span></p>
              {it.options.map((o, j) => (
                <p key={j} className="text-[11px] text-zinc-500">+ {o.option_name}</p>
              ))}
            </div>
          ))}
        </div>
        <p className="font-mono font-bold mt-3 pt-2 border-t border-zinc-100 flex justify-between"><span>Total</span><span>{money(order.total)}</span></p>
      </div>
    </div>
  )
}
