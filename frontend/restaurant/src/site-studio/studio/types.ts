/* ─── Doispalitos Storefront Studio — tipos do motor (passo 2) ───
   Ideia central: o site inteiro é descrito por JSON (theme + sections).
   O renderer interpreta. O Studio no app edita esse JSON visualmente. */

export type StoreStatus = 'open' | 'closed' | 'paused'

export interface StoreCategory {
  id: string
  name: string
  icon: string
  count?: number
}

export interface StoreProduct {
  id: string
  category_id: string
  name: string
  description: string
  price: number
  oldPrice?: number
  badge?: 'mais_pedido' | 'novo' | 'veg' | 'picante' | 'promo' | null
  is_available: boolean
  hue: number
  image?: string | null
}

export interface StorePromo {
  id: string
  title: string
  subtitle: string
  coupon?: string
}

export interface StoreReview {
  id: string
  name: string
  text: string
  stars: number
}

export interface StoreData {
  id: string
  name: string
  slug: string
  tagline: string
  logoText: string
  rating: number
  reviewsCount: number
  deliveryTime: string
  deliveryFee: string
  address: string
  phone: string
  hours: string
  story: string
  categories: StoreCategory[]
  products: StoreProduct[]
  promos: StorePromo[]
  reviews: StoreReview[]
}

/* ─── Tema: todos os tokens ajustáveis sem código ─── */

export type CardVariant = 'photo-left' | 'photo-top' | 'editorial' | 'glass' | 'compact'
export type HeaderVariant = 'minimal' | 'centered' | 'cover' | 'split'
export type HeroVariant = 'split' | 'cover' | 'typo' | 'glass-promo' | 'minimal'
export type CategoryVariant = 'pills' | 'photos' | 'underline'
export type ButtonVariant = 'pill' | 'rounded' | 'square' | 'hard'
export type MotionStyle = 'none' | 'subtle' | 'playful'

export interface SfTheme {
  id: string
  name: string
  description: string
  designStyle: string
  dark: boolean
  colors: {
    bg: string
    surface: string
    surface2: string
    text: string
    muted: string
    primary: string
    primaryText: string
    accent: string
    border: string
  }
  fonts: {
    head: string
    body: string
  }
  radius: number
  borderWidth: number
  shadow: 'none' | 'soft' | 'hard' | 'glow'
  spacing: 'compact' | 'comfortable' | 'airy'
  texture: 'none' | 'paper' | 'dots' | 'grid'
  cardVariant: CardVariant
  headerVariant: HeaderVariant
  heroVariant: HeroVariant
  categoryVariant: CategoryVariant
  buttonVariant: ButtonVariant
  motion?: MotionStyle
  bgMode?: 'solid' | 'gradient' | 'photo'
  bgImage?: string
}

/* ─── Página: lista ordenável de seções (o Studio edita isso) ───
   width 'half': duas metades consecutivas viram 2 colunas lado a lado. */

export type SectionType =
  | 'header'
  | 'status'
  | 'hero'
  | 'search'
  | 'categories'
  | 'products'
  | 'promo'
  | 'featured'
  | 'reviews'
  | 'story'
  | 'info'
  | 'footer'
  | 'cartbar'
  | 'loyalty'
  | 'instagram'
  | 'combo'
  | 'schedule'
  | 'upsell'
  | 'map'
  | 'video'
  | 'hours'
  | 'payment'

export interface PageSection {
  id: string
  type: SectionType
  title?: string
  visible?: boolean
  showIf?: 'always' | 'open' | 'closed'
  width?: 'full' | 'half'
  variant?: string
  variantDesktop?: string
  props?: Record<string, string | number | boolean>
}

export interface SfPreset {
  theme: SfTheme
  sections: PageSection[]
  overrides?: SfOverrides
}

/* Ajustes de vitrine por produto (selo forçado), sem mexer no cardápio real */

export type ProductBadge = 'mais_pedido' | 'novo' | 'veg' | 'picante' | 'promo' | null

export interface SfOverrides {
  productBadges?: Record<string, ProductBadge>
}

/* ─── Catálogo de blocos do Studio ─── */

