import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { RestaurantHeader } from '@/components/RestaurantHeader'
import { DeliveryRadiusMap } from '@/components/DeliveryRadiusMap'
import { LocationPickerMap } from '@/components/LocationPickerMap'
import { TimeInput } from '@/components/TimeInput'
import {
  BRAZILIAN_STATES,
  fetchCitiesByState,
  searchCep,
  geocodeAddress,
} from '@/lib/locationService'
import {
  formatPhone,
  formatDocument,
  formatCpf,
  formatCep,
  formatSlug,
  validateEmail,
  validatePhone,
  validateDocument,
  validateCpf,
  validateCep,
} from '@/lib/maskUtils'
import api from '@/lib/api'
import { 
  Store, 
  Clock, 
  Truck, 
  CreditCard, 
  Check, 
  Loader2, 
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  ChevronDown,
  Building2,
  X,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  User as UserIcon,
  Edit3,
  LocateFixed,
  UtensilsCrossed,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
]

interface NeighborhoodFee {
  name: string
  fee: number
  enabled: boolean
}

// Haversine distance in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export default function RestaurantSettingsPage() {
  const { user, tenant: authTenant } = useAuth()
  const [activeTab, setActiveTab] = useState<'info' | 'delivery' | 'operations'>('info')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Full Tenant Data (Inicia imediatamente com authTenant para fluidez sem atrasos no header)
  const [tenantInfo, setTenantInfo] = useState<any>(authTenant || null)
  const currentTenant = tenantInfo || authTenant

  // Geolocation for Delivery
  const [latitude, setLatitude] = useState<number>((authTenant as any)?.latitude ? Number((authTenant as any).latitude) : -23.55052)
  const [longitude, setLongitude] = useState<number>((authTenant as any)?.longitude ? Number((authTenant as any).longitude) : -46.633308)

  // City Neighborhoods
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<string[]>([])
  const [selectedNeighborhoodToAdd, setSelectedNeighborhoodToAdd] = useState('')
  const [newNeighborhoodFee, setNewNeighborhoodFee] = useState('6.00')
  const [isCustomNeighborhood, setIsCustomNeighborhood] = useState(false)
  const [customNeighborhoodName, setCustomNeighborhoodName] = useState('')

  // Change Request State
  const [latestChangeRequest, setLatestChangeRequest] = useState<any>(null)
  const [dismissedChangeRequestId, setDismissedChangeRequestId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('doispalitos_dismissed_cr_id')
    } catch {
      return null
    }
  })
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'store' | 'address' | 'owner'>('store')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form State for Change Request
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    document: '',
    domain_type: 'subdomain' as 'subdomain' | 'custom_domain',
    slug: '',
    custom_domain: '',
    email: '',
    phone: '',
    postal_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    latitude: null as number | null,
    longitude: null as number | null,
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    owner_document: '',
  })

  // Geolocation & IBGE Cities in Drawer
  const [drawerCities, setDrawerCities] = useState<string[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [isSearchingCep, setIsSearchingCep] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isMapInteractive, setIsMapInteractive] = useState(false)
  const [anchorCoords, setAnchorCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [devicePosition, setDevicePosition] = useState<{ lat: number; lng: number } | null>(null)

  // Settings State (Delivery & Operations)
  const [settings, setSettings] = useState({
    delivery: {
      enabled: false,
      fee_mode: 'fixed_radius' as 'fixed_radius' | 'dynamic_km' | 'custom_neighborhoods',
      max_distance_km: '' as any,
      fixed_fee: '' as any,
      dynamic_base_fee: '' as any,
      dynamic_fee_per_km: '' as any,
      min_order_amount: '' as any,
      neighborhood_fees: [] as NeighborhoodFee[],
    },
    pickup: {
      enabled: false,
    },
    dine_in: {
      enabled: false,
    },
    opening_hours: {
      monday: { open: false, start: '', end: '' },
      tuesday: { open: false, start: '', end: '' },
      wednesday: { open: false, start: '', end: '' },
      thursday: { open: false, start: '', end: '' },
      friday: { open: false, start: '', end: '' },
      saturday: { open: false, start: '', end: '' },
      sunday: { open: false, start: '', end: '' },
    } as Record<string, { open: boolean; start: string; end: string }>,
    payment_methods: {
      pix: false,
      credit_card: false,
      debit_card: false,
      cash: false,
      credit_card_fee_percent: 0,
      debit_card_fee_percent: 0,
    },
  })

  // Load Data
  const loadData = async () => {
    try {
      // 1. Carrega configurações essenciais e solicitações de forma imediata
      const [settingsRes, changeReqRes] = await Promise.all([
        api.get('/restaurant/settings'),
        api.get('/restaurant/change-requests/latest'),
      ])

      const tenant = settingsRes.data.tenant
      if (tenant) {
        setTenantInfo(tenant)
        if (tenant.latitude && tenant.longitude) {
          setLatitude(Number(tenant.latitude))
          setLongitude(Number(tenant.longitude))
        }
      }

      if (settingsRes.data.settings) {
        const s = settingsRes.data.settings
        setSettings((prev) => {
          const rawHours = s.opening_hours || {}
          const mergedHours: Record<string, { open: boolean; start: string; end: string }> = {}
          for (const d of DAYS_OF_WEEK) {
            mergedHours[d.key] = {
              open: Boolean(rawHours[d.key]?.open),
              start: rawHours[d.key]?.start || '',
              end: rawHours[d.key]?.end || '',
            }
          }

          return {
            ...prev,
            ...s,
            delivery: {
              ...prev.delivery,
              ...(s.delivery || {}),
              enabled: Boolean(s.delivery?.enabled),
              fee_mode: s.delivery?.fee_mode || (s.delivery?.fee_type === 'km' ? 'dynamic_km' : 'fixed_radius'),
              max_distance_km: s.delivery?.max_distance_km ?? '',
              fixed_fee: s.delivery?.fixed_fee ?? s.delivery?.base_fee ?? '',
              dynamic_base_fee: s.delivery?.dynamic_base_fee ?? s.delivery?.base_fee ?? '',
              dynamic_fee_per_km: s.delivery?.dynamic_fee_per_km ?? s.delivery?.fee_per_km ?? '',
              min_order_amount: s.delivery?.min_order_amount ?? '',
              neighborhood_fees: s.delivery?.neighborhood_fees || [],
            },
            pickup: {
              enabled: Boolean(s.pickup?.enabled),
            },
            dine_in: {
              enabled: Boolean(s.dine_in?.enabled),
            },
            opening_hours: mergedHours,
            payment_methods: {
              pix: Boolean(s.payment_methods?.pix),
              credit_card: Boolean(s.payment_methods?.credit_card),
              debit_card: Boolean(s.payment_methods?.debit_card),
              cash: Boolean(s.payment_methods?.cash),
              credit_card_fee_percent: s.payment_methods?.credit_card_fee_percent ?? 0,
              debit_card_fee_percent: s.payment_methods?.debit_card_fee_percent ?? 0,
            },
          }
        })
      }

      if (changeReqRes.data.change_request) {
        setLatestChangeRequest(changeReqRes.data.change_request)
      }

      // 2. Busca bairros da cidade em segundo plano sem travar a interface
      api.get('/restaurant/neighborhoods')
        .then((neighRes) => {
          if (neighRes.data.neighborhoods) {
            const list: string[] = neighRes.data.neighborhoods || []
            setAvailableNeighborhoods(list)
            const currentFees = settingsRes.data.settings?.delivery?.neighborhood_fees || []
            const firstAvailable = list.find(
              (n: string) => !currentFees.some((f: any) => f.name?.trim().toLowerCase() === n.trim().toLowerCase())
            )
            setSelectedNeighborhoodToAdd(firstAvailable || list[0] || '')
          }
        })
        .catch(() => {
          // Mantém catálogo padrão silenciosamente
        })
    } catch (err) {
      console.error('Erro ao carregar dados operacionais:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isDrawerOpen])

  // Device Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDevicePosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
        },
        (err) => console.log('Geolocalização não autorizada:', err.message),
        { enableHighAccuracy: true, timeout: 6000 }
      )
    }
  }, [])

  // Cities by State in Drawer
  useEffect(() => {
    if (!formData.state) {
      setDrawerCities([])
      return
    }
    setIsLoadingCities(true)
    fetchCitiesByState(formData.state)
      .then((cities) => {
        setDrawerCities(cities)
      })
      .finally(() => setIsLoadingCities(false))
  }, [formData.state])

  // Open Drawer populated with current data
  const handleOpenDrawer = () => {
    if (!tenantInfo) return

    setFormData({
      name: tenantInfo.name || '',
      legal_name: tenantInfo.legal_name || '',
      document: formatDocument(tenantInfo.document || ''),
      domain_type: tenantInfo.custom_domain ? 'custom_domain' : 'subdomain',
      slug: tenantInfo.slug || '',
      custom_domain: tenantInfo.custom_domain || '',
      email: tenantInfo.email || '',
      phone: formatPhone(tenantInfo.phone || ''),
      postal_code: formatCep(tenantInfo.postal_code || ''),
      street: tenantInfo.street || '',
      number: tenantInfo.number || '',
      complement: tenantInfo.complement || '',
      neighborhood: tenantInfo.neighborhood || '',
      city: tenantInfo.city || '',
      state: tenantInfo.state || '',
      latitude: tenantInfo.latitude || null,
      longitude: tenantInfo.longitude || null,
      owner_name: tenantInfo.owner?.name || user?.name || '',
      owner_email: tenantInfo.owner?.email || user?.email || '',
      owner_phone: formatPhone(tenantInfo.owner?.phone || ''),
      owner_document: formatCpf(tenantInfo.owner?.document || ''),
    })

    if (tenantInfo.latitude && tenantInfo.longitude) {
      setAnchorCoords({ lat: tenantInfo.latitude, lng: tenantInfo.longitude })
      setIsMapInteractive(true)
    } else {
      setIsMapInteractive(false)
      setAnchorCoords(null)
    }

    setDrawerTab('store')
    setDrawerError(null)
    setFieldErrors({})
    setIsDrawerOpen(true)
  }

  // Field validation onBlur
  const handleBlurField = (field: string) => {
    const errors = { ...fieldErrors }

    if (field === 'name') {
      if (!formData.name.trim()) errors.name = 'Nome da loja é obrigatório.'
      else delete errors.name
    } else if (field === 'slug' && formData.domain_type === 'subdomain') {
      if (!formData.slug.trim()) errors.slug = 'Subdomínio é obrigatório.'
      else delete errors.slug
    } else if (field === 'custom_domain' && formData.domain_type === 'custom_domain') {
      if (!formData.custom_domain.trim()) errors.custom_domain = 'Domínio customizado é obrigatório.'
      else delete errors.custom_domain
    } else if (field === 'email' && formData.email) {
      if (!validateEmail(formData.email)) errors.email = 'E-mail comercial inválido.'
      else delete errors.email
    } else if (field === 'phone' && formData.phone) {
      if (!validatePhone(formData.phone)) errors.phone = 'Telefone incompleto. Digite DDD + número.'
      else delete errors.phone
    } else if (field === 'document' && formData.document) {
      if (!validateDocument(formData.document)) errors.document = 'Documento incompleto (11 dígitos para CPF ou 14 para CNPJ).'
      else delete errors.document
    } else if (field === 'postal_code' && formData.postal_code) {
      if (!validateCep(formData.postal_code)) errors.postal_code = 'CEP incompleto (deve ter 8 dígitos).'
      else delete errors.postal_code
    } else if (field === 'owner_name') {
      if (!formData.owner_name.trim()) errors.owner_name = 'Nome do gestor é obrigatório.'
      else delete errors.owner_name
    } else if (field === 'owner_email') {
      if (!formData.owner_email.trim() || !validateEmail(formData.owner_email)) errors.owner_email = 'E-mail do gestor inválido.'
      else delete errors.owner_email
    } else if (field === 'owner_phone' && formData.owner_phone) {
      if (!validatePhone(formData.owner_phone)) errors.owner_phone = 'Telefone do gestor incompleto.'
      else delete errors.owner_phone
    } else if (field === 'owner_document' && formData.owner_document) {
      if (!validateCpf(formData.owner_document)) errors.owner_document = 'CPF do gestor incompleto (11 dígitos).'
      else delete errors.owner_document
    }

    setFieldErrors(errors)
  }

  // Automatic CEP Search
  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val)
    setFormData((prev) => ({ ...prev, postal_code: formatted }))
    if (fieldErrors.postal_code) {
      setFieldErrors((prev) => ({ ...prev, postal_code: '' }))
    }

    const clean = formatted.replace(/\D/g, '')
    if (clean.length === 8) {
      setIsSearchingCep(true)
      try {
        const res = await searchCep(clean)
        if (res) {
          setFormData((prev) => ({
            ...prev,
            street: res.street || prev.street,
            neighborhood: res.neighborhood || prev.neighborhood,
            city: res.city || prev.city,
            state: res.state || prev.state,
          }))
          if (res.state) {
            const cities = await fetchCitiesByState(res.state)
            setDrawerCities(cities)
          }
        }
      } catch (err) {
        console.error('Erro na busca de CEP:', err)
      } finally {
        setIsSearchingCep(false)
      }
    }
  }

  // Acquire Geolocation
  const handleAcquireLocation = async () => {
    if (!formData.state || !formData.city || !formData.street || !formData.number || !formData.neighborhood) {
      setDrawerError('Preencha CEP, Estado, Cidade, Logradouro, Número e Bairro antes de adquirir a geolocalização.')
      return
    }

    setIsGeocoding(true)
    setDrawerError(null)

    try {
      const geo = await geocodeAddress({
        street: formData.street,
        number: formData.number,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
      })

      if (geo) {
        setFormData((prev) => ({
          ...prev,
          latitude: geo.lat,
          longitude: geo.lng,
        }))
        setAnchorCoords({ lat: geo.lat, lng: geo.lng })
        setIsMapInteractive(true)
      } else {
        setDrawerError('Não foi possível obter coordenadas precisas para este endereço. Verifique os dados digitados.')
      }
    } catch (err) {
      console.error('Erro ao geocodificar:', err)
      setDrawerError('Falha ao comunicar com o serviço de mapas.')
    } finally {
      setIsGeocoding(false)
    }
  }

  // Map pin fine-tuning with 3.5km lock
  const handleLocationChange = (lat: number, lng: number) => {
    if (anchorCoords) {
      const distance = getHaversineDistance(anchorCoords.lat, anchorCoords.lng, lat, lng)
      if (distance > 3500) {
        setDrawerError('O pino não pode ser movido para fora do perímetro do estabelecimento (máximo 3.5 km).')
        return
      }
    }
    setDrawerError(null)
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
  }

  // Submit Change Request
  const handleSubmitChangeRequest = async (e: FormEvent) => {
    e.preventDefault()
    setDrawerError(null)

    // Validations
    if (!formData.name.trim()) {
      setDrawerError('Nome da loja é obrigatório.')
      setDrawerTab('store')
      return
    }
    if (formData.domain_type === 'subdomain' && !formData.slug.trim()) {
      setDrawerError('Subdomínio é obrigatório.')
      setDrawerTab('store')
      return
    }
    if (formData.domain_type === 'custom_domain' && !formData.custom_domain.trim()) {
      setDrawerError('Domínio customizado é obrigatório.')
      setDrawerTab('store')
      return
    }
    if (!formData.owner_name.trim() || !formData.owner_email.trim()) {
      setDrawerError('Nome e e-mail do gestor são obrigatórios.')
      setDrawerTab('owner')
      return
    }

    setIsSubmittingRequest(true)

    try {
      const res = await api.post('/restaurant/change-requests', formData)
      setLatestChangeRequest(res.data.change_request)
      setSuccess('Solicitação de alteração cadastral enviada com sucesso! Ela será analisada pela administração.')
      setIsDrawerOpen(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setDrawerError(axiosErr.response?.data?.message || 'Erro ao enviar solicitação de alteração.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  // Neighborhoods management in Tab 2
  const handleAddNeighborhood = async () => {
    const nameToAdd = isCustomNeighborhood
      ? customNeighborhoodName.trim()
      : selectedNeighborhoodToAdd.trim()

    if (!nameToAdd) return
    if (settings.delivery.neighborhood_fees.some((n) => n.name.trim().toLowerCase() === nameToAdd.toLowerCase())) {
      return
    }

    const feeNum = parseFloat(newNeighborhoodFee) || 0

    // Geocodificação automática das coordenadas do centro do bairro
    let lat: number | undefined = undefined
    let lng: number | undefined = undefined
    try {
      const coords = await geocodeAddress({
        neighborhood: nameToAdd,
        city: tenantInfo?.city || '',
        state: tenantInfo?.state || '',
      })
      if (coords) {
        lat = coords.lat
        lng = coords.lng
      }
    } catch {
      // continua sem travar a interface
    }

    const updatedFees = [
      ...settings.delivery.neighborhood_fees,
      { name: nameToAdd, fee: feeNum, enabled: true, latitude: lat, longitude: lng },
    ]

    setSettings((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        neighborhood_fees: updatedFees,
      },
    }))

    if (isCustomNeighborhood) {
      setCustomNeighborhoodName('')
      setIsCustomNeighborhood(false)
    }

    // Set next available suggested neighborhood
    const nextAvailable = availableNeighborhoods.filter(
      (n) => !updatedFees.some((f) => f.name.trim().toLowerCase() === n.trim().toLowerCase())
    )
    setSelectedNeighborhoodToAdd(nextAvailable[0] || '')
  }

  const handleRemoveNeighborhood = (index: number) => {
    const removedItem = settings.delivery.neighborhood_fees[index]
    const updatedFees = settings.delivery.neighborhood_fees.filter((_, i) => i !== index)
    setSettings((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        neighborhood_fees: updatedFees,
      },
    }))

    if (removedItem && availableNeighborhoods.includes(removedItem.name)) {
      setSelectedNeighborhoodToAdd(removedItem.name)
    }
  }

  const handleToggleNeighborhood = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        neighborhood_fees: prev.delivery.neighborhood_fees.map((n, i) =>
          i === index ? { ...n, enabled: !n.enabled } : n
        ),
      },
    }))
  }

  const handleUpdateNeighborhoodFee = (index: number, val: any) => {
    setSettings((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        neighborhood_fees: prev.delivery.neighborhood_fees.map((n, i) =>
          i === index ? { ...n, fee: val } : n
        ),
      },
    }))
  }

  const handleDismissBanner = () => {
    if (latestChangeRequest?.id) {
      setDismissedChangeRequestId(latestChangeRequest.id)
      try {
        localStorage.setItem('doispalitos_dismissed_cr_id', latestChangeRequest.id)
      } catch {
        // Fallback
      }
    }
  }

  const handleSubmitSettings = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    // Sanitização segura de valores numéricos
    const sanitizedDelivery = {
      ...settings.delivery,
      max_distance_km: settings.delivery.max_distance_km !== '' && settings.delivery.max_distance_km !== null ? Number(settings.delivery.max_distance_km) : null,
      fixed_fee: settings.delivery.fixed_fee !== '' && settings.delivery.fixed_fee !== null ? Number(settings.delivery.fixed_fee) : null,
      dynamic_base_fee: settings.delivery.dynamic_base_fee !== '' && settings.delivery.dynamic_base_fee !== null ? Number(settings.delivery.dynamic_base_fee) : null,
      dynamic_fee_per_km: settings.delivery.dynamic_fee_per_km !== '' && settings.delivery.dynamic_fee_per_km !== null ? Number(settings.delivery.dynamic_fee_per_km) : null,
      min_order_amount: settings.delivery.min_order_amount !== '' && settings.delivery.min_order_amount !== null ? Number(settings.delivery.min_order_amount) : null,
      neighborhood_fees: (settings.delivery.neighborhood_fees || []).map((n: any) => ({
        ...n,
        fee: Number(n.fee) || 0,
      })),
    }

    const payload = {
      settings: {
        ...settings,
        delivery: sanitizedDelivery,
      },
      latitude,
      longitude,
    }

    try {
      await api.put('/restaurant/settings', payload)
      setSettings(payload.settings)
      setSuccess('Configurações operacionais salvas com sucesso!')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || 'Erro ao salvar configurações.')
    } finally {
      setIsSaving(false)
    }
  }

  const isAddressComplete =
    Boolean(formData.state) &&
    Boolean(formData.city) &&
    Boolean(formData.street) &&
    Boolean(formData.number) &&
    Boolean(formData.neighborhood)

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-[#F5DC55] selection:text-zinc-950">

      {/* Header Unificado */}
      <RestaurantHeader activeTab="settings" />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 sm:px-12 py-10 space-y-8">
        
        {/* Title Bar */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <div>
            <Link to="/store/dashboard" className="text-xs font-mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao painel da loja</span>
            </Link>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
              Configurações da Loja
            </h1>
          </div>

          {activeTab !== 'info' && (
            <button
              type="button"
              onClick={handleSubmitSettings}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer self-start sm:self-auto"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <Check className="w-4 h-4 text-zinc-950" />
              )}
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          )}
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="py-2.5 px-3 border-l-2 border-red-500 text-xs font-mono text-red-600 dark:text-red-400 bg-red-500/5 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-700 cursor-pointer p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="py-2.5 px-3 border-l-2 border-emerald-500 text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 flex items-center justify-between">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-700 cursor-pointer p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editorial 3 Tabs */}
        <div className="flex items-center gap-8 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`cursor-pointer transition-colors pb-1 flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>01 / Dados do Restaurante</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('delivery')}
            className={`cursor-pointer transition-colors pb-1 flex items-center gap-1.5 ${
              activeTab === 'delivery'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>02 / Entrega & Retirada</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={`cursor-pointer transition-colors pb-1 flex items-center gap-1.5 ${
              activeTab === 'operations'
                ? 'text-zinc-950 dark:text-zinc-50 font-bold border-b-2 border-[#F5DC55]'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>03 / Horários & Pagamentos</span>
          </button>
        </div>

        <div>
          {/* ─── ABA 01: DADOS DO RESTAURANTE (CADASTRO OFICIAL) ───────────── */}
          {activeTab === 'info' && currentTenant && (
            <div className="space-y-8">
                
                {/* Banner de Status da Solicitação Mais Recente (Fechável) */}
                {latestChangeRequest && latestChangeRequest.id !== dismissedChangeRequestId && (
                  <div>
                    {latestChangeRequest.status === 'pending' && (
                      <div className="p-4 bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-300 dark:border-zinc-800 rounded-lg flex items-start justify-between gap-3 text-xs font-mono text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55] shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm text-zinc-950 dark:text-zinc-50">Solicitação de Alteração Cadastral em Análise</p>
                            <p className="text-zinc-600 dark:text-zinc-400">
                              Enviada em{' '}
                              <span className="font-semibold">{new Date(latestChangeRequest.created_at).toLocaleString('pt-BR')}</span>{' '}
                              • Aguardando revisão pela administração.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDismissBanner}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                          title="Fechar aviso"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {latestChangeRequest.status === 'approved' && (
                      <div className="p-4 bg-zinc-100 dark:bg-zinc-900/60 border border-emerald-500/30 rounded-lg flex items-start justify-between gap-3 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm">Última Solicitação Aprovada</p>
                            <p className="text-zinc-600 dark:text-zinc-400">
                              Aprovada em{' '}
                              <span className="font-semibold">{new Date(latestChangeRequest.reviewed_at || latestChangeRequest.updated_at).toLocaleString('pt-BR')}</span>.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDismissBanner}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                          title="Fechar aviso"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {latestChangeRequest.status === 'rejected' && (
                      <div className="p-4 bg-zinc-100 dark:bg-zinc-900/60 border border-red-500/30 rounded-lg flex items-start justify-between gap-3 text-xs font-mono text-red-800 dark:text-red-300">
                        <div className="flex items-start gap-3">
                          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm">Solicitação Recusada pela Administração</p>
                            <p className="text-zinc-600 dark:text-zinc-400">
                              Motivo informado: <span className="font-medium text-zinc-950 dark:text-zinc-100">{latestChangeRequest.admin_notes || 'Dados divergentes.'}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDismissBanner}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                          title="Fechar aviso"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {latestChangeRequest.status === 'edited_and_approved' && (
                      <div className="p-4 bg-zinc-100 dark:bg-zinc-900/60 border border-blue-500/30 rounded-lg flex items-start justify-between gap-3 text-xs font-mono text-blue-800 dark:text-blue-300">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm">Solicitação Aprovada com Ajustes</p>
                            <p className="text-zinc-600 dark:text-zinc-400">
                              Aprovada com pequenos ajustes em{' '}
                              <span className="font-semibold">{new Date(latestChangeRequest.reviewed_at || latestChangeRequest.updated_at).toLocaleString('pt-BR')}</span>.
                              {latestChangeRequest.admin_notes && (
                                <span className="block mt-0.5">Notas: {latestChangeRequest.admin_notes}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleDismissBanner}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                          title="Fechar aviso"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Header da Seção com Botão Amarelo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                      Registro Cadastral Oficial
                    </h3>
                    <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Informações verificadas pela administração da plataforma.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenDrawer}
                    disabled={latestChangeRequest?.status === 'pending'}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 text-zinc-950 font-bold font-mono text-xs uppercase rounded-lg transition-all cursor-pointer self-start sm:self-auto"
                    title={latestChangeRequest?.status === 'pending' ? 'Você já possui uma solicitação pendente de análise.' : 'Solicitar alteração de dados cadastrais'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Solicitar Alteração Cadastral</span>
                  </button>
                </div>

                {/* Cards Estruturados de Registro Oficial */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Bloco 1: Estabelecimento & Endereço Web */}
                  <div className="p-5 bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4 shadow-2xs">
                    <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                      <Building2 className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                      <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                        Estabelecimento & Domínio
                      </h4>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="font-mono text-zinc-400 block text-[11px] uppercase">Nome Fantasia</span>
                        <span className="font-medium text-sm text-zinc-950 dark:text-zinc-50">{currentTenant.name}</span>
                      </div>

                      {currentTenant.legal_name && (
                        <div>
                          <span className="font-mono text-zinc-400 block text-[11px] uppercase">Razão Social</span>
                          <span className="text-zinc-900 dark:text-zinc-100">{currentTenant.legal_name}</span>
                        </div>
                      )}

                      {currentTenant.document && (
                        <div>
                          <span className="font-mono text-zinc-400 block text-[11px] uppercase">CNPJ / CPF</span>
                          <span className="font-mono text-zinc-900 dark:text-zinc-100">{currentTenant.document}</span>
                        </div>
                      )}

                      {/* Linha Única de Domínio */}
                      <div>
                        <span className="font-mono text-zinc-400 block text-[11px] uppercase">
                          {currentTenant.custom_domain ? 'Domínio Próprio' : 'Endereço Web'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {currentTenant.custom_domain || currentTenant.subdomain}
                          </span>
                          <a
                            href={`http://${currentTenant.custom_domain || currentTenant.subdomain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                            title="Abrir cardápio online"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div>
                          <span className="font-mono text-zinc-400 block text-[10px] uppercase">E-mail</span>
                          <span className="text-zinc-900 dark:text-zinc-100 truncate block">{currentTenant.email || 'Não informado'}</span>
                        </div>
                        <div>
                          <span className="font-mono text-zinc-400 block text-[10px] uppercase">Telefone</span>
                          <span className="font-mono text-zinc-900 dark:text-zinc-100 block">{currentTenant.phone || 'Não informado'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Endereço & Gestor */}
                  <div className="space-y-6">
                    
                    {/* Endereço */}
                    <div className="p-5 bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                        <MapPin className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                          Endereço Cadastrado
                        </h4>
                      </div>

                      <div className="space-y-1 text-xs">
                        <p className="font-medium text-zinc-950 dark:text-zinc-50">
                          {currentTenant.street ? `${currentTenant.street}, ${currentTenant.number || 'S/N'}${currentTenant.complement ? ` - ${currentTenant.complement}` : ''}` : 'Endereço não preenchido'}
                        </p>
                        <p className="text-zinc-500 font-mono text-[11px]">
                          {currentTenant.neighborhood ? `${currentTenant.neighborhood} — ` : ''}{currentTenant.city}/{currentTenant.state}
                        </p>
                        {currentTenant.postal_code && (
                          <p className="text-zinc-400 font-mono text-[11px]">
                            CEP: {currentTenant.postal_code}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Gestor Principal */}
                    <div className="p-5 bg-white dark:bg-[#16171B] border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 shadow-2xs">
                      <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                        <UserIcon className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
                          Gestor Principal
                        </h4>
                      </div>

                      <div className="space-y-1 text-xs">
                        <p className="font-medium text-zinc-950 dark:text-zinc-50">
                          {currentTenant.owner?.name || user?.name}
                        </p>
                        <p className="text-zinc-500 font-mono text-[11px]">
                          {currentTenant.owner?.email || user?.email}
                          {currentTenant.owner?.phone ? ` • ${currentTenant.owner.phone}` : ''}
                        </p>
                        {currentTenant.owner?.document && (
                          <p className="text-zinc-400 font-mono text-[11px]">
                            CPF: {currentTenant.owner.document}
                          </p>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* ─── ABA 02: ENTREGA & RETIRADA ────────────────────────────────── */}
            {activeTab === 'delivery' && (
              <div className="space-y-8">
                
                {/* 1. Modalidades de Atendimento (Delivery & Retirada no Balcão Juntas) */}
                <div className="space-y-4">
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                      Modalidades de Atendimento Online
                    </h3>
                    <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Defina quais modalidades de pedido estarão disponíveis para os clientes no cardápio online.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Opção: Entrega em Domicílio */}
                    <div className={`p-4 border rounded-lg transition-all flex items-start justify-between gap-4 ${
                      settings.delivery.enabled
                        ? 'border-[#F5DC55]/80 bg-[#F5DC55]/5'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 opacity-75'
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                          <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                            Entrega em Domicílio (Delivery)
                          </span>
                        </div>
                        <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Clientes recebem seus pedidos no endereço via entregador com cálculo de taxa de entrega.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.delivery.enabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            delivery: {
                              ...settings.delivery,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-[#F5DC55] cursor-pointer mt-1"
                      />
                    </div>

                    {/* Opção: Retirada no Balcão */}
                    <div className={`p-4 border rounded-lg transition-all flex items-start justify-between gap-4 ${
                      settings.pickup.enabled
                        ? 'border-[#F5DC55]/80 bg-[#F5DC55]/5'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 opacity-75'
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                          <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                            Retirada no Balcão (Takeaway)
                          </span>
                        </div>
                        <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Clientes fazem o pedido pelo cardápio e retiram diretamente no restaurante sem taxa.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.pickup.enabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            pickup: {
                              ...settings.pickup,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-[#F5DC55] cursor-pointer mt-1"
                      />
                    </div>

                    {/* Opção: Consumo no Salão / Mesas */}
                    <div className={`p-4 border rounded-lg transition-all flex items-start justify-between gap-4 ${
                      settings.dine_in?.enabled
                        ? 'border-[#F5DC55]/80 bg-[#F5DC55]/5'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 opacity-75'
                    }`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                          <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                            Consumo no Salão / Mesas
                          </span>
                        </div>
                        <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Atendimento presencial no salão com comanda por mesa ou balcão.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.dine_in?.enabled)}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dine_in: {
                              ...settings.dine_in,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-[#F5DC55] cursor-pointer mt-1"
                      />
                    </div>

                  </div>
                </div>

                {/* Se Delivery estiver desativado */}
                {!settings.delivery.enabled && (
                  <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg text-center text-xs font-mono text-zinc-500">
                    A entrega em domicílio está desativada. No cardápio online, os clientes só poderão escolher retirada no balcão.
                  </div>
                )}

                {/* 2. Configurações de Taxa e Raio de Delivery (Quando ativo) */}
                {settings.delivery.enabled && (
                  <div className="space-y-6 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    
                    <div className="space-y-3">
                      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500">
                        Modelo de Cobrança de Entrega
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        
                        {/* Opção 1: Taxa Fixa por Raio */}
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              delivery: { ...settings.delivery, fee_mode: 'fixed_radius' },
                            })
                          }
                          className={`p-4 border text-left rounded-lg transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                            settings.delivery.fee_mode === 'fixed_radius'
                              ? 'border-[#F5DC55] bg-[#F5DC55]/5 text-zinc-950 dark:text-zinc-50'
                              : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-semibold block text-zinc-950 dark:text-zinc-100">
                              1. Taxa Fixa por Raio
                            </span>
                            <p className="text-[11px] font-light leading-relaxed">
                              Valor fixo único para qualquer entrega dentro do raio em km.
                            </p>
                          </div>
                          <span className="text-[10px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55]">
                            {settings.delivery.fee_mode === 'fixed_radius' ? 'Selecionado' : 'Selecionar'}
                          </span>
                        </button>

                        {/* Opção 2: Taxa Dinâmica por Km */}
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              delivery: { ...settings.delivery, fee_mode: 'dynamic_km' },
                            })
                          }
                          className={`p-4 border text-left rounded-lg transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                            settings.delivery.fee_mode === 'dynamic_km'
                              ? 'border-[#F5DC55] bg-[#F5DC55]/5 text-zinc-950 dark:text-zinc-50'
                              : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-semibold block text-zinc-950 dark:text-zinc-100">
                              2. Taxa Dinâmica por Km
                            </span>
                            <p className="text-[11px] font-light leading-relaxed">
                              Taxa base de saída + valor adicional por cada quilômetro rodado.
                            </p>
                          </div>
                          <span className="text-[10px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55]">
                            {settings.delivery.fee_mode === 'dynamic_km' ? 'Selecionado' : 'Selecionar'}
                          </span>
                        </button>

                        {/* Opção 3: Taxa por Bairro */}
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              delivery: { ...settings.delivery, fee_mode: 'custom_neighborhoods' },
                            })
                          }
                          className={`p-4 border text-left rounded-lg transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                            settings.delivery.fee_mode === 'custom_neighborhoods'
                              ? 'border-[#F5DC55] bg-[#F5DC55]/5 text-zinc-950 dark:text-zinc-50'
                              : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-semibold block text-zinc-950 dark:text-zinc-100">
                              3. Taxa por Bairro
                            </span>
                            <p className="text-[11px] font-light leading-relaxed">
                              Selecione os bairros da sua cidade e defina a taxa fixa de cada um.
                            </p>
                          </div>
                          <span className="text-[10px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55]">
                            {settings.delivery.fee_mode === 'custom_neighborhoods' ? 'Selecionado' : 'Selecionar'}
                          </span>
                        </button>

                      </div>
                    </div>

                    {/* Parâmetros da Opção 1: Taxa Fixa por Raio */}
                    {settings.delivery.fee_mode === 'fixed_radius' && (
                      <div className="p-4 bg-zinc-100/40 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                        <h4 className="text-xs font-mono uppercase text-zinc-500">
                          Parâmetros da Taxa Fixa por Raio
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Raio Máximo de Atendimento (km)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="100"
                              value={settings.delivery.max_distance_km ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    max_distance_km: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    max_distance_km: isNaN(val) || val <= 0 ? 1 : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Valor da Taxa Fixa (R$)
                            </label>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={settings.delivery.fixed_fee ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    fixed_fee: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                  setSettings({
                                    ...settings,
                                    delivery: { ...settings.delivery, fixed_fee: '' },
                                  })
                                  return
                                }
                                const val = parseFloat(raw)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    fixed_fee: isNaN(val) || val < 0 ? '' : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Pedido Mínimo (R$)
                            </label>
                            <input
                              type="number"
                              step="1.00"
                              min="0"
                              value={settings.delivery.min_order_amount ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    min_order_amount: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                  setSettings({
                                    ...settings,
                                    delivery: { ...settings.delivery, min_order_amount: '' },
                                  })
                                  return
                                }
                                const val = parseFloat(raw)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    min_order_amount: isNaN(val) || val < 0 ? '' : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Parâmetros da Opção 2: Taxa Dinâmica por Km */}
                    {settings.delivery.fee_mode === 'dynamic_km' && (
                      <div className="p-4 bg-zinc-100/40 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-4">
                        <h4 className="text-xs font-mono uppercase text-zinc-500">
                          Parâmetros da Taxa Dinâmica por Quilômetro
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Raio Máximo (km)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="100"
                              value={settings.delivery.max_distance_km ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    max_distance_km: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                  setSettings({
                                    ...settings,
                                    delivery: { ...settings.delivery, max_distance_km: '' },
                                  })
                                  return
                                }
                                const val = parseFloat(raw)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    max_distance_km: isNaN(val) || val <= 0 ? '' : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Taxa Base de Saída (R$)
                            </label>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={settings.delivery.dynamic_base_fee ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    dynamic_base_fee: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                  setSettings({
                                    ...settings,
                                    delivery: { ...settings.delivery, dynamic_base_fee: '' },
                                  })
                                  return
                                }
                                const val = parseFloat(raw)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    dynamic_base_fee: isNaN(val) || val < 0 ? '' : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Valor por Km Rodado (R$/km)
                            </label>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={settings.delivery.dynamic_fee_per_km ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    dynamic_fee_per_km: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                  setSettings({
                                    ...settings,
                                    delivery: { ...settings.delivery, dynamic_fee_per_km: '' },
                                  })
                                  return
                                }
                                const val = parseFloat(raw)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    dynamic_fee_per_km: isNaN(val) || val < 0 ? '' : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-zinc-500">
                              Pedido Mínimo (R$)
                            </label>
                            <input
                              type="number"
                              step="1.00"
                              min="0"
                              value={settings.delivery.min_order_amount ?? ''}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    min_order_amount: e.target.value as any,
                                  },
                                })
                              }
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                setSettings({
                                  ...settings,
                                  delivery: {
                                    ...settings.delivery,
                                    min_order_amount: isNaN(val) || val < 0 ? 0 : val,
                                  },
                                })
                              }}
                              className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Parâmetros da Opção 3: Taxa por Bairro */}
                    {settings.delivery.fee_mode === 'custom_neighborhoods' && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                          <div>
                            <h4 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                              Bairros Atendidos em {currentTenant?.city || 'sua cidade'}
                            </h4>
                            <p className="text-xs font-light text-zinc-500 dark:text-zinc-400">
                              Selecione os bairros da sua cidade e estipule o valor fixo da taxa de entrega para cada um.
                            </p>
                          </div>
                        </div>

                        {/* Bloco de Adição de Bairros */}
                        <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono uppercase text-zinc-500 font-semibold">
                              Adicionar Bairro ao Atendimento
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomNeighborhood(!isCustomNeighborhood)
                                setCustomNeighborhoodName('')
                              }}
                              className="text-xs font-mono text-[#D4B316] dark:text-[#F5DC55] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              {isCustomNeighborhood ? 'Escolher da lista sugerida' : 'Digitar outro bairro manualmente'}
                            </button>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            {isCustomNeighborhood ? (
                              <div className="w-full sm:flex-1">
                                <input
                                  type="text"
                                  value={customNeighborhoodName}
                                  onChange={(e) => setCustomNeighborhoodName(e.target.value)}
                                  placeholder="Digite o nome do novo bairro..."
                                  className="w-full px-3.5 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                />
                              </div>
                            ) : (
                              <div className="relative w-full sm:flex-1">
                                {(() => {
                                  const availableToAdd = availableNeighborhoods.filter(
                                    (n) => !settings.delivery.neighborhood_fees.some((item) => item.name.trim().toLowerCase() === n.trim().toLowerCase())
                                  )
                                  return (
                                    <>
                                      <select
                                        value={selectedNeighborhoodToAdd}
                                        onChange={(e) => setSelectedNeighborhoodToAdd(e.target.value)}
                                        disabled={availableToAdd.length === 0}
                                        className="w-full pl-3.5 pr-10 py-2.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none appearance-none cursor-pointer disabled:opacity-50"
                                      >
                                        {availableToAdd.length === 0 ? (
                                          <option value="" className="dark:bg-zinc-900">
                                            Todos os bairros sugeridos já foram adicionados
                                          </option>
                                        ) : (
                                          availableToAdd.map((n) => (
                                            <option key={n} value={n} className="dark:bg-zinc-900">
                                              {n}
                                            </option>
                                          ))
                                        )}
                                      </select>
                                      <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </>
                                  )
                                })()}
                              </div>
                            )}

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="flex items-center">
                                <span className="px-2.5 py-2 bg-zinc-200 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-800 rounded-l text-xs font-mono text-zinc-500">
                                  R$
                                </span>
                                <input
                                  type="number"
                                  step="0.50"
                                  min="0"
                                  placeholder="6.00"
                                  value={newNeighborhoodFee}
                                  onChange={(e) => setNewNeighborhoodFee(e.target.value)}
                                  className="w-24 px-2.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-r text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleAddNeighborhood}
                                disabled={
                                  isCustomNeighborhood
                                    ? !customNeighborhoodName.trim()
                                    : !selectedNeighborhoodToAdd ||
                                      !availableNeighborhoods.some(
                                        (n) =>
                                          n.toLowerCase() === selectedNeighborhoodToAdd.toLowerCase() &&
                                          !settings.delivery.neighborhood_fees.some((item) => item.name.toLowerCase() === n.toLowerCase())
                                      )
                                }
                                className="px-4 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-semibold text-xs uppercase rounded transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Adicionar Bairro</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Tabela de Bairros Selecionados */}
                        <div className="border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
                          <div className="p-3 grid grid-cols-12 text-[11px] font-mono uppercase tracking-wider text-zinc-400 bg-zinc-100/30 dark:bg-zinc-900/20">
                            <span className="col-span-6">Bairro</span>
                            <span className="col-span-3">Taxa de Entrega (R$)</span>
                            <span className="col-span-2 text-center">Atendimento</span>
                            <span className="col-span-1 text-right">Ação</span>
                          </div>

                          {settings.delivery.neighborhood_fees.length === 0 ? (
                            <div className="p-6 text-center text-xs font-mono text-zinc-400">
                              Nenhum bairro selecionado. Adicione os bairros acima para aceitar pedidos.
                            </div>
                          ) : (
                            settings.delivery.neighborhood_fees.map((n, idx) => (
                              <div key={idx} className="p-3 grid grid-cols-12 items-center text-sm">
                                <div className="col-span-6 min-w-0 pr-2">
                                  <span className={`font-medium ${n.enabled ? 'text-zinc-950 dark:text-zinc-50' : 'text-zinc-400 line-through'}`}>
                                    {n.name}
                                  </span>
                                </div>

                                <div className="col-span-3 min-w-0 pr-2">
                                  <div className="flex items-center max-w-[110px]">
                                    <span className="text-xs font-mono text-zinc-400 mr-1">R$</span>
                                    <input
                                      type="number"
                                      step="0.50"
                                      min="0"
                                      value={n.fee ?? ''}
                                      onChange={(e) => handleUpdateNeighborhoodFee(idx, e.target.value)}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value)
                                        handleUpdateNeighborhoodFee(idx, isNaN(val) || val < 0 ? 0 : val)
                                      }}
                                      className="w-full px-2 py-1 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="col-span-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleNeighborhood(idx)}
                                    className={`text-[11px] font-mono px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                      n.enabled
                                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                                        : 'text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800'
                                    }`}
                                  >
                                    {n.enabled ? 'Ativo' : 'Pausado'}
                                  </button>
                                </div>

                                <div className="col-span-1 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveNeighborhood(idx)}
                                    className="text-zinc-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                                    title="Remover Bairro"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mapa Interativo */}
                    <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55]" />
                          <span>Localização da Loja {settings.delivery.fee_mode !== 'custom_neighborhoods' ? '& Raio Máximo' : ''}</span>
                        </h4>
                        <span className="text-xs font-mono text-zinc-400">
                          {currentTenant?.city}/{currentTenant?.state}
                        </span>
                      </div>

                      <DeliveryRadiusMap
                        latitude={latitude}
                        longitude={longitude}
                        radiusKm={Number(settings.delivery.max_distance_km) || 1}
                        showRadiusCircle={settings.delivery.fee_mode !== 'custom_neighborhoods'}
                        className="h-[320px]"
                      />
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* ─── ABA 03: HORÁRIOS & PAGAMENTOS ─────────────────────────────── */}
            {activeTab === 'operations' && (
              <div className="space-y-8">
                
                {/* Horários */}
                <div className="space-y-4">
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                      Grade Semanal de Abertura
                    </h3>
                    <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Os pedidos no site só serão aceitos dentro dos horários estipulados.
                    </p>
                  </div>

                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                    {DAYS_OF_WEEK.map((d) => {
                      const dayData = settings.opening_hours[d.key] || {
                        open: false,
                        start: '',
                        end: '',
                      }
                      return (
                        <div key={d.key} className="py-3 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={dayData.open}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  opening_hours: {
                                    ...settings.opening_hours,
                                    [d.key]: {
                                      ...dayData,
                                      open: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="w-4 h-4 accent-[#F5DC55] cursor-pointer"
                            />
                            <span className={dayData.open ? 'font-medium text-zinc-950 dark:text-zinc-50' : 'text-zinc-400'}>
                              {d.label}
                            </span>
                          </div>

                          {dayData.open ? (
                            <div className="flex items-center gap-2">
                              <TimeInput
                                value={dayData.start || ''}
                                onChange={(val) =>
                                  setSettings({
                                    ...settings,
                                    opening_hours: {
                                      ...settings.opening_hours,
                                      [d.key]: {
                                        ...dayData,
                                        start: val,
                                      },
                                    },
                                  })
                                }
                              />
                              <span className="text-zinc-400 font-mono text-xs">às</span>
                              <TimeInput
                                value={dayData.end || ''}
                                onChange={(val) =>
                                  setSettings({
                                    ...settings,
                                    opening_hours: {
                                      ...settings.opening_hours,
                                      [d.key]: {
                                        ...dayData,
                                        end: val,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-zinc-400">Fechado</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Formas de Pagamento */}
                <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <h3 className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                      Formas de Pagamento Aceitas
                    </h3>
                    <p className="text-xs font-light text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Métodos de pagamento disponíveis no checkout do cardápio online.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* PIX */}
                    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-zinc-400" />
                        <div>
                          <span className="text-sm font-medium block text-zinc-950 dark:text-zinc-50">PIX Online / Maquininha</span>
                          <span className="text-xs text-zinc-500">Pagamento instantâneo via QR Code</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.payment_methods.pix}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment_methods: {
                              ...settings.payment_methods,
                              pix: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-[#F5DC55] cursor-pointer"
                      />
                    </div>

                    {/* Dinheiro */}
                    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <Store className="w-4 h-4 text-zinc-400" />
                        <div>
                          <span className="text-sm font-medium block text-zinc-950 dark:text-zinc-50">Dinheiro em Espécie</span>
                          <span className="text-xs text-zinc-500">Com solicitação de troco</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.payment_methods.cash}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment_methods: {
                              ...settings.payment_methods,
                              cash: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-[#F5DC55] cursor-pointer"
                      />
                    </div>

                    {/* Cartão de Crédito com taxa opcional */}
                    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-zinc-400" />
                          <div>
                            <span className="text-sm font-medium block text-zinc-950 dark:text-zinc-50">Cartão de Crédito</span>
                            <span className="text-xs text-zinc-500">Na entrega ou retirada (maquininha)</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.payment_methods.credit_card}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment_methods: {
                                ...settings.payment_methods,
                                credit_card: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 accent-[#F5DC55] cursor-pointer"
                        />
                      </div>

                      {settings.payment_methods.credit_card && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-500">Taxa Adicional no Crédito:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="30"
                              placeholder="0.0"
                              value={settings.payment_methods.credit_card_fee_percent ?? 0}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  payment_methods: {
                                    ...settings.payment_methods,
                                    credit_card_fee_percent: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-16 px-2 py-1 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                            <span className="text-zinc-400">%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cartão de Débito com taxa opcional */}
                    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-zinc-400" />
                          <div>
                            <span className="text-sm font-medium block text-zinc-950 dark:text-zinc-50">Cartão de Débito</span>
                            <span className="text-xs text-zinc-500">Na entrega ou retirada (maquininha)</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.payment_methods.debit_card}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment_methods: {
                                ...settings.payment_methods,
                                debit_card: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 accent-[#F5DC55] cursor-pointer"
                        />
                      </div>

                      {settings.payment_methods.debit_card && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-500">Taxa Adicional no Débito:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="30"
                              placeholder="0.0"
                              value={settings.payment_methods.debit_card_fee_percent ?? 0}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  payment_methods: {
                                    ...settings.payment_methods,
                                    debit_card_fee_percent: parseFloat(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-16 px-2 py-1 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                            />
                            <span className="text-zinc-400">%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>

      </main>

      {/* ─── GAVETA: SOLICITAÇÃO DE ALTERAÇÃO CADASTRAL ──────────────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-[#F8F7F4] dark:bg-[#0F1012] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200">
            
            {/* Header da Gaveta */}
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#141416]">
              <div>
                <span className="text-[11px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55] tracking-wider block">
                  Governança & Cadastro
                </span>
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  Solicitação de Alteração Cadastral
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Abas do Formulário */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-mono">
              <button
                type="button"
                onClick={() => setDrawerTab('store')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  drawerTab === 'store'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>01 / Estabelecimento</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('address')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  drawerTab === 'address'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>02 / Endereço</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('owner')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  drawerTab === 'owner'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>03 / Gestor</span>
              </button>
            </div>

            {/* Feedback de Erro da Gaveta */}
            {drawerError && (
              <div className="mx-6 mt-4 p-3 bg-red-500/10 border-l-2 border-red-500 text-xs font-mono text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{drawerError}</span>
              </div>
            )}

            {/* Conteúdo Formulário */}
            <form onSubmit={handleSubmitChangeRequest} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* ─── ABA 01: ESTABELECIMENTO & DOMÍNIO ─── */}
              {drawerTab === 'store' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Nome da Loja *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value })
                        if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }))
                      }}
                      onBlur={() => handleBlurField('name')}
                      placeholder="Ex: Pizzaria Napoli"
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                        fieldErrors.name ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                      }`}
                    />
                    {fieldErrors.name && (
                      <p className="text-[11px] font-mono text-red-500">{fieldErrors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Razão Social (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.legal_name}
                        onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                        placeholder="Ex: Napoli Alimentos Ltda"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        CNPJ / CPF da Loja (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.document}
                        onChange={(e) => {
                          setFormData({ ...formData, document: formatDocument(e.target.value) })
                          if (fieldErrors.document) setFieldErrors((prev) => ({ ...prev, document: '' }))
                        }}
                        onBlur={() => handleBlurField('document')}
                        placeholder="00.000.000/0001-00"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                          fieldErrors.document ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                        }`}
                      />
                      {fieldErrors.document && (
                        <p className="text-[11px] font-mono text-red-500">{fieldErrors.document}</p>
                      )}
                    </div>
                  </div>

                  {/* Seleção do Tipo de Domínio */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Endereço Web do Cardápio *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, domain_type: 'subdomain' })}
                        className={`p-3 text-left border rounded transition-all cursor-pointer ${
                          formData.domain_type === 'subdomain'
                            ? 'border-[#F5DC55] bg-[#F5DC55]/5 font-semibold text-zinc-950 dark:text-zinc-50'
                            : 'border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        <span className="block text-xs font-mono">1. Subdomínio Grátis</span>
                        <span className="text-[11px] font-light text-zinc-400 block mt-0.5">
                          sua-loja.doispalitos.tech
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, domain_type: 'custom_domain' })}
                        className={`p-3 text-left border rounded transition-all cursor-pointer ${
                          formData.domain_type === 'custom_domain'
                            ? 'border-[#F5DC55] bg-[#F5DC55]/5 font-semibold text-zinc-950 dark:text-zinc-50'
                            : 'border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        <span className="block text-xs font-mono">2. Domínio Próprio</span>
                        <span className="text-[11px] font-light text-zinc-400 block mt-0.5">
                          www.sualoja.com.br
                        </span>
                      </button>
                    </div>

                    {formData.domain_type === 'subdomain' ? (
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => {
                              setFormData({ ...formData, slug: formatSlug(e.target.value) })
                              if (fieldErrors.slug) setFieldErrors((prev) => ({ ...prev, slug: '' }))
                            }}
                            onBlur={() => handleBlurField('slug')}
                            placeholder="exemplo-napoli"
                            className={`flex-1 px-3.5 py-2 bg-transparent border border-r-0 rounded-l text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                              fieldErrors.slug ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                            }`}
                          />
                          <span className="px-3.5 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 rounded-r text-xs font-mono text-zinc-500">
                            .doispalitos.tech
                          </span>
                        </div>
                        {fieldErrors.slug && (
                          <p className="text-[11px] font-mono text-red-500">{fieldErrors.slug}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={formData.custom_domain}
                          onChange={(e) => {
                            setFormData({ ...formData, custom_domain: e.target.value.toLowerCase().trim() })
                            if (fieldErrors.custom_domain) setFieldErrors((prev) => ({ ...prev, custom_domain: '' }))
                          }}
                          onBlur={() => handleBlurField('custom_domain')}
                          placeholder="ex: delivery.napoli.com.br"
                          className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                            fieldErrors.custom_domain ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                          }`}
                        />
                        {fieldErrors.custom_domain && (
                          <p className="text-[11px] font-mono text-red-500">{fieldErrors.custom_domain}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        E-mail Comercial
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value })
                          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }))
                        }}
                        onBlur={() => handleBlurField('email')}
                        placeholder="contato@restaurante.com"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                          fieldErrors.email ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                        }`}
                      />
                      {fieldErrors.email && (
                        <p className="text-[11px] font-mono text-red-500">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Telefone / WhatsApp Comercial
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: formatPhone(e.target.value) })
                          if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }))
                        }}
                        onBlur={() => handleBlurField('phone')}
                        placeholder="(00) 00000-0000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                          fieldErrors.phone ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                        }`}
                      />
                      {fieldErrors.phone && (
                        <p className="text-[11px] font-mono text-red-500">{fieldErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ABA 02: ENDEREÇO & MAPA ─── */}
              {drawerTab === 'address' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500 flex items-center justify-between">
                        <span>CEP *</span>
                        {isSearchingCep && <Loader2 className="w-3 h-3 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />}
                      </label>
                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => handleCepChange(e.target.value)}
                        onBlur={() => handleBlurField('postal_code')}
                        placeholder="00000-000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                          fieldErrors.postal_code ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                        }`}
                      />
                      {fieldErrors.postal_code && (
                        <p className="text-[11px] font-mono text-red-500">{fieldErrors.postal_code}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Estado (UF) *
                      </label>
                      <div className="relative">
                        <select
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value, city: '' })}
                          className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="dark:bg-zinc-900">Selecione</option>
                          {BRAZILIAN_STATES.map((s) => (
                            <option key={s.uf} value={s.uf} className="dark:bg-zinc-900">
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500 flex items-center justify-between">
                        <span>Cidade *</span>
                        {isLoadingCities && <Loader2 className="w-3 h-3 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />}
                      </label>
                      <div className="relative">
                        <select
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          disabled={!formData.state || isLoadingCities}
                          className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none appearance-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="" className="dark:bg-zinc-900">
                            {formData.state ? 'Selecione a cidade' : 'Escolha a UF'}
                          </option>
                          {drawerCities.map((c) => (
                            <option key={c} value={c} className="dark:bg-zinc-900">
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Logradouro (Rua / Av.) *
                      </label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        placeholder="Ex: Avenida Paulista"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Número *
                      </label>
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        placeholder="100"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        placeholder="Ex: Bela Vista"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Complemento (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.complement}
                        onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                        placeholder="Ex: Loja 2, Bloco B"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Botão Adquirir Geolocalização */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={handleAcquireLocation}
                      disabled={!isAddressComplete || isGeocoding}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer self-start"
                    >
                      {isGeocoding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                      ) : (
                        <LocateFixed className="w-3.5 h-3.5 text-zinc-950" />
                      )}
                      <span>Adquirir Geolocalização</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      <span>Lat:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 select-all">
                        {formData.latitude !== null ? formData.latitude.toFixed(6) : '—'}
                      </span>
                      <span>| Lng:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 select-all">
                        {formData.longitude !== null ? formData.longitude.toFixed(6) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Mapa de Ajuste Fino */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                      <span>Localização Exata no Mapa</span>
                      {formData.latitude && formData.longitude && (
                        <span>
                          {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                        </span>
                      )}
                    </div>

                    <LocationPickerMap
                      latitude={formData.latitude}
                      longitude={formData.longitude}
                      devicePosition={devicePosition}
                      isInteractive={isMapInteractive}
                      onLocationChange={handleLocationChange}
                      onCenterOnDevice={() => {
                        if (devicePosition) {
                          handleLocationChange(devicePosition.lat, devicePosition.lng)
                        }
                      }}
                      className="h-64 w-full rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-800 relative"
                    />
                  </div>
                </div>
              )}

              {/* ─── ABA 03: GESTOR PRINCIPAL ─── */}
              {drawerTab === 'owner' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Nome Completo do Gestor *
                    </label>
                    <input
                      type="text"
                      value={formData.owner_name}
                      onChange={(e) => {
                        setFormData({ ...formData, owner_name: e.target.value })
                        if (fieldErrors.owner_name) setFieldErrors((prev) => ({ ...prev, owner_name: '' }))
                      }}
                      onBlur={() => handleBlurField('owner_name')}
                      placeholder="Ex: Giovanni Napoli"
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                        fieldErrors.owner_name ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                      }`}
                    />
                    {fieldErrors.owner_name && (
                      <p className="text-[11px] font-mono text-red-500">{fieldErrors.owner_name}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      E-mail de Acesso do Gestor *
                    </label>
                    <input
                      type="email"
                      value={formData.owner_email}
                      onChange={(e) => {
                        setFormData({ ...formData, owner_email: e.target.value })
                        if (fieldErrors.owner_email) setFieldErrors((prev) => ({ ...prev, owner_email: '' }))
                      }}
                      onBlur={() => handleBlurField('owner_email')}
                      placeholder="gestor@restaurante.com"
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                        fieldErrors.owner_email ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                      }`}
                    />
                    {fieldErrors.owner_email && (
                      <p className="text-[11px] font-mono text-red-500">{fieldErrors.owner_email}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Telefone / WhatsApp do Gestor (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.owner_phone}
                        onChange={(e) => {
                          setFormData({ ...formData, owner_phone: formatPhone(e.target.value) })
                          if (fieldErrors.owner_phone) setFieldErrors((prev) => ({ ...prev, owner_phone: '' }))
                        }}
                        onBlur={() => handleBlurField('owner_phone')}
                        placeholder="(00) 00000-0000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                          fieldErrors.owner_phone ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                        }`}
                      />
                      {fieldErrors.owner_phone && (
                        <p className="text-[11px] font-mono text-red-500">{fieldErrors.owner_phone}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        CPF do Gestor (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.owner_document}
                        onChange={(e) => {
                          setFormData({ ...formData, owner_document: formatCpf(e.target.value) })
                          if (fieldErrors.owner_document) setFieldErrors((prev) => ({ ...prev, owner_document: '' }))
                        }}
                        onBlur={() => handleBlurField('owner_document')}
                        placeholder="000.000.000-00"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none ${
                          fieldErrors.owner_document ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800'
                        }`}
                      />
                      {fieldErrors.owner_document && (
                        <p className="text-[11px] font-mono text-red-500">{fieldErrors.owner_document}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botões do Rodapé da Gaveta */}
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-5 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingRequest ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <Check className="w-4 h-4 text-zinc-950" />
                  )}
                  <span>{isSubmittingRequest ? 'Enviando Solicitação...' : 'Enviar Solicitação de Alteração'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
