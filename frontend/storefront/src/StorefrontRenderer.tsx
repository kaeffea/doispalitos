import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react'
import type { PageSection, SfPreset, StoreData, StoreProduct, StoreStatus } from './studio/types'
import { cssVars, resolveArt } from './studio/types'
import {
  CartBar,
  CategoriesBlock,
  ComboBlock,
  FeaturedBlock,
  FooterBlock,
  HeaderBlock,
  HeroBlock,
  HoursBlock,
  InfoBlock,
  InstagramBlock,
  LoyaltyBlock,
  MapBlock,
  PaymentBlock,
  ProductsBlock,
  PromoBlock,
  ReviewsBlock,
  ScheduleBlock,
  SearchBlock,
  SfArmed,
  StatusBlock,
  StoryBlock,
  UpsellBlock,
  VideoBlock,
} from './blocks/StoreBlocks'

/* Renderer puro: mesmo código, sites irreconhecíveis.
   No Studio (editable) o próprio preview vira o canvas: clique seleciona,
   clique-no-texto edita no lugar, alça ⋮⋮ arrasta, linha azul mostra o drop
   (acima, abaixo ou AO LADO para formar duplas). Blocos sem dado real
   ganham fantasma de exemplo com selo + dica de onde cadastrar. */

export type DropMode = 'before' | 'after' | 'beside'

export interface RendererEditing {
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMove?: (id: string, dir: -1 | 1) => void
  onToggle?: (id: string) => void
  onRemove?: (id: string) => void
  onReorder?: (dragId: string, targetId: string, mode: DropMode) => void
  onEditText?: (id: string, key: string, value: string) => void
  onSelectProduct?: (p: StoreProduct) => void
}

const GHOST_PROMOS: StoreData['promos'] = [
  { id: 'g1', title: 'Terça da Pizza', subtitle: '10% OFF nas grandes com', coupon: 'TERCA10' },
  { id: 'g2', title: 'Frete amigo', subtitle: 'Entrega com taxa fixa com', coupon: 'CENTRO6' },
]

const GHOST_PRODUCTS: StoreData['products'] = [
  { id: 'g1', category_id: 'g', name: 'Pizza exemplo', description: 'Calabresa, mozzarella e orégano.', price: 52.9, badge: 'mais_pedido', is_available: true, hue: 12, image: null },
  { id: 'g2', category_id: 'g', name: 'Burger exemplo', description: 'Blend 180g, cheddar e bacon.', price: 34.9, badge: 'mais_pedido', is_available: true, hue: 40, image: null },
  { id: 'g3', category_id: 'g', name: 'Suco exemplo', description: 'Maracujá natural 500ml.', price: 12, badge: null, is_available: true, hue: 55, image: null },
]