export const BLOCK_CATALOG: Array<{
  type: SectionType
  label: string
  variants: string[]
  status: 'pronto' | 'planejado'
}> = [
  { type: 'header', label: 'Topo da loja', variants: ['minimal', 'centered', 'cover', 'split', 'nav (PC)'], status: 'pronto' },
  { type: 'status', label: 'Faixa Aberto/Fechado/Pausa', variants: ['pill', 'cartão'], status: 'pronto' },
  { type: 'hero', label: 'Capa / Destaque', variants: ['split', 'cover + foto', 'typo', 'glass-promo', 'minimal', 'wide (PC)'], status: 'pronto' },
  { type: 'search', label: 'Busca do cardápio', variants: ['barra'], status: 'pronto' },
  { type: 'categories', label: 'Navegação de categorias', variants: ['pills', 'photos', 'underline', 'grade'], status: 'pronto' },
  { type: 'products', label: 'Grade de produtos', variants: ['photo-left', 'photo-top', 'editorial', 'glass', 'compact'], status: 'pronto' },
  { type: 'promo', label: 'Faixa de cupom / promo', variants: ['banner', 'carrossel'], status: 'pronto' },
  { type: 'featured', label: 'Mais pedidos', variants: ['carrossel', 'grade 2col'], status: 'pronto' },
  { type: 'loyalty', label: 'Clube da casa (fidelidade)', variants: ['cartão de selos', 'progresso'], status: 'pronto' },
  { type: 'combo', label: 'Combo em destaque', variants: ['cartão', 'faixa'], status: 'pronto' },
  { type: 'schedule', label: 'Agendar pedido', variants: ['cartão', 'compacto'], status: 'pronto' },
  { type: 'upsell', label: 'Combina com (sugestões)', variants: ['carrossel'], status: 'pronto' },
  { type: 'reviews', label: 'Avaliações', variants: ['cards', 'destaque nota'], status: 'pronto' },
  { type: 'story', label: 'Nossa história', variants: ['split foto', 'tipográfico', 'timeline'], status: 'pronto' },
  { type: 'instagram', label: 'Instagram da casa', variants: ['grade 3col', 'carrossel'], status: 'pronto' },
  { type: 'map', label: 'Como chegar (mapa)', variants: ['cartão com pin'], status: 'pronto' },
  { type: 'video', label: 'Vídeo da casa', variants: ['player', 'capa'], status: 'pronto' },
  { type: 'hours', label: 'Horário de hoje', variants: ['cartão'], status: 'pronto' },
  { type: 'payment', label: 'Formas de pagamento', variants: ['chips'], status: 'pronto' },
  { type: 'info', label: 'Entrega / Horários / Endereço', variants: ['cards', 'compacto'], status: 'pronto' },
  { type: 'footer', label: 'Rodapé', variants: ['minimal', 'completo'], status: 'pronto' },
  { type: 'cartbar', label: 'Barra da sacola', variants: ['flutuante', 'fixa', 'com progresso p/ entrega grátis'], status: 'pronto' },
  // ── planejados ──
  // video-hero (vídeo da casa), allergen-flags (vegano/sem glúten), nutrition (tabela nutricional),
  // queue-time (tempo ao vivo por categoria), coupon-wheel (roleta de cupons), menu-pdf (ver cardápio em PDF)
]

/* Blocos únicos (somem da biblioteca depois de inseridos) vs repetíveis */

export const SINGLETON_TYPES: SectionType[] = ['header', 'status', 'hero', 'search', 'categories', 'products', 'footer', 'cartbar']

/* Blocos que ficam bons em meia largura lado a lado.
   Atenção: em alguns blocos um modelo divide e outro não — a lista vale
   por bloco; o refinamento por modelo vem na sequência. */

export const HALF_OK: SectionType[] = ['promo', 'featured', 'loyalty', 'reviews', 'story', 'instagram', 'info', 'combo', 'schedule', 'map']

/* Mecânicas que precisam de cadastro real para o bloco valer no site público.
   Sem cadastro: dá pra ver no preview, mas o Publicar barra (mock por enquanto). */

export const BLOCK_GATES: Partial<Record<SectionType, { label: string; hint: string; to: string }>> = {
  loyalty: {
    label: 'Clube fidelidade',
    hint: 'Cadastre pontos, selos e recompensas para ativar o clube de verdade.',
    to: '/settings',
  },
  promo: {
    label: 'Cupons',
    hint: 'Cadastre os cupons da semana para este bloco valer no site real.',
    to: '/settings',
  },
  instagram: {
    label: 'Instagram',
    hint: 'Conecte o @ da loja para puxar as fotos de verdade.',
    to: '/settings',
  },
}

export function cssVars(theme: SfTheme): React.CSSProperties {
  const shadow =
    theme.shadow === 'none'
      ? 'none'
      : theme.shadow === 'hard'
        ? '4px 4px 0 rgba(0,0,0,0.9)'
        : theme.shadow === 'glow'
          ? `0 8px 32px ${theme.colors.primary}55`
          : '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)'

  const spacing = theme.spacing === 'compact' ? '12px' : theme.spacing === 'airy' ? '24px' : '16px'

  return {
    '--sf-bg': theme.colors.bg,
    '--sf-surface': theme.colors.surface,
    '--sf-surface-2': theme.colors.surface2,
    '--sf-text': theme.colors.text,
    '--sf-muted': theme.colors.muted,
    '--sf-primary': theme.colors.primary,
    '--sf-primary-text': theme.colors.primaryText,
    '--sf-accent': theme.colors.accent,
    '--sf-border': theme.colors.border,
    '--sf-radius': `${theme.radius}px`,
    '--sf-border-w': `${theme.borderWidth}px`,
    '--sf-font-head': theme.fonts.head,
    '--sf-font-body': theme.fonts.body,
    '--sf-shadow': shadow,
    '--sf-spacing': spacing,
  } as React.CSSProperties
}

export function buttonRadius(button: ButtonVariant, base: number): number {
  if (button === 'pill') return 999
  if (button === 'square') return 4
  if (button === 'hard') return base
  return Math.max(10, base)
}

/* Resolve foto relativa (/storage/…) contra a origem da API em produção */

const API_ORIGIN: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '')

export function resolveArt(src?: string | null): string {
  if (!src) return ''
  if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  if (src.startsWith('/')) {
    return `${API_ORIGIN}${src}`
  }
  return `/${src}`
}
