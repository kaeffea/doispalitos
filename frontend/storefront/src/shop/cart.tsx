import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { StoreProduct } from '../studio/types'

export interface CartOptionPick {
  group_id: string
  group_name: string
  option_id: string
  option_name: string
  price_modifier: number
}

export interface CartItem {
  key: string
  product_id: string
  name: string
  base_price: number
  image?: string | null
  hue: number
  quantity: number
  notes?: string
  picks: CartOptionPick[]
}

export function unitPrice(item: CartItem): number {
  return item.base_price + item.picks.reduce((a, p) => a + p.price_modifier, 0)
}

export function lineTotal(item: CartItem): number {
  return unitPrice(item) * item.quantity
}

interface AddInput {
  product: StoreProduct
  quantity: number
  notes?: string
  picks: CartOptionPick[]
}

interface CartCtx {
  items: CartItem[]
  count: number
  subtotal: number
  add: (input: AddInput) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

function samePicks(a: CartOptionPick[], b: CartOptionPick[]): boolean {
  if (a.length !== b.length) return false
  const ka = [...a].map((p) => `${p.group_id}:${p.option_id}`).sort().join('|')
  const kb = [...b].map((p) => `${p.group_id}:${p.option_id}`).sort().join('|')
  return ka === kb
}

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const storageKey = `sf_cart_${slug}`
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {
      /* sem storage, segue sem persistir */
    }
  }, [items, storageKey])

  const value = useMemo<CartCtx>(() => {
    const add: CartCtx['add'] = ({ product, quantity, notes, picks }) => {
      const trimmedNotes = notes?.trim() ? notes.trim() : undefined
      setItems((prev) => {
        const found = prev.find(
          (it) => it.product_id === product.id && (it.notes ?? undefined) === trimmedNotes && samePicks(it.picks, picks),
        )
        if (found) {
          return prev.map((it) => (it.key === found.key ? { ...it, quantity: Math.min(20, it.quantity + quantity) } : it))
        }
        return [
          ...prev,
          {
            key: `${product.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`,
            product_id: product.id,
            name: product.name,
            base_price: Number(product.price) || 0,
            image: product.image ?? null,
            hue: product.hue,
            quantity,
            notes: trimmedNotes,
            picks,
          },
        ]
      })
    }
    const setQty: CartCtx['setQty'] = (key, qty) => {
      setItems((prev) =>
        qty <= 0 ? prev.filter((it) => it.key !== key) : prev.map((it) => (it.key === key ? { ...it, quantity: Math.min(20, qty) } : it)),
      )
    }
    const remove: CartCtx['remove'] = (key) => setItems((prev) => prev.filter((it) => it.key !== key))
    const clear = () => setItems([])
    const count = items.reduce((a, it) => a + it.quantity, 0)
    const subtotal = items.reduce((a, it) => a + lineTotal(it), 0)
    return { items, count, subtotal, add, setQty, remove, clear }
  }, [items])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart fora do <CartProvider>')
  return ctx
}

export const money = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
