import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Minus, Plus, Trash2, X } from 'lucide-react'
import { lineTotal, money, useCart } from '../shop/cart'
import type { Channel } from '../shop/api'
import { createOrder, fetchDeliveryFee } from '../shop/api'

interface Props {
  open: boolean
  onClose: () => void
  slug: string
  settings: {
    delivery: { enabled?: boolean; min_order_amount?: number | null }
    pickup: { enabled?: boolean }
    dine_in: { enabled?: boolean }
    payment_methods: Record<string, boolean | number>
  }
  onSubmitted: (uuid: string) => void
  canOrder?: boolean
}

const PAY_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Crédito na entrega',
  debit_card: 'Débito na entrega',
  cash: 'Dinheiro',
}

export default function CartDrawer({ open, onClose, slug, settings, onSubmitted, canOrder = true }: Props) {
  const { items, subtotal, setQty, remove, clear } = useCart()
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<Channel>('delivery')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [postal, setPostal] = useState('')
  const [table, setTable] = useState('')
  const [payment, setPayment] = useState('pix')
  const [changeFor, setChangeFor] = useState('')
  const [notes, setNotes] = useState('')
  const [fee, setFee] = useState(0)
  const [feeError, setFeeError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channels: Array<{ id: Channel; label: string; enabled: boolean }> = [
    { id: 'delivery', label: 'Entrega', enabled: Boolean(settings.delivery?.enabled) },
    { id: 'pickup', label: 'Retirada', enabled: Boolean(settings.pickup?.enabled) },
    { id: 'dine_in', label: 'Na mesa', enabled: Boolean(settings.dine_in?.enabled) },
  ]
  const activeChannels = channels.filter((c) => c.enabled)
  const payments = Object.keys(PAY_LABELS).filter((k) => settings.payment_methods?.[k])

  useEffect(() => {
    if (!open) return
    setStep('cart')
    setError(null)
    if (activeChannels.length > 0 && !activeChannels.some((c) => c.id === channel)) {
      setChannel(activeChannels[0].id)
    }
    if (payments.length > 0 && !payments.includes(payment)) {
      setPayment(payments[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ])

  useEffect(() => {
    if (channel !== 'delivery' || !neighborhood.trim()) {
      setFee(0)
      setFeeError(null)
      return
    }
    setFeeError(null)
    const t = setTimeout(async () => {
      try {
        const v = await fetchDeliveryFee(slug, { neighborhood: neighborhood.trim() })
        setFee(v)
      } catch {
        setFeeError('Não achamos esse bairro na área de entrega.')
      }
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, neighborhood, slug])

  if (!open) return null

  const minOrder = Number(settings.delivery?.min_order_amount) || 0
  const total = subtotal + (channel === 'delivery' ? fee : 0)

  const submit = async () => {
    setError(null)
    if (!canOrder) return setError('A loja está fechada agora — o pedido libera na abertura.')
    if (name.trim().length < 2) return setError('Conte pra gente o seu nome.')
    if (phone.replace(/\D/g, '').length < 10) return setError('WhatsApp incompleto (DDD + número).')
    if (items.length === 0) return setError('Sua sacola está vazia.')
    if (channel === 'delivery') {
      if (!street.trim() || !number.trim() || !neighborhood.trim()) return setError('Complete rua, número e bairro para entrega.')
      if (feeError) return setError(feeError)
      if (minOrder > 0 && subtotal < minOrder) return setError(`Pedido mínimo para entrega: ${money(minOrder)}.`)
    }
    if (channel === 'dine_in' && !table.trim()) return setError('Informe o número da mesa.')
    setSending(true)
    try {
      const order = await createOrder(slug, {
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, ''),
        channel,
        address: channel === 'delivery' ? { street, number, complement, neighborhood, city, postal_code: postal } : undefined,
        table_number: channel === 'dine_in' ? table.trim() : undefined,
        payment_method: payment,
        change_for: payment === 'cash' && changeFor ? Number(changeFor) : undefined,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          notes: it.notes,
          options: Object.values(
            it.picks.reduce<Record<string, { group_id: string; option_ids: string[] }>>((acc, p) => {
              acc[p.group_id] = acc[p.group_id] ?? { group_id: p.group_id, option_ids: [] }
              acc[p.group_id].option_ids.push(p.option_id)
              return acc
            }, {}),
          ),
        })),
      })
      clear()
      onSubmitted(order.public_uuid)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const first = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : undefined
      setError(first || err.response?.data?.message || 'Não deu pra enviar. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  const inputCls = 'w-full px-4 py-3 text-sm bg-transparent outline-none'
  const inputStyle = { border: '1.5px solid var(--sf-border)', borderRadius: 'var(--sf-radius)' } as const

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-full overflow-y-auto" style={{ background: 'var(--sf-bg)', color: 'var(--sf-text)' }}>
        <div className="sticky top-0 flex items-center gap-2 px-5 py-4" style={{ background: 'var(--sf-bg)', borderBottom: '1px solid var(--sf-border)' }}>
          {step === 'checkout' ? (
            <button onClick={() => setStep('cart')} aria-label="Voltar"><ArrowLeft size={18} /></button>
          ) : (
            <button onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          )}
          <h2 className="sf-font-head font-extrabold">{step === 'cart' ? 'Sua sacola' : 'Finalizar pedido'}</h2>
        </div>

        <div className="px-5 py-4 pb-10">
          {step === 'cart' && (
            <>
              {items.length === 0 && <p className="text-sm" style={{ color: 'var(--sf-muted)' }}>Sacola vazia — que tal uma pizza?</p>}
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.key} className="p-3" style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 'var(--sf-radius)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="sf-font-head text-sm font-bold">{it.quantity}× {it.name}</p>
                        {it.picks.map((p) => (
                          <p key={p.option_id} className="text-[11px]" style={{ color: 'var(--sf-muted)' }}>+ {p.option_name}</p>
                        ))}
                        {it.notes && <p className="text-[11px] italic" style={{ color: 'var(--sf-muted)' }}>“{it.notes}”</p>}
                      </div>
                      <button onClick={() => remove(it.key)} aria-label="Remover" className="p-1 opacity-50"><Trash2 size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQty(it.key, it.quantity - 1)} aria-label="Diminuir" className="p-1.5 rounded-full" style={{ background: 'var(--sf-surface-2)' }}><Minus size={13} /></button>
                        <span className="font-mono text-xs font-bold w-5 text-center">{it.quantity}</span>
                        <button onClick={() => setQty(it.key, it.quantity + 1)} aria-label="Aumentar" className="p-1.5 rounded-full" style={{ background: 'var(--sf-surface-2)' }}><Plus size={13} /></button>
                      </div>
                      <span className="font-mono text-sm font-bold">{money(lineTotal(it))}</span>
                    </div>
                  </div>
                ))}
              </div>
              {items.length > 0 && (
                <button
                  onClick={() => setStep('checkout')}
                  className="sf-pressable w-full sf-font-head font-bold text-sm px-5 py-4 mt-5"
                  style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: 'var(--sf-radius)' }}
                >
                  Continuar · {money(subtotal)}
                </button>
              )}
            </>
          )}

          {step === 'checkout' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {activeChannels.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    className="flex-1 text-xs font-bold px-3 py-2.5"
                    style={{
                      borderRadius: 999,
                      background: channel === c.id ? 'var(--sf-text)' : 'transparent',
                      color: channel === c.id ? 'var(--sf-bg)' : 'var(--sf-text)',
                      border: '1.5px solid var(--sf-border)',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" maxLength={120} className={inputCls} style={inputStyle} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Seu WhatsApp (DDD + número)" inputMode="tel" maxLength={20} className={inputCls} style={inputStyle} />

              {channel === 'delivery' && (
                <>
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua / Avenida" className={inputCls} style={inputStyle} />
                    <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Nº" className={inputCls} style={inputStyle} />
                  </div>
                  <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Complemento (opcional)" className={inputCls} style={inputStyle} />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" className={inputCls} style={inputStyle} />
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className={inputCls} style={inputStyle} />
                  </div>
                  <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="CEP (opcional)" inputMode="numeric" className={inputCls} style={inputStyle} />
                  {feeError ? (
                    <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>{feeError}</p>
                  ) : (
                    <p className="font-mono text-xs" style={{ color: 'var(--sf-muted)' }}>Entrega: {money(fee)}</p>
                  )}
                </>
              )}

              {channel === 'dine_in' && (
                <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Número da mesa" className={inputCls} style={inputStyle} />
              )}

              <p className="font-mono text-[11px] uppercase tracking-widest pt-1" style={{ color: 'var(--sf-muted)' }}>Pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {payments.map((k) => (
                  <button
                    key={k}
                    onClick={() => setPayment(k)}
                    className="text-xs font-bold px-3 py-2.5"
                    style={{
                      borderRadius: 'var(--sf-radius)',
                      background: payment === k ? 'var(--sf-text)' : 'transparent',
                      color: payment === k ? 'var(--sf-bg)' : 'var(--sf-text)',
                      border: '1.5px solid var(--sf-border)',
                    }}
                  >
                    {PAY_LABELS[k]}
                  </button>
                ))}
              </div>
              {payment === 'cash' && (
                <input value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Troco para quanto? (opcional)" inputMode="decimal" className={inputCls} style={inputStyle} />
              )}
              {payment === 'pix' && (
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--sf-muted)' }}>PIX: o restaurante confirma o pagamento na entrega. QR Code automático chega numa próxima atualização.</p>
              )}

              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação geral (opcional)" maxLength={500} className={inputCls} style={inputStyle} />

              <div className="font-mono text-xs space-y-1 pt-1" style={{ color: 'var(--sf-muted)' }}>
                <p className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></p>
                {channel === 'delivery' && <p className="flex justify-between"><span>Entrega</span><span>{money(fee)}</span></p>}
                <p className="flex justify-between font-bold text-sm" style={{ color: 'var(--sf-text)' }}><span>Total</span><span>{money(total)}</span></p>
              </div>

              {error && <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>{error}</p>}

              <button
                onClick={submit}
                disabled={sending}
                className="sf-pressable w-full sf-font-head font-bold text-sm px-5 py-4 disabled:opacity-50"
                style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: 'var(--sf-radius)' }}
              >
                {sending ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Enviar pedido · ${money(total)}`}
              </button>
              <p className="text-[11px] text-center" style={{ color: 'var(--sf-muted)' }}>Preço final sempre conferido pela loja.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
