import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { RestaurantHeader } from '@/components/RestaurantHeader'
import { CurrencyInput, formatCurrencyBRL } from '@/components/CurrencyInput'
import { ImageUpload, MiniImageUpload, resolveImageUrl } from '@/components/ImageUpload'
import api from '@/lib/api'
import { 
  Plus, 
  Search, 
  Check, 
  Loader2, 
  Edit2, 
  Trash2, 
  X, 
  UtensilsCrossed, 
  Layers, 
  Eye, 
  Circle, 
  CheckSquare, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react'

export interface ProductOption {
  id?: string
  name: string
  price: number
  image_url?: string | null
}

export interface ProductOptionGroup {
  id?: string
  name: string
  type: 'single' | 'multiple' | 'remove' | 'custom'
  min: number
  max: number
  is_req?: boolean
  options: ProductOption[]
}

export interface Category {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  products_count?: number
}

export interface Product {
  id: string
  category_id: string
  name: string
  description?: string
  price: number
  image_url?: string
  is_available: boolean
  is_featured: boolean
  sort_order: number
  category?: Category
  metadata?: any
  option_groups?: Array<{
    id: string
    name: string
    min_options: number
    max_options: number
    is_required: boolean
    options: Array<{
      id: string
      name: string
      price_modifier: number
      is_available: boolean
      image_url?: string | null
    }>
  }>
}

export interface PizzaSectionConfig {
  id: string
  name: string
  type: 'salgada' | 'doce'
}

export interface PizzaFlavorConfig {
  id: string
  section_id: string
  name: string
  description: string
  image_url: string | null
  prices: Record<string, number>
}

export interface PizzaSizeConfig {
  id: string
  name: string
  slices: number
  max_flavors: number
}

export interface PizzaCustomConfig {
  pricing_rule: 'highest' | 'average'
  allow_sweet_mix: boolean
  sections: PizzaSectionConfig[]
  sizes: PizzaSizeConfig[]
  flavors: PizzaFlavorConfig[]
  groups: ProductOptionGroup[]
}

export const DEFAULT_PIZZA_CONFIG: PizzaCustomConfig = {
  pricing_rule: 'highest',
  allow_sweet_mix: false,
  sections: [
    { id: 'sec_salgadas_tradicionais', name: 'Salgadas Tradicionais', type: 'salgada' },
    { id: 'sec_salgadas_especiais', name: 'Salgadas Especiais', type: 'salgada' },
    { id: 'sec_doces', name: 'Pizzas Doces', type: 'doce' },
  ],
  sizes: [
    { id: 'broto', name: 'Broto / Individual', slices: 4, max_flavors: 1 },
    { id: 'media', name: 'Média', slices: 6, max_flavors: 2 },
    { id: 'grande', name: 'Grande', slices: 8, max_flavors: 2 },
    { id: 'familia', name: 'Família / Gigante', slices: 12, max_flavors: 4 },
  ],
  flavors: [
    {
      id: 'calabresa',
      section_id: 'sec_salgadas_tradicionais',
      name: 'Calabresa com Cebola',
      description: 'Molho pelati artesanal, mozzarella fresca, calabresa defumada e orégano.',
      image_url: null,
      prices: { broto: 32, media: 42, grande: 52, familia: 64 },
    },
    {
      id: 'margherita',
      section_id: 'sec_salgadas_tradicionais',
      name: 'Margherita com Manjericão',
      description: 'Molho pelati, mozzarella de búfala, tomate fresco e folhas de manjericão.',
      image_url: null,
      prices: { broto: 34, media: 44, grande: 54, familia: 66 },
    },
    {
      id: 'frango_catupiry',
      section_id: 'sec_salgadas_tradicionais',
      name: 'Frango com Catupiry',
      description: 'Frango desfiado temperado com ervas, coberto com requeijão Catupiry legítimo.',
      image_url: null,
      prices: { broto: 36, media: 46, grande: 56, familia: 68 },
    },
    {
      id: 'quatro_queijos',
      section_id: 'sec_salgadas_especiais',
      name: 'Quatro Queijos',
      description: 'Mozzarella, provolone defumado, gorgonzola cremoso e parmesão ralado.',
      image_url: null,
      prices: { broto: 38, media: 50, grande: 62, familia: 76 },
    },
    {
      id: 'camarao',
      section_id: 'sec_salgadas_especiais',
      name: 'Camarão ao Catupiry',
      description: 'Camarões selecionados salteados no azeite com alho e Catupiry.',
      image_url: null,
      prices: { broto: 46, media: 60, grande: 76, familia: 92 },
    },
    {
      id: 'chocolate_morango',
      section_id: 'sec_doces',
      name: 'Chocolate com Morango',
      description: 'Ganache de chocolate ao leite nobre com morangos frescos fatiados.',
      image_url: null,
      prices: { broto: 35, media: 46, grande: 58, familia: 70 },
    },
    {
      id: 'nutella_ninho',
      section_id: 'sec_doces',
      name: 'Nutella com Leite Ninho',
      description: 'Creme de avelã Nutella genuína com polvilhado generoso de Leite Ninho.',
      image_url: null,
      prices: { broto: 40, media: 52, grande: 65, familia: 78 },
    },
  ],
  groups: [
    {
      name: 'Borda Recheada',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Sem Borda Recheada (Tradicional)', price: 0, image_url: null },
        { name: 'Borda de Catupiry Original', price: 10, image_url: null },
        { name: 'Borda de Cheddar Cremoso', price: 10, image_url: null },
        { name: 'Borda de Chocolate ao Leite', price: 12, image_url: null },
      ],
    },
    {
      name: 'Tipo de Massa',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Massa Tradicional de Fermentação Lenta', price: 0, image_url: null },
        { name: 'Massa Fina e Crocante', price: 0, image_url: null },
        { name: 'Massa Pan Fofinha', price: 6, image_url: null },
      ],
    },
    {
      name: 'Adicionais da Cozinha',
      type: 'multiple',
      min: 0,
      max: 4,
      is_req: false,
      options: [
        { name: 'Bacon Crocante Salpicado', price: 6, image_url: null },
        { name: 'Alho Frito Dourado', price: 4, image_url: null },
        { name: 'Queijo Parmesão Ralado', price: 5, image_url: null },
        { name: 'Azeitonas Pretas Extras', price: 4, image_url: null },
      ],
    },
  ],
}

export const SYSTEM_CATEGORY_PRESETS = [
  { name: 'Pizzas' },
  { name: 'Calzones' },
  { name: 'Hambúrgueres' },
  { name: 'Pastéis' },
  { name: 'Salgados' },
  { name: 'Açaí' },
  { name: 'Sorvetes' },
  { name: 'Massas' },
  { name: 'Pratos Executivos' },
  { name: 'Petiscos' },
  { name: 'Porções' },
  { name: 'Saladas' },
  { name: 'Sushi' },
  { name: 'Sobremesas' },
  { name: 'Bebidas' },
  { name: 'Combos' },
]

