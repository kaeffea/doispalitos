import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RestaurantHeader } from '@/components/RestaurantHeader'
import { MiniImageUpload } from '@/components/ImageUpload'
import api from '@/lib/api'
import StorefrontRenderer from '@/site-studio/StorefrontRenderer'
import { BLOCK_CATALOG, BLOCK_GATES, type PageSection, type ProductBadge, type SfOverrides, type SfTheme, type StoreData, type StoreStatus } from '@/site-studio/studio/types'
import { PRESETS } from '@/site-studio/studio/presets'
import { LOJA_CHEIA, LOJA_VAZIA } from '@/site-studio/studio/mocks'
import '../site-studio/studio.css'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  Layers,
  Loader2,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  Smartphone,
  Sparkles,
  Blocks,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  X,
} from 'lucide-react'

type LeftTab = 'temas' | 'blocos' | 'camadas'

const FONT_OPTIONS = [
  '"Plus Jakarta Sans", sans-serif',
  '"Inter", sans-serif',
  '"Space Grotesk", sans-serif',
  '"Playfair Display", serif',
  '"DM Serif Display", serif',
  '"Fredoka", sans-serif',
  '"Caveat", cursive',
  '"JetBrains Mono", monospace',
]

function fontShort(f: string): string {
  return f.split(',')[0].replace(/"/g, '')
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`
}

interface Snapshot {
  theme: SfTheme
  sections: PageSection[]
  overrides: SfOverrides
}

function StudioField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase text-zinc-400">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs"
      />
    </label>
  )
}

function StudioArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase text-zinc-400">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs resize-y"
      />
    </label>
  )
}

/* Miniatura viva do bloco (renderiza de verdade, no estilo atual) */

function BlockThumb({ theme, section, store, status }: { theme: SfTheme; section: PageSection; store: StoreData; status: StoreStatus }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700/60" style={{ height: 118, background: theme.colors.bg }}>
      <div className="pointer-events-none select-none absolute top-0 left-0" style={{ width: 390, transform: 'scale(0.72)', transformOrigin: 'top left' }}>
        <StorefrontRenderer
          editable
          preset={{ theme, sections: [{ ...section, width: 'full', visible: true, showIf: 'always' }] }}
          store={store}
          status={status}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-9 pointer-events-none" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.22))' }} />
    </div>
  )
}

/* Modelos trocáveis por bloco (independem do preset) + metades compatíveis */

const VARIANT_CHOICES: Record<string, Array<{ value: string; label: string }>> = {
  hero: [
    { value: 'split', label: 'Dividida' },
    { value: 'cover', label: 'Foto cheia' },
    { value: 'typo', label: 'Tipográfica' },
    { value: 'glass-promo', label: 'Vidro' },
    { value: 'minimal', label: 'Mínima' },
    { value: 'wide', label: 'Ampla (PC)' },
  ],
  header: [
    { value: 'minimal', label: 'Mínimo' },
    { value: 'centered', label: 'Centralizado' },
    { value: 'cover', label: 'Com capa' },
    { value: 'split', label: 'Dividido + nota' },
    { value: 'nav', label: 'Navegação (PC)' },
  ],
  categories: [
    { value: 'pills', label: 'Pills' },
    { value: 'photos', label: 'Fotos redondas' },
    { value: 'underline', label: 'Sublinhado' },
    { value: 'grid', label: 'Grade 2 colunas' },
  ],
  products: [
    { value: 'photo-left', label: 'Foto à esquerda' },
    { value: 'photo-top', label: 'Foto em cima' },
    { value: 'editorial', label: 'Editorial sem foto' },
    { value: 'glass', label: 'Vidro' },
    { value: 'compact', label: 'Compacto 1 linha' },
  ],
  promo: [
    { value: 'banner', label: 'Faixa' },
    { value: 'carousel', label: 'Carrossel' },
  ],
  featured: [
    { value: 'carousel', label: 'Carrossel' },
    { value: 'grid', label: 'Grade 2 colunas' },
  ],
  reviews: [
    { value: 'cards', label: 'Cartões' },
    { value: 'spotlight', label: 'Nota em destaque' },
  ],
  info: [
    { value: 'cards', label: 'Cartões' },
    { value: 'compact', label: 'Lista compacta' },
  ],
  combo: [
    { value: 'card', label: 'Cartão com foto' },
    { value: 'banner', label: 'Faixa escura' },
  ],
  status: [
    { value: 'pill', label: 'Faixa fina' },
    { value: 'card', label: 'Cartão' },
  ],
  footer: [
    { value: 'minimal', label: 'Mínimo' },
    { value: 'complete', label: 'Completo' },
  ],
}

/* Só estes blocos ficam bons em meia largura (importado do motor) */

const BADGE_CYCLE: ProductBadge[] = [null, 'mais_pedido', 'novo', 'promo', 'veg', 'picante']

const BADGE_LABEL: Record<string, string> = {
  mais_pedido: 'Mais pedido',
  novo: 'Novo',
  promo: 'Oferta',
  veg: 'Vegetariano',
  picante: 'Picante',
}

function hueOf(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/* Dados reais da loja (sem mock): categorias e produtos do cardápio de verdade */

function mapRealStore(cats: any[], prods: any[], tenantName?: string | null): StoreData {
  const name = tenantName || 'Minha loja'
  return {
    id: 'real',
    name,
    slug: 'minha-loja',
    tagline: '',
    logoText: name.trim().slice(0, 2).toUpperCase() || 'ML',
    rating: 0,
    reviewsCount: 0,
    deliveryTime: '—',
    deliveryFee: '—',
    address: '',
    phone: '',
    hours: '',
    story: '',
    categories: cats.map((c: any) => ({ id: String(c.id), name: c.name, icon: 'pizza' })),
    products: prods.map((p: any) => ({
      id: String(p.id),
      category_id: String(p.category_id),
      name: p.name,
      description: p.description ?? '',
      price: Number(p.price) || 0,
      badge: (p.is_featured ? 'mais_pedido' : null) as 'mais_pedido' | null,
      is_available: Boolean(p.is_available),
      hue: hueOf(String(p.id)),
      image: (p.image_url as string | null) ?? null,
    })),
    promos: [],
    reviews: [],
  }
}

/* ─── Assistente "Montar do zero": cores → blocos, camada por camada ─── */

const WIZARD_ORDER: PageSection['type'][] = ['header', 'status', 'hero', 'search', 'categories', 'products', 'promo', 'combo', 'featured', 'upsell', 'loyalty', 'schedule', 'reviews', 'story', 'video', 'hours', 'payment', 'instagram', 'map', 'info', 'footer', 'cartbar']

const WIZARD_BLOCKS: Array<{ type: PageSection['type']; label: string; desc: string; on: boolean }> = [
  { type: 'header', label: 'Topo da loja', desc: 'Logo + nome', on: true },
  { type: 'status', label: 'Aberto/Fechado', desc: 'Faixa de status ao vivo', on: true },
  { type: 'hero', label: 'Capa de destaque', desc: 'Foto + chamada + botões', on: true },
  { type: 'search', label: 'Busca', desc: 'Buscar no cardápio', on: true },
  { type: 'categories', label: 'Categorias', desc: 'Navegação do cardápio', on: true },
  { type: 'products', label: 'Produtos', desc: 'O cardápio em si', on: true },
  { type: 'promo', label: 'Cupons', desc: 'Faixa de ofertas', on: false },
  { type: 'combo', label: 'Combo em destaque', desc: 'Oferta montada', on: false },
  { type: 'featured', label: 'Mais pedidos', desc: 'Carrossel de queridinhos', on: false },
  { type: 'upsell', label: 'Combina com', desc: 'Sugestões do cardápio', on: false },
  { type: 'loyalty', label: 'Fidelidade', desc: 'Cartão de selos', on: false },
  { type: 'schedule', label: 'Agendar pedido', desc: 'Encomendas com hora', on: false },
  { type: 'reviews', label: 'Avaliações', desc: 'Prova de quem pediu', on: false },
  { type: 'story', label: 'História', desc: 'Conte a origem da casa', on: false },
  { type: 'video', label: 'Vídeo da casa', desc: 'YouTube embutido', on: false },
  { type: 'hours', label: 'Horário de hoje', desc: 'Destaque de horário', on: false },
  { type: 'payment', label: 'Pagamento', desc: 'PIX, cartão, dinheiro', on: false },
  { type: 'instagram', label: 'Instagram', desc: 'Grade do perfil', on: false },
  { type: 'map', label: 'Como chegar', desc: 'Mapa + rota', on: false },
  { type: 'info', label: 'Entrega e horários', desc: 'Taxa, endereço, horas', on: true },
  { type: 'footer', label: 'Rodapé', desc: 'Assinatura da loja', on: true },
  { type: 'cartbar', label: 'Sacola', desc: 'Botão flutuante do pedido', on: true },
]

function ZeroWizard({ onClose, onApply }: { onClose: () => void; onApply: (theme: SfTheme, sections: PageSection[]) => void }) {
  const [step, setStep] = useState(0)
  const [base, setBase] = useState<'light' | 'dark'>('light')
  const [primary, setPrimary] = useState('#E5CB3C')
  const [font, setFont] = useState(FONT_OPTIONS[0])
  const [photo, setPhoto] = useState('')
  const [picked, setPicked] = useState<string[]>(WIZARD_BLOCKS.filter((b) => b.on).map((b) => b.type))

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  const apply = () => {
    const baseTheme = base === 'light' ? PRESETS[0].theme : PRESETS[1].theme
    const theme: SfTheme = JSON.parse(
      JSON.stringify({
        ...baseTheme,
        id: `custom-${Date.now().toString(36)}`,
        name: 'Meu estilo',
        description: 'Montado do zero pelo gestor.',
        designStyle: 'personalizado do zero',
        colors: { ...baseTheme.colors, primary },
        fonts: { ...baseTheme.fonts, head: font },
      }),
    )
    const sections: PageSection[] = WIZARD_ORDER.filter((t) => picked.includes(t)).map((t) => {
      const s: PageSection = { id: uid(t), type: t, visible: true, showIf: 'always' }
      if (t === 'hero' && photo.trim()) s.props = { imageUrl: photo.trim() }
      return s
    })
    onApply(theme, sections)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">Passo {step + 1} de 3</p>
            <h2 className="text-lg font-bold">{step === 0 ? 'Base do seu site' : step === 1 ? 'Camadas do site' : 'Tudo pronto?'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-sm">
          {step === 0 && (
            <>
              <div>
                <p className="font-mono text-[11px] uppercase text-zinc-400 mb-2">Comece pelo clima</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['light', 'dark'] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBase(b)}
                      className={`p-3 rounded-xl border text-left ${base === b ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-200 dark:border-zinc-800'}`}
                    >
                      <span className="font-bold text-xs block">{b === 'light' ? '☀️ Claro editorial' : '🌙 Escuro premium'}</span>
                      <span className="text-[11px] text-zinc-500">{b === 'light' ? 'Limpo, papel e manteiga' : 'Noturno, sofisticado'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase text-zinc-400 mb-2">Cor principal do restaurante</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                  <div className="flex gap-1.5">
                    {['#E5CB3C', '#C96F2B', '#B33A2B', '#3E9B4F', '#E23E3E', '#A855F7', '#2D7DD2', '#141416'].map((c) => (
                      <button key={c} onClick={() => setPrimary(c)} className="w-7 h-7 rounded-full border border-black/15" style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
              </div>
              <label className="block">
                <span className="font-mono text-[11px] uppercase text-zinc-400">Fonte dos títulos</span>
                <select value={font} onChange={(e) => setFont(e.target.value)} className="mt-1.5 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm">
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{fontShort(f)}</option>)}
                </select>
              </label>
              <div>
                <span className="font-mono text-[11px] uppercase text-zinc-400">Foto da capa (opcional)</span>
                <div className="flex items-center gap-2.5 mt-1.5 p-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                  <MiniImageUpload value={photo} onChange={setPhoto} onRemove={() => setPhoto('')} />
                  <input
                    type="text"
                    value={photo}
                    onChange={(e) => setPhoto(e.target.value)}
                    placeholder="…ou cole o link https://"
                    className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-zinc-400"
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs text-zinc-500">Marque as camadas na ordem em que aparecem. A ordem você ajusta depois arrastando.</p>
              <div className="space-y-1.5">
                {WIZARD_BLOCKS.map((b, i) => (
                  <label key={b.type} className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-zinc-400">
                    <input
                      type="checkbox"
                      checked={picked.includes(b.type)}
                      onChange={() => toggle(b.type)}
                      className="w-4 h-4 accent-[#F5DC55] shrink-0"
                    />
                    <span className="font-mono text-[10px] text-zinc-400 w-5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">
                      <span className="text-xs font-bold block">{b.label}</span>
                      <span className="text-[11px] text-zinc-500">{b.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="text-center py-4 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-[#D4B316] dark:text-[#F5DC55]" />
              <p className="font-bold">Base {base === 'light' ? 'clara' : 'escura'} · {picked.length} camadas · fonte {fontShort(font)}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">Vamos montar o rascunho. Depois você clica nos textos do preview para editar, troca modelos por bloco e arrasta tudo de lugar.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
          >
            {step === 0 ? 'Cancelar' : '← Voltar'}
          </button>
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} className="px-5 py-2.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold">
              Continuar →
            </button>
          ) : (
            <button
              onClick={apply}
              disabled={picked.length === 0}
              className="px-5 py-2.5 rounded-lg bg-[#F5DC55] hover:bg-[#E5CB3C] disabled:opacity-40 text-zinc-950 text-xs font-bold uppercase tracking-wide"
            >
              Montar meu site
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SiteStudioPage() {
  const { tenant } = useAuth()
  const initial = PRESETS[0]

  const [theme, setTheme] = useState<SfTheme>(() => JSON.parse(JSON.stringify(initial.theme)))
  const [sections, setSections] = useState<PageSection[]>(() => JSON.parse(JSON.stringify(initial.sections)))
  const [overrides, setOverrides] = useState<SfOverrides>({})
  const [presetId, setPresetId] = useState(initial.theme.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>('temas')
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [source, setSource] = useState<'real' | 'sample'>('real')
  const [realStore, setRealStore] = useState<StoreData | null>(null)
  const [loadingReal, setLoadingReal] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const loadedRef = useRef(false)

  /* Carrega o rascunho salvo no servidor (sem sujar o desfazer) */
  useEffect(() => {
    let alive = true
    api.get('/restaurant/storefront')
      .then((res) => {
        if (!alive) return
        const d = res.data?.draft
        if (d && (d.theme || d.sections)) {
          if (d.theme) setTheme(d.theme)
          if (d.sections) setSections(d.sections)
          if (d.overrides) setOverrides(d.overrides)
          const pid = d.theme?.id
          if (pid && PRESETS.some((p) => p.theme.id === pid)) setPresetId(pid)
          else if (d.theme) setPresetId('custom')
        }
        if (res.data?.published) setPublishedAt(res.data.published.published_at ?? 'publicado')
        setPast([])
        setFuture([])
      })
      .catch(() => {
        /* sem rascunho: começa do padrão */
      })
      .finally(() => {
        if (alive) loadedRef.current = true
      })
    return () => {
      alive = false
    }
  }, [])

  /* Autosave do rascunho com debounce */
  useEffect(() => {
    if (!loadedRef.current) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try {
        await api.put('/restaurant/storefront', { theme, sections, overrides })
        setSaveState('saved')
        setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      } catch {
        setSaveState('error')
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [theme, sections, overrides])

  const handlePublish = async () => {
    try {
      const res = await api.post('/restaurant/storefront/publish')
      setPublishedAt(res.data.published_at ?? new Date().toISOString())
      const gated = Array.from(new Set(sections.filter((s) => s.visible !== false).map((s) => s.type)))
        .map((t) => BLOCK_GATES[t]?.label)
        .filter((x): x is string => Boolean(x))
      setToast(
        gated.length > 0
          ? `Site publicado! Ressalva: cadastre ${gated.join(' · ')} para esses blocos valerem de verdade.`
          : 'Site publicado! O cliente já vê esse design no endereço da loja.',
      )
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setToast(err.response?.data?.message || 'Não deu pra publicar. Tente de novo.')
    }
  }

  const handleUnpublish = async () => {
    try {
      await api.post('/restaurant/storefront/unpublish')
      setPublishedAt(null)
      setToast('Site customizado pausado. O modelo padrão voltou ao ar.')
    } catch {
      setToast('Não deu pra pausar. Tente de novo.')
    }
  }
  const [status, setStatus] = useState<StoreStatus>('open')
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const sampleStore = useMemo(() => {
    if (tenant?.name) return { ...LOJA_CHEIA, name: tenant.name }
    return LOJA_CHEIA
  }, [tenant?.name])

  /* Conteúdo real: nada mockado no editor de verdade */
  useEffect(() => {
    let alive = true
    setLoadingReal(true)
    Promise.all([api.get('/restaurant/categories'), api.get('/restaurant/products')])
      .then(([c, p]) => {
        if (alive) setRealStore(mapRealStore(c.data?.categories ?? [], p.data?.products ?? [], tenant?.name))
      })
      .catch(() => {
        if (alive) setRealStore(null)
      })
      .finally(() => {
        if (alive) setLoadingReal(false)
      })
    return () => {
      alive = false
    }
  }, [tenant?.name])

  const store = source === 'sample' ? sampleStore : (realStore ?? { ...LOJA_VAZIA, name: tenant?.name ?? 'Minha loja' })

  const preset = useMemo(
    () => ({ theme, sections, overrides }),
    [theme, sections, overrides],
  )

  const pushHistory = (nextTheme: SfTheme, nextSections: PageSection[], nextOverrides: SfOverrides = overrides) => {
    setPast((p) => [...p.slice(-29), { theme, sections, overrides }])
    setFuture([])
    setTheme(nextTheme)
    setSections(nextSections)
    setOverrides(nextOverrides)
  }

  const handleUndo = () => {
    if (past.length === 0) return
    const prev = past[past.length - 1]
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [{ theme, sections, overrides }, ...f].slice(0, 30))
    setTheme(prev.theme)
    setSections(prev.sections)
    setOverrides(prev.overrides ?? {})
  }

  const handleRedo = () => {
    if (future.length === 0) return
    const next = future[0]
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, { theme, sections, overrides }])
    setTheme(next.theme)
    setSections(next.sections)
    setOverrides(next.overrides ?? {})
  }

  const applyPreset = (id: string) => {
    const found = PRESETS.find((p) => p.theme.id === id)
    if (!found) return
    pushHistory(
      JSON.parse(JSON.stringify(found.theme)),
      JSON.parse(JSON.stringify(found.sections)),
      {},
    )
    setPresetId(id)
    setSelectedId(null)
    setToast(`Estilo “${found.theme.name}” aplicado. Ajuste o que quiser — nada foi publicado ainda.`)
  }

  const updateTheme = (patch: Partial<SfTheme>) => {
    pushHistory({ ...theme, ...patch }, sections)
  }

  const updateColors = (key: keyof SfTheme['colors'], value: string) => {
    pushHistory({ ...theme, colors: { ...theme.colors, [key]: value } }, sections)
  }

  const moveSection = (index: number, dir: -1 | 1) => {
    const next = [...sections]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    pushHistory(theme, next)
  }

  const dropAt = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) return
    const next = [...sections]
    const [item] = next.splice(dragIndex, 1)
    next.splice(toIndex, 0, item)
    pushHistory(theme, next)
    setDragIndex(null)
  }

  const toggleVisible = (id: string) => {
    pushHistory(
      theme,
      sections.map((s) => (s.id === id ? { ...s, visible: s.visible === false ? true : false } : s)),
    )
  }

  const removeSection = (id: string) => {
    pushHistory(theme, sections.filter((s) => s.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const addBlock = (type: PageSection['type']) => {
    const id = uid(type)
    pushHistory(theme, [...sections, { id, type, visible: true, showIf: 'always' }])
    setSelectedId(id)
  }

  const resetAll = () => {
    applyPreset(PRESETS[0].theme.id)
    setPast([])
    setFuture([])
  }

  const moveById = (id: string, dir: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === id)
    if (i >= 0) moveSection(i, dir)
  }

  const reorderById = (dragId: string, targetId: string, mode: 'before' | 'after' | 'beside' = 'before') => {
    if (dragId === targetId) return
    const dragged = sections.find((s) => s.id === dragId)
    if (!dragged) return
    const next = sections.filter((s) => s.id !== dragId)
    const to = next.findIndex((s) => s.id === targetId)
    const at = to < 0 ? next.length : mode === 'after' ? to + 1 : to
    next.splice(at, 0, dragged)
    pushHistory(theme, next)
  }

  const duplicateSection = (id: string) => {
    const i = sections.findIndex((s) => s.id === id)
    if (i < 0) return
    const copy: PageSection = {
      ...sections[i],
      id: uid(sections[i].type),
      props: sections[i].props ? { ...sections[i].props } : undefined,
    }
    const next = [...sections]
    next.splice(i + 1, 0, copy)
    pushHistory(theme, next)
    setSelectedId(copy.id)
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    try {
      if (!localStorage.getItem('doispalitos_inline_hint')) {
        localStorage.setItem('doispalitos_inline_hint', '1')
        setToast('Dica: clique de novo em qualquer texto do bloco para editar ali mesmo ✎ — Enter confirma, Esc cancela.')
      }
    } catch {
      /* sem localStorage, segue o jogo */
    }
  }

  const selected = sections.find((s) => s.id === selectedId) ?? null

  const propStr = (key: string): string => {
    const v = selected?.props?.[key]
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
  }

  const setProp = (key: string, value: string) => {
    if (!selected) return
    pushHistory(theme, sections.map((s) => (s.id === selected.id ? { ...s, props: { ...(s.props ?? {}), [key]: value } } : s)))
  }

  const setNumProp = (key: string, value: string) => {
    if (!selected) return
    const n = Number(value)
    if (!Number.isFinite(n)) return
    pushHistory(theme, sections.map((s) => (s.id === selected.id ? { ...s, props: { ...(s.props ?? {}), [key]: n } } : s)))
  }

  const setBoolProp = (key: string, value: boolean) => {
    if (!selected) return
    pushHistory(theme, sections.map((s) => (s.id === selected.id ? { ...s, props: { ...(s.props ?? {}), [key]: value } } : s)))
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-[#F5DC55] selection:text-zinc-950 flex flex-col">
      <RestaurantHeader activeTab="site" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 space-y-4">
        {/* Title bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <Link to="/dashboard" className="text-xs font-mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao painel da loja
            </Link>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Meu Site <span className="font-mono text-xs align-middle ml-2 px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-500">rascunho local · passo 2</span></h1>
            <p className="text-xs text-zinc-500 mt-1">Monte o cardápio do jeito da sua casa. Arraste blocos, troque o estilo, veja na hora. Publicar no endereço oficial vem na próxima etapa.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleUndo} disabled={past.length === 0} className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 hover:border-[#F5DC55]" title="Desfazer">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={future.length === 0} className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-40 hover:border-[#F5DC55]" title="Refazer">
              <Redo2 className="w-4 h-4" />
            </button>
            <button onClick={resetAll} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-mono hover:border-[#F5DC55]" title="Voltar ao padrão">
              <RotateCcw className="w-3.5 h-3.5" /> Padrão
            </button>
            <a
              href="http://localhost:5175"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-mono hover:border-[#F5DC55]"
            >
              <Globe className="w-3.5 h-3.5" /> Vitrine :5175
            </a>
            <span className="font-mono text-[11px] text-zinc-400 hidden md:inline">
              {saveState === 'saving' ? 'Salvando rascunho…' : saveState === 'saved' ? `Rascunho salvo${savedAt ? ` às ${savedAt}` : ''} ✓` : saveState === 'error' ? 'Falha ao salvar rascunho' : ''}
              {publishedAt ? ` · no ar` : ''}
            </span>
            <button
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 text-xs font-bold uppercase tracking-wide"
            >
              <Check className="w-4 h-4" /> Publicar
            </button>
            {publishedAt && (
              <button
                onClick={handleUnpublish}
                className="text-[11px] font-mono text-zinc-400 underline underline-offset-2"
                title="Tirar o site customizado do ar"
              >
                tirar do ar
              </button>
            )}
          </div>
        </div>

        {toast && (
          <div className="py-2.5 px-3 border-l-2 border-[#F5DC55] text-xs font-mono bg-[#F5DC55]/10 flex items-center justify-between">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="p-1 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* 3 columns */}
        <div
          className={
            device === 'mobile'
              ? 'grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)_330px] gap-4 items-start'
              : 'grid grid-cols-1 xl:grid-cols-2 gap-4 items-start'
          }
        >
          {/* LEFT */}
          <div className="bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex text-[11px] font-mono border-b border-zinc-200 dark:border-zinc-800">
              {([['temas', 'Temas'], ['blocos', 'Blocos'], ['camadas', 'Camadas']] as Array<[LeftTab, string]>).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`flex-1 px-2 py-3 uppercase tracking-wider ${leftTab === tab ? 'font-bold border-b-2 border-[#F5DC55] bg-[#F5DC55]/5' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-3 max-h-[640px] overflow-y-auto">
              {leftTab === 'temas' && (
                <div className="space-y-2">
                  <button onClick={() => setWizardOpen(true)} className="w-full p-3 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-left flex items-center gap-2.5 hover:opacity-90 transition-opacity">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>
                      <span className="text-xs font-bold block">Montar do zero</span>
                      <span className="text-[11px] opacity-70">cores → blocos, camada por camada</span>
                    </span>
                  </button>
                  <p className="text-[11px] font-mono text-zinc-400 px-1 flex items-center gap-1"><Palette className="w-3 h-3" /> ou {PRESETS.length} estilos prontos · 1 clique troca tudo</p>
                  {PRESETS.map((p) => (
                    <button
                      key={p.theme.id}
                      onClick={() => applyPreset(p.theme.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${presetId === p.theme.id ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{p.theme.name}</span>
                        <span className="flex gap-1">
                          {[p.theme.colors.bg, p.theme.colors.primary, p.theme.colors.text].map((c, i) => (
                            <span key={i} className="w-4 h-4 rounded-full border border-black/15" style={{ background: c }} />
                          ))}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">{p.theme.designStyle}</p>
                      <p className="font-mono text-[10px] text-zinc-400 mt-1">cards {p.theme.cardVariant} · hero {p.theme.heroVariant}</p>
                    </button>
                  ))}
                </div>
              )}

              {leftTab === 'blocos' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-mono text-zinc-400 px-1 flex items-center gap-1"><Blocks className="w-3 h-3" /> Só o que ainda não está no site · prévia real</p>
                  {BLOCK_CATALOG.filter((b) => b.status === 'pronto')
                    .filter((b) => !sections.some((s) => s.type === b.type))
                    .map((b) => (
                      <div key={b.type} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <BlockThumb theme={theme} section={{ id: `thumb-${b.type}`, type: b.type, visible: true, showIf: 'always' }} store={store} status={status} />
                        <div className="p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold leading-snug">{b.label}</span>
                            <button onClick={() => addBlock(b.type)} className="p-1.5 rounded-md bg-[#F5DC55] text-zinc-950 hover:bg-[#E5CB3C] shrink-0" title={`Adicionar ${b.label}`}>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="font-mono text-[10px] text-zinc-400 mt-1 leading-relaxed">{b.variants.join(' · ')}</p>
                          {BLOCK_GATES[b.type] && (
                            <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 mt-1">⚠ precisa de cadastro: {BLOCK_GATES[b.type]?.label}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {leftTab === 'camadas' && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-mono text-zinc-400 px-1 flex items-center gap-1"><Layers className="w-3 h-3" /> Arraste para reordenar · clique para editar</p>
                  {sections.map((s, i) => {
                    const meta = BLOCK_CATALOG.find((b) => b.type === s.type)
                    const hidden = s.visible === false
                    const isOpen = selectedId === s.id
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropAt(i)}
                        onClick={() => handleSelect(s.id)}
                        className={`p-2 rounded-lg border cursor-pointer ${isOpen ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'} ${hidden ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-zinc-400 cursor-grab shrink-0" />
                          <span className="font-mono text-[10px] text-zinc-400 w-5">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-xs font-medium flex-1 leading-snug">{meta?.label ?? s.type}</span>
                          {s.variantDesktop && s.variantDesktop !== s.variant && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" title={`No PC usa outro modelo: ${VARIANT_CHOICES[s.type]?.find((o) => o.value === s.variantDesktop)?.label ?? s.variantDesktop}`}>
                              PC≠CEL
                            </span>
                          )}
                          {BLOCK_GATES[s.type] && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title={`Precisa de cadastro: ${BLOCK_GATES[s.type]?.label}`} />
                          )}
                          <button onClick={(e) => { e.stopPropagation(); moveSection(i, -1) }} className="p-1 hover:text-zinc-950 dark:hover:text-white" title="Subir"><ArrowUp className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveSection(i, 1) }} className="p-1 hover:text-zinc-950 dark:hover:text-white" title="Descer"><ArrowDown className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); toggleVisible(s.id) }} className="p-1" title={hidden ? 'Mostrar' : 'Ocultar'}>
                            {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); duplicateSection(s.id) }} className="p-1 hover:text-zinc-950 dark:hover:text-white" title="Duplicar bloco">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); removeSection(s.id) }} className="p-1 hover:text-red-500" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        {isOpen && (
                          <div className="mt-2">
                            <BlockThumb theme={theme} section={s} store={store} status={status} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CENTER preview */}
          <div className={`bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden ${device === 'desktop' ? 'xl:col-span-full xl:order-first' : ''}`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 text-xs font-mono">
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700">
                <button onClick={() => setDevice('mobile')} className={`px-2.5 py-1.5 flex items-center gap-1 ${device === 'mobile' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-bold' : 'text-zinc-500'}`}>
                  <Smartphone className="w-3.5 h-3.5" /> Celular
                </button>
                <button onClick={() => setDevice('desktop')} className={`px-2.5 py-1.5 flex items-center gap-1 ${device === 'desktop' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-bold' : 'text-zinc-500'}`}>
                  <Monitor className="w-3.5 h-3.5" /> Site
                </button>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700">
                <button onClick={() => setSource('real')} className={`px-2.5 py-1.5 ${source === 'real' ? 'bg-[#F5DC55] text-zinc-950 font-bold' : 'text-zinc-500'}`}>
                  {loadingReal ? '… ' : ''}Minha loja
                </button>
                <button onClick={() => setSource('sample')} className={`px-2.5 py-1.5 ${source === 'sample' ? 'bg-[#F5DC55] text-zinc-950 font-bold' : 'text-zinc-500'}`}>
                  Exemplo
                </button>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700">
                {(['open', 'paused', 'closed'] as StoreStatus[]).map((s) => (
                  <button key={s} onClick={() => setStatus(s)} className={`px-2.5 py-1.5 ${status === s ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-bold' : 'text-zinc-500'}`}>
                    {s === 'open' ? 'Aberta' : s === 'paused' ? 'Pausa' : 'Fechada'}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-zinc-400 hidden sm:inline">{sections.filter((s) => s.visible !== false).length}/{sections.length} blocos visíveis</span>
            </div>
            <div className="bg-zinc-100 dark:bg-black/40 p-4">
              <div
                className="overflow-hidden bg-black border border-zinc-300 dark:border-zinc-700 mx-auto"
                style={{
                  width: device === 'mobile' ? 390 : '100%',
                  maxWidth: device === 'mobile' ? 390 : 1280,
                  borderRadius: device === 'mobile' ? 28 : 12,
                }}
              >
                {device === 'mobile' ? (
                  <div className="flex justify-center py-2 border-b border-white/10 bg-black">
                    <div className="w-20 h-1 rounded-full bg-white/25" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-[#1c1c20]">
                    <span className="flex gap-1.5 shrink-0">
                      <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                      <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </span>
                    <span className="flex-1 flex items-center justify-center gap-1.5 font-mono text-[11px] text-zinc-300 bg-white/10 rounded-md px-3 py-1.5 truncate">
                      <span className="text-emerald-400">●</span> {store.slug || 'sualoja'}.doispalitos.tech
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500 uppercase hidden sm:inline shrink-0">prévia do site</span>
                  </div>
                )}
                <div className={device === 'mobile' ? 'max-h-[680px] overflow-y-auto' : 'max-h-[76vh] overflow-y-auto sf-wide'}>
                  <StorefrontRenderer
                    preset={preset}
                    store={store}
                    status={status}
                    device={device}
                    editable
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onMove={moveById}
                    onToggle={toggleVisible}
                    onRemove={removeSection}
                    onReorder={reorderById}
                    onEditText={(id, key, value) => {
                      pushHistory(theme, sections.map((s) => (s.id === id ? { ...s, props: { ...(s.props ?? {}), [key]: value } } : s)))
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT inspector */}
          <div className="bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {selected ? `Bloco · ${BLOCK_CATALOG.find((b) => b.type === selected.type)?.label ?? selected.type}` : 'Aparência geral'}
            </div>
            <div className="p-3 space-y-4 max-h-[640px] overflow-y-auto text-xs">
              {!selected && (
                <>
                  <div>
                    <p className="font-mono text-[11px] uppercase text-zinc-400 mb-2">Cores (toque para trocar)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['bg', 'surface', 'text', 'muted', 'primary', 'accent', 'border'] as Array<keyof SfTheme['colors']>).map((key) => (
                        <label key={key} className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5">
                          <input type="color" value={theme.colors[key].length === 7 ? theme.colors[key] : '#F5DC55'} onChange={(e) => updateColors(key, e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
                          <span className="font-mono text-[10px]">{key}<br /><span className="text-zinc-400">{theme.colors[key]}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Fonte títulos</span>
                      <select value={theme.fonts.head} onChange={(e) => updateTheme({ fonts: { ...theme.fonts, head: e.target.value } })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        {FONT_OPTIONS.map((f) => <option key={f} value={f}>{fontShort(f)}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Fonte texto</span>
                      <select value={theme.fonts.body} onChange={(e) => updateTheme({ fonts: { ...theme.fonts, body: e.target.value } })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        {FONT_OPTIONS.map((f) => <option key={f} value={f}>{fontShort(f)}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="font-mono text-[10px] uppercase text-zinc-400">Arredondamento · {theme.radius}px</span>
                    <input type="range" min={0} max={28} value={theme.radius} onChange={(e) => updateTheme({ radius: Number(e.target.value) })} className="w-full accent-[#F5DC55]" />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Cartão produto</span>
                      <select value={theme.cardVariant} onChange={(e) => updateTheme({ cardVariant: e.target.value as SfTheme['cardVariant'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="photo-left">Foto à esquerda</option>
                        <option value="photo-top">Foto em cima</option>
                        <option value="editorial">Editorial sem foto</option>
                        <option value="glass">Vidro</option>
                        <option value="compact">Compacto 1 linha</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Capa (hero)</span>
                      <select value={theme.heroVariant} onChange={(e) => updateTheme({ heroVariant: e.target.value as SfTheme['heroVariant'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="split">Dividida</option>
                        <option value="cover">Foto cheia</option>
                        <option value="typo">Tipográfica</option>
                        <option value="glass-promo">Vidro promo</option>
                        <option value="minimal">Mínima</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Topo</span>
                      <select value={theme.headerVariant} onChange={(e) => updateTheme({ headerVariant: e.target.value as SfTheme['headerVariant'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="minimal">Mínimo</option>
                        <option value="centered">Centralizado</option>
                        <option value="cover">Com capa</option>
                        <option value="split">Dividido + nota</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Categorias</span>
                      <select value={theme.categoryVariant} onChange={(e) => updateTheme({ categoryVariant: e.target.value as SfTheme['categoryVariant'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="pills">Pills</option>
                        <option value="photos">Fotos redondas</option>
                        <option value="underline">Sublinhado</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Botões</span>
                      <select value={theme.buttonVariant} onChange={(e) => updateTheme({ buttonVariant: e.target.value as SfTheme['buttonVariant'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="pill">Pílula</option>
                        <option value="rounded">Arredondado</option>
                        <option value="square">Quadrado</option>
                        <option value="hard">Duro brutalista</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Sombra</span>
                      <select value={theme.shadow} onChange={(e) => updateTheme({ shadow: e.target.value as SfTheme['shadow'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="none">Nenhuma</option>
                        <option value="soft">Suave</option>
                        <option value="hard">Dura</option>
                        <option value="glow">Brilho</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-zinc-400">Animação</span>
                      <select value={theme.motion ?? 'subtle'} onChange={(e) => updateTheme({ motion: e.target.value as SfTheme['motion'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                        <option value="none">Parada</option>
                        <option value="subtle">Suave</option>
                        <option value="playful">Divertida</option>
                      </select>
                    </label>
                  </div>

                  <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-200 dark:border-zinc-800 pt-3">
                    Dica: o preview é o canvas — <b>clique num bloco do cardápio</b> para editar textos, foto e modelo dele. Passe o mouse para ver a barrinha de subir/descer/duplicar/ocultar/remover, ou arraste o bloco pela alça ⋮⋮.
                  </p>

                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2.5">
                    <p className="font-mono text-[11px] uppercase text-zinc-400">Fundo do site</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([['solid', 'Sólida'], ['gradient', 'Degradê'], ['photo', 'Foto']] as const).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => updateTheme({ bgMode: v })}
                          className={`px-2 py-2 rounded-lg border text-xs font-semibold ${(theme.bgMode ?? 'solid') === v ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="font-mono text-[10px] uppercase text-zinc-400">Textura</span>
                        <select value={theme.texture} onChange={(e) => updateTheme({ texture: e.target.value as SfTheme['texture'] })} className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs">
                          <option value="none">Lisa</option>
                          <option value="paper">Papel</option>
                          <option value="dots">Pontilhado</option>
                          <option value="grid">Grade</option>
                        </select>
                      </label>
                      <p className="text-[10px] text-zinc-400 self-end pb-2 font-mono">textura vale no fundo sólido</p>
                    </div>
                    {(theme.bgMode ?? 'solid') === 'photo' && (
                      <div>
                        <span className="font-mono text-[10px] uppercase text-zinc-400">Foto de fundo</span>
                        <div className="flex items-center gap-2.5 mt-1.5 p-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                          <MiniImageUpload value={theme.bgImage ?? ''} onChange={(url) => updateTheme({ bgImage: url })} onRemove={() => updateTheme({ bgImage: undefined })} />
                          <p className="text-[11px] text-zinc-500 leading-snug">Envie <b>ou</b> cole o link abaixo. Aplicamos véu da cor do site por cima para o texto continuar legível.</p>
                        </div>
                        <div className="mt-2">
                          <StudioField label="Foto de fundo (link)" value={theme.bgImage ?? ''} onChange={(v) => updateTheme({ bgImage: v })} placeholder="https://…/fundo.jpg" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selected && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-zinc-400">ID {selected.id}</span>
                    <button onClick={() => setSelectedId(null)} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">← geral</button>
                  </div>
                  {selected && BLOCK_GATES[selected.type] && (
                    <div className="p-3 rounded-xl border border-amber-400/50 bg-amber-400/10 text-[11px] leading-relaxed">
                      <p className="font-bold">⚠ Precisa de cadastro: {BLOCK_GATES[selected.type]?.label}</p>
                      <p className="text-zinc-500 mt-0.5">{BLOCK_GATES[selected.type]?.hint}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Link
                          to={BLOCK_GATES[selected.type]?.to ?? '/settings'}
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-bold"
                        >
                          Ir para cadastro →
                        </Link>
                      </div>
                      <p className="font-mono text-[10px] text-zinc-400 mt-1.5">Visualize à vontade — o Publicar só libera com a mecânica cadastrada. Ideal para ligar/desligar por temporada (ex: cupons só de semana).</p>
                    </div>
                  )}
                  <label className="flex items-center justify-between border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5">
                    <span className="font-semibold">Visível no site</span>
                    <input type="checkbox" checked={selected.visible !== false} onChange={() => toggleVisible(selected.id)} className="w-4 h-4 accent-[#F5DC55]" />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase text-zinc-400">Mostrar quando</span>
                    <select
                      value={selected.showIf ?? 'always'}
                      onChange={(e) => {
                        const v = e.target.value as PageSection['showIf']
                        pushHistory(theme, sections.map((s) => (s.id === selected.id ? { ...s, showIf: v } : s)))
                      }}
                      className="mt-1 w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs"
                    >
                      <option value="always">Sempre</option>
                      <option value="open">Só com loja aberta</option>
                      <option value="closed">Só com loja fechada/pausada</option>
                    </select>
                  </label>

                  {VARIANT_CHOICES[selected.type] && (
                    <div className="space-y-3">
                      <div>
                        <span className="font-mono text-[10px] uppercase text-zinc-400">Modelo no celular</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          {VARIANT_CHOICES[selected.type].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => pushHistory(theme, sections.map((s) => (s.id === selected.id ? { ...s, variant: opt.value } : s)))}
                              className={`px-2 py-2 rounded-lg border text-xs font-semibold leading-tight ${selected.variant === opt.value ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {selected.variant && (
                          <button
                            onClick={() => pushHistory(theme, sections.map((s) => {
                              if (s.id !== selected.id) return s
                              const copy = { ...s }
                              delete copy.variant
                              return copy
                            }))}
                            className="text-[11px] font-mono text-zinc-400 mt-1.5 underline underline-offset-2"
                          >
                            voltar a usar o do estilo
                          </button>
                        )}
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase text-zinc-400">Modelo no computador</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          {VARIANT_CHOICES[selected.type].map((opt) => {
                            const effective = selected.variantDesktop ?? selected.variant
                            return (
                              <button
                                key={opt.value}
                                onClick={() => pushHistory(theme, sections.map((s) => (s.id === selected.id ? { ...s, variantDesktop: opt.value } : s)))}
                                className={`px-2 py-2 rounded-lg border text-xs font-semibold leading-tight ${effective === opt.value ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                        {selected.variantDesktop ? (
                          <button
                            onClick={() => pushHistory(theme, sections.map((s) => {
                              if (s.id !== selected.id) return s
                              const copy = { ...s }
                              delete copy.variantDesktop
                              return copy
                            }))}
                            className="text-[11px] font-mono text-zinc-400 mt-1.5 underline underline-offset-2"
                          >
                            igual ao celular
                          </button>
                        ) : (
                          <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">Por enquanto repete o celular. Pré-visualize no modo Site para conferir o espaço largo.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.type === 'hero' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Textos da capa</p>
                      <StudioField label="Chamada pequena" value={propStr('kicker')} onChange={(v) => setProp('kicker', v)} placeholder="Ex: Forno a lenha · desde 1998" />
                      <StudioField label="Título grande" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Ex: Pizza de verdade, sem taxa abusiva." />
                      <StudioField label="Subtítulo" value={propStr('subtitle')} onChange={(v) => setProp('subtitle', v)} placeholder="Ex: Pedido direto com a casa…" />
                      <div className="grid grid-cols-2 gap-2">
                        <StudioField label="Botão 1" value={propStr('ctaPrimary')} onChange={(v) => setProp('ctaPrimary', v)} placeholder="Ver cardápio" />
                        <StudioField label="Botão 2" value={propStr('ctaSecondary')} onChange={(v) => setProp('ctaSecondary', v)} placeholder="Retirada" />
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase text-zinc-400">Foto da capa</span>
                        <div className="flex items-center gap-2.5 mt-1.5 p-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                          <MiniImageUpload value={propStr('imageUrl')} onChange={(url) => setProp('imageUrl', url)} onRemove={() => setProp('imageUrl', '')} />
                          <p className="text-[11px] text-zinc-500 leading-snug">Envie do seu celular <b>ou</b> cole o link no campo abaixo. JPG/PNG/WEBP até 5MB.</p>
                        </div>
                      </div>
                      <StudioField label="Foto da capa (link)" value={propStr('imageUrl')} onChange={(v) => setProp('imageUrl', v)} placeholder="https://…/foto.jpg" />
                      {propStr('imageUrl') && (
                        <img src={propStr('imageUrl')} alt="Prévia da capa" className="w-full h-28 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800" />
                      )}
                      <p className="text-[11px] text-zinc-500 leading-relaxed">A foto aparece na capa “Foto cheia” e no quadro da capa “Dividida”. Em branco, usa o desenho padrão do estilo.</p>
                    </div>
                  )}

                  {selected.type === 'featured' && (
                    <StudioField label="Título da seção" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="★ Mais pedidos da casa" />
                  )}
                  {selected.type === 'reviews' && (
                    <StudioField label="Título da seção" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Avaliações" />
                  )}
                  {selected.type === 'products' && (
                    <StudioField label="Título acima do cardápio (opcional)" value={propStr('heading')} onChange={(v) => setProp('heading', v)} placeholder="Ex: Nossas pizzas" />
                  )}
                  {selected.type === 'products' && (
                    <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Selos por produto</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">Vale para Mais pedidos e Sugestões, sem mexer no cadastro. O prato em si se edita no Cardápio.</p>
                      {store.products.length === 0 && (
                        <p className="text-[11px] text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5">Sem produtos na loja ainda — cadastre no Cardápio para selar.</p>
                      )}
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                        {store.products.map((p) => {
                          const real = (p.badge ?? null) as ProductBadge
                          const cur = overrides.productBadges?.[p.id] ?? real
                          const forced = overrides.productBadges?.[p.id] !== undefined
                          return (
                            <div key={p.id} className="flex items-center gap-2">
                              <span className="text-xs flex-1 truncate" title={p.name}>{p.name}</span>
                              <button
                                onClick={() => {
                                  const next = BADGE_CYCLE[(BADGE_CYCLE.indexOf(cur) + 1) % BADGE_CYCLE.length]
                                  const pb = { ...(overrides.productBadges ?? {}) }
                                  if (next === real) delete pb[p.id]
                                  else pb[p.id] = next
                                  pushHistory(theme, sections, { ...overrides, productBadges: pb })
                                }}
                                className={`text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-lg border shrink-0 ${cur ? 'border-[#F5DC55] bg-[#F5DC55]/10' : 'border-zinc-300 dark:border-zinc-700 text-zinc-400'}`}
                                title="Clique para trocar o selo"
                              >
                                {cur ? BADGE_LABEL[cur] : 'Sem selo'}{forced ? ' ●' : ''}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <Link to="/menu" className="text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2">
                        Editar pratos e fotos no Cardápio →
                      </Link>
                    </div>
                  )}
                  {selected.type === 'story' && (
                    <>
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                        <MiniImageUpload value={propStr('photo')} onChange={(url) => setProp('photo', url)} onRemove={() => setProp('photo', '')} />
                        <p className="text-[11px] text-zinc-500 leading-snug">Foto da casa (opcional) — aparece no topo do bloco.</p>
                      </div>
                      <StudioArea label="Texto da história" value={propStr('text')} onChange={(v) => setProp('text', v)} placeholder="Conte a história da casa…" />
                    </>
                  )}
                  {selected.type === 'footer' && (
                    <StudioField label="Linha do rodapé" value={propStr('note')} onChange={(v) => setProp('note', v)} placeholder="pedido direto · sem comissão…" />
                  )}
                  {selected.type === 'loyalty' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Cartão fidelidade</p>
                      <StudioField label="Título" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Clube da casa" />
                      <StudioField label="Subtítulo" value={propStr('subtitle')} onChange={(v) => setProp('subtitle', v)} placeholder="Junte 8 selos e ganhe…" />
                      <div className="grid grid-cols-2 gap-2">
                        <StudioField label="Meta de selos" value={propStr('goal')} onChange={(v) => setNumProp('goal', v)} placeholder="8" />
                        <StudioField label="Selos cheios (exemplo)" value={propStr('filled')} onChange={(v) => setNumProp('filled', v)} placeholder="3" />
                      </div>
                    </div>
                  )}
                  {selected.type === 'instagram' && (
                    <StudioField label="Perfil do Instagram" value={propStr('handle')} onChange={(v) => setProp('handle', v)} placeholder="@suarestaurante" />
                  )}
                  {selected.type === 'combo' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Oferta do combo</p>
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                        <MiniImageUpload value={propStr('photo')} onChange={(url) => setProp('photo', url)} onRemove={() => setProp('photo', '')} />
                        <p className="text-[11px] text-zinc-500 leading-snug">Foto do combo (opcional) — no lugar da arte padrão.</p>
                      </div>
                      <StudioField label="Selo" value={propStr('tag')} onChange={(v) => setProp('tag', v)} placeholder="Economize R$ 20" />
                      <StudioField label="Título" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Combo Família Feliz" />
                      <StudioField label="Descrição" value={propStr('subtitle')} onChange={(v) => setProp('subtitle', v)} placeholder="2 pizzas grandes + refri 2L…" />
                      <StudioField label="Preço" value={propStr('price')} onChange={(v) => setProp('price', v)} placeholder="R$ 99,90" />
                    </div>
                  )}
                  {selected.type === 'schedule' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Agendamento</p>
                      <StudioField label="Título" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Vai pedir pra depois?" />
                      <StudioField label="Subtítulo" value={propStr('subtitle')} onChange={(v) => setProp('subtitle', v)} placeholder="Agende o dia e a hora…" />
                      <StudioField label="Botão" value={propStr('button')} onChange={(v) => setProp('button', v)} placeholder="Escolher horário" />
                    </div>
                  )}
                  {selected.type === 'upsell' && (
                    <StudioField label="Título das sugestões" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Combina com seu pedido" />
                  )}
                  {selected.type === 'map' && (
                    <StudioField label="Endereço exibido (vazio = endereço da loja)" value={propStr('address')} onChange={(v) => setProp('address', v)} placeholder="Rua…, número — bairro" />
                  )}
                  {selected.type === 'video' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Vídeo</p>
                      <StudioField label="Título" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Conheça a casa 🎬" />
                      <StudioField label="Link do YouTube" value={propStr('videoUrl')} onChange={(v) => setProp('videoUrl', v)} placeholder="https://youtube.com/watch?v=…" />
                    </div>
                  )}
                  {selected.type === 'hours' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Horário em destaque</p>
                      <StudioField label="Título" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Horário de hoje" />
                      <StudioField label="Horário" value={propStr('text')} onChange={(v) => setProp('text', v)} placeholder="Ter–Dom · 18h às 23h" />
                      <StudioField label="Observação" value={propStr('note')} onChange={(v) => setProp('note', v)} placeholder="Cozinha fecha 30 min antes." />
                    </div>
                  )}
                  {selected.type === 'payment' && (
                    <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Bandeiras aceitas</p>
                      <StudioField label="Título" value={propStr('title')} onChange={(v) => setProp('title', v)} placeholder="Aceitamos" />
                      {(['pix', 'card', 'cash'] as const).map((k) => (
                        <label key={k} className="flex items-center justify-between border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
                          <span className="font-semibold">{k === 'pix' ? 'PIX' : k === 'card' ? 'Cartão' : 'Dinheiro'}</span>
                          <input
                            type="checkbox"
                            checked={selected.props?.[k] !== false}
                            onChange={(e) => setBoolProp(k, e.target.checked)}
                            className="w-4 h-4 accent-[#F5DC55]"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {selected.type === 'header' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Textos do topo (vazio = dados da loja)</p>
                      <StudioField label="Nome exibido" value={propStr('name')} onChange={(v) => setProp('name', v)} placeholder={store.name} />
                      <StudioField label="Frase exibida" value={propStr('tagline')} onChange={(v) => setProp('tagline', v)} placeholder={store.tagline || 'Frase da casa…'} />
                    </div>
                  )}
                  {selected.type === 'status' && (
                    <StudioField label="Texto da faixa (vazio = automático)" value={propStr('label')} onChange={(v) => setProp('label', v)} placeholder="Aberto agora · cozinha em 40 min" />
                  )}
                  {selected.type === 'search' && (
                    <StudioField label="Texto da busca" value={propStr('placeholder')} onChange={(v) => setProp('placeholder', v)} placeholder="Buscar no cardápio… ex: calabresa" />
                  )}
                  {selected.type === 'cartbar' && (
                    <div className="space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <p className="font-mono text-[10px] uppercase text-zinc-400">Textos da sacola</p>
                      <StudioField label="Esquerda" value={propStr('label')} onChange={(v) => setProp('label', v)} placeholder="Sacola · 2 itens" />
                      <StudioField label="Direita" value={propStr('action')} onChange={(v) => setProp('action', v)} placeholder="R$ 59,00 →" />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => { const i = sections.findIndex((s) => s.id === selected.id); moveSection(i, -1) }} className="flex-1 px-2 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-mono">↑ Subir</button>
                    <button onClick={() => { const i = sections.findIndex((s) => s.id === selected.id); moveSection(i, 1) }} className="flex-1 px-2 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-mono">↓ Descer</button>
                  </div>
                  <button onClick={() => removeSection(selected.id)} className="w-full px-2 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-mono flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Remover bloco
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-zinc-400 pb-6">
          {past.length > 0 ? `${past.length} alterações no rascunho · ` : 'Nenhuma alteração ainda · '}
          {sections.length} blocos · tema {theme.name ?? presetId} · {source === 'sample' ? `exemplo: ${store.products.length} produtos` : loadingReal ? 'carregando sua loja…' : store.products.length === 0 ? 'sua loja ainda sem produtos' : `${store.products.length} produtos · ${store.categories.length} categorias reais`} · status {status === 'open' ? 'aberta' : status === 'paused' ? 'pausa' : 'fechada'}
          {toast ? '' : ''}
          {false && <Loader2 className="w-3 h-3" />}
        </p>
      </main>
      {wizardOpen && (
        <ZeroWizard
          onClose={() => setWizardOpen(false)}
          onApply={(t, s) => {
            pushHistory(t, s, {})
            setPresetId('custom')
            setSelectedId(null)
            setWizardOpen(false)
            setToast('Site montado do zero! Agora clique nos textos do preview para editar e arraste os blocos de lugar.')
          }}
        />
      )}
    </div>
  )
}
