import { createContext, useContext, useState } from 'react'
import {
  Award,
  BadgePercent,
  Banknote,
  Bike,
  CalendarDays,
  Check,
  Clock,
  Copy,
  CreditCard,
  Gift,
  Instagram,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Pizza,
  Play,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
} from 'lucide-react'
import type { SfTheme, StoreData, StoreProduct, StoreStatus } from '../studio/types'
import { buttonRadius, resolveArt } from '../studio/types'

export const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function badgeLabel(badge: string | null | undefined): string | null {
  if (badge === 'mais_pedido') return 'Mais pedido'
  if (badge === 'novo') return 'Novo'
  if (badge === 'veg') return 'Vegetariano'
  if (badge === 'picante') return 'Picante'
  if (badge === 'promo') return 'Oferta'
  return null
}

function surfaceStyle(theme: SfTheme): React.CSSProperties {
  return {
    background: theme.colors.surface,
    border: `${theme.borderWidth}px solid ${theme.colors.border}`,
    borderRadius: theme.radius,
    boxShadow: theme.id === 'glass-noite' ? '0 8px 32px rgba(0,0,0,0.35)' : 'var(--sf-shadow)',
  }
}

export function ProductArt({ hue, name, variant, image }: { hue: number; name: string; variant: string; image?: string | null }) {
  const tall = variant === 'photo-top'
  const w = variant === 'compact' ? 52 : tall ? '100%' : 92
  const h = variant === 'compact' ? 52 : tall ? 120 : 92
  const src = resolveArt(image)
  if (src) {
    return (
      <div className="shrink-0 overflow-hidden" style={{ width: w, height: h, borderRadius: 'calc(var(--sf-radius) - 4px)', background: 'var(--sf-surface-2)' }}>
        <img src={src} alt={name} loading="lazy" className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: w,
        height: h,
        borderRadius: 'calc(var(--sf-radius) - 4px)',
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 45) % 360} 75% 42%))`,
        color: '#fff',
      }}
    >
      <Pizza className="opacity-90" size={variant === 'compact' ? 22 : 30} />
      <span className="sr-only">{name}</span>
    </div>
  )
}

export function EmptyInline({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      className="p-6 text-center"
      style={{
        border: '1.5px dashed var(--sf-border)',
        borderRadius: 'var(--sf-radius)',
        background: 'transparent',
      }}
    >
      <Store size={22} className="mx-auto mb-2 opacity-50" />
      <p className="sf-font-head text-sm font-bold">{title}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--sf-muted)' }}>{hint}</p>
    </div>
  )
}

/* ─── Texto editável inline (clique quando selecionado, ou duplo clique) ───
   Textos curtos = edição no contexto. Painel lateral = resto.
   Regra das melhores práticas: inline para o simples, formulário para o complexo. */

const SfArmedContext = createContext(false)

export function SfArmed({ armed, children }: { armed: boolean; children: React.ReactNode }) {
  return <SfArmedContext.Provider value={armed}>{children}</SfArmedContext.Provider>
}

export function InlineText({ value, onCommit, multiline, className, style }: {
  value: string
  onCommit?: (v: string) => void
  multiline?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const armed = useContext(SfArmedContext)
  const cls = `${className ?? ''}${onCommit ? ' sf-canedit' : ''}`
  if (!onCommit) {
    return <span className={className} style={style}>{value}</span>
  }
  const start = () => {
    setDraft(value)
    setEditing(true)
  }
  if (!editing) {
    return (
      <span
        className={cls}
        style={style}
        onClick={(e) => {
          if (armed) {
            e.stopPropagation()
            start()
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          start()
        }}
        title={armed ? 'Clique para editar aqui mesmo' : 'Selecione o bloco e clique para editar aqui mesmo'}
      >
        {value}
      </span>
    )
  }
  const commit = (cancel: boolean) => {
    setEditing(false)
    if (!cancel && draft !== value) onCommit(draft)
  }
  const fieldStyle: React.CSSProperties = {
    ...style,
    background: 'rgba(127,127,127,0.14)',
    borderRadius: 6,
    outline: '1.5px dashed currentColor',
    minWidth: 48,
    width: '100%',
  }
  if (multiline) {
    return (
      <textarea
        autoFocus
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') commit(true)
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={className}
        style={{ ...fieldStyle, resize: 'vertical' }}
      />
    )
  }
  return (
    <input
      autoFocus
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') commit(true)
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={className}
      style={fieldStyle}
    />
  )
}

/* ─── HEADER ─── */

export function HeaderBlock({ theme, store, variant, props, edit, active, setActive }: { theme: SfTheme; store: StoreData; variant?: string; props?: { name?: string; tagline?: string }; edit?: (key: string, value: string) => void; active?: string; setActive?: (v: string) => void }) {
  const v = variant ?? theme.headerVariant
  const name = props?.name?.trim() ? props.name : store.name
  const tagline = props?.tagline?.trim() ? props.tagline : store.tagline
  const N = (kind: 'name' | 'tagline', fallback: string, className?: string, style?: React.CSSProperties) => (
    <InlineText value={kind === 'name' ? name : tagline} onCommit={edit ? (val) => edit(kind, val ?? fallback) : undefined} className={className} style={style} />
  )
  if (v === 'nav') {
    return (
      <header className="px-5 sm:px-8 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center font-extrabold sf-font-head shrink-0" style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }}>
              {store.logoText}
            </div>
            <div className="min-w-0">
              <h1 className="sf-font-head text-lg font-extrabold leading-tight truncate">{N('name', store.name)}</h1>
              <p className="text-[11px] truncate" style={{ color: 'var(--sf-muted)' }}>
                ★ {store.rating > 0 ? store.rating.toFixed(1) : '—'} · {store.deliveryTime}
              </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-2 shrink-0">
            {store.categories.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => setActive?.(c.id)}
                className="text-xs font-bold px-3.5 py-2 whitespace-nowrap"
                style={{
                  borderRadius: 999,
                  background: active === c.id ? 'var(--sf-text)' : 'transparent',
                  color: active === c.id ? 'var(--sf-bg)' : 'var(--sf-text)',
                  border: `${theme.borderWidth}px solid var(--sf-border)`,
                }}
              >
                {c.name}
              </button>
            ))}
          </nav>
          <span className="hidden sm:flex items-center gap-1.5 sf-font-head text-xs font-bold px-4 py-2.5 shrink-0" style={{ background: 'var(--sf-text)', color: 'var(--sf-bg)', borderRadius: 999 }}>
            <ShoppingBag size={14} /> Pedir
          </span>
        </div>
      </header>
    )
  }
  if (v === 'centered') {
    return (
      <header className="text-center pt-8 pb-4 px-5">
        <div
          className="mx-auto flex items-center justify-center font-extrabold sf-font-head"
          style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', fontSize: 20 }}
        >
          {store.logoText}
        </div>
        <h1 className="sf-font-head text-2xl font-extrabold mt-3">{N('name', store.name)}</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--sf-muted)' }}>{N('tagline', store.tagline)}</p>
      </header>
    )
  }
  if (v === 'cover') {
    return (
      <header>
        <div className="h-36 flex items-end p-5" style={{ background: 'linear-gradient(135deg, var(--sf-primary), var(--sf-accent))' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center font-extrabold sf-font-head bg-black/25 text-white" style={{ width: 52, height: 52, borderRadius: 16 }}>
              {store.logoText}
            </div>
            <div>
              <h1 className="sf-font-head text-xl font-extrabold text-white leading-tight">{N('name', store.name)}</h1>
              <p className="text-[11px] text-white/85">{N('tagline', store.tagline)}</p>
            </div>
          </div>
        </div>
      </header>
    )
  }
  if (v === 'split') {
    return (
      <header className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center font-extrabold sf-font-head" style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--sf-text)', color: 'var(--sf-bg)' }}>
            {store.logoText}
          </div>
          <div>
            <h1 className="sf-font-head text-base font-extrabold leading-tight">{N('name', store.name)}</h1>
            <p className="text-[11px]" style={{ color: 'var(--sf-muted)' }}>{store.deliveryTime} · {store.deliveryFee}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold">
          <Star size={14} fill="currentColor" /> {store.rating > 0 ? store.rating.toFixed(1) : '—'}
        </div>
      </header>
    )
  }
  return (
    <header className="flex items-center justify-between px-5 pt-5">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center font-extrabold sf-font-head" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }}>
          {store.logoText}
        </div>
        <h1 className="sf-font-head text-base font-bold">{N('name', store.name)}</h1>
      </div>
      <span className="font-mono text-[11px]" style={{ color: 'var(--sf-muted)' }}>{store.slug}.doispalitos.tech</span>
    </header>
  )
}

/* ─── STATUS ─── */

export function StatusBlock({ status, store, variant, label, edit }: { status: StoreStatus; store: StoreData; variant?: string; label?: string; edit?: (key: string, value: string) => void }) {
  const map = {
    open: { dot: '#22c55e', label: `Aberto agora · cozinha em ${store.deliveryTime}` },
    paused: { dot: '#f59e0b', label: 'Em pausa rápida · já voltamos' },
    closed: { dot: '#ef4444', label: `Fechado · ${store.hours}` },
  }[status]
  const text = label?.trim() ? label : map.label
  const node = <InlineText value={text} onCommit={edit ? (v) => edit('label', v) : undefined} />
  if (variant === 'card') {
    return (
      <div className="px-5 mt-4">
        <div className="p-4 flex items-center gap-3" style={surfaceStyle({ id: '', colors: { surface: 'var(--sf-surface)', border: 'var(--sf-border)' } } as SfTheme)}>
          <span className="flex items-center justify-center shrink-0" style={{ width: 38, height: 38, borderRadius: 999, background: `${map.dot}22` }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: map.dot, display: 'inline-block' }} />
          </span>
          <div>
            <p className="sf-font-head text-sm font-extrabold">Status da casa</p>
            <p className="text-xs font-semibold mt-0.5">{node}</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="px-5 mt-3">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold" style={{ ...surfaceStyle({ id: '', colors: { surface: 'var(--sf-surface)', border: 'var(--sf-border)' } } as SfTheme), borderRadius: 999 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: map.dot, display: 'inline-block' }} />
        {node}
      </div>
    </div>
  )
}

/* ─── HERO (textos e foto editáveis pelo Studio via props) ─── */

export interface HeroProps {
  kicker?: string
  title?: string
  subtitle?: string
  ctaPrimary?: string
  ctaSecondary?: string
  imageUrl?: string
}

function heroText(props: HeroProps | undefined, key: keyof HeroProps): string | undefined {
  const v = props?.[key]
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

export function HeroBlock({ theme, store, status, props, variant, edit }: { theme: SfTheme; store: StoreData; status: StoreStatus; props?: HeroProps; variant?: string; edit?: (key: string, value: string) => void }) {
  const v = variant ?? theme.heroVariant
  const ctaRadius = buttonRadius(theme.buttonVariant, theme.radius)
  const primaryLabel = heroText(props, 'ctaPrimary') ?? (status === 'open' ? 'Ver cardápio' : 'Ver horários')
  const secondaryLabel = heroText(props, 'ctaSecondary') ?? 'Retirada'
  const T = (key: keyof HeroProps, fallback: string, className?: string, style?: React.CSSProperties, multiline?: boolean) => (
    <InlineText value={heroText(props, key) ?? fallback} onCommit={edit ? (val) => edit(key, val) : undefined} className={className} style={style} multiline={multiline} />
  )
  const cta = (
    <div className="flex gap-2 mt-4">
      <button className="sf-pressable sf-font-head text-sm font-bold px-5 py-3" style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: ctaRadius, border: `${theme.borderWidth}px solid var(--sf-border)` }}>
        <InlineText value={primaryLabel} onCommit={edit ? (val) => edit('ctaPrimary', val) : undefined} />
      </button>
      <button className="sf-pressable text-sm font-semibold px-5 py-3" style={{ border: `${theme.borderWidth}px solid var(--sf-border)`, borderRadius: ctaRadius, background: 'var(--sf-surface)' }}>
        <InlineText value={secondaryLabel} onCommit={edit ? (val) => edit('ctaSecondary', val) : undefined} />
      </button>
    </div>
  )

  if (v === 'cover') {
    const customPhoto = heroText(props, 'imageUrl')
    return (
      <section className="px-5 mt-4">
        <div
          className="p-6 overflow-hidden"
          style={{
            ...surfaceStyle(theme),
            border: customPhoto ? undefined : 'none',
            background: customPhoto
              ? `linear-gradient(rgba(10,8,4,.62), rgba(10,8,4,.30)), url(${resolveArt(customPhoto)}) center/cover`
              : 'linear-gradient(135deg,#2A1A08,#6B2E0E 55%,#B45309)',
            color: '#FFF7ED',
          }}
        >
          <p className="font-mono text-[11px] uppercase tracking-widest opacity-70">{T('kicker', 'Forno a lenha · desde 1998', 'font-mono text-[11px] uppercase tracking-widest opacity-70')}</p>
          <h2 className="sf-font-head text-3xl font-extrabold leading-tight mt-2">{T('title', 'Pizza de verdade, sem taxa abusiva.')}</h2>
          <p className="text-sm opacity-80 mt-2">{T('subtitle', 'Pedido direto com a casa. Chega quente, sem intermediário.')}</p>
          {cta}
        </div>
      </section>
    )
  }
  if (v === 'typo') {
    return (
      <section className="px-5 mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--sf-muted)' }}>{T('kicker', `${store.slug} — cardápio próprio`)}</p>
        <h2 className="sf-font-head font-medium leading-[1.05] mt-2" style={{ fontSize: 40 }}>{T('title', `${store.name}.`)}</h2>
        <p className="text-sm mt-2 max-w-[30ch]" style={{ color: 'var(--sf-muted)' }}>{T('subtitle', store.tagline)}</p>
        {cta}
      </section>
    )
  }
  if (v === 'glass-promo') {
    return (
      <section className="px-5 mt-4">
        <div className="p-6" style={{ ...surfaceStyle(theme), background: 'linear-gradient(135deg, rgba(167,139,250,.25), rgba(34,211,238,.18))', backdropFilter: 'blur(12px)' }}>
          <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--sf-accent)' }}>{T('kicker', '✦ entrega própria')}</p>
          <h2 className="sf-font-head text-3xl font-extrabold mt-1">{T('title', 'Monte sua noite.')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--sf-muted)' }}>{T('subtitle', 'Do clássico ao doce. Fecha o pedido em 1 minuto.')}</p>
          {cta}
        </div>
      </section>
    )
  }
  if (v === 'minimal') {
    return (
      <section className="px-5 mt-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="sf-font-head text-2xl font-extrabold">{T('title', store.name)}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--sf-muted)' }}>{T('subtitle', store.tagline)}</p>
        </div>
        <div className="text-right text-xs font-mono" style={{ color: 'var(--sf-muted)' }}>
          <div className="flex items-center gap-1 justify-end"><Clock size={12} /> {store.deliveryTime}</div>
          <div className="flex items-center gap-1 justify-end mt-1"><Bike size={12} /> {store.deliveryFee}</div>
        </div>
      </section>
    )
  }
  if (v === 'wide') {
    const customPhoto = heroText(props, 'imageUrl')
    return (
      <section className="px-5 sm:px-8 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-6 sm:p-10 overflow-hidden" style={{ ...surfaceStyle(theme), background: customPhoto ? `linear-gradient(rgba(10,8,6,.55), rgba(10,8,6,.45)), url(${customPhoto}) center/cover` : 'var(--sf-text)', color: customPhoto ? '#FFF7ED' : 'var(--sf-bg)', borderColor: 'transparent' }}>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">{T('kicker', 'Cardápio próprio · sem comissão')}</p>
            <h2 className="sf-font-head font-extrabold leading-[1.02] mt-3" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>{T('title', 'A casa inteira, direto no seu navegador.')}</h2>
            <p className="text-sm mt-3 opacity-80 max-w-[42ch]">{T('subtitle', 'Monte o pedido, escolha entrega ou retirada e acompanhe tudo por aqui.')}</p>
            {cta}
          </div>
          <div className="hidden md:flex items-center justify-center">
            {customPhoto ? (
              <img src={customPhoto} alt="Capa da loja" className="w-full max-h-72 object-cover" style={{ borderRadius: 'var(--sf-radius)' }} />
            ) : (
              <Pizza size={160} className="opacity-25" />
            )}
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="px-5 mt-4 grid grid-cols-[1.2fr_.8fr] gap-3 items-stretch">
      <div className="p-5" style={surfaceStyle(theme)}>
        <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--sf-muted)' }}>{T('kicker', 'Cardápio da casa')}</p>
        <h2 className="sf-font-head text-2xl font-extrabold leading-tight mt-1">{T('title', 'Do forno pra sua mesa.')}</h2>
        {heroText(props, 'subtitle') ? (
          <p className="text-xs mt-1.5" style={{ color: 'var(--sf-muted)' }}>{T('subtitle', '')}</p>
        ) : null}
        {cta}
      </div>
      <div className="flex items-center justify-center overflow-hidden" style={{ ...surfaceStyle(theme), background: 'linear-gradient(135deg,#F5DC55,#E8822B)' }}>
        {heroText(props, 'imageUrl') ? (
          <img src={resolveArt(heroText(props, 'imageUrl'))} alt="Capa da loja" className="w-full h-full object-cover" />
        ) : (
          <Pizza size={64} color="#141416" />
        )}
      </div>
    </section>
  )
}

/* ─── SEARCH ─── */

export function SearchBlock({ query, setQuery, placeholder }: { query: string; setQuery: (v: string) => void; placeholder?: string }) {
  return (
    <div className="px-5 mt-4">
      <div className="flex items-center gap-2 px-4 py-3" style={surfaceStyle({ id: '', colors: { surface: 'var(--sf-surface)', border: 'var(--sf-border)' } } as SfTheme)}>
        <Search size={16} className="opacity-50" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder?.trim() ? placeholder : 'Buscar no cardápio… ex: calabresa'}
          className="bg-transparent outline-none text-sm w-full"
        />
      </div>
    </div>
  )
}

/* ─── CATEGORIES ─── */

export function CategoriesBlock({
  theme, store, active, setActive, variant,
}: { theme: SfTheme; store: StoreData; active: string; setActive: (v: string) => void; variant?: string }) {
  const cv = variant ?? theme.categoryVariant
  if (store.categories.length === 0) {
    return (
      <div className="px-5 mt-4">
        <EmptyInline title="Categorias em breve" hint="Assim que a loja cadastrar categorias, elas aparecem aqui em pills, fotos ou sublinhado." />
      </div>
    )
  }
  if (cv === 'underline') {
    return (
      <nav className="flex gap-6 px-5 mt-6 border-b text-sm font-semibold" style={{ borderColor: 'var(--sf-border)' }}>
        {store.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className="pb-3 -mb-px"
            style={{ borderBottom: active === c.id ? '2px solid var(--sf-text)' : '2px solid transparent', opacity: active === c.id ? 1 : 0.55 }}
          >
            {c.name}
          </button>
        ))}
      </nav>
    )
  }
  if (cv === 'photos') {
    return (
      <nav className="flex gap-3 px-5 mt-4 overflow-x-auto sf-no-scrollbar">
        {store.categories.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)} className="flex flex-col items-center gap-1.5 shrink-0">
            <span
              className="flex items-center justify-center"
              style={{
                width: 58, height: 58, borderRadius: 999,
                background: active === c.id ? 'var(--sf-primary)' : 'var(--sf-surface)',
                border: `${theme.borderWidth}px solid var(--sf-border)`,
                color: active === c.id ? 'var(--sf-primary-text)' : 'var(--sf-text)',
              }}
            >
              <Pizza size={22} />
            </span>
            <span className="text-[11px] font-semibold" style={{ opacity: active === c.id ? 1 : 0.65 }}>{c.name}</span>
          </button>
        ))}
      </nav>
    )
  }
  if (cv === 'grid') {
    return (
      <nav className="grid grid-cols-2 gap-2 px-5 mt-4">
        {store.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className="flex items-center gap-2.5 px-3.5 py-3 text-xs font-bold"
            style={{
              borderRadius: 'var(--sf-radius)',
              background: active === c.id ? 'var(--sf-text)' : 'var(--sf-surface)',
              color: active === c.id ? 'var(--sf-bg)' : 'var(--sf-text)',
              border: `${theme.borderWidth}px solid var(--sf-border)`,
            }}
          >
            <Pizza size={17} className="shrink-0 opacity-70" />
            <span className="truncate">{c.name}</span>
          </button>
        ))}
      </nav>
    )
  }
  return (
    <nav className="flex gap-2 px-5 mt-4 overflow-x-auto sf-no-scrollbar">
      {store.categories.map((c) => (
        <button
          key={c.id}
          onClick={() => setActive(c.id)}
          className="text-xs font-bold px-4 py-2 whitespace-nowrap"
          style={{
            borderRadius: 999,
            background: active === c.id ? 'var(--sf-text)' : 'var(--sf-surface)',
            color: active === c.id ? 'var(--sf-bg)' : 'var(--sf-text)',
            border: `${theme.borderWidth}px solid var(--sf-border)`,
          }}
        >
          {c.name}
        </button>
      ))}
    </nav>
  )
}

/* ─── PRODUCTS ─── */

function ProductCard({ theme, name, description, price, oldPrice, badge, available, hue, image, card: cardProp, onSelect }: {
  theme: SfTheme; name: string; description: string; price: number; oldPrice?: number; badge?: string | null; available: boolean; hue: number; image?: string | null; card?: string; onSelect?: () => void
}) {
  const [qty, setQty] = useState(0)
  const b = badgeLabel(badge)
  const card = cardProp ?? theme.cardVariant

  const addBtn = (
    <div className="flex items-center gap-2">
      {qty === 0 ? (
        <button
          onClick={() => {
            if (onSelect) {
              onSelect()
              return
            }
            if (available) setQty(1)
          }}
          className="sf-pressable p-2"
          style={{ borderRadius: 999, background: available ? 'var(--sf-primary)' : 'var(--sf-surface-2)', color: available ? 'var(--sf-primary-text)' : 'var(--sf-muted)' }}
          aria-label={`Adicionar ${name}`}
        >
          <Plus size={16} />
        </button>
      ) : (
        <div className="flex items-center gap-2" style={{ borderRadius: 999, background: 'var(--sf-text)', color: 'var(--sf-bg)', padding: '4px 6px' }}>
          <button onClick={() => setQty(Math.max(0, qty - 1))} aria-label="Remover"><Minus size={14} /></button>
          <span className="text-xs font-bold font-mono w-4 text-center">{qty}</span>
          <button onClick={() => setQty(qty + 1)} aria-label="Adicionar"><Plus size={14} /></button>
        </div>
      )}
    </div>
  )

  if (card === 'compact') {
    return (
      <div className="sf-lift flex items-center gap-3 p-3" style={surfaceStyle(theme)}>
        <ProductArt hue={hue} name={name} image={image} variant="compact" />
        <div className="flex-1 min-w-0">
          <p className="sf-font-head text-sm font-bold truncate">{name}</p>
          <p className="font-mono text-xs font-bold mt-0.5">{money(price)}</p>
        </div>
        {addBtn}
      </div>
    )
  }

  if (card === 'editorial') {
    return (
      <div className="sf-lift py-4 border-b" style={{ borderColor: 'var(--sf-border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="sf-font-head text-[15px] font-semibold leading-snug">{name}</p>
            <p className="text-xs mt-1 sf-line-clamp-2" style={{ color: 'var(--sf-muted)' }}>{description}</p>
            <p className="font-mono text-sm font-bold mt-2">{money(price)}</p>
          </div>
          {addBtn}
        </div>
      </div>
    )
  }

  if (card === 'glass') {
    return (
      <div className="sf-lift p-4" style={{ ...surfaceStyle(theme), backdropFilter: 'blur(10px)' }}>
        <ProductArt hue={hue} name={name} image={image} variant="photo-top" />
        <p className="sf-font-head text-sm font-bold mt-3">{name}</p>
        <p className="text-xs mt-1 sf-line-clamp-2" style={{ color: 'var(--sf-muted)' }}>{description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="font-mono text-sm font-bold">{money(price)}</span>
          {addBtn}
        </div>
      </div>
    )
  }

  if (card === 'photo-top') {
    return (
      <div className="sf-lift overflow-hidden" style={surfaceStyle(theme)}>
        <ProductArt hue={hue} name={name} image={image} variant="photo-top" />
        <div className="p-4">
          {b && <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>{b}</span>}
          <p className="sf-font-head text-[15px] font-bold leading-snug mt-0.5">{name}</p>
          <p className="text-xs mt-1 sf-line-clamp-2" style={{ color: 'var(--sf-muted)' }}>{description}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="font-mono text-sm font-bold">{money(price)} {oldPrice && <s className="font-normal opacity-50 ml-1">{money(oldPrice)}</s>}</span>
            {addBtn}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-lift flex gap-3 p-3" style={{ ...surfaceStyle(theme), opacity: available ? 1 : 0.6 }}>
      <ProductArt hue={hue} name={name} image={image} variant="photo-left" />
      <div className="flex-1 min-w-0">
        {b && <span className="inline-block font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-1" style={{ background: 'var(--sf-surface-2)', borderRadius: 999 }}>{b}</span>}
        <p className="sf-font-head text-sm font-bold leading-snug">{name} {!available && <span className="font-mono text-[10px] font-normal">· pausado</span>}</p>
        <p className="text-xs mt-0.5 sf-line-clamp-2" style={{ color: 'var(--sf-muted)' }}>{description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-sm font-bold">{money(price)}</span>
          {addBtn}
        </div>
      </div>
    </div>
  )
}

export function ProductsBlock({ theme, store, active, query, heading, cardVariant, edit, onSelect }: { theme: SfTheme; store: StoreData; active: string; query: string; heading?: string; cardVariant?: string; edit?: (key: string, value: string) => void; onSelect?: (p: StoreProduct) => void }) {
  const cv = cardVariant ?? theme.cardVariant
  const q = query.trim().toLowerCase()
  let list = store.products.filter((p) => (active === 'all' ? true : p.category_id === active))
  if (q) list = store.products.filter((p) => (p.name + ' ' + p.description).toLowerCase().includes(q))

  if (store.products.length === 0) {
    return (
      <section className="px-5 mt-4">
        <h3 className="sf-font-head text-base font-bold mb-3">Cardápio</h3>
        <EmptyInline title="Cardápio vazio — e isso também é design" hint="Estado vazio planejado: foto, texto acolhedor e botão de WhatsApp. Nada de tela branca quebrada." />
        <div className="mt-3 p-5 text-center" style={surfaceStyle(theme)}>
          <Pizza size={28} className="mx-auto opacity-40" />
          <p className="sf-font-head font-bold text-sm mt-2">Em breve, novidades saindo do forno</p>
          <p className="text-xs mt-1" style={{ color: 'var(--sf-muted)' }}>Deixe seu WhatsApp que avisamos na inauguração.</p>
          <button className="sf-font-head text-xs font-bold px-5 py-2.5 mt-3" style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: buttonRadius(theme.buttonVariant, theme.radius) }}>
            Avisar no WhatsApp
          </button>
        </div>
      </section>
    )
  }

  if (list.length === 0) {
    return (
      <section className="px-5 mt-4">
        <EmptyInline title={q ? `Nada com “${query}”` : 'Categoria sem itens'} hint="Busca vazia também é personalizável: sugestões, mais buscados e botão limpar filtro." />
      </section>
    )
  }

  const grouped = active === 'all' && !q
  if (!grouped) {
    return (
      <section className="px-5 mt-4 space-y-3">
        {list.map((p) => (
          <div key={p.id} onClick={() => onSelect?.(p)} className={onSelect ? 'cursor-pointer' : undefined}>
            <ProductCard theme={theme} card={cv} image={p.image} onSelect={onSelect ? () => onSelect(p) : undefined} name={p.name} description={p.description} price={p.price} oldPrice={p.oldPrice} badge={p.badge} available={p.is_available} hue={p.hue} />
          </div>
        ))}
      </section>
    )
  }

  return (
    <div className="mt-2">
      {heading ? (
        <div className="px-5 mt-6">
          <h3 className="sf-font-head text-lg font-extrabold">
            <InlineText value={heading} onCommit={edit ? (v) => edit('heading', v) : undefined} />
          </h3>
        </div>
      ) : null}
      {store.categories.map((c) => {
        const items = store.products.filter((p) => p.category_id === c.id)
        if (items.length === 0) return null
        return (
          <section key={c.id} className="px-5 mt-6">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="sf-font-head text-lg font-extrabold">{c.name}</h3>
              <span className="font-mono text-[11px]" style={{ color: 'var(--sf-muted)' }}>{items.length} itens</span>
            </div>
            <div className={cv === 'photo-top' || cv === 'glass' ? 'grid grid-cols-2 gap-3 sf-products-2col' : 'space-y-3'}>
              {items.map((p) => (
                <div key={p.id} onClick={() => onSelect?.(p)} className={onSelect ? 'cursor-pointer' : undefined}>
                  <ProductCard theme={theme} card={cv} image={p.image} onSelect={onSelect ? () => onSelect(p) : undefined} name={p.name} description={p.description} price={p.price} oldPrice={p.oldPrice} badge={p.badge} available={p.is_available} hue={p.hue} />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ─── PROMO / FEATURED / REVIEWS / STORY / INFO / FOOTER / CARTBAR ─── */

export function PromoBlock({ theme, store, variant }: { theme: SfTheme; store: StoreData; variant?: string }) {
  if (store.promos.length === 0) return null
  const card = (promo: StoreData['promos'][number]) => (
    <div className="p-4 flex items-center justify-between gap-3" style={{ ...surfaceStyle(theme), background: 'var(--sf-text)', color: 'var(--sf-bg)', borderColor: 'transparent' }}>
      <div>
        <p className="sf-font-head font-extrabold text-sm flex items-center gap-1.5"><BadgePercent size={15} />{promo.title}</p>
        <p className="text-xs opacity-70">{promo.subtitle} <b className="font-mono">{promo.coupon}</b></p>
      </div>
      <button className="sf-pressable p-2 shrink-0" style={{ borderRadius: 999, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }} aria-label="Copiar cupom">
        <Copy size={15} />
      </button>
    </div>
  )
  if (variant === 'carousel') {
    return (
      <section className="mt-6">
        <div className="flex gap-3 px-5 overflow-x-auto sf-no-scrollbar">
          {store.promos.map((promo) => (
            <div key={promo.id} className="shrink-0 w-64">{card(promo)}</div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="px-5 mt-6 space-y-3">
      {store.promos.map((promo) => (
        <div key={promo.id}>{card(promo)}</div>
      ))}
    </section>
  )
}

export function FeaturedBlock({ theme, store, title, edit, variant, onSelect }: { theme: SfTheme; store: StoreData; title?: string; edit?: (key: string, value: string) => void; variant?: string; onSelect?: (p: StoreProduct) => void }) {
  const feats = store.products.filter((p) => p.badge === 'mais_pedido').slice(0, 4)
  if (store.products.length === 0 || feats.length === 0) return null
  const headingNode = (
    <h3 className="sf-font-head text-base font-extrabold px-5 mb-3">
      <InlineText value={title?.trim() ? title : '★ Mais pedidos da casa'} onCommit={edit ? (v) => edit('title', v) : undefined} />
    </h3>
  )
  const cardNode = (p: StoreData['products'][number], i: number) => (
    <div className={`p-4 shrink-0 w-44 sf-lift${onSelect ? ' cursor-pointer' : ''}`} style={surfaceStyle(theme)} onClick={() => onSelect?.(p)}>
      <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--sf-muted)' }}>#{i + 1}</span>
      <p className="sf-font-head text-sm font-bold leading-snug mt-1">{p.name}</p>
      <p className="font-mono text-xs font-bold mt-1">{money(p.price)}</p>
    </div>
  )
  if (variant === 'grid') {
    return (
      <section className="mt-6">
        {headingNode}
        <div className="grid grid-cols-2 gap-3 px-5">
          {feats.map((p, i) => (
            <div key={p.id} className="[&>div]:w-full [&>div]:shrink">{cardNode(p, i)}</div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="mt-6">
      {headingNode}
      <div className="flex gap-3 px-5 overflow-x-auto sf-no-scrollbar">
        {feats.map((p, i) => (
          <div key={p.id}>{cardNode(p, i)}</div>
        ))}
      </div>
    </section>
  )
}

export function ReviewsBlock({ theme, store, title, edit, variant }: { theme: SfTheme; store: StoreData; title?: string; edit?: (key: string, value: string) => void; variant?: string }) {
  const headingText = title?.trim() ? title : 'Avaliações'
  const headingNode = <InlineText value={headingText} onCommit={edit ? (v) => edit('title', v) : undefined} />
  if (store.reviews.length === 0) {
    return (
      <section className="px-5 mt-6">
        <h3 className="sf-font-head text-base font-bold mb-3">{headingNode}</h3>
        <EmptyInline title="Sem avaliações ainda" hint="Loja nova mostra selo de inauguração + convite pra ser o primeiro a avaliar." />
      </section>
    )
  }
  if (variant === 'spotlight') {
    return (
      <section className="px-5 mt-6">
        <div className="p-6 text-center" style={{ ...surfaceStyle(theme), background: 'var(--sf-text)', color: 'var(--sf-bg)', borderColor: 'transparent' }}>
          <p className="sf-font-head font-extrabold" style={{ fontSize: 52, lineHeight: 1 }}>
            {store.rating > 0 ? store.rating.toFixed(1).replace('.', ',') : '—'}
          </p>
          <p className="flex items-center justify-center gap-1 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} fill="currentColor" />
            ))}
          </p>
          <p className="text-xs mt-2 opacity-70">{headingText} · {store.reviewsCount} avaliações</p>
        </div>
        <div className="mt-3 p-4" style={surfaceStyle(theme)}>
          <p className="text-xs leading-relaxed">“{store.reviews[0].text}”</p>
          <p className="text-[11px] font-bold mt-1.5">— {store.reviews[0].name}</p>
        </div>
      </section>
    )
  }
  return (
    <section className="px-5 mt-6">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="sf-font-head text-base font-extrabold">{headingNode}</h3>
        <span className="font-mono text-xs" style={{ color: 'var(--sf-muted)' }}>★ {store.rating.toFixed(1)} · {store.reviewsCount}</span>
      </div>
      <div className="space-y-3">
        {store.reviews.map((r) => (
          <div key={r.id} className="p-4" style={surfaceStyle(theme)}>
            <div className="flex items-center gap-1 text-xs">
              {Array.from({ length: r.stars }).map((_, i) => (
                <Star key={i} size={12} fill="currentColor" />
              ))}
              <b className="ml-1">{r.name}</b>
            </div>
            <p className="text-xs mt-1.5 leading-relaxed">“{r.text}”</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function StoryBlock({ theme, store, text, edit, photo, editableHint }: { theme: SfTheme; store: StoreData; text?: string; edit?: (key: string, value: string) => void; photo?: string; editableHint?: boolean }) {
  const body = text?.trim() ? text : store.story
  const photoSrc = resolveArt(photo)
  if (!body && !photoSrc) {
    if (!editableHint) return null
    return (
      <section className="px-5 mt-6">
        <EmptyInline title="Conte a história da casa" hint="Vazio de propósito no preview — escreva o texto e envie uma foto no painel ao lado." />
      </section>
    )
  }
  return (
    <section className="px-5 mt-6">
      <div className="overflow-hidden" style={{ ...surfaceStyle(theme), background: 'var(--sf-surface-2)' }}>
        {photoSrc && (
          <img src={photoSrc} alt="Foto da casa" className="w-full h-36 object-cover" />
        )}
        <div className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--sf-muted)' }}>Nossa história</p>
          <p className="sf-font-head text-[15px] leading-relaxed mt-2">
            {body ? (
              <InlineText value={body} multiline onCommit={edit ? (v) => edit('text', v) : undefined} />
            ) : (
              <span className="text-xs" style={{ color: 'var(--sf-muted)' }}>Foto ok! Agora escreva o texto no painel ao lado.</span>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}

export function InfoBlock({ theme, store, variant }: { theme: SfTheme; store: StoreData; variant?: string }) {
  if (variant === 'compact') {
    const rows: Array<{ icon: React.ReactNode; text: React.ReactNode }> = [
      { icon: <Clock size={15} className="shrink-0 opacity-60" />, text: <span><b>{store.hours}</b> · cozinha em {store.deliveryTime}</span> },
      { icon: <Bike size={15} className="shrink-0 opacity-60" />, text: <span>Entrega {store.deliveryFee} · Retirada grátis</span> },
      { icon: <MapPin size={15} className="shrink-0 opacity-60" />, text: <span>{store.address || 'Endereço em breve'}</span> },
      { icon: <Phone size={15} className="shrink-0 opacity-60" />, text: <span className="font-mono">{store.phone || '—'}</span> },
    ]
    return (
      <section className="px-5 mt-6">
        <div className="px-4 py-1 text-xs" style={surfaceStyle(theme)}>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-3" style={i > 0 ? { borderTop: '1px solid var(--sf-border)' } : undefined}>
              {r.icon} {r.text}
            </div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="px-5 mt-6 space-y-2 text-xs">
      <div className="p-4 flex items-center gap-3" style={surfaceStyle(theme)}>
        <Clock size={16} className="shrink-0 opacity-60" /> <span><b>{store.hours}</b> · cozinha em {store.deliveryTime}</span>
      </div>
      <div className="p-4 flex items-center gap-3" style={surfaceStyle(theme)}>
        <MapPin size={16} className="shrink-0 opacity-60" /> <span>{store.address}</span>
      </div>
      <div className="p-4 flex items-center gap-3" style={surfaceStyle(theme)}>
        <Phone size={16} className="shrink-0 opacity-60" /> <span className="font-mono">{store.phone}</span>
      </div>
    </section>
  )
}

export function FooterBlock({ store, note, edit, variant }: { store: StoreData; note?: string; edit?: (key: string, value: string) => void; variant?: string }) {
  const line = note?.trim() ? note : `pedido direto · sem comissão · ${store.slug}.doispalitos.tech`
  if (variant === 'complete') {
    return (
      <footer className="px-5 mt-8">
        <div className="p-6 text-center" style={{ ...surfaceStyle({ id: '', colors: { surface: 'var(--sf-surface)', border: 'var(--sf-border)' } } as SfTheme), background: 'var(--sf-text)', color: 'var(--sf-bg)', borderColor: 'transparent' }}>
          <p className="sf-font-head font-extrabold text-2xl">{store.name}</p>
          <p className="text-xs mt-1 opacity-70">{store.tagline}</p>
          <div className="font-mono text-[11px] mt-3 space-y-1 opacity-80">
            <p>{store.hours}</p>
            <p>{store.address}</p>
            <p>{store.phone}</p>
          </div>
          <p className="font-mono text-[11px] mt-3">
            <InlineText value={line} onCommit={edit ? (v) => edit('note', v) : undefined} />
          </p>
        </div>
        <p className="font-mono text-[10px] mt-3 pb-10 text-center flex items-center justify-center gap-1" style={{ color: 'var(--sf-muted)' }}>
          <Check size={11} /> feito com Doispalitos
        </p>
      </footer>
    )
  }
  return (
    <footer className="px-5 mt-8 pb-10 text-center">
      <p className="sf-font-head font-extrabold text-lg">{store.name}</p>
      <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--sf-muted)' }}>
        <InlineText value={note?.trim() ? note : `pedido direto · sem comissão · ${store.slug}.doispalitos.tech`} onCommit={edit ? (v) => edit('note', v) : undefined} />
      </p>
      <p className="font-mono text-[10px] mt-2 flex items-center justify-center gap-1" style={{ color: 'var(--sf-muted)' }}>
        <Check size={11} /> feito com Doispalitos
      </p>
    </footer>
  )
}

/* ─── CLUBE DA CASA (fidelidade por selos — o "selo" colecionável) ─── */

export interface LoyaltyProps {
  title?: string
  subtitle?: string
  goal?: number
  filled?: number
}

export function LoyaltyBlock({ theme, props, edit }: { theme: SfTheme; props?: LoyaltyProps; edit?: (key: string, value: string) => void }) {
  const goal = Math.min(Math.max(Number(props?.goal) || 8, 3), 12)
  const filled = Math.min(Math.max(Number(props?.filled) || 0, 0), goal)
  return (
    <section className="px-5 mt-6">
      <div className="p-5" style={{ ...surfaceStyle(theme), background: 'var(--sf-text)', color: 'var(--sf-bg)', borderColor: 'transparent' }}>
        <div className="flex items-center gap-2">
          <Gift size={18} style={{ color: 'var(--sf-primary)' }} />
          <p className="sf-font-head font-extrabold text-[15px]">
            <InlineText value={props?.title?.trim() ? props.title : 'Clube da casa'} onCommit={edit ? (v) => edit('title', v) : undefined} />
          </p>
        </div>
        <p className="text-xs mt-1 opacity-70">
          <InlineText value={props?.subtitle?.trim() ? props.subtitle : `Junte ${goal} selos e ganhe uma pizza grande`} onCommit={edit ? (v) => edit('subtitle', v) : undefined} />
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {Array.from({ length: goal }).map((_, i) => (
            <span
              key={i}
              className="flex items-center justify-center"
              style={{
                width: 34, height: 34, borderRadius: 999,
                background: i < filled ? 'var(--sf-primary)' : 'transparent',
                color: i < filled ? 'var(--sf-primary-text)' : 'currentColor',
                border: i < filled ? 'none' : '1.5px dashed currentColor',
                opacity: i < filled ? 1 : 0.45,
              }}
            >
              <Award size={16} />
            </span>
          ))}
        </div>
        <p className="font-mono text-[11px] mt-3 opacity-70">{filled}/{goal} selos · faltam {goal - filled}</p>
      </div>
    </section>
  )
}

/* ─── INSTAGRAM DA CASA ─── */

export function InstagramBlock({ props, edit }: { theme: SfTheme; props?: { handle?: string }; edit?: (key: string, value: string) => void }) {
  const handle = props?.handle?.trim() ? props.handle : '@pizzariadoze'
  const tiles = [12, 45, 150, 200, 280, 320]
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-5 mb-3">
        <h3 className="sf-font-head text-base font-extrabold flex items-center gap-1.5">
          <Instagram size={16} /> <InlineText value={handle} onCommit={edit ? (v) => edit('handle', v) : undefined} />
        </h3>
        <span className="font-mono text-[11px]" style={{ color: 'var(--sf-muted)' }}>Seguir →</span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-5">
        {tiles.map((hue) => (
          <div
            key={hue}
            className="flex items-center justify-center"
            style={{
              aspectRatio: '1/1',
              borderRadius: 'calc(var(--sf-radius) - 6px)',
              background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 50) % 360} 70% 40%))`,
              color: '#fff',
            }}
          >
            <Instagram size={20} className="opacity-80" />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── COMBO EM DESTAQUE (oferta montada, sem depender de mecânica) ─── */

