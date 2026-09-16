import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import StorefrontRenderer from '../StorefrontRenderer'
import { PRESETS } from '../studio/presets'
import { LOJA_CHEIA } from '../studio/mocks'
import { cssVars } from '../studio/types'
import type { StoreData, StoreProduct } from '../studio/types'
import { CartProvider, money, useCart } from '../shop/cart'
import { detectStore, resolveByHost, resolveStore, type ResolvedStore } from '../shop/api'
import ProductModal, { type ModalPick } from '../components/ProductModal'
import CartDrawer from '../components/CartDrawer'

function hueOf(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

function toStore(res: ResolvedStore): StoreData {
  const t = res.tenant
  return {
    id: t.slug,
    name: t.name,
    slug: t.slug,
    tagline: [t.neighborhood, t.city].filter(Boolean).join(' · '),
    logoText: t.name.trim().slice(0, 2).toUpperCase(),
    rating: 0,
    reviewsCount: 0,
    deliveryTime: res.live.prep_time_min ? `~${res.live.prep_time_min} min` : '—',
    deliveryFee: '—',
    address: [t.street, t.number, t.neighborhood, t.city].filter(Boolean).join(', '),
    phone: (t as { phone?: string }).phone ?? '',
    hours: '',
    story: '',
    categories: res.menu.categories.map((c: { id: string; name: string }) => ({ id: String(c.id), name: c.name, icon: 'pizza' })),
    products: res.menu.products.map((p: Record<string, unknown>) => ({
      id: String(p.id),
      category_id: String(p.category_id),
      name: String(p.name),
      description: (p.description as string) ?? '',
      price: Number(p.price) || 0,
      badge: p.is_featured ? 'mais_pedido' : null,
      is_available: Boolean(p.is_available),
      hue: hueOf(String(p.id)),
      image: (p.image_url as string | null) ?? null,
      option_groups: ((p.optionGroups ?? p.option_groups ?? []) as Array<Record<string, unknown>>).map((g) => ({
        id: String(g.id),
        name: String(g.name),
        min_options: Number(g.min_options) || 0,
        max_options: Number(g.max_options) || 1,
        is_required: Boolean(g.is_required),
        options: ((g.options ?? []) as Array<Record<string, unknown>>).map((o) => ({
          id: String(o.id),
          name: String(o.name),
          price_modifier: Number(o.price_modifier) || 0,
          is_available: o.is_available !== false,
        })),
      })),
    })),
    promos: [],
    reviews: [],
  }
}

function ShopBody({ slug, data }: { slug: string; data: ResolvedStore | null }) {
  const navigate = useNavigate()
  const { count, subtotal, add } = useCart()
  const [modalProduct, setModalProduct] = useState<StoreProduct | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const editorial = PRESETS[0]
  const theme = data?.storefront?.theme ?? editorial.theme
  const sections = (data?.storefront?.sections ?? editorial.sections).filter((s) => s.type !== 'cartbar')
  const overrides = data?.storefront?.overrides ?? {}
  const store: StoreData = useMemo(
    () => (data ? toStore(data) : { ...LOJA_CHEIA, name: 'Loja demonstração', slug: 'demo' }),
    [data],
  )
  const status = data ? (data.live.is_open ? 'open' as const : 'closed' as const) : ('open' as const)

  return (
    <div className="min-h-screen" style={{ ...cssVars(theme), background: 'var(--sf-bg)' }}>
      {!data?.live.is_open && data && (
        <div className="px-5 py-2.5 text-center text-xs font-bold" style={{ background: '#dc2626', color: '#fff' }}>
          Fechado agora — explore o cardápio, o pedido libera na abertura.
        </div>
      )}
      <StorefrontRenderer
        preset={{ theme, sections, overrides }}
        store={store}
        status={status}
        onSelectProduct={(p) => {
          if (!p.is_available) return
          setModalProduct(p)
        }}
      />
      {count > 0 && (
        <div className="px-5 mt-6 sticky bottom-4 z-30">
          <div className="mx-auto w-full max-w-[420px]">
            <button
              onClick={() => setDrawerOpen(true)}
              className="sf-pressable w-full flex items-center justify-between px-5 py-4 sf-font-head font-bold text-sm"
              style={{ background: 'var(--sf-text)', color: 'var(--sf-bg)', borderRadius: 18, boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}
            >
              <span className="flex items-center gap-2"><ShoppingBag size={17} /> Sacola · {count} {count === 1 ? 'item' : 'itens'}</span>
              <span className="font-mono">{money(subtotal)} →</span>
            </button>
          </div>
        </div>
      )}
      <ProductModal
        product={modalProduct as (StoreProduct & { option_groups?: [] }) | null}
        onClose={() => setModalProduct(null)}
        onAdd={(p, pick: ModalPick) => {
          add({ product: p, quantity: pick.quantity, notes: pick.notes, picks: pick.picks })
          setModalProduct(null)
        }}
      />
      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slug={slug}
        canOrder={!data || data.live.is_open}
        settings={{
          delivery: (data?.settings.delivery ?? { enabled: true }) as { enabled?: boolean; min_order_amount?: number | null },
          pickup: (data?.settings.pickup ?? { enabled: true }) as { enabled?: boolean },
          dine_in: (data?.settings.dine_in ?? { enabled: false }) as { enabled?: boolean },
          payment_methods: (data?.settings.payment_methods ?? { pix: true, cash: true }) as Record<string, boolean | number>,
        }}
        onSubmitted={(uuid) => {
          setDrawerOpen(false)
          navigate(`/pedido/${uuid}`)
        }}
      />
    </div>
  )
}

export default function ShopPage() {
  const [params] = useSearchParams()
  const detected = detectStore()
  const slug = params.get('loja') || detected.slug || 'demo'
  const useByHost = !params.get('loja') && !detected.slug && detected.byHost
  const [data, setData] = useState<ResolvedStore | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(slug !== 'demo')

  useEffect(() => {
    if (slug === 'demo' && !useByHost) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    ;(useByHost ? resolveByHost() : resolveStore(slug))
      .then((res) => {
        setData(res)
        setFailed(false)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [slug, useByHost])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-sm text-zinc-500">Abrindo cardápio…</div>
  }

  if (failed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-bold">Não achamos essa loja.</p>
        <p className="text-sm text-zinc-500">Confira o endereço ou veja a <a className="underline" href="?loja=demo">loja demonstração</a>.</p>
      </div>
    )
  }

  return (
    <CartProvider slug={data?.tenant.slug ?? slug}>
      <ShopBody slug={data?.tenant.slug ?? slug} data={data} />
    </CartProvider>
  )
}