export const CATEGORY_OPTION_TEMPLATES: Record<string, ProductOptionGroup[]> = {
  pizzas: [
    {
      name: 'Borda Recheada',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Sem Borda Recheada (Tradicional)', price: 0 },
        { name: 'Borda de Catupiry Original', price: 10 },
        { name: 'Borda de Cheddar Cremoso', price: 10 },
        { name: 'Borda de Chocolate ao Leite', price: 12 },
      ],
    },
    {
      name: 'Tipo de Massa',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Massa Tradicional de Fermentação Lenta', price: 0 },
        { name: 'Massa Fina e Crocante', price: 0 },
        { name: 'Massa Pan Fofinha', price: 6 },
      ],
    },
    {
      name: 'Adicionais & Extras',
      type: 'multiple',
      min: 0,
      max: 4,
      is_req: false,
      options: [
        { name: 'Bacon Crocante Salpicado', price: 6 },
        { name: 'Alho Frito Dourado', price: 4 },
        { name: 'Queijo Parmesão Ralado', price: 5 },
        { name: 'Azeitonas Pretas Extras', price: 4 },
      ],
    },
  ],
  calzones: [
    {
      name: 'Recheio Principal',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Calabresa com Catupiry e Mozzarella', price: 0 },
        { name: 'Frango com Catupiry e Milho Doce', price: 0 },
        { name: 'Quatro Queijos Nobres', price: 0 },
        { name: 'Carne Seca Desfiada com Requeijão', price: 0 },
      ],
    },
    {
      name: 'Finalização por Cima',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Molho Pelati Artesanal e Orégano', price: 0 },
        { name: 'Queijo Parmesão Gratinado', price: 0 },
        { name: 'Azeite de Oliva e Ervas Finas', price: 0 },
      ],
    },
    {
      name: 'Adicionais Extras',
      type: 'multiple',
      min: 0,
      max: 3,
      is_req: false,
      options: [
        { name: 'Bacon Crocante Extra', price: 5 },
        { name: 'Palmito Picado', price: 4 },
        { name: 'Alho Dourado', price: 3 },
      ],
    },
  ],
  hamburgueres: [
    {
      name: 'Ponto da Carne',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Ao Ponto', price: 0 },
        { name: 'Bem Passado', price: 0 },
        { name: 'Mal Passado', price: 0 },
      ],
    },
    {
      name: 'Turbine seu Burger (Adicionais)',
      type: 'multiple',
      min: 0,
      max: 5,
      is_req: false,
      options: [
        { name: 'Bacon Crocante em Fatias', price: 6 },
        { name: 'Queijo Cheddar Inglês Derretido', price: 5 },
        { name: 'Ovo Frito com Gema Mole', price: 4 },
        { name: 'Hambúrguer Extra 180g', price: 12 },
      ],
    },
    {
      name: 'Ingredientes para Retirar',
      type: 'remove',
      min: 0,
      max: 10,
      is_req: false,
      options: [
        { name: 'Sem Cebola Caramelizada', price: 0 },
        { name: 'Sem Tomate', price: 0 },
        { name: 'Sem Picles Artesanal', price: 0 },
        { name: 'Sem Molho da Casa', price: 0 },
      ],
    },
  ],
  pasteis: [
    {
      name: 'Recheio do Pastel',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Carne Moída com Azeitona', price: 0 },
        { name: 'Queijo Mozzarella', price: 0 },
        { name: 'Frango com Catupiry', price: 0 },
        { name: 'Pizza (Queijo, Presunto, Tomate e Orégano)', price: 0 },
      ],
    },
    {
      name: 'Borda Recheada',
      type: 'single',
      min: 0,
      max: 1,
      is_req: false,
      options: [
        { name: 'Sem Borda Recheada', price: 0 },
        { name: 'Borda de Catupiry', price: 4 },
        { name: 'Borda de Cheddar', price: 4 },
      ],
    },
  ],
  salgados: [
    {
      name: 'Tipo de Preparo',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Frito na Hora', price: 0 },
        { name: 'Assado do Dia', price: 0 },
        { name: 'Congelado', price: 0 },
      ],
    },
  ],
  acai: [
    {
      name: 'Tamanho',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: '300ml', price: 0 },
        { name: '500ml', price: 5 },
        { name: '700ml', price: 10 },
      ],
    },
    {
      name: 'Acompanhamentos Grátis',
      type: 'multiple',
      min: 0,
      max: 3,
      is_req: false,
      options: [
        { name: 'Banana Fatiada', price: 0 },
        { name: 'Leite em Pó Ninho', price: 0 },
        { name: 'Granola Tradicional', price: 0 },
        { name: 'Leite Condensado', price: 0 },
        { name: 'Paçoca de Amendoim', price: 0 },
      ],
    },
    {
      name: 'Adicionais Premium',
      type: 'multiple',
      min: 0,
      max: 5,
      is_req: false,
      options: [
        { name: 'Nutella Pura Original', price: 6 },
        { name: 'Morango Fresco Picado', price: 5 },
        { name: 'Gotas de Chocolate', price: 4 },
        { name: 'Creme de Ninho', price: 5 },
      ],
    },
  ],
  sorvetes: [
    {
      name: 'Quantidade de Bolas',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: '1 Bola (Casquinha ou Copinho)', price: 0 },
        { name: '2 Bolas (Cascão ou Copinho)', price: 6 },
        { name: '3 Bolas (Taça Especial)', price: 12 },
      ],
    },
  ],
  massas: [
    {
      name: 'Tipo de Massa',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Espaguete Grano Duro', price: 0 },
        { name: 'Fettuccine Fresco', price: 0 },
        { name: 'Penne Rigate', price: 0 },
        { name: 'Nhoque de Batata', price: 4 },
      ],
    },
    {
      name: 'Molho Principal',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Molho Bolonhesa Clássico', price: 0 },
        { name: 'Molho Quatro Queijos', price: 4 },
        { name: 'Molho Carbonara', price: 6 },
        { name: 'Molho Pomodoro com Manjericão', price: 0 },
      ],
    },
  ],
  pratos_executivos: [
    {
      name: 'Escolha o Feijão',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Feijão Carioca', price: 0 },
        { name: 'Feijão Preto', price: 0 },
        { name: 'Sem Feijão', price: 0 },
      ],
    },
    {
      name: 'Ponto da Carne',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Ao Ponto', price: 0 },
        { name: 'Bem Passado', price: 0 },
      ],
    },
  ],
  petiscos: [
    {
      name: 'Tamanho da Porção',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Porção Inteira', price: 0 },
        { name: 'Meia Porção', price: 0 },
      ],
    },
  ],
  porcoes: [
    {
      name: 'Tamanho da Porção',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Porção Inteira', price: 0 },
        { name: 'Meia Porção', price: 0 },
      ],
    },
  ],
  saladas: [
    {
      name: 'Molho da Salada',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Molho Caesar', price: 0 },
        { name: 'Mostarda e Mel', price: 0 },
        { name: 'Azeite e Ervas', price: 0 },
      ],
    },
  ],
  sushi: [
    {
      name: 'Hashi e Utensílios',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Enviar 1 Par de Hashi', price: 0 },
        { name: 'Enviar 2 Pares de Hashi', price: 0 },
        { name: 'Não preciso de Hashi', price: 0 },
      ],
    },
    {
      name: 'Molhos Inclusos',
      type: 'multiple',
      min: 0,
      max: 4,
      is_req: false,
      options: [
        { name: 'Molho Shoyu', price: 0 },
        { name: 'Molho Tarê Doce', price: 0 },
        { name: 'Gengibre em Conserva (Gari)', price: 0 },
        { name: 'Wasabi (Raiz Forte)', price: 0 },
      ],
    },
  ],
  sobremesas: [
    {
      name: 'Temperatura de Serviço',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Servir Aquecido / Quente', price: 0 },
        { name: 'Servir Gelado', price: 0 },
        { name: 'Temperatura Ambiente', price: 0 },
      ],
    },
  ],
  bebidas: [
    {
      name: 'Temperatura e Gelo',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Gelada com Gelo e Limão', price: 0 },
        { name: 'Gelada sem Gelo', price: 0 },
        { name: 'Temperatura Ambiente', price: 0 },
      ],
    },
  ],
  combos: [
    {
      name: 'Escolha a Bebida',
      type: 'single',
      min: 1,
      max: 1,
      is_req: true,
      options: [
        { name: 'Coca-Cola Lata 350ml', price: 0 },
        { name: 'Coca-Cola Zero Lata 350ml', price: 0 },
        { name: 'Guaraná Antarctica Lata 350ml', price: 0 },
        { name: 'Suco Natural de Laranja 300ml', price: 0 },
      ],
    },
  ],
}

export const getCategoryTemplateKey = (categoryName: string): string | null => {
  if (!categoryName) return null
  const norm = categoryName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (norm.includes('pizza')) return 'pizzas'
  if (norm.includes('calzone')) return 'calzones'
  if (norm.includes('burger') || norm.includes('hamburguer') || norm.includes('sanduiche')) return 'hamburgueres'
  if (norm.includes('pastel') || norm.includes('pasteis')) return 'pasteis'
  if (norm.includes('salgado')) return 'salgados'
  if (norm.includes('acai')) return 'acai'
  if (norm.includes('sorvete')) return 'sorvetes'
  if (norm.includes('massa') || norm.includes('macarrao') || norm.includes('nhoque') || norm.includes('lasanha')) return 'massas'
  if (norm.includes('executivo') || norm.includes('prato feito') || norm.includes('marmita') || norm.includes('marmitex')) return 'pratos_executivos'
  if (norm.includes('petisco')) return 'petiscos'
  if (norm.includes('porcao') || norm.includes('porcoes')) return 'porcoes'
  if (norm.includes('salada')) return 'saladas'
  if (norm.includes('sushi') || norm.includes('japones') || norm.includes('oriental')) return 'sushi'
  if (norm.includes('sobremesa') || norm.includes('doce') || norm.includes('torta') || norm.includes('bolo')) return 'sobremesas'
  if (norm.includes('bebida') || norm.includes('suco') || norm.includes('refrigerante') || norm.includes('cerveja') || norm.includes('vinho')) return 'bebidas'
  if (norm.includes('combo')) return 'combos'
  return null
}