export interface ComboProps {
  title?: string
  subtitle?: string
  price?: string
  tag?: string
  photo?: string
}

export function ComboBlock({ theme, props, variant, edit }: { theme: SfTheme; props?: ComboProps; variant?: string; edit?: (key: string, value: string) => void }) {
  const title = props?.title?.trim() ? props.title : 'Combo Família Feliz'
  const subtitle = props?.subtitle?.trim() ? props.subtitle : '2 pizzas grandes + refri 2L + borda grátis'
  const price = props?.price?.trim() ? props.price : 'R$ 99,90'
  const tag = props?.tag?.trim() ? props.tag : 'Economize R$ 20'
  const photoSrc = resolveArt(props?.photo)
  if (variant === 'banner') {
    return (
      <section className="px-5 mt-6">
        <div className="p-5 flex items-center justify-between gap-3" style={{ ...surfaceStyle(theme), background: 'var(--sf-text)', color: 'var(--sf-bg)', borderColor: 'transparent' }}>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block" style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }}>
              <InlineText value={tag} onCommit={edit ? (v) => edit('tag', v) : undefined} />
            </p>
            <p className="sf-font-head font-extrabold text-lg mt-1.5">
              <InlineText value={title} onCommit={edit ? (v) => edit('title', v) : undefined} />
            </p>
            <p className="text-xs opacity-70">
              <InlineText value={subtitle} onCommit={edit ? (v) => edit('subtitle', v) : undefined} />
            </p>
          </div>
          <span className="font-mono font-extrabold text-lg whitespace-nowrap">
            <InlineText value={price} onCommit={edit ? (v) => edit('price', v) : undefined} />
          </span>
        </div>
      </section>
    )
  }
  return (
    <section className="px-5 mt-6">
      <div className="overflow-hidden" style={surfaceStyle(theme)}>
        {photoSrc ? (
          <img src={photoSrc} alt={title} className="w-full h-28 object-cover" />
        ) : (
          <div className="h-28 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--sf-primary), var(--sf-accent))' }}>
            <Pizza size={52} style={{ color: 'var(--sf-primary-text)' }} className="opacity-80" />
          </div>
        )}
        <div className="p-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sf-muted)' }}>
            <InlineText value={tag} onCommit={edit ? (v) => edit('tag', v) : undefined} />
          </span>
          <p className="sf-font-head text-base font-extrabold mt-0.5">
            <InlineText value={title} onCommit={edit ? (v) => edit('title', v) : undefined} />
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--sf-muted)' }}>
            <InlineText value={subtitle} onCommit={edit ? (v) => edit('subtitle', v) : undefined} />
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="font-mono font-extrabold">
              <InlineText value={price} onCommit={edit ? (v) => edit('price', v) : undefined} />
            </span>
            <span className="sf-pressable sf-font-head text-xs font-bold px-4 py-2.5" style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: buttonRadius(theme.buttonVariant, theme.radius) }}>
              Montar combo
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── AGENDAR PEDIDO (encomendas com dia/hora) ─── */

