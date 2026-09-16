import { useState, useEffect, useRef, FormEvent, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { RestaurantHeader } from '@/components/RestaurantHeader'
import { CurrencyInput, formatCurrencyBRL } from '@/components/CurrencyInput'
import api from '@/lib/api'
import {
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  X,
  Layers,
  ChefHat,
  Truck,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Sparkles,
  Send,
} from 'lucide-react'
import { PurchasingCalendar, DayCalendarData } from '@/components/PurchasingCalendar'
import { PurchasingBatchModal } from '@/components/PurchasingBatchModal'
import { formatDateBR, formatDateMask, parseDateBRtoISO, parseISOtoDateBR } from '@/lib/dateUtils'

export interface InventorySupplier {
  id: string
  name: string
  contact_name?: string
  phone_whatsapp?: string
  email?: string
  supplier_type: 'distributor' | 'wholesaler' | 'local_market' | 'e_commerce' | 'other'
  order_days?: string[]
  min_order_value: number
  notes?: string
  is_active: boolean
  packagings_count?: number
}

export interface InventorySupplierPackaging {
  id: string
  inventory_item_id: string
  supplier_id: string
  brand_name?: string
  package_name: string
  package_base_quantity: number
  price_paid: number
  unit_cost_equivalent: number
  is_preferred: boolean
  supplier?: InventorySupplier
}

export interface InventoryItemOptionView {
  id: string
  brand_name?: string | null
  supplier_id?: string | null
  supplier_name?: string | null
  cost_per_unit: number
  current_stock: number
  last_purchased_at?: string | null
  is_default?: boolean
}

export interface InventoryItem {
  id: string
  name: string
  brand_name?: string
  description?: string
  category: string
  base_unit: 'kg' | 'g' | 'L' | 'ml' | 'un'
  current_stock: number
  min_stock: number
  ideal_stock: number
  frequency_days?: number
  cycle_consumption_qty?: number
  lead_time_days?: number
  last_purchased_at?: string
  next_scheduled_purchase_date?: string
  purchase_frequency?: 'weekly' | 'daily' | 'biweekly' | 'monthly' | 'on_demand'
  purchase_day_of_week?: string
  critical_stock_days?: number
  average_cost_per_unit: number
  last_cost_per_unit: number
  primary_supplier_id?: string
  is_active: boolean
  computed_status?: 'critical' | 'reorder' | 'healthy'
  daily_consumption?: number
  days_until_delivery?: number
  primary_supplier?: InventorySupplier
  packagings?: InventorySupplierPackaging[]
  options_list?: InventoryItemOptionView[]
  brands_in_stock?: InventoryItemOptionView[]
}

export interface SubRecipeIngredient {
  id?: string
  inventory_item_id: string
  quantity_consumed: number
  item?: InventoryItem
}

export interface SubRecipe {
  id: string
  name: string
  batch_yield_quantity: number
  yield_unit: string
  total_batch_cost: number
  unit_cost: number
  current_stock: number
  min_stock: number
  instructions?: string
  is_active: boolean
  ingredients?: SubRecipeIngredient[]
}

export interface ProductRecipeItem {
  id?: string
  product_id?: string
  flavor_id?: string
  size_id?: string
  option_id?: string
  inventory_item_id?: string
  sub_recipe_id?: string
  name?: string
  unit?: string
  quantity_consumed: number
  unit_cost?: number
  cost?: number
  item?: InventoryItem
  sub_recipe?: SubRecipe
}

export interface ProductRecipeView {
  id: string
  name: string
  category_name: string
  is_pizza: boolean
  price: number
  calculated_cost: number
  gross_profit: number
  gross_margin_percent: number
  cmv_percent: number
  recipes_count: number
  recipes?: any[]
}

export interface PurchasingSchedule {
  id: string
  name: string
  frequency_type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'on_demand'
  schedule_days?: string[]
  item_categories?: string[]
  is_active: boolean
}

export interface SmartShoppingSupplier {
  supplier_id: string
  supplier_name: string
  supplier_phone: string
  min_order_value: number
  total_estimated_cost: number
  whatsapp_text: string
  items: Array<{
    item_id: string
    name: string
    category: string
    base_unit: string
    current_stock: number
    min_stock: number
    ideal_stock: number
    needed_base_qty: number
    package_name: string
    brand_name: string
    packages_to_order: number
    total_buy_base_qty: number
    estimated_cost: number
  }>
}

export const INVENTORY_CATEGORIES = [
  { id: 'laticinios', name: 'Laticínios' },
  { id: 'carnes', name: 'Carnes' },
  { id: 'hortifruti', name: 'Hortifrúti' },
  { id: 'farinhas', name: 'Farinhas' },
  { id: 'molhos', name: 'Molhos' },
  { id: 'temperos', name: 'Temperos' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'sobremesas', name: 'Sobremesas' },
  { id: 'embalagens', name: 'Embalagens' },
  { id: 'limpeza', name: 'Limpeza' },
  { id: 'outros', name: 'Outros' },
]

export const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Segunda-feira' },
  { id: 'tuesday', label: 'Terça-feira' },
  { id: 'wednesday', label: 'Quarta-feira' },
  { id: 'thursday', label: 'Quinta-feira' },
  { id: 'friday', label: 'Sexta-feira' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
]

export default function InventoryPage() {
  const { tenant } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'purchasing' | 'sub_recipes' | 'recipes' | 'suppliers' | 'shopping_list' | 'overheads'>('items')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const categoriesScrollRef = useRef<HTMLDivElement>(null)

  // Estados de Calendário & Compras em Lote
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<DayCalendarData | null>(null)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false)
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState<number>(0)

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220
      categoriesScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  // Feedback & Modal de Confirmação
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
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

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text })
    setTimeout(() => {
      setFeedbackMessage(null)
    }, 4500)
  }

  // ─── DADOS DO ESTOQUE & FORNECEDORES ─────────────────────────────────────
  const [items, setItems] = useState<InventoryItem[]>([])
  const [criticalCount, setCriticalCount] = useState(0)
  const [totalStockValue, setTotalStockValue] = useState(0)
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({})

  const toggleItemExpand = (id: string) => {
    setExpandedItemIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([])
  const [productRecipes, setProductRecipes] = useState<ProductRecipeView[]>([])
  const [averageCMV, setAverageCMV] = useState(0)

  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([])
  const [schedules, setSchedules] = useState<PurchasingSchedule[]>([])
  const [shoppingList, setShoppingList] = useState<SmartShoppingSupplier[]>([])
  const [shoppingListLoading, setShoppingListLoading] = useState(false)
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState<string>('all')

  const [financialOverheads, setFinancialOverheads] = useState({
    payroll_expenses: 0,
    rent_expense: 0,
    utilities_expense: 0,
    other_fixed_expenses: 0,
    total_fixed_costs: 0,
    estimated_monthly_revenue: 10000,
    fixed_cost_percentage: 0,
  })
  const [financialMetrics, setFinancialMetrics] = useState({
    total_stock_value: 0,
    average_cmv_percentage: 0,
    fixed_overhead_percentage: 0,
    estimated_net_margin_percent: 0,
  })

  // ─── ESTADOS DE MODAIS DE CADASTRO ─────────────────────────────────────────
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    category: 'laticinios',
    base_unit: 'kg' as 'kg' | 'g' | 'L' | 'ml' | 'un',
    current_stock: '' as string | number,
    frequency_days: '7' as string | number,
    cycle_consumption_qty: '10' as string | number,
    lead_time_days: '0' as string | number,
    last_purchased_at: '',
  })

  // ─── ESTADOS DO MODAL DE OPÇÃO (MARCA / FORNECEDOR / PREÇO / ESTOQUE) ────
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false)
  const [selectedItemForOption, setSelectedItemForOption] = useState<InventoryItem | null>(null)
  const [editingOption, setEditingOption] = useState<any | null>(null)
  const [optionForm, setOptionForm] = useState({
    brand_name: '',
    supplier_id: '',
    cost_per_unit: 0,
    current_stock: '' as string | number,
  })

  const [isSubRecipeModalOpen, setIsSubRecipeModalOpen] = useState(false)
  const [editingSubRecipe, setEditingSubRecipe] = useState<SubRecipe | null>(null)
  const [subRecipeForm, setSubRecipeForm] = useState({
    name: '',
    batch_yield_quantity: 20,
    yield_unit: 'un',
    min_stock: 10,
    instructions: '',
    ingredients: [] as Array<{ inventory_item_id: string; quantity_consumed: number }>,
  })

  const [isProduceModalOpen, setIsProduceModalOpen] = useState(false)
  const [produceSubRecipe, setProduceSubRecipe] = useState<SubRecipe | null>(null)
  const [produceMultiplier, setProduceMultiplier] = useState(1)

  const [isRecipeDrawerOpen, setIsRecipeDrawerOpen] = useState(false)
  const [editingProductRecipe, setEditingProductRecipe] = useState<ProductRecipeView | null>(null)
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{
    type: 'item' | 'sub_recipe'
    id: string
    quantity: number
  }>>([])

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null)
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_name: '',
    phone_whatsapp: '',
    email: '',
    supplier_type: 'wholesaler' as 'distributor' | 'wholesaler' | 'local_market' | 'e_commerce' | 'other',
    order_days: [] as string[],
    min_order_value: 0,
    notes: '',
  })

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<PurchasingSchedule | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    frequency_type: 'weekly' as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'on_demand',
    schedule_days: ['monday'] as string[],
    item_categories: [] as string[],
  })

  const loadAllInventoryData = async () => {
    setIsLoading(true)
    try {
      const [itemsRes, subRes, recipesRes, supRes, schedRes, finRes] = await Promise.all([
        api.get('/restaurant/inventory/items'),
        api.get('/restaurant/inventory/sub-recipes'),
        api.get('/restaurant/inventory/recipes/products'),
        api.get('/restaurant/inventory/suppliers'),
        api.get('/restaurant/inventory/purchasing-schedules'),
        api.get('/restaurant/inventory/financial-overview'),
      ])

      setItems(itemsRes.data.items || [])
      setCriticalCount(itemsRes.data.critical_count || 0)
      setTotalStockValue(itemsRes.data.total_stock_value || 0)

      setSubRecipes(subRes.data.sub_recipes || [])
      setProductRecipes(recipesRes.data.products || [])
      setAverageCMV(recipesRes.data.average_cmv_percentage || 0)

      setSuppliers(supRes.data.suppliers || [])
      setSchedules(schedRes.data.schedules || [])

      setFinancialOverheads(finRes.data.overheads || {})
      setFinancialMetrics(finRes.data.metrics || {})
    } catch (err) {
      console.error('Erro ao carregar dados do estoque:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadShoppingList = async (scheduleId: string = 'all') => {
    setShoppingListLoading(true)
    try {
      const res = await api.get(`/restaurant/inventory/smart-shopping-list?schedule_id=${scheduleId}`)
      setShoppingList(res.data.shopping_list || [])
    } catch (err) {
      console.error('Erro ao gerar lista de compras:', err)
    } finally {
      setShoppingListLoading(false)
    }
  }

  useEffect(() => {
    loadAllInventoryData()
  }, [])

  useEffect(() => {
    if (activeSubTab === 'shopping_list') {
      loadShoppingList(selectedScheduleFilter)
    }
  }, [activeSubTab, selectedScheduleFilter])

  // ─── ITEM HANDLERS & STOCK LOGIC ─────────────────────────────────────────────
  const handleOpenItemModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item)
      setItemForm({
        name: item.name,
        description: item.description || '',
        category: item.category,
        base_unit: item.base_unit,
        current_stock: String(item.current_stock ?? 0),
        frequency_days: String(item.frequency_days ?? 7),
        cycle_consumption_qty: String(item.cycle_consumption_qty ?? item.ideal_stock ?? 10),
        lead_time_days: String(item.lead_time_days ?? 0),
        last_purchased_at: item.last_purchased_at ? parseISOtoDateBR(item.last_purchased_at) : '',
      })
    } else {
      setEditingItem(null)
      setItemForm({
        name: '',
        description: '',
        category: 'laticinios',
        base_unit: 'kg',
        current_stock: '',
        frequency_days: '7',
        cycle_consumption_qty: '10',
        lead_time_days: '0',
        last_purchased_at: '',
      })
    }
    setIsItemModalOpen(true)
  }

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const trimmedName = itemForm.name.trim()
      if (!trimmedName) {
        showFeedback('error', 'Informe o nome do insumo.')
        return
      }

      // Validação de unicidade no frontend (case-insensitive)
      const normalizedName = trimmedName.toLowerCase()
      const isDuplicate = items.some(
        (it) => (!editingItem || it.id !== editingItem.id) && it.name.trim().toLowerCase() === normalizedName
      )
      if (isDuplicate) {
        showFeedback('error', `Já existe um insumo cadastrado com o nome "${trimmedName}".`)
        return
      }

      // Validação da data digitada
      let parsedLastPurchased: string | null = null
      if (itemForm.last_purchased_at.trim()) {
        parsedLastPurchased = parseDateBRtoISO(itemForm.last_purchased_at)
        if (!parsedLastPurchased) {
          showFeedback('error', 'Data da última compra inválida. Use o formato DD/MM/AAAA (ex: 23/08/2026) ou deixe em branco.')
          return
        }
      }

      const freqDays = itemForm.frequency_days === '' ? 0 : (parseInt(String(itemForm.frequency_days), 10) || 0)
      const cycleQty = itemForm.cycle_consumption_qty === '' ? 0 : (parseFloat(String(itemForm.cycle_consumption_qty)) || 0)
      const leadTime = itemForm.lead_time_days === '' ? 0 : (parseInt(String(itemForm.lead_time_days), 10) || 0)
      const currentStock = itemForm.current_stock === '' ? 0 : (parseFloat(String(itemForm.current_stock)) || 0)

      const payload: any = {
        name: trimmedName,
        description: itemForm.description.trim() || null,
        category: itemForm.category,
        base_unit: itemForm.base_unit,
        frequency_days: freqDays,
        cycle_consumption_qty: cycleQty,
        ideal_stock: cycleQty,
        min_stock: 0,
        lead_time_days: leadTime,
      }

      if (!editingItem) {
        payload.current_stock = currentStock
        payload.last_purchased_at = parsedLastPurchased
      }

      if (editingItem) {
        await api.put(`/restaurant/inventory/items/${editingItem.id}`, payload)
        showFeedback('success', 'Insumo atualizado com sucesso.')
      } else {
        await api.post('/restaurant/inventory/items', payload)
        showFeedback('success', 'Insumo cadastrado com sucesso.')
      }

      setIsItemModalOpen(false)
      loadAllInventoryData()
      setCalendarRefreshTrigger(prev => prev + 1)
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar insumo.')
    }
  }

  const handleDeleteItemPrompt = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Insumo',
      description: `Tem certeza que deseja remover "${name}" do estoque?`,
      confirmLabel: 'Remover Insumo',
      onConfirm: async () => {
        try {
          await api.delete(`/restaurant/inventory/items/${id}`)
          showFeedback('success', 'Insumo removido.')
          loadAllInventoryData()
        } catch (err: any) {
          showFeedback('error', err.response?.data?.message || 'Erro ao remover insumo.')
        }
      },
    })
  }

  // ─── OPTION (MARCA / FORNECEDOR / ESTOQUE) HANDLERS ─────────────────────────
  const handleOpenOptionModal = (item: InventoryItem, option?: any) => {
    setSelectedItemForOption(item)
    if (option) {
      setEditingOption(option)
      setOptionForm({
        brand_name: option.brand_name || '',
        supplier_id: option.supplier_id || '',
        cost_per_unit: Number(option.cost_per_unit) || 0,
        current_stock: String(option.current_stock ?? 0),
      })
    } else {
      setEditingOption(null)
      setOptionForm({
        brand_name: '',
        supplier_id: '',
        cost_per_unit: 0,
        current_stock: '0',
      })
    }
    setIsOptionModalOpen(true)
  }

  const handleSaveOption = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedItemForOption) return

    const numStock = optionForm.current_stock === '' ? 0 : (parseFloat(String(optionForm.current_stock)) || 0)
    if (numStock > selectedItemForOption.current_stock) {
      showFeedback(
        'error',
        `O estoque desta opção (${numStock} ${selectedItemForOption.base_unit}) não pode ultrapassar o estoque total do insumo (${selectedItemForOption.current_stock} ${selectedItemForOption.base_unit}).`
      )
      return
    }

    try {
      const payload = {
        brand_name: optionForm.brand_name.trim() || null,
        supplier_id: optionForm.supplier_id || null,
        cost_per_unit: Number(optionForm.cost_per_unit) || 0,
        current_stock: numStock,
      }

      if (editingOption) {
        await api.put(`/restaurant/inventory/items/${selectedItemForOption.id}/options/${editingOption.id}`, payload)
        showFeedback('success', 'Opção atualizada com sucesso.')
      } else {
        await api.post(`/restaurant/inventory/items/${selectedItemForOption.id}/options`, payload)
        showFeedback('success', 'Nova opção adicionada com sucesso.')
      }

      setIsOptionModalOpen(false)
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar opção do insumo.')
    }
  }

  // ─── SUB-RECIPE HANDLERS ────────────────────────────────────────────────────
  const handleOpenSubRecipeModal = (recipe?: SubRecipe) => {
    if (recipe) {
      setEditingSubRecipe(recipe)
      setSubRecipeForm({
        name: recipe.name,
        batch_yield_quantity: Number(recipe.batch_yield_quantity) || 1,
        yield_unit: recipe.yield_unit || 'un',
        min_stock: Number(recipe.min_stock) || 0,
        instructions: recipe.instructions || '',
        ingredients: (recipe.ingredients || []).map((ing) => ({
          inventory_item_id: ing.inventory_item_id,
          quantity_consumed: Number(ing.quantity_consumed) || 0,
        })),
      })
    } else {
      setEditingSubRecipe(null)
      setSubRecipeForm({
        name: '',
        batch_yield_quantity: 20,
        yield_unit: 'un',
        min_stock: 10,
        instructions: '',
        ingredients: items[0] ? [{ inventory_item_id: items[0].id, quantity_consumed: 1 }] : [],
      })
    }
    setIsSubRecipeModalOpen(true)
  }

  const handleSaveSubRecipe = async (e: FormEvent) => {
    e.preventDefault()
    if (subRecipeForm.ingredients.length === 0) {
      showFeedback('error', 'Adicione pelo menos 1 ingrediente ao pré-preparo.')
      return
    }

    try {
      const payload = {
        name: subRecipeForm.name.trim(),
        batch_yield_quantity: Number(subRecipeForm.batch_yield_quantity),
        yield_unit: subRecipeForm.yield_unit,
        min_stock: Number(subRecipeForm.min_stock),
        instructions: subRecipeForm.instructions,
        ingredients: subRecipeForm.ingredients.map((ing) => ({
          inventory_item_id: ing.inventory_item_id,
          quantity_consumed: Number(ing.quantity_consumed),
        })),
      }

      if (editingSubRecipe) {
        await api.put(`/restaurant/inventory/sub-recipes/${editingSubRecipe.id}`, payload)
        showFeedback('success', 'Pré-preparo atualizado.')
      } else {
        await api.post('/restaurant/inventory/sub-recipes', payload)
        showFeedback('success', 'Pré-preparo cadastrado com sucesso.')
      }

      setIsSubRecipeModalOpen(false)
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar pré-preparo.')
    }
  }

  const handleProduceBatch = async (e: FormEvent) => {
    e.preventDefault()
    if (!produceSubRecipe) return

    try {
      const res = await api.post(`/restaurant/inventory/sub-recipes/${produceSubRecipe.id}/produce`, {
        multiplier: Number(produceMultiplier) || 1,
      })
      showFeedback('success', res.data.message)
      setIsProduceModalOpen(false)
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao produzir lote.')
    }
  }

  // ─── PRODUCT RECIPE HANDLERS ────────────────────────────────────────────────
  const handleOpenRecipeDrawer = async (prod: ProductRecipeView) => {
    setEditingProductRecipe(prod)
    try {
      const res = await api.get(`/restaurant/inventory/recipes/products/${prod.id}`)
      const rawIngredients = res.data.ingredients || []
      setRecipeIngredients(
        rawIngredients.map((r: any) => ({
          type: r.sub_recipe_id ? 'sub_recipe' : 'item',
          id: r.sub_recipe_id || r.inventory_item_id,
          quantity: Number(r.quantity_consumed) || 0,
        }))
      )
      setIsRecipeDrawerOpen(true)
    } catch (err) {
      showFeedback('error', 'Erro ao carregar receita do prato.')
    }
  }

  const handleSaveProductRecipe = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingProductRecipe) return

    try {
      const payload = {
        product_id: editingProductRecipe.id,
        ingredients: recipeIngredients.map((ing) => ({
          inventory_item_id: ing.type === 'item' ? ing.id : null,
          sub_recipe_id: ing.type === 'sub_recipe' ? ing.id : null,
          quantity_consumed: Number(ing.quantity),
        })),
      }

      await api.post('/restaurant/inventory/recipes/attach', payload)
      showFeedback('success', 'Ficha técnica salva com sucesso.')
      setIsRecipeDrawerOpen(false)
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar ficha técnica.')
    }
  }

  // ─── SUPPLIER HANDLERS ───────────────────────────────────────────────────────
  const handleOpenSupplierModal = (sup?: InventorySupplier) => {
    if (sup) {
      setEditingSupplier(sup)
      setSupplierForm({
        name: sup.name,
        contact_name: sup.contact_name || '',
        phone_whatsapp: sup.phone_whatsapp || '',
        email: sup.email || '',
        supplier_type: sup.supplier_type,
        order_days: sup.order_days || [],
        min_order_value: Number(sup.min_order_value) || 0,
        notes: sup.notes || '',
      })
    } else {
      setEditingSupplier(null)
      setSupplierForm({
        name: '',
        contact_name: '',
        phone_whatsapp: '',
        email: '',
        supplier_type: 'wholesaler',
        order_days: ['monday', 'thursday'],
        min_order_value: 0,
        notes: '',
      })
    }
    setIsSupplierModalOpen(true)
  }

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingSupplier) {
        await api.put(`/restaurant/inventory/suppliers/${editingSupplier.id}`, supplierForm)
        showFeedback('success', 'Fornecedor atualizado.')
      } else {
        await api.post('/restaurant/inventory/suppliers', supplierForm)
        showFeedback('success', 'Fornecedor cadastrado.')
      }
      setIsSupplierModalOpen(false)
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', err.response?.data?.message || 'Erro ao salvar fornecedor.')
    }
  }

  // ─── PURCHASING SCHEDULE HANDLERS ────────────────────────────────────────────
  const handleOpenScheduleModal = (sched?: PurchasingSchedule) => {
    if (sched) {
      setEditingSchedule(sched)
      setScheduleForm({
        name: sched.name,
        frequency_type: sched.frequency_type,
        schedule_days: sched.schedule_days || ['monday'],
        item_categories: sched.item_categories || [],
      })
    } else {
      setEditingSchedule(null)
      setScheduleForm({
        name: '',
        frequency_type: 'weekly',
        schedule_days: ['monday'],
        item_categories: [],
      })
    }
    setIsScheduleModalOpen(true)
  }

  const handleSaveSchedule = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editingSchedule) {
        await api.put(`/restaurant/inventory/purchasing-schedules/${editingSchedule.id}`, scheduleForm)
        showFeedback('success', 'Rotina de compras atualizada.')
      } else {
        await api.post('/restaurant/inventory/purchasing-schedules', scheduleForm)
        showFeedback('success', 'Rotina de compras cadastrada.')
      }
      setIsScheduleModalOpen(false)
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', 'Erro ao salvar rotina.')
    }
  }

  // ─── FINANCIAL OVERHEAD HANDLERS ─────────────────────────────────────────────
  const handleSaveFinancialOverheads = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.put('/restaurant/inventory/financial-overheads', {
        payroll_expenses: Number(financialOverheads.payroll_expenses),
        rent_expense: Number(financialOverheads.rent_expense),
        utilities_expense: Number(financialOverheads.utilities_expense),
        other_fixed_expenses: Number(financialOverheads.other_fixed_expenses),
        estimated_monthly_revenue: Number(financialOverheads.estimated_monthly_revenue),
      })
      showFeedback('success', 'Despesas e custos fixos atualizados.')
      loadAllInventoryData()
    } catch (err: any) {
      showFeedback('error', 'Erro ao salvar despesas.')
    }
  }

  // ─── FILTERED ITEMS ──────────────────────────────────────────────────────────
  const filteredItems = items.filter((item) => {
    if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.primary_supplier?.name && item.primary_supplier.name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-[#F5DC55] selection:text-zinc-950">
      
      {/* Header Unificado */}
      <RestaurantHeader activeTab="inventory" />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-10 space-y-8">
        
        {/* Title Bar & High-Level Metrics */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Gestão de Insumos // Engenharia de Custos & CMV
            </p>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
              Controle de Estoque & Custos
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {activeSubTab === 'items' && (
              <button
                type="button"
                onClick={() => handleOpenItemModal()}
                className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-semibold text-xs font-mono uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-950" />
                <span>Cadastrar Insumo</span>
              </button>
            )}

            {activeSubTab === 'sub_recipes' && (
              <button
                type="button"
                onClick={() => handleOpenSubRecipeModal()}
                className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-semibold text-xs font-mono uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-950" />
                <span>Novo Pré-preparo</span>
              </button>
            )}

            {activeSubTab === 'suppliers' && (
              <button
                type="button"
                onClick={() => handleOpenSupplierModal()}
                className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-semibold text-xs font-mono uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-950" />
                <span>Novo Fornecedor</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Cards de Métricas Estratégicas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Valor em Estoque</span>
            <div className="text-xl font-bold font-mono text-zinc-950 dark:text-zinc-50">
              R$ {formatCurrencyBRL(totalStockValue)}
            </div>
            <span className="text-[11px] text-zinc-400 block">{items.length} insumos cadastrados</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Itens em Alerta / Ruptura</span>
            <div className={`text-xl font-bold font-mono ${criticalCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {criticalCount} {criticalCount === 1 ? 'item crítico' : 'itens críticos'}
            </div>
            <span className="text-[11px] text-zinc-400 block">Abaixo do estoque mínimo</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500">CMV Médio do Cardápio</span>
            <div className="text-xl font-bold font-mono text-[#D4B316] dark:text-[#F5DC55]">
              {averageCMV > 0 ? `${averageCMV}%` : 'Não Calculado'}
            </div>
            <span className="text-[11px] text-zinc-400 block">Custo de mercadoria vendida</span>
          </div>

          <div className="p-4 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500">Margem Líquida Real</span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {financialMetrics.estimated_net_margin_percent > 0 ? `${financialMetrics.estimated_net_margin_percent}%` : '--'}
            </div>
            <span className="text-[11px] text-zinc-400 block">Após salários e despesas fixas</span>
          </div>
        </div>

        {/* Sub-Tabs de Navegação Interna */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 sm:gap-6 overflow-x-auto text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveSubTab('items')}
            className={`py-3 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'items'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Insumos ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('purchasing')}
            className={`py-3 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'purchasing'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendário & Compras</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('sub_recipes')}
            className={`py-3 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'sub_recipes'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Pré-preparos ({subRecipes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('recipes')}
            className={`py-3 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'recipes'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Ficha Técnica & CMV ({productRecipes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('suppliers')}
            className={`py-3 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'suppliers'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Fornecedores ({suppliers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('overheads')}
            className={`py-3 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'overheads'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Custos Fixos & Margem</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-16 text-center text-xs font-mono text-zinc-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#F5DC55]" />
            <span>Carregando dados de estoque...</span>
          </div>
        ) : (
          <>
            {/* ─── TAB 1: INSUMOS & MATÉRIAS-PRIMAS ──────────────────────────── */}
            {activeSubTab === 'items' && (
              <div className="space-y-6">
                {/* Filtros e Busca com Setas de Navegação Suave */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => scrollCategories('left')}
                      className="p-1.5 rounded-md border border-zinc-300 dark:border-zinc-700/80 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer shrink-0 transition-colors"
                      title="Rolar para a esquerda"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <div
                      ref={categoriesScrollRef}
                      className="flex items-center gap-2 overflow-x-auto py-1 scroll-smooth"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryFilter('all')}
                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                          selectedCategoryFilter === 'all'
                            ? 'bg-[#F5DC55] text-zinc-950 font-bold'
                            : 'bg-zinc-200/60 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                        }`}
                      >
                        Todos ({items.length})
                      </button>

                      {INVENTORY_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryFilter(cat.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                            selectedCategoryFilter === cat.id
                              ? 'bg-[#F5DC55] text-zinc-950 font-bold'
                              : 'bg-zinc-200/60 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                          }`}
                        >
                          {cat.name} ({items.filter((i) => i.category === cat.id).length})
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollCategories('right')}
                      className="p-1.5 rounded-md border border-zinc-300 dark:border-zinc-700/80 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer shrink-0 transition-colors"
                      title="Rolar para a direita"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="relative min-w-[240px]">
                    <input
                      type="text"
                      placeholder="Buscar insumo ou fornecedor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="p-12 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl text-center space-y-3">
                    <p className="text-xs font-mono text-zinc-500">Nenhum insumo encontrado nesta categoria.</p>
                    <button
                      type="button"
                      onClick={() => handleOpenItemModal()}
                      className="px-4 py-2 bg-[#F5DC55] text-zinc-950 text-xs font-mono font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cadastrar Primeiro Insumo</span>
                    </button>
                  </div>
                ) : (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-[#121316]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase text-zinc-500">
                        <tr>
                          <th className="py-3 px-3 w-10 text-center"></th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Insumo / Matéria-Prima</th>
                          <th className="py-3 px-4">Categoria</th>
                          <th className="py-3 px-4 text-center">Estoque Total</th>
                          <th className="py-3 px-4 text-center">Ciclo & Consumo</th>
                          <th className="py-3 px-4 text-center">Próxima Compra</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {filteredItems.map((it) => {
                          const status = it.computed_status || (Number(it.current_stock) <= 0 ? 'critical' : 'healthy')
                          const isCritical = status === 'critical'
                          const isReorder = status === 'reorder'
                          const cycleQty = Number(it.cycle_consumption_qty) || Number(it.ideal_stock) || 10
                          const freqDays = Number(it.frequency_days) || 7
                          const dailyConsumption = freqDays > 0 ? cycleQty / freqDays : 0
                          const isExpanded = !!expandedItemIds[it.id]
                          const options = it.options_list || it.brands_in_stock || []

                          return (
                            <Fragment key={it.id}>
                              <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                                {/* Coluna Setinha Expansível */}
                                <td className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleItemExpand(it.id)}
                                    className="p-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                                    title={isExpanded ? 'Recolher opções' : 'Ver opções do insumo'}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>

                                {/* Status */}
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isCritical
                                        ? 'bg-red-500/10 text-red-500'
                                        : isReorder
                                        ? 'bg-[#F5DC55]/15 text-[#8A7100] dark:text-[#F5DC55]'
                                        : 'bg-emerald-500/10 text-emerald-500'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    <span>{isCritical ? 'Crítico' : isReorder ? 'Repor' : 'Ok'}</span>
                                  </span>
                                </td>

                                {/* Insumo Puro */}
                                <td className="py-3 px-4">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-zinc-950 dark:text-zinc-50 text-sm">
                                        {it.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleItemExpand(it.id)}
                                        className="text-[10px] text-zinc-400 hover:text-[#D4B316] dark:hover:text-[#F5DC55] transition-colors cursor-pointer"
                                      >
                                        ({options.length} {options.length === 1 ? 'opção cadastrada' : 'opções cadastradas'})
                                      </button>
                                    </div>
                                    {it.description && (
                                      <p className="text-[11px] text-zinc-400 truncate max-w-xs">{it.description}</p>
                                    )}
                                  </div>
                                </td>

                                {/* Categoria */}
                                <td className="py-3 px-4 text-zinc-500 capitalize">
                                  {INVENTORY_CATEGORIES.find((c) => c.id === it.category)?.name || it.category}
                                </td>

                                {/* Estoque Físico Total */}
                                <td className="py-3 px-4 text-center font-bold text-zinc-900 dark:text-zinc-100">
                                  {it.current_stock} {it.base_unit}
                                </td>

                                {/* Ciclo & Consumo */}
                                <td className="py-3 px-4 text-center">
                                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold block">
                                    {cycleQty} {it.base_unit} / {freqDays > 0 ? `${freqDays}d` : 'sob demanda'}
                                  </span>
                                  {dailyConsumption > 0 && (
                                    <span className="text-[10px] text-zinc-400 block">
                                      ~{dailyConsumption.toFixed(2)} {it.base_unit}/dia
                                    </span>
                                  )}
                                </td>

                                {/* Próxima Compra */}
                                <td className="py-3 px-4 text-center">
                                  {freqDays === 0 ? (
                                    <span className="text-zinc-400 italic">Sob Demanda</span>
                                  ) : it.next_scheduled_purchase_date ? (
                                    <div className="space-y-0.5">
                                      <span className="text-zinc-900 dark:text-zinc-100 font-medium block">
                                        {formatDateBR(it.next_scheduled_purchase_date)}
                                      </span>
                                      {it.days_until_delivery !== undefined && (
                                        <span className="text-[10px] text-zinc-400 block">
                                          {it.days_until_delivery === 0
                                            ? 'Hoje'
                                            : it.days_until_delivery === 1
                                            ? 'Amanhã'
                                            : `Em ${it.days_until_delivery} dias`}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                                      Sem previsão
                                    </span>
                                  )}
                                </td>

                                {/* Ações */}
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenItemModal(it)}
                                      className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded cursor-pointer"
                                      title="Editar Insumo"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItemPrompt(it.id, it.name)}
                                      className="p-1.5 text-zinc-400 hover:text-red-500 rounded cursor-pointer"
                                      title="Remover Insumo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Sub-Linha Expansível com Opções de Marcas & Fornecedores */}
                              {isExpanded && (
                                <tr className="bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800">
                                  <td colSpan={8} className="py-3 px-4 sm:px-8">
                                    <div className="space-y-2 py-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                                          Opções de Marcas & Fornecedores Homologados
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenOptionModal(it)}
                                          className="text-[11px] font-bold text-[#8A7100] dark:text-[#F5DC55] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Adicionar Nova Opção</span>
                                        </button>
                                      </div>

                                      <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-[#121316]">
                                        <table className="w-full text-left text-xs font-mono">
                                          <thead className="bg-zinc-100/70 dark:bg-zinc-900/80 text-[10px] uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                              <th className="py-2 px-3">Opção</th>
                                              <th className="py-2 px-3">Fornecedor</th>
                                              <th className="py-2 px-3">Preço de Custo</th>
                                              <th className="py-2 px-3">Última Compra</th>
                                              <th className="py-2 px-3 text-center">Estoque Atual</th>
                                              <th className="py-2 px-3 text-right w-20">Ações</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                            {options.map((opt, optIdx) => (
                                              <tr key={opt.id || optIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                                                <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                                                  {opt.brand_name?.trim() ? opt.brand_name : <span className="text-zinc-400 italic">Sem registro</span>}
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                                                  {opt.supplier_name?.trim() ? opt.supplier_name : <span className="text-zinc-400 italic">Sem registro</span>}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-zinc-900 dark:text-zinc-100">
                                                  {opt.cost_per_unit > 0 ? (
                                                    <>
                                                      <span>R$ {formatCurrencyBRL(opt.cost_per_unit)} / {it.base_unit}</span>
                                                      {(it.base_unit === 'kg' || it.base_unit === 'L') && (
                                                        <span className="text-[10px] text-zinc-400 block">
                                                          (R$ {(opt.cost_per_unit / 1000).toFixed(4)} / {it.base_unit === 'kg' ? 'g' : 'ml'})
                                                        </span>
                                                      )}
                                                    </>
                                                  ) : (
                                                    <span className="text-zinc-400 italic">Sem registro</span>
                                                  )}
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-500">
                                                  {opt.last_purchased_at ? (
                                                    formatDateBR(opt.last_purchased_at)
                                                  ) : (
                                                    <span className="text-zinc-400 italic">Sem registro</span>
                                                  )}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                  {opt.current_stock > 0 ? (
                                                    <span className="font-bold text-[#8A7100] dark:text-[#F5DC55]">
                                                      {opt.current_stock} {it.base_unit}
                                                    </span>
                                                  ) : (
                                                    <span className="text-zinc-400 font-normal">
                                                      0 {it.base_unit}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenOptionModal(it, opt)}
                                                    className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                                    title="Editar Opção"
                                                  >
                                                    <Edit2 className="w-3 h-3" />
                                                    <span>Editar</span>
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 2: CENTRAL & CALENDÁRIO DE COMPRAS ──────────────────── */}
            {activeSubTab === 'purchasing' && (
              <PurchasingCalendar
                onOpenDayBatch={(dayData) => {
                  setSelectedCalendarDay(dayData)
                  setIsBatchModalOpen(true)
                }}
                onRefreshTrigger={calendarRefreshTrigger}
              />
            )}

            {/* ─── TAB 3: PRÉ-PREPAROS DA COZINHA ───────────────────────────── */}
            {activeSubTab === 'sub_recipes' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                      Receitas Base & Pré-preparos em Lote
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Produza lotes de massas, molhos e recheios com 1 clique para abater ingredientes brutos.
                    </p>
                  </div>
                </div>

                {subRecipes.length === 0 ? (
                  <div className="p-12 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl text-center space-y-3">
                    <ChefHat className="w-8 h-8 text-zinc-400 mx-auto" />
                    <p className="text-xs font-mono text-zinc-500">Nenhum pré-preparo cadastrado.</p>
                    <button
                      type="button"
                      onClick={() => handleOpenSubRecipeModal()}
                      className="px-4 py-2 bg-[#F5DC55] text-zinc-950 text-xs font-mono font-bold rounded-lg cursor-pointer"
                    >
                      Criar Primeiro Pré-preparo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subRecipes.map((sr) => (
                      <div
                        key={sr.id}
                        className="p-5 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                              {sr.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                              Rende {sr.batch_yield_quantity} {sr.yield_unit}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs font-mono pt-1">
                            <div className="flex justify-between text-zinc-500">
                              <span>Custo Total do Lote:</span>
                              <strong className="text-zinc-900 dark:text-zinc-100">R$ {formatCurrencyBRL(sr.total_batch_cost)}</strong>
                            </div>
                            <div className="flex justify-between text-zinc-500">
                              <span>Custo Unitário Calculado:</span>
                              <strong className="text-[#D4B316] dark:text-[#F5DC55]">R$ {formatCurrencyBRL(sr.unit_cost)} / {sr.yield_unit}</strong>
                            </div>
                            <div className="flex justify-between text-zinc-500">
                              <span>Estoque Pronto:</span>
                              <strong>{sr.current_stock} {sr.yield_unit}</strong>
                            </div>
                          </div>

                          {sr.ingredients && sr.ingredients.length > 0 && (
                            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                              <span className="text-[10px] uppercase text-zinc-400 font-semibold block mb-1">
                                Ingredientes do Lote:
                              </span>
                              <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                                {sr.ingredients.map((ing, iIdx) => (
                                  <li key={iIdx} className="flex justify-between">
                                    <span>• {ing.item?.name}</span>
                                    <span>{ing.quantity_consumed} {ing.item?.base_unit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setProduceSubRecipe(sr)
                              setProduceMultiplier(1)
                              setIsProduceModalOpen(true)
                            }}
                            className="flex-1 px-3 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs font-mono uppercase rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ChefHat className="w-3.5 h-3.5 text-zinc-950" />
                            <span>Produzir Lote</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenSubRecipeModal(sr)}
                            className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 3: FICHA TÉCNICA & ENGENHARIA DE CARDÁPIO (CMV) ───────── */}
            {activeSubTab === 'recipes' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                      Fichas Técnicas & Análise de Margem Bruta
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Conecte ingredientes e pré-preparos aos pratos e pizzas para calcular CMV e margens exatas.
                    </p>
                  </div>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-[#121316]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase text-zinc-500">
                      <tr>
                        <th className="py-3 px-4">Prato / Item</th>
                        <th className="py-3 px-4">Categoria</th>
                        <th className="py-3 px-4">Preço Venda</th>
                        <th className="py-3 px-4">Custo Insumos (CMV)</th>
                        <th className="py-3 px-4">Lucro Bruto</th>
                        <th className="py-3 px-4">Margem Bruta %</th>
                        <th className="py-3 px-4 text-right">Ficha Técnica</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {productRecipes.map((p) => {
                        const hasRecipe = p.recipes_count > 0
                        return (
                          <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                            <td className="py-3 px-4 font-semibold text-zinc-950 dark:text-zinc-50">
                              {p.name}
                            </td>

                            <td className="py-3 px-4 text-zinc-500">
                              {p.category_name}
                            </td>

                            <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                              R$ {formatCurrencyBRL(p.price)}
                            </td>

                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                              {hasRecipe ? (
                                <span>R$ {formatCurrencyBRL(p.calculated_cost)} ({p.cmv_percent}%)</span>
                              ) : (
                                <span className="text-zinc-400 italic">Não configurado</span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                              {hasRecipe ? `R$ ${formatCurrencyBRL(p.gross_profit)}` : '--'}
                            </td>

                            <td className="py-3 px-4">
                              {hasRecipe ? (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded font-bold">
                                  {p.gross_margin_percent}%
                                </span>
                              ) : (
                                <span className="text-zinc-400">--</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenRecipeDrawer(p)}
                                className="px-3 py-1.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs rounded transition-colors cursor-pointer"
                              >
                                {hasRecipe ? 'Editar Ficha' : '+ Vincular Insumos'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── TAB 4: FORNECEDORES & EMBALAGENS ─────────────────────────── */}
            {activeSubTab === 'suppliers' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                      Fornecedores & Canais de Compra
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Cadastre atacadistas, distribuidoras e feiras com contatos para envio direto de pedidos por WhatsApp.
                    </p>
                  </div>
                </div>

                {suppliers.length === 0 ? (
                  <div className="p-12 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl text-center space-y-3">
                    <Truck className="w-8 h-8 text-zinc-400 mx-auto" />
                    <p className="text-xs font-mono text-zinc-500">Nenhum fornecedor cadastrado.</p>
                    <button
                      type="button"
                      onClick={() => handleOpenSupplierModal()}
                      className="px-4 py-2 bg-[#F5DC55] text-zinc-950 text-xs font-mono font-bold rounded-lg cursor-pointer"
                    >
                      Cadastrar Fornecedor
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suppliers.map((sup) => (
                      <div
                        key={sup.id}
                        className="p-5 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                              {sup.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                              {sup.supplier_type}
                            </span>
                          </div>

                          {sup.contact_name && (
                            <p className="text-xs text-zinc-500">Contato: {sup.contact_name}</p>
                          )}

                          {sup.phone_whatsapp && (
                            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span>WhatsApp: {sup.phone_whatsapp}</span>
                            </p>
                          )}

                          <div className="text-[11px] font-mono text-zinc-400 pt-1">
                            {sup.min_order_value > 0 ? (
                              <span>Pedido Mínimo: R$ {formatCurrencyBRL(sup.min_order_value)}</span>
                            ) : (
                              <span>Sem valor mínimo</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenSupplierModal(sup)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 5: CENTRAL DE COMPRAS INTELIGENTE (SMART LIST) ────────── */}
            {activeSubTab === 'shopping_list' && (
              <div className="space-y-6">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                      <span>Lista de Compras Inteligente</span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Calcula a necessidade de reposição (Estoque Ideal - Atual) e gera mensagens formatadas para WhatsApp.
                    </p>
                  </div>

                  {/* Seletor de Agenda de Compra */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">Rotina:</span>
                    <select
                      value={selectedScheduleFilter}
                      onChange={(e) => setSelectedScheduleFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="all">Todas as Compras Necessárias</option>
                      {schedules.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name} ({sc.frequency_type})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleOpenScheduleModal()}
                      className="p-1.5 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-mono cursor-pointer"
                      title="Configurar Nova Rotina de Compra"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {shoppingListLoading ? (
                  <div className="p-12 text-center text-xs font-mono text-zinc-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#F5DC55]" />
                    <span>Calculando lista inteligente de compras...</span>
                  </div>
                ) : shoppingList.length === 0 ? (
                  <div className="p-12 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-emerald-500/5 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                      Estoque 100% Abastecido!
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      Todos os insumos estão acima do ponto de reposição para esta rotina de compras.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {shoppingList.map((supGroup, idx) => (
                      <div
                        key={idx}
                        className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-[#121316] space-y-4 p-5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                              <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                                {supGroup.supplier_name}
                              </h4>
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400">
                              {supGroup.items.length} {supGroup.items.length === 1 ? 'item solicitado' : 'itens solicitados'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                              Total Estimado: R$ {formatCurrencyBRL(supGroup.total_estimated_cost)}
                            </span>

                            {supGroup.supplier_phone && (
                              <a
                                href={`https://wa.me/55${supGroup.supplier_phone.replace(/\D/g, '')}?text=${encodeURIComponent(supGroup.whatsapp_text)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs font-mono uppercase rounded-lg transition-colors inline-flex items-center gap-1.5"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Enviar no WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Tabela de Itens para este Fornecedor */}
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[10px] uppercase text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                              <th className="py-2">Insumo</th>
                              <th className="py-2 text-center">Estoque Atual / Ideal</th>
                              <th className="py-2">Embalagem de Compra</th>
                              <th className="py-2 text-center">Qtd Sugerida</th>
                              <th className="py-2 text-right">Custo Estimado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                            {supGroup.items.map((it, iIdx) => (
                              <tr key={iIdx}>
                                <td className="py-2.5 font-medium text-zinc-950 dark:text-zinc-50">
                                  {it.name} {it.brand_name && <span className="text-zinc-400 text-[10px]">({it.brand_name})</span>}
                                </td>
                                <td className="py-2.5 text-center text-zinc-500">
                                  {it.current_stock} / {it.ideal_stock} {it.base_unit}
                                </td>
                                <td className="py-2.5 text-zinc-600 dark:text-zinc-300">
                                  {it.package_name}
                                </td>
                                <td className="py-2.5 text-center font-bold text-[#D4B316] dark:text-[#F5DC55]">
                                  {it.packages_to_order}x ({it.total_buy_base_qty} {it.base_unit})
                                </td>
                                <td className="py-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100">
                                  R$ {formatCurrencyBRL(it.estimated_cost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 6: CUSTOS FIXOS & MARGEM REAL ─────────────────────────── */}
            {activeSubTab === 'overheads' && (
              <div className="max-w-2xl space-y-6">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    Custos Fixos & Margem Líquida Real
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Insira as despesas operacionais da loja para calcular a margem líquida real de cada prato.
                  </p>
                </div>

                <form onSubmit={handleSaveFinancialOverheads} className="space-y-4 text-xs font-mono">
                  <div className="p-4 bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[11px] uppercase text-zinc-500">
                        Folha Salarial Mensal (R$)
                      </label>
                      <CurrencyInput
                        value={financialOverheads.payroll_expenses}
                        onChange={(val) => setFinancialOverheads({ ...financialOverheads, payroll_expenses: val })}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] uppercase text-zinc-500">
                        Aluguel do Ponto Comercial (R$)
                      </label>
                      <CurrencyInput
                        value={financialOverheads.rent_expense}
                        onChange={(val) => setFinancialOverheads({ ...financialOverheads, rent_expense: val })}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] uppercase text-zinc-500">
                        Contas Básicas: Energia, Água, Gás e Internet (R$)
                      </label>
                      <CurrencyInput
                        value={financialOverheads.utilities_expense}
                        onChange={(val) => setFinancialOverheads({ ...financialOverheads, utilities_expense: val })}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] uppercase text-zinc-500">
                        Outras Despesas Fixas: Contador, Softwares, Taxas (R$)
                      </label>
                      <CurrencyInput
                        value={financialOverheads.other_fixed_expenses}
                        onChange={(val) => setFinancialOverheads({ ...financialOverheads, other_fixed_expenses: val })}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <label className="block text-[11px] uppercase text-zinc-500">
                        Faturamento Mensal Médio Estimado (R$)
                      </label>
                      <CurrencyInput
                        value={financialOverheads.estimated_monthly_revenue}
                        onChange={(val) => setFinancialOverheads({ ...financialOverheads, estimated_monthly_revenue: val })}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#F5DC55]/10 border border-[#F5DC55]/30 rounded-xl space-y-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-950 dark:text-zinc-100 block">
                      Resultado do Custo Fixo
                    </span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      Suas despesas fixas somam <strong>R$ {formatCurrencyBRL(financialOverheads.payroll_expenses + financialOverheads.rent_expense + financialOverheads.utilities_expense + financialOverheads.other_fixed_expenses)}</strong>, o que representa aproximadamente <strong>{financialOverheads.fixed_cost_percentage}%</strong> sobre o faturamento.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Salvar Despesas & Recalcular Margens
                  </button>
                </form>
              </div>
            )}
          </>
        )}

      </main>

      {/* ─── MODAL: INSUMO PURO / MATÉRIA-PRIMA ─────────────────────────────────── */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F5DC55]/20 flex items-center justify-center text-[#D4B316] dark:text-[#F5DC55]">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                    {editingItem ? 'Editar Insumo' : 'Novo Insumo'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-light">
                    {editingItem
                      ? 'Atualize o planejamento de estoque e parâmetros do insumo'
                      : 'Cadastre a matéria-prima e defina os parâmetros de estoque'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* ─── 1. IDENTIFICAÇÃO DO INSUMO PURO ─── */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 dark:border-zinc-800/80 pb-1">
                  01 / Identificação do Insumo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8 space-y-1">
                    <label className="block text-[11px] uppercase text-zinc-500 font-medium">Nome do Insumo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Queijo Mussarela, Farinha de Trigo, Tomate Pelati..."
                      value={itemForm.name}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none font-medium"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[11px] uppercase text-zinc-500 font-medium">Categoria *</label>
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                    >
                      {INVENTORY_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-8 space-y-1">
                    <label className="block text-[11px] uppercase text-zinc-500 font-medium">Descrição (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Peça fatiada para montagem das pizzas"
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[11px] uppercase text-zinc-500 font-medium">Unidade Base *</label>
                    <select
                      value={itemForm.base_unit}
                      onChange={(e) => setItemForm({ ...itemForm, base_unit: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none font-bold"
                    >
                      <option value="kg">Quilograma (kg)</option>
                      <option value="g">Grama (g)</option>
                      <option value="L">Litro (L)</option>
                      <option value="ml">Mililitro (ml)</option>
                      <option value="un">Unidade (un)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ─── 2. PLANEJAMENTO DE REPOSIÇÃO & ESTOQUE ─── */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 dark:border-zinc-800/80 pb-1">
                  02 / Planejamento de Reposição & Estoque
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  
                  {/* Frequência: A cada X dias */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                      Frequência (Dias)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        placeholder="Ex: 7"
                        value={itemForm.frequency_days}
                        onChange={(e) => setItemForm({ ...itemForm, frequency_days: e.target.value })}
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-zinc-400 pointer-events-none">
                        {(parseInt(String(itemForm.frequency_days), 10) || 0) > 0 ? 'dias' : 'sob demanda'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block">
                      {(parseInt(String(itemForm.frequency_days), 10) || 0) > 0
                        ? `A cada ${parseInt(String(itemForm.frequency_days), 10)} dias`
                        : 'Sob demanda'}
                    </span>
                  </div>

                  {/* Consumo do Ciclo */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                      Consumo do Ciclo ({itemForm.base_unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 10"
                      value={itemForm.cycle_consumption_qty}
                      onChange={(e) => setItemForm({ ...itemForm, cycle_consumption_qty: e.target.value })}
                      className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-400 block">
                      {(parseInt(String(itemForm.frequency_days), 10) || 0) > 0
                        ? `~${(((parseFloat(String(itemForm.cycle_consumption_qty)) || 0) / (parseInt(String(itemForm.frequency_days), 10) || 1))).toFixed(2)} ${itemForm.base_unit}/dia`
                        : `${itemForm.cycle_consumption_qty || 0} ${itemForm.base_unit} por compra`}
                    </span>
                  </div>

                  {/* Prazo de Entrega (Lead Time) */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                      Prazo de Entrega (Dias)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 0"
                      value={itemForm.lead_time_days}
                      onChange={(e) => setItemForm({ ...itemForm, lead_time_days: e.target.value })}
                      className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-400 block">
                      {(parseInt(String(itemForm.lead_time_days), 10) || 0) === 0 ? 'Busca no mesmo dia' : `Chega em ${parseInt(String(itemForm.lead_time_days), 10)} dia(s)`}
                    </span>
                  </div>

                  {/* Data da Última Compra e Estoque Físico Inicial: apenas no CADASTRO NOVO */}
                  {!editingItem && (
                    <>
                      {/* Data da Última Compra (Texto formatado DD/MM/AAAA) */}
                      <div className="sm:col-span-6 space-y-1">
                        <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                          Data da Última Compra
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="DD/MM/AAAA"
                          value={itemForm.last_purchased_at}
                          onChange={(e) => setItemForm({ ...itemForm, last_purchased_at: formatDateMask(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                        />
                        <span className="text-[10px] text-zinc-400 block">
                          Opcional. Se não souber, deixe em branco.
                        </span>
                      </div>

                      {/* Estoque Físico Inicial */}
                      <div className="sm:col-span-6 space-y-1">
                        <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                          Estoque Inicial ({itemForm.base_unit})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={itemForm.current_stock}
                          onChange={(e) => setItemForm({ ...itemForm, current_stock: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-left text-xs font-semibold bg-transparent border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                        />
                        <span className="text-[10px] text-zinc-400 block">
                          Saldo em mãos na cozinha hoje.
                        </span>
                      </div>
                    </>
                  )}

                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  {editingItem ? 'Salvar Alterações' : 'Concluir Cadastro'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DE GESTÃO DE OPÇÃO (MARCA / FORNECEDOR / PREÇO / ESTOQUE) ─── */}
      {isOptionModalOpen && selectedItemForOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#F5DC55]/20 flex items-center justify-center text-[#D4B316] dark:text-[#F5DC55]">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                    {editingOption ? 'Editar Opção' : 'Adicionar Nova Opção'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-light">
                    Insumo: <strong className="text-zinc-900 dark:text-zinc-100">{selectedItemForOption.name}</strong> (Estoque Total: {selectedItemForOption.current_stock} {selectedItemForOption.base_unit})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOptionModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveOption} className="p-6 space-y-4">
              
              {/* Marca */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                  Marca / Opção
                </label>
                <input
                  type="text"
                  placeholder="Ex: Scala, Tirolez, Mococa, etc."
                  value={optionForm.brand_name}
                  onChange={(e) => setOptionForm({ ...optionForm, brand_name: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-[#F5DC55] focus:outline-none"
                />
              </div>

              {/* Fornecedor */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                  Fornecedor
                </label>
                <select
                  value={optionForm.supplier_id}
                  onChange={(e) => setOptionForm({ ...optionForm, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                >
                  <option value="">Sem fornecedor fixo</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Preço de Custo */}
              <div className="space-y-1">
                <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                  Preço de Custo por {selectedItemForOption.base_unit} (R$)
                </label>
                <CurrencyInput
                  value={optionForm.cost_per_unit}
                  onChange={(val) => setOptionForm({ ...optionForm, cost_per_unit: val })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                />
              </div>

              {/* Estoque Atual da Opção */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase text-zinc-500 font-medium">
                    Estoque Físico Desta Opção ({selectedItemForOption.base_unit})
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    Máx: {selectedItemForOption.current_stock} {selectedItemForOption.base_unit}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={selectedItemForOption.current_stock}
                  placeholder="0.00"
                  value={optionForm.current_stock}
                  onChange={(e) => setOptionForm({ ...optionForm, current_stock: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-lg text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                />
                <span className="text-[10px] text-zinc-400 block">
                  Ao definir o saldo desta opção, o estoque restante das outras opções do insumo se redistribui automaticamente.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOptionModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Salvar Opção
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: PRODUZIR LOTE DE PRÉ-PREPARO ───────────────────────────── */}
      {isProduceModalOpen && produceSubRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                  Produzir Lote na Cozinha
                </h3>
                <p className="text-xs text-zinc-500">{produceSubRecipe.name}</p>
              </div>
              <button onClick={() => setIsProduceModalOpen(false)} className="text-zinc-400 hover:text-zinc-950 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProduceBatch} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">
                  Quantos Lotes Deseja Produzir?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={produceMultiplier}
                    onChange={(e) => setProduceMultiplier(parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-center text-sm font-bold"
                  />
                  <span className="text-zinc-500">
                    = <strong>{produceSubRecipe.batch_yield_quantity * produceMultiplier} {produceSubRecipe.yield_unit}</strong> produzidos
                  </span>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1.5 text-[11px]">
                <span className="font-semibold text-zinc-500 uppercase block">Ingredientes que serão abatidos:</span>
                <ul className="space-y-0.5 text-zinc-600 dark:text-zinc-300">
                  {produceSubRecipe.ingredients?.map((ing, iIdx) => (
                    <li key={iIdx} className="flex justify-between">
                      <span>• {ing.item?.name}</span>
                      <span><strong>{ing.quantity_consumed * produceMultiplier} {ing.item?.base_unit}</strong></span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProduceModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded cursor-pointer"
                >
                  Confirmar Produção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: PRÉ-PREPARO (SUB-RECEITA) ───────────────────────────────── */}
      {isSubRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                {editingSubRecipe ? 'Editar Pré-preparo' : 'Novo Pré-preparo da Cozinha'}
              </h3>
              <button onClick={() => setIsSubRecipeModalOpen(false)} className="text-zinc-400 hover:text-zinc-950 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubRecipe} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">Nome do Pré-preparo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Massa de Pizza 48h, Molho Pelati da Casa"
                  value={subRecipeForm.name}
                  onChange={(e) => setSubRecipeForm({ ...subRecipeForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] uppercase text-zinc-500">Rendimento do Lote</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={subRecipeForm.batch_yield_quantity}
                    onChange={(e) => setSubRecipeForm({ ...subRecipeForm, batch_yield_quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] uppercase text-zinc-500">Unidade de Rendimento</label>
                  <select
                    value={subRecipeForm.yield_unit}
                    onChange={(e) => setSubRecipeForm({ ...subRecipeForm, yield_unit: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                  >
                    <option value="un">Discos / Unidades (un)</option>
                    <option value="L">Litros (L)</option>
                    <option value="kg">Quilos (kg)</option>
                    <option value="g">Gramas (g)</option>
                  </select>
                </div>
              </div>

              {/* Ingredientes do Lote */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-zinc-500">Ingredientes Consumidos no Lote:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (items[0]) {
                        setSubRecipeForm({
                          ...subRecipeForm,
                          ingredients: [...subRecipeForm.ingredients, { inventory_item_id: items[0].id, quantity_consumed: 1 }],
                        })
                      }
                    }}
                    className="text-xs text-[#D4B316] dark:text-[#F5DC55] font-bold cursor-pointer"
                  >
                    + Adicionar Ingrediente
                  </button>
                </div>

                <div className="space-y-2">
                  {subRecipeForm.ingredients.map((ing, iIdx) => {
                    const selItem = items.find((i) => i.id === ing.inventory_item_id)
                    return (
                      <div key={iIdx} className="flex items-center gap-2">
                        <select
                          value={ing.inventory_item_id}
                          onChange={(e) => {
                            const val = e.target.value
                            setSubRecipeForm({
                              ...subRecipeForm,
                              ingredients: subRecipeForm.ingredients.map((item, idx) =>
                                idx === iIdx ? { ...item, inventory_item_id: val } : item
                              ),
                            })
                          }}
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                        >
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>{it.name} ({it.base_unit})</option>
                          ))}
                        </select>

                        <div className="flex items-center w-28">
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={ing.quantity_consumed}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setSubRecipeForm({
                                ...subRecipeForm,
                                ingredients: subRecipeForm.ingredients.map((item, idx) =>
                                  idx === iIdx ? { ...item, quantity_consumed: val } : item
                                ),
                              })
                            }}
                            className="w-full px-2 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-l text-center text-xs"
                          />
                          <span className="px-2 py-1.5 bg-zinc-200 dark:bg-zinc-800 border border-l-0 border-zinc-300 dark:border-zinc-700 rounded-r text-[10px] text-zinc-500">
                            {selItem?.base_unit}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSubRecipeForm({
                              ...subRecipeForm,
                              ingredients: subRecipeForm.ingredients.filter((_, idx) => idx !== iIdx),
                            })
                          }}
                          className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSubRecipeModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded cursor-pointer"
                >
                  Salvar Pré-preparo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DRAWER: FICHA TÉCNICA DO PRATO ─────────────────────────────────── */}
      {isRecipeDrawerOpen && editingProductRecipe && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsRecipeDrawerOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-[#121316] border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col z-10 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <p className="text-[10px] font-mono uppercase text-zinc-500">Ficha Técnica do Prato</p>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                  {editingProductRecipe.name}
                </h3>
              </div>
              <button onClick={() => setIsRecipeDrawerOpen(false)} className="text-zinc-400 hover:text-zinc-950 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductRecipe} className="flex-1 overflow-y-auto space-y-5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-zinc-500">Ingredientes & Pré-preparos:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (items[0]) {
                        setRecipeIngredients([...recipeIngredients, { type: 'item', id: items[0].id, quantity: 1 }])
                      }
                    }}
                    className="text-xs text-[#D4B316] dark:text-[#F5DC55] font-bold cursor-pointer"
                  >
                    + Insumo
                  </button>
                  {subRecipes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeIngredients([...recipeIngredients, { type: 'sub_recipe', id: subRecipes[0].id, quantity: 1 }])
                      }}
                      className="text-xs text-blue-500 font-bold cursor-pointer"
                    >
                      + Pré-preparo
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {recipeIngredients.map((ing, idx) => {
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {ing.type === 'item' ? 'Insumo' : 'Pré-prep'}
                      </span>

                      <select
                        value={ing.id}
                        onChange={(e) => {
                          const val = e.target.value
                          setRecipeIngredients(
                            recipeIngredients.map((item, i) => (i === idx ? { ...item, id: val } : item))
                          )
                        }}
                        className="flex-1 px-2 py-1 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                      >
                        {ing.type === 'item'
                          ? items.map((it) => (
                              <option key={it.id} value={it.id} className="bg-white dark:bg-zinc-900">
                                {it.name} ({it.base_unit})
                              </option>
                            ))
                          : subRecipes.map((sr) => (
                              <option key={sr.id} value={sr.id} className="bg-white dark:bg-zinc-900">
                                {sr.name} ({sr.yield_unit})
                              </option>
                            ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="0.001"
                          min="0.0001"
                          value={ing.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setRecipeIngredients(
                              recipeIngredients.map((item, i) => (i === idx ? { ...item, quantity: val } : item))
                            )
                          }}
                          className="w-full px-2 py-1 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-center text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
                        className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsRecipeDrawerOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded cursor-pointer"
                >
                  Salvar Ficha Técnica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: FORNECEDOR ──────────────────────────────────────────────── */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-950 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs font-mono">
              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">Nome da Empresa / Fornecedor</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">Contato / Representante</label>
                <input
                  type="text"
                  value={supplierForm.contact_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">WhatsApp para Pedidos</label>
                <input
                  type="text"
                  placeholder="(11) 98888-7777"
                  value={supplierForm.phone_whatsapp}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone_whatsapp: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">Tipo de Fornecedor</label>
                <select
                  value={supplierForm.supplier_type}
                  onChange={(e) => setSupplierForm({ ...supplierForm, supplier_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                >
                  <option value="wholesaler">Atacadista</option>
                  <option value="distributor">Distribuidora</option>
                  <option value="local_market">Feira / Mercado Local</option>
                  <option value="e_commerce">E-commerce / Internet</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded cursor-pointer"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: AGENDA DE COMPRAS ───────────────────────────────────────── */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-[#121316] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                {editingSchedule ? 'Editar Rotina' : 'Nova Rotina de Compras'}
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-zinc-400 hover:text-zinc-950 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3 text-xs font-mono">
              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">Nome da Rotina</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compras Gerais da Semana, Feira Terça/Sexta"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-700 rounded text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] uppercase text-zinc-500">Frequência</label>
                <select
                  value={scheduleForm.frequency_type}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                >
                  <option value="weekly">Semanal</option>
                  <option value="daily">Diária</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                  <option value="on_demand">Sob Demanda (Manual)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs uppercase border border-zinc-300 dark:border-zinc-700 rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-bold text-xs uppercase rounded cursor-pointer"
                >
                  Salvar Rotina
                </button>
              </div>
            </form>
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
                className="px-4 py-2 text-xs font-mono uppercase border border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs font-mono uppercase rounded-lg cursor-pointer"
              >
                {confirmModal.confirmLabel || 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: PLANILHA ÁGIL DE COMPRAS EM LOTE ──────────────────────── */}
      <PurchasingBatchModal
        isOpen={isBatchModalOpen}
        onClose={() => {
          setIsBatchModalOpen(false)
          setSelectedCalendarDay(null)
        }}
        dayData={selectedCalendarDay}
        allItems={items}
        suppliers={suppliers}
        onSuccess={() => {
          loadAllInventoryData()
          setCalendarRefreshTrigger((prev) => prev + 1)
        }}
        showFeedback={showFeedback}
      />

      {/* ─── TOAST FLUTUANTE ─────────────────────────────────────────────────── */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 rounded-xl shadow-2xl border border-zinc-800 dark:border-zinc-200 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${feedbackMessage.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
        <span>doispalitos.tech // {tenant?.name}</span>
        <span>Controle de Estoque, Pré-preparos & CMV</span>
      </footer>

    </div>
  )
}