function strProp(props: PageSection['props'], key: string): string | undefined {
  const v = props?.[key]
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function numProp(props: PageSection['props'], key: string): number | undefined {
  const v = props?.[key]
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

function boolProp(props: PageSection['props'], key: string, dflt: boolean): boolean {
  const v = props?.[key]
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true'
  if (typeof v === 'number') return v !== 0
  return dflt
}

function withAlpha(hex: string, alpha: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${alpha}`
  return hex
}

function dropPos(e: React.DragEvent): DropMode {
  const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
  const y = (e.clientY - r.top) / Math.max(1, r.height)
  if (y < 0.5) return 'before'
  return 'after'
}

/* Selo do fantasma: diz que é exemplo + onde cadastrar de verdade */

function ghostFor(s: PageSection, store: StoreData, status: StoreStatus): string | null {
  if (s.type === 'promo' && store.promos.length === 0) return 'exemplo · cadastre cupons'
  if (s.type === 'featured' && !store.products.some((p) => p.badge === 'mais_pedido')) {
    return store.products.length > 0 ? 'exemplo · marque Mais pedidos' : 'exemplo · cadastre produtos'
  }
  if (s.type === 'upsell' && !store.products.some((p) => p.is_available)) return 'exemplo · produtos disponíveis'
  if (s.type === 'cartbar' && (store.products.length === 0 || status !== 'open')) return 'exemplo · loja aberta com produtos'
  return null
}

function ghostStoreFor(s: PageSection, store: StoreData): StoreData {
  if (s.type === 'promo' && store.promos.length === 0) return { ...store, promos: GHOST_PROMOS }
  if (s.type === 'featured' && !store.products.some((p) => p.badge === 'mais_pedido')) {
    const base = store.products.length > 0 ? store.products : GHOST_PRODUCTS
    return {
      ...store,
      products: base.slice(0, 4).map((p, i) => (i < 2 ? { ...p, badge: 'mais_pedido' as const } : p)),
    }
  }
  if (s.type === 'upsell' && !store.products.some((p) => p.is_available)) {
    const base = store.products.length > 0 ? store.products : GHOST_PRODUCTS
    return { ...store, products: base.map((p) => ({ ...p, is_available: true })) }
  }
  return store
}

export default function StorefrontRenderer({
  preset,
  store,
  status,
  device = 'mobile',
  editable,
  selectedId,
  onSelect,
  onMove,
  onToggle,
  onRemove,
  onReorder,
  onEditText,
  onSelectProduct,
}: {
  preset: SfPreset
  store: StoreData
  status: StoreStatus
  device?: 'mobile' | 'desktop'
} & RendererEditing) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('all')
  const [drop, setDrop] = useState<{ id: string; pos: DropMode } | null>(null)
  const { theme, sections } = preset

  /* Selos forçados na vitrine (sem mexer no cardápio real) */
  const effStore = useMemo(() => {
    const ob = preset.overrides?.productBadges
    if (!ob || Object.keys(ob).length === 0) return store
    return {
      ...store,
      products: store.products.map((p) =>
        ob[p.id] !== undefined && ob[p.id] !== (p.badge ?? null) ? { ...p, badge: ob[p.id] } : p,
      ),
    }
  }, [preset.overrides, store])

  const bgMode = theme.bgMode ?? 'solid'
  const textureClass =
    bgMode === 'solid' && theme.texture === 'paper'
      ? 'sf-texture-paper'
      : bgMode === 'solid' && theme.texture === 'dots'
        ? 'sf-texture-dots'
        : bgMode === 'solid' && theme.texture === 'grid'
          ? 'sf-texture-grid'
          : ''
  const motionClass = `sf-motion-${theme.motion ?? 'subtle'}`

  const visibleSections = useMemo(
    () =>
      sections.filter((s: PageSection) => {
        if (s.visible === false) return false
        if (s.showIf === 'open' && status !== 'open') return false
        if (s.showIf === 'closed' && status === 'open') return false
        return true
      }),
    [sections, status],
  )

  /* Agrupa metades consecutivas em linhas de 2 colunas (pensamento horizontal).
     Sacola é sempre largura total. */
  const rows = useMemo(() => {
    const out: PageSection[][] = []
    visibleSections.forEach((s) => {
      const half = (s.width ?? 'full') === 'half' && s.type !== 'cartbar'
      const last = out[out.length - 1]
      if (half && last && last.length === 1 && ((last[0].width ?? 'full') === 'half') && last[0].type !== 'cartbar') {
        last.push(s)
      } else {
        out.push([s])
      }
    })
    return out
  }, [visibleSections])

  const editFor = (s: PageSection) =>
    onEditText ? (key: string, value: string) => onEditText(s.id, key, value) : undefined

  /* Mesmo bloco, modelo por aparelho: no PC usa o modelo próprio se definido */
  const pick = (s: PageSection): string | undefined =>
    device === 'desktop' && s.variantDesktop ? s.variantDesktop : s.variant

  const renderSection = (s: PageSection, st: StoreData) => {
    const p = s.props
    switch (s.type) {
      case 'header':
        return <HeaderBlock theme={theme} store={st} variant={pick(s)} edit={editFor(s)} active={active} setActive={setActive} props={{ name: strProp(p, 'name'), tagline: strProp(p, 'tagline') }} />
      case 'status':
        return <StatusBlock status={status} store={st} variant={pick(s)} label={strProp(p, 'label')} edit={editFor(s)} />
      case 'hero':
        return (
          <HeroBlock
            theme={theme}
            store={st}
            status={status}
            variant={pick(s)}
            edit={editFor(s)}
            props={{
              kicker: strProp(p, 'kicker'),
              title: strProp(p, 'title'),
              subtitle: strProp(p, 'subtitle'),
              ctaPrimary: strProp(p, 'ctaPrimary'),
              ctaSecondary: strProp(p, 'ctaSecondary'),
              imageUrl: strProp(p, 'imageUrl'),
            }}
          />
        )
      case 'search':
        return <SearchBlock query={query} setQuery={setQuery} placeholder={strProp(p, 'placeholder')} />
      case 'categories':
        return <CategoriesBlock theme={theme} store={st} active={active} setActive={setActive} variant={pick(s)} />
      case 'products':
        return (
          <ProductsBlock
            theme={theme}
            store={st}
            active={active}
            query={query}
            heading={strProp(p, 'heading')}
            cardVariant={pick(s)}
            edit={editFor(s)}
            onSelect={onSelectProduct}
          />
        )
      case 'promo':
        return <PromoBlock theme={theme} store={st} variant={pick(s)} />
      case 'featured':
        return <FeaturedBlock theme={theme} store={st} title={strProp(p, 'title')} edit={editFor(s)} variant={pick(s)} onSelect={onSelectProduct} />
      case 'loyalty':
        return (
          <LoyaltyBlock
            theme={theme}
            edit={editFor(s)}
            props={{
              title: strProp(p, 'title'),
              subtitle: strProp(p, 'subtitle'),
              goal: numProp(p, 'goal'),
              filled: numProp(p, 'filled'),
            }}
          />
        )
      case 'combo':
        return (
          <ComboBlock
            theme={theme}
            variant={pick(s)}
            edit={editFor(s)}
            props={{
              title: strProp(p, 'title'),
              subtitle: strProp(p, 'subtitle'),
              price: strProp(p, 'price'),
              tag: strProp(p, 'tag'),
              photo: strProp(p, 'photo'),
            }}
          />
        )
      case 'schedule':
        return (
          <ScheduleBlock
            theme={theme}
            edit={editFor(s)}
            props={{ title: strProp(p, 'title'), subtitle: strProp(p, 'subtitle'), button: strProp(p, 'button') }}
          />
        )
      case 'upsell':
        return <UpsellBlock theme={theme} store={st} edit={editFor(s)} props={{ title: strProp(p, 'title') }} onSelect={onSelectProduct} />
      case 'reviews':
        return <ReviewsBlock theme={theme} store={st} title={strProp(p, 'title')} edit={editFor(s)} variant={pick(s)} />
      case 'story':
        return <StoryBlock theme={theme} store={st} text={strProp(p, 'text')} edit={editFor(s)} photo={strProp(p, 'photo')} editableHint={!!editable} />
      case 'instagram':
        return <InstagramBlock theme={theme} props={{ handle: strProp(p, 'handle') }} edit={editFor(s)} />
      case 'map':
        return <MapBlock theme={theme} store={st} edit={editFor(s)} props={{ address: strProp(p, 'address') }} />
      case 'video':
        return <VideoBlock theme={theme} edit={editFor(s)} props={{ title: strProp(p, 'title'), videoUrl: strProp(p, 'videoUrl') }} />
      case 'hours':
        return (
          <HoursBlock
            theme={theme}
            edit={editFor(s)}
            props={{ title: strProp(p, 'title'), text: strProp(p, 'text'), note: strProp(p, 'note') }}
          />
        )
      case 'payment':
        return (
          <PaymentBlock
            theme={theme}
            props={{ title: strProp(p, 'title'), pix: boolProp(p, 'pix', true), card: boolProp(p, 'card', true), cash: boolProp(p, 'cash', true) }}
          />
        )
      case 'info':
        return <InfoBlock theme={theme} store={st} variant={pick(s)} />
      case 'footer':
        return <FooterBlock store={st} note={strProp(p, 'note')} edit={editFor(s)} variant={pick(s)} />
      case 'cartbar': {
        const show = status === 'open' && st.products.length > 0
        if (!show && !editable) return null
        return (
          <div style={show ? undefined : { opacity: 0.6 }}>
            <CartBar theme={theme} label={strProp(p, 'label')} action={strProp(p, 'action')} edit={editFor(s)} />
          </div>
        )
      }
      default:
        return null
    }
  }

  let order = 0

  const wrap = (s: PageSection, node: React.ReactNode, ghost: string | null) => {
    if (!node) return null
    const delay = Math.min(order++ * 60, 480)
    const content = editable ? <SfArmed armed={selectedId === s.id}>{node}</SfArmed> : node
    if (!editable) {
      return (
        <div key={s.id} className="sf-anim" style={{ animationDelay: `${delay}ms` }}>
          {content}
        </div>
      )
    }
    const isSelected = selectedId === s.id
    const hidden = s.visible === false
    const dropHere = drop?.id === s.id ? drop.pos : null
    return (
      <div
        key={s.id}
        onDragOver={(e) => {
          e.preventDefault()
          const pos = dropPos(e)
          setDrop((d) => (d?.id === s.id && d.pos === pos ? d : { id: s.id, pos }))
        }}
        onDragLeave={() => setDrop((d) => (d?.id === s.id ? null : d))}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const dragId = e.dataTransfer.getData('text/sf-id')
          const pos = dropPos(e)
          setDrop(null)
          if (dragId && dragId !== s.id) onReorder?.(dragId, s.id, pos)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(s.id)
        }}
        className={`sf-anim sf-editable ${isSelected ? 'sf-selected' : ''} ${dropHere ? `sf-drop-${dropHere}` : ''}`}
        style={{ animationDelay: `${delay}ms`, opacity: hidden ? 0.55 : 1 }}
        title="Clique para editar · arraste pela alça ⋮⋮ para mover"
      >
        <div className="sf-toolbar" onClick={(e) => e.stopPropagation()}>
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/sf-id', s.id)
              e.stopPropagation()
            }}
            title="Arrastar para mover (solte acima, abaixo ou ao lado)"
            style={{ cursor: 'grab', color: '#fff', padding: 5, borderRadius: 999, display: 'flex' }}
          >
            <GripVertical size={13} />
          </span>
          <button onClick={() => onMove?.(s.id, -1)} title="Subir"><ArrowUp size={13} /></button>
          <button onClick={() => onMove?.(s.id, 1)} title="Descer"><ArrowDown size={13} /></button>
          <button onClick={() => onToggle?.(s.id)} title={hidden ? 'Mostrar' : 'Ocultar'}>
            {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button className="danger" onClick={() => onRemove?.(s.id)} title="Remover"><Trash2 size={13} /></button>
        </div>
        {ghost && <span className="sf-ghost-badge">{ghost}</span>}
        {content}
      </div>
    )
  }

  return (
    <div className={`sf-root relative ${textureClass} ${motionClass}`} style={cssVars(theme)}>
      {bgMode === 'photo' && theme.bgImage ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(${withAlpha(theme.colors.bg, 'E8')}, ${withAlpha(theme.colors.bg, 'E8')}), url(${resolveArt(theme.bgImage)}) center/cover`,
          }}
        />
      ) : bgMode === 'gradient' ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${theme.colors.bg}, ${theme.colors.surface2})` }}
        />
      ) : null}
      <div className="relative">
        {rows.map((row, i) => {
          if (row.length === 2) {
            return (
            <div key={`row-${i}`} className="px-5 mt-4 grid grid-cols-2 gap-3">
              {row.map((s) => {
                const ghost = editable ? ghostFor(s, effStore, status) : null
                return (
                  <div key={s.id} className="sf-half min-w-0">
                    {wrap(s, renderSection(s, ghost ? ghostStoreFor(s, effStore) : effStore), ghost)}
                  </div>
                )
              })}
            </div>
            )
          }
          const s = row[0]
          const ghost = editable ? ghostFor(s, effStore, status) : null
          return (
            <div key={s.id}>
              {wrap(s, renderSection(s, ghost ? ghostStoreFor(s, effStore) : effStore), ghost)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
