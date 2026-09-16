import { useMemo, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import type { StoreProduct } from '../studio/types'
import { ProductArt } from '../blocks/StoreBlocks'
import { money } from '../shop/cart'

interface Group {
  id: string
  name: string
  min_options: number
  max_options: number
  is_required: boolean
  options: Array<{ id: string; name: string; price_modifier: number; is_available: boolean }>
}

export interface ModalPick {
  picks: Array<{ group_id: string; group_name: string; option_id: string; option_name: string; price_modifier: number }>
  quantity: number
  notes: string
}

export default function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: (StoreProduct & { option_groups?: Group[] }) | null
  onClose: () => void
  onAdd: (product: StoreProduct, pick: ModalPick) => void
}) {
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const groups: Group[] = useMemo(() => product?.option_groups ?? [], [product])

  if (!product) return null

  const toggle = (group: Group, optionId: string) => {
    setError(null)
    setSel((prev) => {
      const cur = prev[group.id] ?? []
      if (group.max_options === 1) return { ...prev, [group.id]: [optionId] }
      if (cur.includes(optionId)) return { ...prev, [group.id]: cur.filter((id) => id !== optionId) }
      if (cur.length >= group.max_options) {
        setError(`Em ${group.name} dá pra escolher até ${group.max_options}.`)
        return prev
      }
      return { ...prev, [group.id]: [...cur, optionId] }
    })
  }

  const extras = groups.reduce((acc, g) => {
    const ids = sel[g.id] ?? []
    return acc + g.options.filter((o) => ids.includes(o.id)).reduce((a, o) => a + Number(o.price_modifier || 0), 0)
  }, 0)

  const submit = () => {
    for (const g of groups) {
      const n = (sel[g.id] ?? []).length
      if (n < g.min_options) {
        setError(`Escolha ao menos ${g.min_options} opção em ${g.name}.`)
        return
      }
    }
    const picks = groups.flatMap((g) =>
      (sel[g.id] ?? []).map((id) => {
        const o = g.options.find((x) => x.id === id)!
        return { group_id: g.id, group_name: g.name, option_id: o.id, option_name: o.name, price_modifier: Number(o.price_modifier) || 0 }
      }),
    )
    onAdd(product, { picks, quantity: qty, notes })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--sf-surface)', color: 'var(--sf-text)', borderRadius: '20px 20px 0 0' }}
      >
        <div className="sticky top-0 flex justify-end p-3 pb-0" style={{ background: 'var(--sf-surface)' }}>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-full" style={{ background: 'var(--sf-surface-2)' }}>
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 -mt-2">
          <ProductArt hue={product.hue} name={product.name} variant="photo-top" image={product.image} />
          <h2 className="sf-font-head text-xl font-extrabold mt-3">{product.name}</h2>
          {product.description && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--sf-muted)' }}>{product.description}</p>
          )}
          <p className="font-mono font-bold mt-2">{money(Number(product.price))}</p>

          {groups.map((g) => (
            <div key={g.id} className="mt-5">
              <p className="sf-font-head text-sm font-bold">
                {g.name}{' '}
                <span className="font-mono text-[10px] font-normal" style={{ color: 'var(--sf-muted)' }}>
                  {g.min_options > 0 ? `escolha ${g.min_options}` : 'opcional'}
                  {g.max_options > 1 ? ` · até ${g.max_options}` : ''}
                </span>
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {g.options.filter((o) => o.is_available).map((o) => {
                  const on = (sel[g.id] ?? []).includes(o.id)
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(g, o.id)}
                      className="text-xs font-semibold px-3.5 py-2.5"
                      style={{
                        borderRadius: 999,
                        background: on ? 'var(--sf-text)' : 'transparent',
                        color: on ? 'var(--sf-bg)' : 'var(--sf-text)',
                        border: '1.5px solid var(--sf-border)',
                      }}
                    >
                      {o.name}{Number(o.price_modifier) > 0 ? ` +${money(Number(o.price_modifier))}` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observação pra cozinha (ex: sem cebola)"
            maxLength={280}
            className="w-full mt-5 px-4 py-3 text-sm bg-transparent outline-none"
            style={{ border: '1.5px solid var(--sf-border)', borderRadius: 'var(--sf-radius)' }}
          />

          {error && <p className="text-xs font-semibold mt-3" style={{ color: '#dc2626' }}>{error}</p>}

          <div className="flex items-center gap-3 mt-5">
            <div className="flex items-center gap-3 px-2" style={{ border: '1.5px solid var(--sf-border)', borderRadius: 999, padding: '8px 12px' }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Diminuir"><Minus size={15} /></button>
              <span className="font-mono font-bold w-5 text-center">{qty}</span>
              <button onClick={() => setQty(Math.min(20, qty + 1))} aria-label="Aumentar"><Plus size={15} /></button>
            </div>
            <button
              onClick={submit}
              className="sf-pressable flex-1 sf-font-head font-bold text-sm px-5 py-3.5"
              style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: 'var(--sf-radius)' }}
            >
              Adicionar · {money((Number(product.price) + extras) * qty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