export function ScheduleBlock({ theme, props, edit }: { theme: SfTheme; props?: { title?: string; subtitle?: string; button?: string }; edit?: (key: string, value: string) => void }) {
  const days = ['Hoje', 'Amanhã', 'Sáb']
  return (
    <section className="px-5 mt-6">
      <div className="p-5" style={{ ...surfaceStyle(theme), background: 'var(--sf-surface-2)' }}>
        <p className="sf-font-head font-extrabold text-[15px] flex items-center gap-2">
          <CalendarDays size={17} />
          <InlineText value={props?.title?.trim() ? props.title : 'Vai pedir pra depois?'} onCommit={edit ? (v) => edit('title', v) : undefined} />
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--sf-muted)' }}>
          <InlineText value={props?.subtitle?.trim() ? props.subtitle : 'Agende o dia e a hora — a cozinha já deixa tudo no jeito.'} onCommit={edit ? (v) => edit('subtitle', v) : undefined} />
        </p>
        <div className="flex gap-2 mt-3">
          {days.map((d, i) => (
            <span
              key={d}
              className="text-xs font-bold px-4 py-2"
              style={{
                borderRadius: 999,
                background: i === 0 ? 'var(--sf-text)' : 'var(--sf-surface)',
                color: i === 0 ? 'var(--sf-bg)' : 'var(--sf-text)',
                border: `${theme.borderWidth}px solid var(--sf-border)`,
              }}
            >
              {d}
            </span>
          ))}
        </div>
        <span
          className="sf-pressable sf-font-head text-xs font-bold px-4 py-2.5 mt-3 inline-block"
          style={{ background: 'var(--sf-primary)', color: 'var(--sf-primary-text)', borderRadius: buttonRadius(theme.buttonVariant, theme.radius) }}
        >
          <InlineText value={props?.button?.trim() ? props.button : 'Escolher horário'} onCommit={edit ? (v) => edit('button', v) : undefined} />
        </span>
      </div>
    </section>
  )
}