export default function MenuPage() {
  const { tenant } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Floating Toast Feedback
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Custom Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    description: string
    confirmLabel?: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirmar',
    onConfirm: () => {},
  })

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', is_active: true })

  // Product Drawer
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productDrawerTab, setProductDrawerTab] = useState<'details' | 'options' | 'pizza_rules' | 'pizza_flavors' | 'pizza_groups'>('details')
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)

  // Pizza Config State
  const [pizzaConfig, setPizzaConfig] = useState<PizzaCustomConfig>(DEFAULT_PIZZA_CONFIG)

  // Live Customer Preview State
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(false)
  const [previewSelections, setPreviewSelections] = useState<Record<number, string[]>>({})
  const [previewQuantity, setPreviewQuantity] = useState(1)

  // Pizza Live Preview State
  const [pizzaPreviewDivision, setPizzaPreviewDivision] = useState<number>(1)
  const [pizzaPreviewType, setPizzaPreviewType] = useState<'salgada' | 'doce'>('salgada')
  const [pizzaPreviewSizeId, setPizzaPreviewSizeId] = useState<string>('grande')
  const [pizzaPreviewFlavors, setPizzaPreviewFlavors] = useState<string[]>([])
  const [pizzaPreviewGroupSelections, setPizzaPreviewGroupSelections] = useState<Record<number, string[]>>({})

  // Product Form State
  const [productForm, setProductForm] = useState({
    category_id: '',
    name: '',
    description: '',
    price: 0,
    image_url: '',
    is_available: true,
    is_featured: false,
    option_groups: [] as ProductOptionGroup[],
  })

  const loadMenuData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/restaurant/categories'),
        api.get('/restaurant/products'),
      ])
      setCategories(catRes.data.categories || [])
      setProducts(prodRes.data.products || [])
    } catch (err) {
      console.error('Erro ao carregar cardápio:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMenuData()
  }, [])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text })
    setTimeout(() => setFeedbackMessage(null), 3000)
  }

  // ─── CATEGORY HANDLERS ───────────────────────────────────────────────────────
  const handleOpenCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat)
      setCategoryForm({
        name: cat.name,
        is_active: cat.is_active,
      })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', is_active: true })
    }
    setIsCategoryModalOpen(true)
  }

  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedName = categoryForm.name.trim()
    if (!trimmedName) return

    const isDuplicate = categories.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase() && c.id !== editingCategory?.id
    )
    if (isDuplicate) {
      showFeedback('error', 'Já existe uma categoria cadastrada com este nome.')
      return
    }

    try {
      if (editingCategory) {
        await api.put(`/restaurant/categories/${editingCategory.id}`, {
          name: trimmedName,
          is_active: categoryForm.is_active,
        })
        showFeedback('success', 'Categoria atualizada com sucesso.')
      } else {
        await api.post('/restaurant/categories', {
          name: trimmedName,
          is_active: categoryForm.is_active,
        })
        showFeedback('success', 'Categoria criada com sucesso.')
      }
      setIsCategoryModalOpen(false)
      loadMenuData()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar categoria.')
    }
  }

  const handleDeleteCategoryPrompt = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Categoria',
      description: `Tem certeza que deseja excluir a categoria "${name}" e todos os pratos cadastrados nela?`,
      confirmLabel: 'Excluir Categoria',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurant/categories/${id}`)
          showFeedback('success', 'Categoria excluída com sucesso.')
          loadMenuData()
        } catch (err: any) {
          showFeedback('error', err.response?.data?.message || 'Erro ao excluir categoria.')
        }
      },
    })
  }

  // ─── PRODUCT HANDLERS ────────────────────────────────────────────────────────
  const handleOpenProductDrawer = (prod?: Product) => {
    setProductDrawerTab('details')
    setDrawerError(null)
    if (prod) {
      setEditingProduct(prod)
      setProductForm({
        category_id: prod.category_id,
        name: prod.name,
        description: prod.description || '',
        price: Number(prod.price) || 0,
        image_url: prod.image_url || '',
        is_available: prod.is_available,
        is_featured: false,
        option_groups: (prod.option_groups || []).map((og) => {
          let detectedType: 'single' | 'multiple' | 'remove' | 'custom' = 'multiple'
          if (og.min_options === 1 && og.max_options === 1) {
            detectedType = 'single'
          } else if (
            og.name.toLowerCase().includes('remover') ||
            og.name.toLowerCase().includes('sem ') ||
            og.name.toLowerCase().includes('retirar')
          ) {
            detectedType = 'remove'
          } else if (og.min_options === 0) {
            detectedType = 'multiple'
          } else {
            detectedType = 'custom'
          }

          return {
            id: og.id,
            name: og.name,
            type: detectedType,
            min: og.min_options,
            max: og.max_options,
            is_req: og.is_required,
            options: (og.options || []).map((o: any) => ({
              id: o.id,
              name: o.name,
              price: Number(o.price_modifier),
              image_url: o.image_url || null,
            })),
          }
        }),
      })

      if ((prod as any).metadata?.pizza_config) {
        const pConf = (prod as any).metadata.pizza_config
        // Garantir retrocompatibilidade com sections
        if (!pConf.sections || pConf.sections.length === 0) {
          pConf.sections = DEFAULT_PIZZA_CONFIG.sections
        }
        if (!pConf.groups) {
          pConf.groups = DEFAULT_PIZZA_CONFIG.groups
        }
        setPizzaConfig(pConf)
      } else {
        setPizzaConfig(DEFAULT_PIZZA_CONFIG)
      }
    } else {
      setEditingProduct(null)
      setProductForm({
        category_id: categories[0]?.id || '',
        name: '',
        description: '',
        price: 0,
        image_url: '',
        is_available: true,
        is_featured: false,
        option_groups: [],
      })
      setPizzaConfig(DEFAULT_PIZZA_CONFIG)
    }
    setIsProductDrawerOpen(true)
  }

  const handleDeleteProductPrompt = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Produto',
      description: `Tem certeza que deseja remover "${name}" do cardápio?`,
      confirmLabel: 'Remover Produto',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurant/products/${id}`)
          showFeedback('success', 'Produto removido do cardápio.')
          loadMenuData()
        } catch (err: any) {
          showFeedback('error', err.response?.data?.message || 'Erro ao remover produto.')
        }
      },
    })
  }

  const handleClearAllGroupsPrompt = (isPizza: boolean) => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar Grupos de Opcionais',
      description: 'Tem certeza que deseja remover todos os grupos de opcionais deste produto?',
      confirmLabel: 'Limpar Todos',
      onConfirm: () => {
        if (isPizza) {
          setPizzaConfig((prev) => ({ ...prev, groups: [] }))
        } else {
          setProductForm((prev) => ({ ...prev, option_groups: [] }))
        }
        showFeedback('success', 'Grupos de opcionais removidos.')
      },
    })
  }

  // ─── LIVE PREVIEW HELPERS ───────────────────────────────────────────────────
  const handleOpenLivePreview = (isPizza: boolean) => {
    if (isPizza) {
      setPizzaPreviewDivision(1)
      setPizzaPreviewType('salgada')
      setPizzaPreviewSizeId(pizzaConfig.sizes[2]?.id || pizzaConfig.sizes[0]?.id || 'grande')
      
      const firstSection = pizzaConfig.sections.find((s) => s.type === 'salgada') || pizzaConfig.sections[0]
      const defaultFlav = pizzaConfig.flavors.find((f) => f.section_id === firstSection?.id) || pizzaConfig.flavors[0]
      setPizzaPreviewFlavors(defaultFlav ? [defaultFlav.name] : [])

      const initialGroupSelections: Record<number, string[]> = {}
      ;(pizzaConfig.groups || []).forEach((g, gIdx) => {
        if (g.type === 'single' && g.options.length > 0) {
          initialGroupSelections[gIdx] = [g.options[0].name]
        } else {
          initialGroupSelections[gIdx] = []
        }
      })
      setPizzaPreviewGroupSelections(initialGroupSelections)
      setPreviewQuantity(1)
      setIsLivePreviewOpen(true)
      return
    }

    const initialSelections: Record<number, string[]> = {}
    productForm.option_groups.forEach((g, gIdx) => {
      if (g.type === 'single' && g.options.length > 0) {
        initialSelections[gIdx] = [g.options[0].name]
      } else {
        initialSelections[gIdx] = []
      }
    })
    setPreviewSelections(initialSelections)
    setPreviewQuantity(1)
    setIsLivePreviewOpen(true)
  }

  const handleTogglePreviewOption = (groupIndex: number, optionName: string, isSingle: boolean) => {
    setPreviewSelections((prev) => {
      const current = prev[groupIndex] || []
      if (isSingle) {
        return { ...prev, [groupIndex]: [optionName] }
      }
      if (current.includes(optionName)) {
        return { ...prev, [groupIndex]: current.filter((item) => item !== optionName) }
      } else {
        return { ...prev, [groupIndex]: [...current, optionName] }
      }
    })
  }

  const handleTogglePizzaGroupOption = (groupIndex: number, optionName: string, isSingle: boolean) => {
    setPizzaPreviewGroupSelections((prev) => {
      const current = prev[groupIndex] || []
      if (isSingle) {
        return { ...prev, [groupIndex]: [optionName] }
      }
      if (current.includes(optionName)) {
        return { ...prev, [groupIndex]: current.filter((item) => item !== optionName) }
      } else {
        return { ...prev, [groupIndex]: [...current, optionName] }
      }
    })
  }

  const handleTogglePizzaPreviewFlavor = (flavorName: string) => {
    setPizzaPreviewFlavors((prev) => {
      if (prev.includes(flavorName)) {
        if (prev.length > 1) {
          return prev.filter((n) => n !== flavorName)
        }
        return prev
      }
      if (prev.length < pizzaPreviewDivision) {
        return [...prev, flavorName]
      }
      return [...prev.slice(0, pizzaPreviewDivision - 1), flavorName]
    })
  }

  const calculatePizzaPreviewTotal = () => {
    const size = pizzaConfig.sizes.find((s) => s.id === pizzaPreviewSizeId) || pizzaConfig.sizes[0]
    if (!size) return 0

    const selectedObjs = pizzaPreviewFlavors
      .map((name) => pizzaConfig.flavors.find((f) => f.name === name))
      .filter(Boolean) as PizzaFlavorConfig[]

    if (selectedObjs.length === 0) return 0

    const prices = selectedObjs.map((f) => Number(f.prices[size.id]) || 0)

    let basePrice = 0
    if (pizzaConfig.pricing_rule === 'highest') {
      basePrice = Math.max(...prices, 0)
    } else {
      const sum = prices.reduce((a, b) => a + b, 0)
      basePrice = sum / Math.max(1, prices.length)
    }

    let extrasPrice = 0
    ;(pizzaConfig.groups || []).forEach((group, gIdx) => {
      const selectedNames = pizzaPreviewGroupSelections[gIdx] || []
      group.options.forEach((opt) => {
        if (selectedNames.includes(opt.name)) {
          extrasPrice += Number(opt.price) || 0
        }
      })
    })

    return (basePrice + extrasPrice) * previewQuantity
  }

  const calculatePreviewTotal = () => {
    const basePrice = Number(productForm.price) || 0
    let extrasPrice = 0

    productForm.option_groups.forEach((group, gIdx) => {
      const selectedNames = previewSelections[gIdx] || []
      group.options.forEach((opt) => {
        if (selectedNames.includes(opt.name)) {
          extrasPrice += Number(opt.price) || 0
        }
      })
    })

    return (basePrice + extrasPrice) * previewQuantity
  }

  const handleLoadCategoryTemplate = (templateKey: string) => {
    const template = CATEGORY_OPTION_TEMPLATES[templateKey]
    if (!template) return
    setDrawerError(null)

    setProductForm((prev) => {
      const existingNames = new Set(prev.option_groups.map((g) => g.name.trim().toLowerCase()))
      const newGroupsToAdd = template.filter((tGroup) => !existingNames.has(tGroup.name.trim().toLowerCase()))

      return {
        ...prev,
        option_groups: [
          ...prev.option_groups,
          ...JSON.parse(JSON.stringify(newGroupsToAdd.length > 0 ? newGroupsToAdd : template)),
        ],
      }
    })
    showFeedback('success', 'Modelo de opcionais adicionado.')
  }

  const handleToggleProductAvailability = async (id: string) => {
    try {
      const res = await api.patch(`/restaurant/products/${id}/toggle-availability`)
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_available: res.data.is_available } : p))
      )
      showFeedback('success', res.data.message)
    } catch (err: any) {
      showFeedback('error', 'Erro ao alterar disponibilidade.')
    }
  }

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault()
    setDrawerError(null)

    const trimmedName = productForm.name.trim()
    if (!trimmedName) {
      setDrawerError('Preencha o nome do prato na aba 01.')
      setProductDrawerTab('details')
      return
    }

    if (!productForm.category_id) {
      setDrawerError('Selecione uma categoria para o prato.')
      setProductDrawerTab('details')
      return
    }

    const currentCat = categories.find((c) => c.id === productForm.category_id)
    const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false

    if (isPizza) {
      if (pizzaConfig.sizes.length === 0) {
        setDrawerError('Cadastre pelo menos 1 tamanho de pizza.')
        setProductDrawerTab('pizza_rules')
        return
      }
      if (pizzaConfig.sections.length === 0) {
        setDrawerError('Cadastre pelo menos 1 seção de sabores na aba 01.')
        setProductDrawerTab('pizza_rules')
        return
      }
      if (pizzaConfig.flavors.length === 0) {
        setDrawerError('Cadastre pelo menos 1 sabor de pizza na aba 02.')
        setProductDrawerTab('pizza_flavors')
        return
      }
    } else {
      const groupNamesSet = new Set<string>()
      for (let i = 0; i < productForm.option_groups.length; i++) {
        const g = productForm.option_groups[i]
        const gName = g.name.trim()
        if (!gName) {
          setDrawerError(`O grupo #${i + 1} precisa ter um título preenchido.`)
          setProductDrawerTab('options')
          return
        }

        const gNameLower = gName.toLowerCase()
        if (groupNamesSet.has(gNameLower)) {
          setDrawerError(`Você cadastrou dois grupos com o mesmo título: "${gName}".`)
          setProductDrawerTab('options')
          return
        }
        groupNamesSet.add(gNameLower)

        const validOptions = g.options.filter((o) => o.name.trim() !== '')
        if (validOptions.length === 0) {
          setDrawerError(`O grupo "${gName}" deve ter pelo menos 1 opção preenchida.`)
          setProductDrawerTab('options')
          return
        }
      }
    }

    setIsSavingProduct(true)

    let payloadOptionGroups = productForm.option_groups.map((og) => ({
      name: og.name.trim(),
      min: og.type === 'single' ? 1 : (og.type === 'remove' ? 0 : og.min),
      max: og.type === 'single' ? 1 : (og.type === 'remove' ? 10 : (og.max || 1)),
      is_req: og.type === 'single' || og.min > 0,
      options: og.options
        .filter((o) => o.name.trim() !== '')
        .map((o) => ({
          name: o.name.trim(),
          price: og.type === 'remove' ? 0 : (Number(o.price) || 0),
          image_url: o.image_url || null,
        })),
    }))

    let basePrice = Number(productForm.price) || 0

    if (isPizza) {
      const minFlavorPrice = Math.min(
        ...pizzaConfig.flavors.map((f) => Number(Object.values(f.prices)[0]) || 0).filter((p) => p > 0)
      )
      if (minFlavorPrice > 0 && minFlavorPrice !== Infinity) {
        basePrice = minFlavorPrice
      }

      payloadOptionGroups = [
        {
          name: 'Tamanho da Pizza',
          min: 1,
          max: 1,
          is_req: true,
          options: pizzaConfig.sizes.map((s) => ({
            name: `${s.name} (${s.slices} Fatias - Até ${s.max_flavors} Sabores)`,
            price: 0,
            image_url: null,
          })),
        },
        {
          name: '1º Sabor (Metade 1 ou Inteira)',
          min: 1,
          max: 1,
          is_req: true,
          options: pizzaConfig.flavors.map((f) => ({
            name: f.name,
            price: Number(Object.values(f.prices)[0]) || 0,
            image_url: f.image_url || null,
          })),
        },
        ...((pizzaConfig.groups || []).map((g) => ({
          name: g.name.trim(),
          min: g.type === 'single' ? 1 : (g.type === 'remove' ? 0 : g.min),
          max: g.type === 'single' ? 1 : (g.type === 'remove' ? 10 : (g.max || 1)),
          is_req: g.type === 'single' || g.min > 0,
          options: g.options
            .filter((o) => o.name.trim() !== '')
            .map((o) => ({
              name: o.name.trim(),
              price: g.type === 'remove' ? 0 : (Number(o.price) || 0),
              image_url: o.image_url || null,
            })),
        }))),
      ]
    }

    const payload = {
      category_id: productForm.category_id,
      name: trimmedName,
      description: productForm.description?.trim() || null,
      price: basePrice,
      image_url: productForm.image_url || null,
      is_available: productForm.is_available,
      is_featured: false,
      metadata: isPizza ? { pizza_config: pizzaConfig } : null,
      option_groups: payloadOptionGroups,
    }

    try {
      if (editingProduct) {
        await api.put(`/restaurant/products/${editingProduct.id}`, payload)
        showFeedback('success', 'Produto atualizado no cardápio.')
      } else {
        await api.post('/restaurant/products', payload)
        showFeedback('success', 'Produto cadastrado com sucesso.')
      }
      setIsProductDrawerOpen(false)
      loadMenuData()
    } catch (err: any) {
      setDrawerError(err.response?.data?.message || 'Erro ao salvar produto. Verifique os campos.')
    } finally {
      setIsSavingProduct(false)
    }
  }

  // ─── REUSABLE OPTION GROUP BUILDER HELPERS ───────────────────────────────────
  const renderOptionGroupsBuilder = (
    groups: ProductOptionGroup[],
    setGroups: (updater: (prev: ProductOptionGroup[]) => ProductOptionGroup[]) => void,
    isPizza: boolean
  ) => {
    return (
      <div className="space-y-6">
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {isPizza ? 'Grupos de Bordas, Massas & Adicionais' : 'Grupos de Opcionais & Adicionais'}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Personalize grupos com escolhas obrigatórias, adicionais extras ou remoção de itens.
            </p>
          </div>

          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => handleClearAllGroupsPrompt(isPizza)}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-800"
              title="Limpar todos os grupos"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Banner Sugestão Inteligente apenas para produtos normais */}
        {!isPizza && (() => {
          const currentCat = categories.find((c) => c.id === productForm.category_id)
          const tKey = currentCat ? getCategoryTemplateKey(currentCat.name) : null
          if (!tKey) return null
          const templateGroups = CATEGORY_OPTION_TEMPLATES[tKey] || []

          const hasAllTemplateGroups =
            templateGroups.length > 0 &&
            templateGroups.every((tGroup) =>
              groups.some((g) => g.name.trim().toLowerCase() === tGroup.name.trim().toLowerCase())
            )

          if (hasAllTemplateGroups) return null

          return (
            <div className="p-3.5 bg-[#F5DC55]/10 border border-[#F5DC55]/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-zinc-900 dark:text-zinc-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55] shrink-0" />
                <span>
                  Carregar modelo sugerido para <strong>{currentCat?.name}</strong>?
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleLoadCategoryTemplate(tKey)}
                className="px-3 py-1.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold rounded-lg text-xs cursor-pointer transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                Carregar Modelo
              </button>
            </div>
          )
        })()}

        {groups.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-3 rounded-xl bg-zinc-50/40 dark:bg-zinc-900/20">
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              Nenhum grupo de adicionais configurado.
            </p>
            <button
              type="button"
              onClick={() => {
                setGroups((prev) => [
                  ...prev,
                  {
                    name: '',
                    type: 'single',
                    min: 1,
                    max: 1,
                    is_req: true,
                    options: [{ name: '', price: 0, image_url: null }],
                  },
                ])
              }}
              className="px-4 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Grupo</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group, gIdx) => {
              const currentType = group.type || 'single'
              return (
                <div
                  key={gIdx}
                  className="p-4 bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3.5 text-xs font-mono"
                >
                  {/* Top Bar do Grupo */}
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        placeholder="Título do Grupo"
                        value={group.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setGroups((prev) =>
                            prev.map((g, i) => (i === gIdx ? { ...g, name: val } : g))
                          )
                        }}
                        className="w-full px-2.5 py-1 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs font-semibold text-zinc-950 dark:text-zinc-50 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    {/* Seletor de Tipo */}
                    <div className="flex items-center gap-1">
                      <select
                        value={currentType}
                        onChange={(e) => {
                          const newType = e.target.value as 'single' | 'multiple' | 'remove' | 'custom'
                          setGroups((prev) =>
                            prev.map((g, i) => {
                              if (i !== gIdx) return g
                              if (newType === 'single') return { ...g, type: 'single', min: 1, max: 1, is_req: true }
                              if (newType === 'multiple') return { ...g, type: 'multiple', min: 0, max: g.max > 1 ? g.max : 5, is_req: false }
                              if (newType === 'remove') return { ...g, type: 'remove', min: 0, max: 10, is_req: false, options: g.options.map((o) => ({ ...o, price: 0 })) }
                              return { ...g, type: 'custom', min: g.min, max: g.max || 1, is_req: g.min > 0 }
                            })
                          )
                        }}
                        className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-[11px] font-mono text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="single" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Escolha Única (Obrigatório)</option>
                        <option value="multiple" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Adicionais Extras (Opcional)</option>
                        <option value="remove" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Remover Ingredientes</option>
                      </select>

                      {currentType === 'multiple' && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-zinc-400">Máx:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={group.max}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1
                              setGroups((prev) =>
                                prev.map((g, i) => (i === gIdx ? { ...g, max: val } : g))
                              )
                            }}
                            className="w-12 px-1.5 py-1 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-center text-xs text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setGroups((prev) => prev.filter((_, i) => i !== gIdx))
                        }}
                        className="text-zinc-400 hover:text-red-500 p-1.5 cursor-pointer transition-colors"
                        title="Remover Grupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Opções no Design Limpo */}
                  <div className="space-y-2">
                    {group.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <MiniImageUpload
                          value={opt.image_url}
                          onChange={(url) => {
                            setGroups((prev) =>
                              prev.map((g, gi) =>
                                gi === gIdx
                                  ? {
                                      ...g,
                                      options: g.options.map((o, oi) =>
                                        oi === oIdx ? { ...o, image_url: url } : o
                                      ),
                                    }
                                  : g
                              )
                            )
                          }}
                          onRemove={() => {
                            setGroups((prev) =>
                              prev.map((g, gi) =>
                                gi === gIdx
                                  ? {
                                      ...g,
                                      options: g.options.map((o, oi) =>
                                        oi === oIdx ? { ...o, image_url: null } : o
                                      ),
                                    }
                                  : g
                              )
                            )
                          }}
                        />

                        <input
                          type="text"
                          required
                          value={opt.name}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              setGroups((prev) =>
                                prev.map((g, i) =>
                                  i === gIdx
                                    ? { ...g, options: [...g.options, { name: '', price: 0, image_url: null }] }
                                    : g
                                )
                              )
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value
                            setGroups((prev) =>
                              prev.map((g, gi) =>
                                gi === gIdx
                                  ? {
                                      ...g,
                                      options: g.options.map((o, oi) =>
                                        oi === oIdx ? { ...o, name: val } : o
                                      ),
                                    }
                                  : g
                              )
                            )
                          }}
                          className="flex-1 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                        />

                        {currentType === 'remove' ? (
                          <div className="w-24 px-2 py-1.5 bg-zinc-200/50 dark:bg-zinc-800 rounded text-center text-xs text-zinc-500">
                            Grátis
                          </div>
                        ) : (
                          <div className="flex items-center w-28">
                            <span className="px-2 py-1.5 bg-zinc-200 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l text-[10px] text-zinc-500">
                              +R$
                            </span>
                            <CurrencyInput
                              value={Number(opt.price) || 0}
                              onChange={(newPrice) => {
                                setGroups((prev) =>
                                  prev.map((g, gi) =>
                                    gi === gIdx
                                      ? {
                                          ...g,
                                          options: g.options.map((o, oi) =>
                                            oi === oIdx ? { ...o, price: newPrice } : o
                                          ),
                                        }
                                      : g
                                  )
                                )
                              }}
                              className="w-full px-2 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-r text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setGroups((prev) =>
                              prev.map((g, gi) =>
                                gi === gIdx
                                  ? { ...g, options: g.options.filter((_, oi) => oi !== oIdx) }
                                  : g
                              )
                            )
                          }}
                          disabled={group.options.length <= 1}
                          className="text-zinc-400 hover:text-red-500 disabled:opacity-20 p-1 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setGroups((prev) =>
                        prev.map((g, i) =>
                          i === gIdx
                            ? { ...g, options: [...g.options, { name: '', price: 0, image_url: null }] }
                            : g
                        )
                      )
                    }}
                    className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-[#F5DC55] flex items-center gap-1 pt-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar Opção</span>
                  </button>
                </div>
              )
            })}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setGroups((prev) => [
                    ...prev,
                    {
                      name: '',
                      type: 'single',
                      min: 1,
                      max: 1,
                      is_req: true,
                      options: [{ name: '', price: 0, image_url: null }],
                    },
                  ])
                }}
                className="px-4 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-950" />
                <span>Adicionar Grupo de Opcionais</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── FILTERED DATA ───────────────────────────────────────────────────────────
  const filteredCategories = categories.filter((c) => {
    if (selectedCategoryFilter === 'all') return true
    return c.id === selectedCategoryFilter
  })

  const getFilteredProductsForCategory = (catId: string) => {
    return products.filter((p) => {
      if (p.category_id !== catId) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      )
    })
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-[#F5DC55] selection:text-zinc-950">
      
      {/* Header Unificado */}
      <RestaurantHeader activeTab="menu" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-10 space-y-8">
        
        {/* Title Bar & Main Actions */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Catálogo de Produtos // Engenharia Gastronômica
            </p>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
              Cardápio da Loja
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleOpenCategoryModal()}
              className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Categoria</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenProductDrawer()}
              disabled={categories.length === 0}
              className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 text-zinc-950 font-semibold text-xs font-mono uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-950" />
              <span>Cadastrar Produto</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
          
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-[#F5DC55] text-zinc-950 font-bold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 bg-zinc-200/60 dark:bg-zinc-900 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-800'
              }`}
            >
              Todas as Categorias ({products.length})
            </button>

            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategoryFilter === c.id
                    ? 'bg-[#F5DC55] text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 bg-zinc-200/60 dark:bg-zinc-900 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-800'
                }`}
              >
                {c.name} ({products.filter((p) => p.category_id === c.id).length})
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Buscar item ou ingrediente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-16 text-center text-xs font-mono text-zinc-500 dark:text-zinc-300 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#F5DC55]" />
            <span>Carregando cardápio...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30">
            <UtensilsCrossed className="w-10 h-10 text-zinc-400 dark:text-zinc-400 mx-auto" />
            <div className="space-y-1.5">
              <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                Seu cardápio ainda está vazio
              </h3>
              <p className="text-sm font-normal text-zinc-700 dark:text-zinc-200 max-w-md mx-auto leading-relaxed">
                Crie sua primeira categoria (ex: <strong>Pizzas</strong>, <strong>Hambúrgueres</strong>, <strong>Bebidas</strong>) para começar a cadastrar seus pratos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenCategoryModal()}
              className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono uppercase rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeira Categoria</span>
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredCategories.map((cat) => {
              const catProducts = getFilteredProductsForCategory(cat.id)
              const isPizzaCat = getCategoryTemplateKey(cat.name) === 'pizzas'

              return (
                <div key={cat.id} className="space-y-4">
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {cat.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {catProducts.length} {catProducts.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCategoryModal(cat)}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                        title="Editar Categoria"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategoryPrompt(cat.id, cat.name)}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded transition-colors cursor-pointer"
                        title="Excluir Categoria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Products Grid */}
                  {catProducts.length === 0 ? (
                    <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800/80 rounded-xl text-center space-y-2 bg-zinc-50/30 dark:bg-zinc-900/10">
                      <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        Nenhum produto cadastrado nesta categoria.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setProductForm({
                            category_id: cat.id,
                            name: '',
                            description: '',
                            price: 0,
                            image_url: '',
                            is_available: true,
                            is_featured: false,
                            option_groups: [],
                          })
                          setIsProductDrawerOpen(true)
                        }}
                        className="text-xs font-mono text-[#D4B316] dark:text-[#F5DC55] hover:underline cursor-pointer font-bold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Cadastrar item nesta categoria</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {catProducts.map((p) => {
                        const optionGroupsCount = p.option_groups?.length || 0
                        return (
                          <div
                            key={p.id}
                            className={`border rounded-xl p-4 flex flex-col justify-between transition-all group ${
                              p.is_available
                                ? 'bg-white dark:bg-[#121316] border-zinc-200 dark:border-zinc-800/90 shadow-2xs hover:border-zinc-400 dark:hover:border-zinc-700'
                                : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/50 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              {/* Foto Thumbnail */}
                              {p.image_url ? (
                                <img
                                  src={resolveImageUrl(p.image_url)}
                                  alt={p.name}
                                  className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-200 dark:border-zinc-800">
                                  <UtensilsCrossed className="w-6 h-6 opacity-40" />
                                </div>
                              )}

                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50 truncate">
                                    {p.name}
                                  </h3>
                                </div>

                                {p.description && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                    {p.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                  <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                    {isPizzaCat ? 'a partir de ' : ''}R$ {formatCurrencyBRL(Number(p.price) || 0)}
                                  </span>

                                  {optionGroupsCount > 0 && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                                      {optionGroupsCount} {optionGroupsCount === 1 ? 'grupo' : 'grupos'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs font-mono">
                              <button
                                type="button"
                                onClick={() => handleToggleProductAvailability(p.id)}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                  p.is_available
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300'
                                }`}
                              >
                                {p.is_available ? 'Disponível' : 'Pausado'}
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenProductDrawer(p)}
                                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 rounded transition-colors cursor-pointer"
                                  title="Editar Produto"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProductPrompt(p.id, p.name)}
                                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded transition-colors cursor-pointer"
                                  title="Remover Produto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}

      </main>

      {/* ─── MODAL: CRIAR / EDITAR CATEGORIA COM PRESETS ─────────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[#F8F7F4] dark:bg-[#0F1012] border border-zinc-300 dark:border-zinc-800 p-6 rounded-xl shadow-2xl z-10 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria no Cardápio'}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Selecione uma categoria padrão do sistema ou digite um nome exclusivo.
                </p>
              </div>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-5">
              {!editingCategory && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                    Sugestões Populares do Sistema
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SYSTEM_CATEGORY_PRESETS.map((preset) => {
                      const isAlreadyAdded = categories.some(
                        (c) => c.name.toLowerCase() === preset.name.toLowerCase()
                      )
                      const isSelected = categoryForm.name.toLowerCase() === preset.name.toLowerCase()
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setCategoryForm({ ...categoryForm, name: preset.name })}
                          disabled={isAlreadyAdded && !isSelected}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#F5DC55] text-zinc-950 font-bold border-[#F5DC55]'
                              : isAlreadyAdded
                              ? 'opacity-40 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-[#F5DC55]/60'
                          }`}
                          title={isAlreadyAdded ? 'Categoria já cadastrada' : `Usar ${preset.name}`}
                        >
                          <span>{preset.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                  Nome da Categoria
                </label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono uppercase border border-zinc-300 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono uppercase rounded cursor-pointer transition-colors"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DRAWER LATERAL: PRODUTO & CONSTRUTOR DE OPCIONAIS ──────────────── */}
      {isProductDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsProductDrawerOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-[#F8F7F4] dark:bg-[#0F1012] border-l border-zinc-300 dark:border-zinc-800 h-full flex flex-col z-10 shadow-2xl">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {editingProduct ? 'Editar Prato' : 'Novo Prato no Cardápio'}
                </p>
                <h2 className="text-xl font-medium text-zinc-950 dark:text-zinc-50">
                  {editingProduct ? editingProduct.name : 'Cadastrar Produto'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const currentCat = categories.find((c) => c.id === productForm.category_id)
                    const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false
                    handleOpenLivePreview(isPizza)
                  }}
                  className="p-2 bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors cursor-pointer border border-zinc-300 dark:border-zinc-700 flex items-center justify-center"
                  title="Ver como o cliente vê este prato no cardápio"
                >
                  <Eye className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsProductDrawerOpen(false)}
                  className="text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 p-1 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Tabs */}
            {(() => {
              const currentCat = categories.find((c) => c.id === productForm.category_id)
              const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false

              if (isPizza) {
                return (
                  <div className="px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-6 text-xs font-mono overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setProductDrawerTab('pizza_rules')}
                      className={`py-3 transition-colors cursor-pointer whitespace-nowrap ${
                        productDrawerTab === 'pizza_rules' || productDrawerTab === 'details'
                          ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      Tamanhos & Preços
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductDrawerTab('pizza_flavors')}
                      className={`py-3 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        productDrawerTab === 'pizza_flavors'
                          ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      <span>Sabores ({pizzaConfig.flavors.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductDrawerTab('pizza_groups')}
                      className={`py-3 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                        productDrawerTab === 'pizza_groups'
                          ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>03 / Bordas & Opcionais ({pizzaConfig.groups?.length || 0})</span>
                    </button>
                  </div>
                )
              }

              return (
                <div className="px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-6 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setProductDrawerTab('details')}
                    className={`py-3 transition-colors cursor-pointer ${
                      productDrawerTab === 'details'
                        ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    01 / Dados do Prato & Preço
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductDrawerTab('options')}
                    className={`py-3 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      productDrawerTab === 'options'
                        ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>02 / Opcionais & Adicionais ({productForm.option_groups.length})</span>
                  </button>
                </div>
              )
            })()}

            {/* Drawer Body Form */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {drawerError && (
                <div className="p-3.5 bg-red-500/10 border-l-4 border-red-500 rounded-r text-xs font-mono text-red-600 dark:text-red-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{drawerError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerError(null)}
                    className="text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* ─── FLUXO ESPECIALIZADO DE PIZZAS ────────────────────────────── */}
              {(() => {
                const currentCat = categories.find((c) => c.id === productForm.category_id)
                const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false
                if (!isPizza) return null

                return (
                  <>
                    {/* PIZZA TAB 1: REGRAS, SEÇÕES E TAMANHOS */}
                    {(productDrawerTab === 'pizza_rules' || productDrawerTab === 'details') && (
                      <div className="space-y-6">
                        
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Categoria do Cardápio
                          </label>
                          <select
                            value={productForm.category_id}
                            onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                            required
                            className="w-full px-3 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Nome do Item no Cardápio
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.name}
                            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                            className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Descrição da Pizza
                          </label>
                          <textarea
                            rows={2}
                            value={productForm.description}
                            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                            className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                          />
                        </div>

                        {/* Regra de Cobrança do Meio a Meio */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                          <label className="block text-[11px] font-mono uppercase font-bold text-zinc-950 dark:text-zinc-50">
                            Cobrança de Sabores Meio a Meio
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                            <button
                              type="button"
                              onClick={() => setPizzaConfig({ ...pizzaConfig, pricing_rule: 'highest' })}
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                pizzaConfig.pricing_rule === 'highest'
                                  ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-100 font-bold'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Circle className={`w-3.5 h-3.5 ${pizzaConfig.pricing_rule === 'highest' ? 'fill-current text-[#D4B316] dark:text-[#F5DC55]' : 'text-zinc-400'}`} />
                                <span className="font-semibold">Maior Valor dos Sabores</span>
                              </div>
                              <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 leading-snug">
                                Cobra o preço do sabor mais caro selecionado na pizza.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPizzaConfig({ ...pizzaConfig, pricing_rule: 'average' })}
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                pizzaConfig.pricing_rule === 'average'
                                  ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-100 font-bold'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Circle className={`w-3.5 h-3.5 ${pizzaConfig.pricing_rule === 'average' ? 'fill-current text-[#D4B316] dark:text-[#F5DC55]' : 'text-zinc-400'}`} />
                                <span className="font-semibold">Média dos Sabores</span>
                              </div>
                              <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 leading-snug">
                                Cobra a média ponderada dos sabores selecionados.
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* Chave: Misturar Salgada e Doce */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                          <label className="block text-[11px] font-mono uppercase font-bold text-zinc-950 dark:text-zinc-50">
                            Misturar Sabores Salgados e Doces
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                            <button
                              type="button"
                              onClick={() => setPizzaConfig({ ...pizzaConfig, allow_sweet_mix: true })}
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                pizzaConfig.allow_sweet_mix
                                  ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-100 font-bold'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Circle className={`w-3.5 h-3.5 ${pizzaConfig.allow_sweet_mix ? 'fill-current text-[#D4B316] dark:text-[#F5DC55]' : 'text-zinc-400'}`} />
                                <span className="font-semibold">Sim, Permitir Misturar</span>
                              </div>
                              <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 leading-snug">
                                O cliente pode escolher sabores salgados e doces na mesma pizza.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPizzaConfig({ ...pizzaConfig, allow_sweet_mix: false })}
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                !pizzaConfig.allow_sweet_mix
                                  ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-100 font-bold'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Circle className={`w-3.5 h-3.5 ${!pizzaConfig.allow_sweet_mix ? 'fill-current text-[#D4B316] dark:text-[#F5DC55]' : 'text-zinc-400'}`} />
                                <span className="font-semibold">Não, Separar por Tipo</span>
                              </div>
                              <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 leading-snug">
                                O cliente escolhe primeiro se a pizza é Salgada ou Doce.
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* Seções de Sabores Personalizáveis */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                            <div>
                              <h4 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                                Seções de Sabores da Pizza
                              </h4>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Defina os grupos de sabores (ex: Salgadas Tradicionais, Especiais, Doces).
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newId = `sec_${Date.now()}`
                                setPizzaConfig({
                                  ...pizzaConfig,
                                  sections: [
                                    ...pizzaConfig.sections,
                                    { id: newId, name: 'Nova Seção', type: 'salgada' },
                                  ],
                                })
                              }}
                              className="px-3 py-1.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar Seção</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {pizzaConfig.sections.map((sec, sIdx) => (
                              <div
                                key={sec.id || sIdx}
                                className="p-3 bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs font-mono"
                              >
                                <input
                                  type="text"
                                  required
                                  value={sec.name}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPizzaConfig({
                                      ...pizzaConfig,
                                      sections: pizzaConfig.sections.map((s, i) =>
                                        i === sIdx ? { ...s, name: val } : s
                                      ),
                                    })
                                  }}
                                  className="flex-1 px-2.5 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                />

                                <select
                                  value={sec.type}
                                  onChange={(e) => {
                                    const val = e.target.value as 'salgada' | 'doce'
                                    setPizzaConfig({
                                      ...pizzaConfig,
                                      sections: pizzaConfig.sections.map((s, i) =>
                                        i === sIdx ? { ...s, type: val } : s
                                      ),
                                    })
                                  }}
                                  className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100"
                                >
                                  <option value="salgada" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Salgada</option>
                                  <option value="doce" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Doce</option>
                                </select>

                                <button
                                  type="button"
                                  disabled={pizzaConfig.sections.length <= 1}
                                  onClick={() => {
                                    setPizzaConfig({
                                      ...pizzaConfig,
                                      sections: pizzaConfig.sections.filter((_, i) => i !== sIdx),
                                      flavors: pizzaConfig.flavors.filter((f) => f.section_id !== sec.id),
                                    })
                                  }}
                                  className="text-zinc-400 hover:text-red-500 disabled:opacity-20 p-1.5 cursor-pointer transition-colors"
                                  title="Remover Seção"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tabela de Tamanhos Personalizável */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                            <div>
                              <h4 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                                Tamanhos da Pizza & Divisões
                              </h4>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Personalize os tamanhos oferecidos e a quantidade máxima de sabores.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newId = `tamanho_${Date.now()}`
                                setPizzaConfig({
                                  ...pizzaConfig,
                                  sizes: [
                                    ...pizzaConfig.sizes,
                                    { id: newId, name: 'Novo Tamanho', slices: 8, max_flavors: 2 },
                                  ],
                                })
                              }}
                              className="px-3 py-1.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar Tamanho</span>
                            </button>
                          </div>

                          <div className="space-y-3">
                            {pizzaConfig.sizes.map((sz, sIdx) => (
                              <div
                                key={sz.id || sIdx}
                                className="p-3.5 bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                              >
                                <div className="flex-1 space-y-1">
                                  <span className="text-[10px] uppercase text-zinc-400">Nome do Tamanho</span>
                                  <input
                                    type="text"
                                    required
                                    value={sz.name}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setPizzaConfig({
                                        ...pizzaConfig,
                                        sizes: pizzaConfig.sizes.map((s, i) =>
                                          i === sIdx ? { ...s, name: val } : s
                                        ),
                                      })
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs font-medium text-zinc-900 dark:text-zinc-100"
                                  />
                                </div>

                                <div className="w-24 space-y-1">
                                  <span className="text-[10px] uppercase text-zinc-400">Fatias</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="32"
                                    value={sz.slices}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1
                                      setPizzaConfig({
                                        ...pizzaConfig,
                                        sizes: pizzaConfig.sizes.map((s, i) =>
                                          i === sIdx ? { ...s, slices: val } : s
                                        ),
                                      })
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs text-center text-zinc-900 dark:text-zinc-100"
                                  />
                                </div>

                                <div className="w-32 space-y-1">
                                  <span className="text-[10px] uppercase text-zinc-400">Máx. Sabores</span>
                                  <select
                                    value={sz.max_flavors}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1
                                      setPizzaConfig({
                                        ...pizzaConfig,
                                        sizes: pizzaConfig.sizes.map((s, i) =>
                                          i === sIdx ? { ...s, max_flavors: val } : s
                                        ),
                                      })
                                    }}
                                    className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs text-zinc-900 dark:text-zinc-100"
                                  >
                                    <option value="1" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">1 Sabor (Inteira)</option>
                                    <option value="2" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Até 2 Sabores</option>
                                    <option value="3" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Até 3 Sabores</option>
                                    <option value="4" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Até 4 Sabores</option>
                                  </select>
                                </div>

                                <button
                                  type="button"
                                  disabled={pizzaConfig.sizes.length <= 1}
                                  onClick={() => {
                                    setPizzaConfig({
                                      ...pizzaConfig,
                                      sizes: pizzaConfig.sizes.filter((_, i) => i !== sIdx),
                                    })
                                  }}
                                  className="text-zinc-400 hover:text-red-500 disabled:opacity-20 p-2 cursor-pointer transition-colors self-end sm:self-center"
                                  title="Remover Tamanho"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Foto de Capa da Pizza */}
                        <div className="space-y-1.5 pt-2">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Foto de Capa da Pizza
                          </label>
                          <ImageUpload
                            value={productForm.image_url}
                            onChange={(imageUrl) => setProductForm({ ...productForm, image_url: imageUrl })}
                            onRemove={() => setProductForm({ ...productForm, image_url: '' })}
                          />
                        </div>

                      </div>
                    )}

                    {/* PIZZA TAB 2: SABORES ORGANIZADOS POR SEÇÃO */}
                    {productDrawerTab === 'pizza_flavors' && (
                      <div className="space-y-8">
                        {pizzaConfig.sections.map((sec) => {
                          const sectionFlavors = pizzaConfig.flavors.filter(
                            (f) => f.section_id === sec.id
                          )

                          return (
                            <div key={sec.id} className="space-y-4">
                              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                    {sec.name}
                                  </h4>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                    {sec.type === 'salgada' ? 'Salgada' : 'Doce'} • {sectionFlavors.length} {sectionFlavors.length === 1 ? 'sabor' : 'sabores'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const newId = `flavor_${Date.now()}`
                                    const initialPrices: Record<string, number> = {}
                                    pizzaConfig.sizes.forEach((s) => {
                                      initialPrices[s.id] = 0
                                    })
                                    setPizzaConfig({
                                      ...pizzaConfig,
                                      flavors: [
                                        ...pizzaConfig.flavors,
                                        {
                                          id: newId,
                                          section_id: sec.id,
                                          name: '',
                                          description: '',
                                          image_url: null,
                                          prices: initialPrices,
                                        },
                                      ],
                                    })
                                  }}
                                  className="px-3 py-1 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Adicionar Sabor</span>
                                </button>
                              </div>

                              {sectionFlavors.length === 0 ? (
                                <p className="text-xs font-mono text-zinc-400 italic py-2">
                                  Nenhum sabor cadastrado nesta seção.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {sectionFlavors.map((flv) => (
                                    <div
                                      key={flv.id}
                                      className="p-3.5 bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs font-mono"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <MiniImageUpload
                                          value={flv.image_url}
                                          onChange={(url) => {
                                            setPizzaConfig({
                                              ...pizzaConfig,
                                              flavors: pizzaConfig.flavors.map((f) =>
                                                f.id === flv.id ? { ...f, image_url: url } : f
                                              ),
                                            })
                                          }}
                                          onRemove={() => {
                                            setPizzaConfig({
                                              ...pizzaConfig,
                                              flavors: pizzaConfig.flavors.map((f) =>
                                                f.id === flv.id ? { ...f, image_url: null } : f
                                              ),
                                            })
                                          }}
                                        />

                                        <input
                                          type="text"
                                          required
                                          placeholder="Nome do Sabor"
                                          value={flv.name}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            setPizzaConfig({
                                              ...pizzaConfig,
                                              flavors: pizzaConfig.flavors.map((f) =>
                                                f.id === flv.id ? { ...f, name: val } : f
                                              ),
                                            })
                                          }}
                                          className="flex-1 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                        />

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPizzaConfig({
                                              ...pizzaConfig,
                                              flavors: pizzaConfig.flavors.filter((f) => f.id !== flv.id),
                                            })
                                          }}
                                          className="text-zinc-400 hover:text-red-500 p-1.5 cursor-pointer transition-colors"
                                          title="Remover Sabor"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>

                                      <div>
                                        <input
                                          type="text"
                                          placeholder="Ingredientes / Descrição"
                                          value={flv.description}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            setPizzaConfig({
                                              ...pizzaConfig,
                                              flavors: pizzaConfig.flavors.map((f) =>
                                                f.id === flv.id ? { ...f, description: val } : f
                                              ),
                                            })
                                          }}
                                          className="w-full px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                        />
                                      </div>

                                      {/* Grid de Preços por Tamanho */}
                                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                        <span className="text-[10px] uppercase text-zinc-400 block font-semibold mb-2">
                                          Preço por tamanho:
                                        </span>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {pizzaConfig.sizes.map((sz) => (
                                            <div key={sz.id} className="space-y-1">
                                              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate block">
                                                {sz.name}
                                              </span>
                                              <div className="flex items-center">
                                                <span className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l text-[10px] font-mono text-zinc-500">
                                                  R$
                                                </span>
                                                <CurrencyInput
                                                  value={Number(flv.prices[sz.id]) || 0}
                                                  onChange={(val) => {
                                                    setPizzaConfig({
                                                      ...pizzaConfig,
                                                      flavors: pizzaConfig.flavors.map((f) =>
                                                        f.id === flv.id
                                                          ? {
                                                              ...f,
                                                              prices: {
                                                                ...f.prices,
                                                                [sz.id]: val,
                                                              },
                                                            }
                                                          : f
                                                      ),
                                                    })
                                                  }}
                                                  className="w-full px-2 py-1 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-r text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* PIZZA TAB 3: BORDAS, MASSAS & OPCIONAIS (USANDO DESIGN UNIFICADO DE GRUPOS) */}
                    {productDrawerTab === 'pizza_groups' && (
                      renderOptionGroupsBuilder(
                        pizzaConfig.groups || [],
                        (updater) => {
                          setPizzaConfig((prev) => ({
                            ...prev,
                            groups: updater(prev.groups || []),
                          }))
                        },
                        true
                      )
                    )}
                  </>
                )
              })()}

              {/* ─── FLUXO PADRÃO PARA OUTRAS CATEGORIAS ───────────────────────── */}
              {(() => {
                const currentCat = categories.find((c) => c.id === productForm.category_id)
                const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false
                if (isPizza) return null

                return (
                  <>
                    {/* TAB 1: DADOS PRINCIPAIS */}
                    {productDrawerTab === 'details' && (
                      <div className="space-y-5">
                        
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Categoria do Cardápio
                          </label>
                          <select
                            value={productForm.category_id}
                            onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                            required
                            className="w-full px-3 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Nome do Prato / Item
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.name}
                            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                            className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Descrição & Ingredientes
                          </label>
                          <textarea
                            rows={3}
                            value={productForm.description}
                            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                            className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Preço Base (R$)
                          </label>
                          <div className="flex items-center">
                            <span className="px-3 py-2 bg-zinc-200 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l text-xs font-mono text-zinc-500">
                              R$
                            </span>
                            <CurrencyInput
                              value={Number(productForm.price) || 0}
                              onChange={(val) => setProductForm({ ...productForm, price: val })}
                              className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-r text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-mono uppercase text-zinc-600 dark:text-zinc-300">
                            Foto do Prato
                          </label>
                          <ImageUpload
                            value={productForm.image_url}
                            onChange={(imageUrl) => setProductForm({ ...productForm, image_url: imageUrl })}
                            onRemove={() => setProductForm({ ...productForm, image_url: '' })}
                          />
                        </div>

                      </div>
                    )}

                    {/* TAB 2: CONSTRUTOR DE GRUPOS DE OPCIONAIS (DESIGN UNIFICADO) */}
                    {productDrawerTab === 'options' && (
                      renderOptionGroupsBuilder(
                        productForm.option_groups,
                        (updater) => {
                          setProductForm((prev) => ({
                            ...prev,
                            option_groups: updater(prev.option_groups),
                          }))
                        },
                        false
                      )
                    )}
                  </>
                )
              })()}

              {/* Drawer Footer */}
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsProductDrawerOpen(false)}
                  className="px-4 py-2.5 text-xs font-mono uppercase border border-zinc-300 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-6 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono uppercase rounded transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingProduct ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Produto</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ─── MODAL: PRÉVIA AO VIVO DE COMO O CLIENTE VÊ ───────────────────── */}
      {isLivePreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header com Badge da Loja */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-200">
                  Prévia do Cardápio Digital (Visão do Cliente)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLivePreviewOpen(false)}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 p-1 cursor-pointer transition-colors rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo do Prato Simulando a Interface do Cliente */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1">
              
              {(() => {
                const currentCat = categories.find((c) => c.id === productForm.category_id)
                const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false

                if (isPizza) {
                  const currentSize = pizzaConfig.sizes.find((s) => s.id === pizzaPreviewSizeId) || pizzaConfig.sizes[0]
                  const maxAllowedDivisions = Math.max(...pizzaConfig.sizes.map((s) => s.max_flavors), 1)
                  const divisionPills = Array.from({ length: maxAllowedDivisions }, (_, i) => i + 1)

                  const allowedSections = pizzaConfig.sections.filter((s) => {
                    if (pizzaConfig.allow_sweet_mix) return true
                    return s.type === pizzaPreviewType
                  })

                  return (
                    <div className="space-y-6">
                      {productForm.image_url ? (
                        <div className="w-full h-48 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                          <img
                            src={resolveImageUrl(productForm.image_url)}
                            alt={productForm.name || 'Pizza'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-36 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center text-zinc-400 gap-2 border border-zinc-200 dark:border-zinc-800">
                          <UtensilsCrossed className="w-8 h-8 opacity-40" />
                          <span className="text-xs font-mono">Pizza Artesanal Doispalitos</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <h3 className="text-xl font-bold text-zinc-950 dark:text-zinc-50">
                          {productForm.name || 'Monte sua Pizza'}
                        </h3>
                        {productForm.description && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                            {productForm.description}
                          </p>
                        )}
                      </div>

                      {/* PASSO 0: ESCOLHA DE TIPO SALGADA OU DOCE (Se não permitir misturar) */}
                      {!pizzaConfig.allow_sweet_mix && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                            1. Tipo de Pizza
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPizzaPreviewType('salgada')
                                const salgadaSec = pizzaConfig.sections.find((s) => s.type === 'salgada')
                                const firstFlav = pizzaConfig.flavors.find((f) => f.section_id === salgadaSec?.id)
                                setPizzaPreviewFlavors(firstFlav ? [firstFlav.name] : [])
                              }}
                              className={`p-2.5 rounded-xl border text-center font-mono text-xs transition-all cursor-pointer ${
                                pizzaPreviewType === 'salgada'
                                  ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50 font-bold'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              Pizzas Salgadas
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPizzaPreviewType('doce')
                                const doceSec = pizzaConfig.sections.find((s) => s.type === 'doce')
                                const firstFlav = pizzaConfig.flavors.find((f) => f.section_id === doceSec?.id)
                                setPizzaPreviewFlavors(firstFlav ? [firstFlav.name] : [])
                              }}
                              className={`p-2.5 rounded-xl border text-center font-mono text-xs transition-all cursor-pointer ${
                                pizzaPreviewType === 'doce'
                                  ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50 font-bold'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              Pizzas Doces
                            </button>
                          </div>
                        </div>
                      )}

                      {/* PASSO 1: QUANTAS DIVISÕES / SABORES */}
                      <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                            Quantos Sabores?
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-500">1 obrigatório</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                          {divisionPills.map((count) => {
                            const isSelected = pizzaPreviewDivision === count
                            return (
                              <button
                                key={count}
                                type="button"
                                onClick={() => {
                                  setPizzaPreviewDivision(count)
                                  if (currentSize && currentSize.max_flavors < count) {
                                    const suitableSize = pizzaConfig.sizes.find((s) => s.max_flavors >= count)
                                    if (suitableSize) {
                                      setPizzaPreviewSizeId(suitableSize.id)
                                    }
                                  }
                                }}
                                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-[#F5DC55] bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold'
                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {count === 1
                                  ? '1 Sabor (Inteira)'
                                  : count === 2
                                  ? '2 Sabores (Meio a Meio)'
                                  : `${count} Sabores`}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* PASSO 2: ESCOLHA DO TAMANHO */}
                      <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                            Tamanho da Pizza
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-500">1 obrigatório</span>
                        </div>

                        <div className="space-y-2">
                          {pizzaConfig.sizes.map((sz) => {
                            const isSupported = sz.max_flavors >= pizzaPreviewDivision
                            const isSelected = pizzaPreviewSizeId === sz.id

                            return (
                              <div
                                key={sz.id}
                                onClick={() => {
                                  if (isSupported) {
                                    setPizzaPreviewSizeId(sz.id)
                                  }
                                }}
                                className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                                  !isSupported
                                    ? 'opacity-40 border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20 cursor-not-allowed text-zinc-400'
                                    : isSelected
                                    ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50 cursor-pointer font-bold'
                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                      isSelected
                                        ? 'bg-[#F5DC55] border-[#F5DC55] text-zinc-950'
                                        : 'border-zinc-300 dark:border-zinc-700'
                                    }`}
                                  >
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                                  </div>

                                  <div>
                                    <span className="text-xs font-medium block">{sz.name}</span>
                                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                                      {sz.slices} Fatias • Até {sz.max_flavors} {sz.max_flavors === 1 ? 'sabor' : 'sabores'}
                                    </span>
                                  </div>
                                </div>

                                {!isSupported ? (
                                  <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded">
                                    Mínimo {pizzaPreviewDivision} sabores
                                  </span>
                                ) : (
                                  <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                    a partir de R${' '}
                                    {formatCurrencyBRL(
                                      Math.min(
                                        ...pizzaConfig.flavors
                                          .map((f) => Number(f.prices[sz.id]) || 0)
                                          .filter((p) => p > 0)
                                      ) || 0
                                    )}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* PASSO 3: SELEÇÃO DOS SABORES (ORGANIZADOS POR SEÇÃO) */}
                      <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                              Escolha os Sabores ({pizzaPreviewFlavors.length} de {pizzaPreviewDivision})
                            </h4>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {pizzaPreviewDivision === 1
                                ? 'Selecione 1 sabor para a pizza inteira.'
                                : `Selecione exatamente ${pizzaPreviewDivision} sabores.`}
                            </p>
                          </div>

                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#F5DC55]/20 text-zinc-950 dark:text-zinc-100 border border-[#F5DC55]/40">
                            {pizzaPreviewFlavors.length}/{pizzaPreviewDivision}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {allowedSections.map((sec) => {
                            const secFlavors = pizzaConfig.flavors.filter((f) => f.section_id === sec.id)
                            if (secFlavors.length === 0) return null

                            return (
                              <div key={sec.id} className="space-y-2">
                                <span className="text-[11px] font-mono font-semibold uppercase text-zinc-500 dark:text-zinc-400 block">
                                  {sec.name}
                                </span>

                                <div className="space-y-2">
                                  {secFlavors.map((flv) => {
                                    const isChecked = pizzaPreviewFlavors.includes(flv.name)
                                    const priceForSize = Number(flv.prices[pizzaPreviewSizeId]) || 0

                                    return (
                                      <div
                                        key={flv.id}
                                        onClick={() => handleTogglePizzaPreviewFlavor(flv.name)}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                          isChecked
                                            ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50'
                                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                              isChecked
                                                ? 'bg-[#F5DC55] border-[#F5DC55] text-zinc-950'
                                                : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                                            }`}
                                          >
                                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                          </div>

                                          {flv.image_url && (
                                            <img
                                              src={resolveImageUrl(flv.image_url)}
                                              alt={flv.name}
                                              className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                                            />
                                          )}

                                          <div>
                                            <span className="text-xs font-semibold block">{flv.name}</span>
                                            {flv.description && (
                                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                                                {flv.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                            R$ {formatCurrencyBRL(priceForSize)}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* PASSO 4+: GRUPOS DE BORDAS & OPCIONAIS DA PIZZA */}
                      {(pizzaConfig.groups || []).length > 0 && (
                        <div className="space-y-5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          {pizzaConfig.groups.map((group, gIdx) => {
                            const isSingle = group.type === 'single'
                            const selected = pizzaPreviewGroupSelections[gIdx] || []

                            return (
                              <div key={gIdx} className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-zinc-100 flex items-center gap-1.5">
                                    {isSingle ? (
                                      <Circle className="w-3 h-3 text-[#F5DC55] fill-current" />
                                    ) : (
                                      <CheckSquare className="w-3 h-3 text-[#F5DC55]" />
                                    )}
                                    <span>{group.name || `Grupo #${gIdx + 1}`}</span>
                                  </h4>
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    {isSingle ? '1 obrigatório' : `máx ${group.max}`}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {group.options.map((opt, oIdx) => {
                                    const isChecked = selected.includes(opt.name)
                                    return (
                                      <div
                                        key={oIdx}
                                        onClick={() => handleTogglePizzaGroupOption(gIdx, opt.name, isSingle)}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                                          isChecked
                                            ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50'
                                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div
                                            className={`w-4 h-4 rounded-${isSingle ? 'full' : 'md'} border flex items-center justify-center shrink-0 ${
                                              isChecked
                                                ? 'bg-[#F5DC55] border-[#F5DC55] text-zinc-950'
                                                : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                                            }`}
                                          >
                                            {isChecked && (
                                              isSingle ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                                              ) : (
                                                <Check className="w-3 h-3 stroke-[3]" />
                                              )
                                            )}
                                          </div>

                                          {opt.image_url && (
                                            <img
                                              src={resolveImageUrl(opt.image_url)}
                                              alt={opt.name}
                                              className="w-8 h-8 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                                            />
                                          )}

                                          <span className="text-xs font-medium">{opt.name}</span>
                                        </div>

                                        <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                          {Number(opt.price) === 0 ? 'Grátis' : `+ R$ ${formatCurrencyBRL(Number(opt.price) || 0)}`}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Resumo da Pizza Montada */}
                      <div className="p-3.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 text-xs font-mono">
                        <span className="text-[10px] uppercase text-zinc-500 font-bold block">
                          Resumo da Pizza Montada
                        </span>
                        <div className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                          <div>
                            <strong>Tamanho:</strong> {currentSize?.name} ({currentSize?.slices} Fatias)
                          </div>
                          <div>
                            <strong>Sabores ({pizzaPreviewFlavors.length}):</strong>{' '}
                            {pizzaPreviewFlavors.join(' + ') || 'Nenhum selecionado'}
                          </div>
                          <div>
                            <strong>Critério de Preço:</strong>{' '}
                            {pizzaConfig.pricing_rule === 'highest'
                              ? 'Cobrado pelo Maior Valor dos Sabores'
                              : 'Cobrado pela Média dos Sabores'}
                          </div>
                        </div>
                      </div>

                    </div>
                  )
                }

                // Visualizador Padrão para outras categorias
                return (
                  <div className="space-y-6">
                    {productForm.image_url ? (
                      <div className="w-full h-48 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <img
                          src={resolveImageUrl(productForm.image_url)}
                          alt={productForm.name || 'Prato'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-36 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center justify-center text-zinc-400 gap-2 border border-zinc-200 dark:border-zinc-800">
                        <UtensilsCrossed className="w-8 h-8 opacity-40" />
                        <span className="text-xs font-mono">Sem foto cadastrada</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-zinc-950 dark:text-zinc-50">
                        {productForm.name || 'Nome do Produto'}
                      </h3>
                      {productForm.description && (
                        <p className="text-xs font-normal text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          {productForm.description}
                        </p>
                      )}
                      <div className="text-lg font-mono font-bold text-[#D4B316] dark:text-[#F5DC55] pt-1">
                        R$ {formatCurrencyBRL(Number(productForm.price) || 0)}
                      </div>
                    </div>

                    {productForm.option_groups.length > 0 && (
                      <div className="space-y-5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        {productForm.option_groups.map((group, gIdx) => {
                          const isSingle = group.type === 'single'
                          const selected = previewSelections[gIdx] || []
                          return (
                            <div key={gIdx} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-950 dark:text-zinc-100 flex items-center gap-1.5">
                                  {isSingle ? (
                                    <Circle className="w-3 h-3 text-[#F5DC55] fill-current" />
                                  ) : (
                                    <CheckSquare className="w-3 h-3 text-[#F5DC55]" />
                                  )}
                                  <span>{group.name || `Grupo #${gIdx + 1}`}</span>
                                </h4>
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {isSingle
                                    ? '1 obrigatório'
                                    : group.type === 'remove'
                                    ? 'opcional'
                                    : `máx ${group.max}`}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {group.options.map((opt, oIdx) => {
                                  const isChecked = selected.includes(opt.name)
                                  return (
                                    <div
                                      key={oIdx}
                                      onClick={() => handleTogglePreviewOption(gIdx, opt.name, isSingle)}
                                      className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                                        isChecked
                                          ? 'border-[#F5DC55] bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50'
                                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <div
                                          className={`w-4 h-4 rounded-${isSingle ? 'full' : 'md'} border flex items-center justify-center shrink-0 ${
                                            isChecked
                                              ? 'bg-[#F5DC55] border-[#F5DC55] text-zinc-950'
                                              : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                                          }`}
                                        >
                                          {isChecked && (
                                            isSingle ? (
                                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                                            ) : (
                                              <Check className="w-3 h-3 stroke-[3]" />
                                            )
                                          )}
                                        </div>

                                        {opt.image_url && (
                                          <img
                                            src={resolveImageUrl(opt.image_url)}
                                            alt={opt.name}
                                            className="w-8 h-8 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                                          />
                                        )}

                                        <span className="text-xs font-medium">{opt.name}</span>
                                      </div>

                                      {group.type === 'remove' || Number(opt.price) === 0 ? (
                                        <span className="text-[11px] font-mono text-zinc-500">
                                          Grátis
                                        </span>
                                      ) : (
                                        <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                          + R$ {formatCurrencyBRL(Number(opt.price) || 0)}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Observação do Cliente */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="block text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400">
                  Observações para a Cozinha (Simulação)
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                />
              </div>

            </div>

            {/* Rodapé Interativo com Quantidade e Total Calculado */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-4">
              <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setPreviewQuantity(Math.max(1, previewQuantity - 1))}
                  className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer font-bold"
                >
                  -
                </button>
                <span className="px-3 py-2 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {previewQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewQuantity(previewQuantity + 1)}
                  className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer font-bold"
                >
                  +
                </button>
              </div>

              {(() => {
                const currentCat = categories.find((c) => c.id === productForm.category_id)
                const isPizza = currentCat ? (getCategoryTemplateKey(currentCat.name) === 'pizzas') : false
                const total = isPizza ? calculatePizzaPreviewTotal() : calculatePreviewTotal()

                return (
                  <button
                    type="button"
                    className="flex-1 px-5 py-3 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono uppercase rounded-xl transition-all cursor-pointer flex items-center justify-between shadow-sm"
                  >
                    <span>Adicionar ao Pedido</span>
                    <span>R$ {formatCurrencyBRL(total)}</span>
                  </button>
                )
              })()}
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL CUSTOMIZADO DE CONFIRMAÇÃO ──────────────────────────────── */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-red-500/10 text-red-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-mono uppercase border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs font-mono uppercase rounded-lg transition-colors cursor-pointer"
              >
                {confirmModal.confirmLabel || 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST FLUTUANTE (FEEDBACK FIXO NO CANTO) ────────────────────────── */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 rounded-xl shadow-2xl border border-zinc-800 dark:border-zinc-200 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${feedbackMessage.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
        <span>doispalitos.tech // {tenant?.name}</span>
        <span>Engenharia de Cardápio e Opcionais</span>
      </footer>

    </div>
  )
}