/* ─── COMBINA COM (sugestões a partir do cardápio real) ─── */

export function UpsellBlock({ theme, store, props, edit, onSelect }: { theme: SfTheme; store: StoreData; props?: { title?: string }; edit?: (key: string, value: string) => void; onSelect?: (p: StoreProduct) => void }) {
  const items = store.products.filter((p) => p.is_available).slice(0, 4)
  if (items.length === 0) return null
  return (
    <section className="mt-6">
      <h3 className="sf-font-head text-base font-extrabold px-5 mb-3 flex items-center gap-1.5">
        <Sparkles size={15} />
        <InlineText value={props?.title?.trim() ? props.title : 'Combina com seu pedido'} onCommit={edit ? (v) => edit('title', v) : undefined} />
      </h3>
      <div className="flex gap-3 px-5 overflow-x-auto sf-no-scrollbar">
        {items.map((p) => (
          <div key={p.id} className={`shrink-0 w-36 p-3 sf-lift${onSelect ? ' cursor-pointer' : ''}`} style={surfaceStyle(theme)} onClick={() => onSelect?.(p)}>
            <ProductArt hue={p.hue} name={p.name} variant="compact" image={p.image} />
            <p className="sf-font-head text-xs font-bold leading-snug mt-2 truncate">{p.name}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="font-mono text-xs font-bold">{money(p.price)}</span>
              <span className="p-1.5" style={{ borderRadius: 999, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }}>
                <Plus size={13} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── COMO CHEGAR (mapa + endereço real) ─── */

export function MapBlock({ theme, store, props, edit }: { theme: SfTheme; store: StoreData; props?: { address?: string }; edit?: (key: string, value: string) => void }) {
  const address = props?.address?.trim() ? props.address : store.address
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || store.name)}`
  return (
    <section className="px-5 mt-6">
      <div className="overflow-hidden" style={surfaceStyle(theme)}>
        <div className="sf-texture-grid h-32 flex items-center justify-center relative" style={{ background: 'var(--sf-surface-2)' }}>
          <span className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }}>
            <MapPin size={22} />
          </span>
        </div>
        <div className="p-4 flex items-center justify-between gap-3">
          <p className="text-xs flex-1">
            <InlineText value={address || 'Endereço em breve'} onCommit={edit ? (v) => edit('address', v) : undefined} />
          </p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="sf-pressable sf-font-head text-xs font-bold px-4 py-2.5 flex items-center gap-1.5 whitespace-nowrap"
            style={{ background: 'var(--sf-text)', color: 'var(--sf-bg)', borderRadius: buttonRadius(theme.buttonVariant, theme.radius) }}
          >
            <Navigation size={13} /> Rota
          </a>
        </div>
      </div>
    </section>
  )
}

/* ─── VÍDEO DA CASA ─── */

function toEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

export function VideoBlock({ theme, props, edit }: { theme: SfTheme; props?: { title?: string; videoUrl?: string }; edit?: (key: string, value: string) => void }) {
  const url = props?.videoUrl?.trim() ?? ''
  const embed = url ? toEmbed(url) : null
  return (
    <section className="px-5 mt-6">
      <h3 className="sf-font-head text-base font-extrabold mb-3">
        <InlineText value={props?.title?.trim() ? props.title : 'Conheça a casa 🎬'} onCommit={edit ? (v) => edit('title', v) : undefined} />
      </h3>
      <div className="overflow-hidden" style={{ ...surfaceStyle(theme), background: '#000' }}>
        {embed ? (
          <iframe src={embed} title="Vídeo da casa" className="w-full aspect-video" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
        ) : (
          <div className="w-full aspect-video flex flex-col items-center justify-center gap-2 text-white/80">
            <span className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--sf-primary)', color: 'var(--sf-primary-text)' }}>
              <Play size={22} fill="currentColor" />
            </span>
            <p className="text-xs font-mono">Cole o link do YouTube no painel →</p>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─── HORÁRIO DE HOJE ─── */

export function HoursBlock({ theme, props, edit }: { theme: SfTheme; props?: { title?: string; text?: string; note?: string }; edit?: (key: string, value: string) => void }) {
  return (
    <section className="px-5 mt-6">
      <div className="p-5 flex items-start gap-3" style={surfaceStyle(theme)}>
        <span className="flex items-center justify-center shrink-0" style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--sf-surface-2)' }}>
          <Clock size={20} />
        </span>
        <div className="flex-1">
          <p className="sf-font-head font-extrabold text-[15px]">
            <InlineText value={props?.title?.trim() ? props.title : 'Horário de hoje'} onCommit={edit ? (v) => edit('title', v) : undefined} />
          </p>
          <p className="font-mono text-xs font-bold mt-0.5">
            <InlineText value={props?.text?.trim() ? props.text : 'Ter–Dom · 18h às 23h'} onCommit={edit ? (v) => edit('text', v) : undefined} />
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--sf-muted)' }}>
            <InlineText value={props?.note?.trim() ? props.note : 'Cozinha fecha 30 min antes.'} onCommit={edit ? (v) => edit('note', v) : undefined} />
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─── FORMAS DE PAGAMENTO ─── */

export function PaymentBlock({ theme, props }: { theme: SfTheme; props?: { title?: string; pix?: boolean; card?: boolean; cash?: boolean } }) {
  const showPix = props?.pix !== false
  const showCard = props?.card !== false
  const showCash = props?.cash !== false
  const methods = [
    showPix && { icon: <QrCode size={16} />, label: 'PIX' },
    showCard && { icon: <CreditCard size={16} />, label: 'Cartão' },
    showCash && { icon: <Banknote size={16} />, label: 'Dinheiro' },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string }>
  if (methods.length === 0) return null
  return (
    <section className="px-5 mt-6">
      <p className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: 'var(--sf-muted)' }}>
        {props?.title?.trim() ? props.title : 'Aceitamos'}
      </p>
      <div className="flex gap-2">
        {methods.map((m) => (
          <span key={m.label} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold" style={surfaceStyle(theme)}>
            {m.icon} {m.label}
          </span>
        ))}
      </div>
    </section>
  )
}

export function CartBar({ theme, label, action, edit }: { theme: SfTheme; label?: string; action?: string; edit?: (key: string, value: string) => void }) {
  return (
    <div className="px-5 mt-6 sticky bottom-4 z-30">
      <div className="mx-auto w-full max-w-[420px]">
        <button
          className="sf-pressable w-full flex items-center justify-between px-5 py-4 sf-font-head font-bold text-sm"
          style={{
            background: 'var(--sf-text)',
            color: 'var(--sf-bg)',
            borderRadius: buttonRadius(theme.buttonVariant, theme.radius) + 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          }}
        >
          <span className="flex items-center gap-2"><ShoppingBag size={17} /> <InlineText value={label?.trim() ? label : 'Sacola · 2 itens'} onCommit={edit ? (v) => edit('label', v) : undefined} /></span>
          <span className="font-mono"><InlineText value={action?.trim() ? action : 'R$ 59,00 →'} onCommit={edit ? (v) => edit('action', v) : undefined} /></span>
        </button>
      </div>
    </div>
  )
}
