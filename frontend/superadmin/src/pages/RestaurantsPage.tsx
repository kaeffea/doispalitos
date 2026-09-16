import { useState, useEffect, FormEvent, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/Logo'
import { NotificationCenter } from '@/components/NotificationCenter'
import { LocationPickerMap } from '@/components/LocationPickerMap'
import { ChangeRequestsModal } from '@/components/ChangeRequestsModal'
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
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  LogOut,
  Power,
  Settings2,
  LocateFixed,
  MapPin,
  Clock,
  ArrowLeft,
  Check,
  ChevronDown,
  Building2,
  User as UserIcon,
} from 'lucide-react'

interface Tenant {
  id: string
  name: string
  legal_name?: string | null
  document?: string | null
  slug: string | null
  custom_domain?: string | null
  primary_url?: string | null
  email?: string | null
  phone?: string | null
  postal_code?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  latitude?: number | null
  longitude?: number | null
  is_active: boolean
  users_count?: number
  subdomain?: string | null
  created_at: string
  owner?: {
    id: string | number
    name: string
    email: string
    phone?: string | null
    document?: string | null
    role: string
    created_at?: string
  } | null
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function RestaurantsPage() {
  const { user, logout } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  
  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [isChangeRequestsModalOpen, setIsChangeRequestsModalOpen] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

  // Tabs
  const [createTab, setCreateTab] = useState<'general' | 'address' | 'owner'>('general')
  const [editTab, setEditTab] = useState<'general' | 'address' | 'owner'>('general')

  // Field validation errors
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string | undefined>>({})
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string | undefined>>({})

  // Password reset state
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)

  // Location / Geolocation global states
  const [devicePosition, setDevicePosition] = useState<{ lat: number; lng: number } | null>(null)

  // Create Form State
  const [createDomainType, setCreateDomainType] = useState<'subdomain' | 'custom_domain'>('subdomain')
  const [createCities, setCreateCities] = useState<string[]>([])
  const [isSearchingCreateCep, setIsSearchingCreateCep] = useState(false)
  const [createCepStatus, setCreateCepStatus] = useState<string | null>(null)
  const [isGeocodingCreate, setIsGeocodingCreate] = useState(false)
  const [createGeocodingFeedback, setCreateGeocodingFeedback] = useState<string | null>(null)
  const [createBaseCoords, setCreateBaseCoords] = useState<{ lat: number; lng: number } | null>(null)
  const lastSearchedCreateCep = useRef<string>('')

  const [createData, setCreateData] = useState({
    name: '',
    legal_name: '',
    document: '',
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
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    admin_document: '',
  })
  const [createError, setCreateError] = useState<string | null>(null)
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  const [successModal, setSuccessModal] = useState<{
    tenantName: string
    primaryUrl: string
    adminEmail: string
    generatedPassword?: string
  } | null>(null)

  // Edit Form State
  const [editDomainType, setEditDomainType] = useState<'subdomain' | 'custom_domain'>('subdomain')
  const [editCities, setEditCities] = useState<string[]>([])
  const [isSearchingEditCep, setIsSearchingEditCep] = useState(false)
  const [editCepStatus, setEditCepStatus] = useState<string | null>(null)
  const [isGeocodingEdit, setIsGeocodingEdit] = useState(false)
  const [editGeocodingFeedback, setEditGeocodingFeedback] = useState<string | null>(null)
  const [editBaseCoords, setEditBaseCoords] = useState<{ lat: number; lng: number } | null>(null)
  const lastSearchedEditCep = useRef<string>('')

  const [editData, setEditData] = useState({
    name: '',
    legal_name: '',
    document: '',
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
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  const fetchTenants = async () => {
    try {
      setIsLoading(true)
      const [tenantsRes, requestsRes] = await Promise.all([
        api.get('/admin/tenants', {
          params: { search: search || undefined },
        }),
        api.get('/admin/change-requests').catch(() => ({ data: { total_pending: 0 } })),
      ])
      setTenants(tenantsRes.data.tenants)
      setPendingRequestsCount(requestsRes.data?.total_pending || 0)
    } catch (err) {
      console.error('Erro ao carregar restaurantes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTenants()
    }, 200)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDevicePosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
        },
        (err) => {
          console.log('Permissão de localização do dispositivo não concedida:', err.message)
        },
        { timeout: 8000, enableHighAccuracy: true }
      )
    }
  }, [])

  // Trava o scroll do body quando gavetas ou modais estiverem abertos
  useEffect(() => {
    if (isCreateOpen || editingTenant || deletingTenant || isChangeRequestsModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isCreateOpen, editingTenant, deletingTenant, isChangeRequestsModalOpen])

  // Auto geração de slug
  const handleSlugAutoGenerate = (name: string) => {
    const cleanSlug = formatSlug(name)
    setCreateData((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === cleanSlug.slice(0, -1) ? cleanSlug : prev.slug,
    }))
    setCreateFieldErrors((prev) => ({ ...prev, name: undefined }))
  }

  // ─── VALIDAÇÕES NO ONBLUR (ONBOARDING) ──────────────────────────────────
  const validateCreateField = (field: string) => {
    let error: string | undefined

    switch (field) {
      case 'name':
        if (!createData.name.trim()) error = 'Nome fantasia é obrigatório.'
        break
      case 'slug':
        if (createDomainType === 'subdomain' && !createData.slug.trim()) {
          error = 'Subdomínio é obrigatório.'
        }
        break
      case 'custom_domain':
        if (createDomainType === 'custom_domain' && !createData.custom_domain.trim()) {
          error = 'Domínio próprio é obrigatório.'
        }
        break
      case 'document': {
        const v = validateDocument(createData.document, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'email': {
        const v = validateEmail(createData.email, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'phone': {
        const v = validatePhone(createData.phone, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'postal_code': {
        const v = validateCep(createData.postal_code, true)
        if (!v.isValid) error = v.error
        break
      }
      case 'street':
        if (!createData.street.trim()) error = 'Logradouro é obrigatório.'
        break
      case 'number':
        if (!createData.number.trim()) error = 'Número é obrigatório.'
        break
      case 'neighborhood':
        if (!createData.neighborhood.trim()) error = 'Bairro é obrigatório.'
        break
      case 'admin_name':
        if (!createData.admin_name.trim()) error = 'Nome do gestor é obrigatório.'
        break
      case 'admin_email': {
        const v = validateEmail(createData.admin_email, true)
        if (!v.isValid) error = v.error
        break
      }
      case 'admin_phone': {
        const v = validatePhone(createData.admin_phone, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'admin_document': {
        const v = validateCpf(createData.admin_document, false)
        if (!v.isValid) error = v.error
        break
      }
    }

    setCreateFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  // ─── VALIDAÇÕES NO ONBLUR (EDIÇÃO) ──────────────────────────────────────
  const validateEditField = (field: string) => {
    let error: string | undefined

    switch (field) {
      case 'name':
        if (!editData.name.trim()) error = 'Nome fantasia é obrigatório.'
        break
      case 'slug':
        if (editDomainType === 'subdomain' && !editData.slug.trim()) {
          error = 'Subdomínio é obrigatório.'
        }
        break
      case 'custom_domain':
        if (editDomainType === 'custom_domain' && !editData.custom_domain.trim()) {
          error = 'Domínio próprio é obrigatório.'
        }
        break
      case 'document': {
        const v = validateDocument(editData.document, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'email': {
        const v = validateEmail(editData.email, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'phone': {
        const v = validatePhone(editData.phone, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'postal_code': {
        const v = validateCep(editData.postal_code, true)
        if (!v.isValid) error = v.error
        break
      }
      case 'street':
        if (!editData.street.trim()) error = 'Logradouro é obrigatório.'
        break
      case 'number':
        if (!editData.number.trim()) error = 'Número é obrigatório.'
        break
      case 'neighborhood':
        if (!editData.neighborhood.trim()) error = 'Bairro é obrigatório.'
        break
      case 'owner_name':
        if (!editData.owner_name.trim()) error = 'Nome do gestor é obrigatório.'
        break
      case 'owner_email': {
        const v = validateEmail(editData.owner_email, true)
        if (!v.isValid) error = v.error
        break
      }
      case 'owner_phone': {
        const v = validatePhone(editData.owner_phone, false)
        if (!v.isValid) error = v.error
        break
      }
      case 'owner_document': {
        const v = validateCpf(editData.owner_document, false)
        if (!v.isValid) error = v.error
        break
      }
    }

    setEditFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  // ─── LÓGICA DE ENDEREÇO & CEP NO ONBOARDING ──────────────────────────────
  const loadCreateCities = useCallback(async (uf: string) => {
    if (!uf) {
      setCreateCities([])
      return
    }
    const cities = await fetchCitiesByState(uf)
    setCreateCities(cities)
  }, [])

  const handleCreateCepChange = async (value: string) => {
    const formatted = formatCep(value)
    const rawDigits = formatted.replace(/\D/g, '')

    setCreateData((prev) => ({ ...prev, postal_code: formatted }))
    setCreateFieldErrors((prev) => ({ ...prev, postal_code: undefined }))

    if (rawDigits.length === 8 && rawDigits !== lastSearchedCreateCep.current.replace(/\D/g, '')) {
      lastSearchedCreateCep.current = rawDigits
      setIsSearchingCreateCep(true)
      setCreateCepStatus('Consultando CEP...')

      const result = await searchCep(rawDigits)
      setIsSearchingCreateCep(false)

      if (result) {
        if (result.isGeneralCityCep) {
          setCreateCepStatus('CEP geral do município. Informe o logradouro e bairro abaixo.')
        } else {
          setCreateCepStatus(null)
        }

        setCreateData((prev) => ({
          ...prev,
          street: result.street || prev.street,
          neighborhood: result.neighborhood || prev.neighborhood,
          city: result.city || prev.city,
          state: result.state || prev.state,
          postal_code: result.postal_code,
        }))

        if (result.state) {
          loadCreateCities(result.state)
        }
      } else {
        setCreateCepStatus('CEP não localizado nas bases postais. Preencha o endereço manualmente.')
      }
    }
  }

  const handleCreateAcquireGeolocation = async () => {
    setIsGeocodingCreate(true)
    setCreateGeocodingFeedback(null)

    const coords = await geocodeAddress({
      street: createData.street,
      number: createData.number,
      neighborhood: createData.neighborhood,
      city: createData.city,
      state: createData.state,
      postal_code: createData.postal_code,
    })

    setIsGeocodingCreate(false)

    if (coords) {
      setCreateData((prev) => ({
        ...prev,
        latitude: coords.lat,
        longitude: coords.lng,
      }))
      setCreateBaseCoords({ lat: coords.lat, lng: coords.lng })

      if (coords.accuracy === 'exact') {
        setCreateGeocodingFeedback('Ponto aproximado por numeração. Arraste o pino no mapa se desejar precisão na porta.')
      } else if (coords.accuracy === 'street') {
        setCreateGeocodingFeedback('Rua localizada. Arraste o pino no mapa até a fachada do restaurante.')
      } else {
        setCreateGeocodingFeedback('Cidade localizada. Arraste o pino no mapa até a rua e número do estabelecimento.')
      }
    } else {
      setCreateGeocodingFeedback('Não foi possível obter coordenadas automáticas. Verifique os dados digitados.')
    }
  }

  const handleCreateMapLocationChange = (lat: number, lng: number) => {
    if (createBaseCoords) {
      const dist = calculateDistanceKm(createBaseCoords.lat, createBaseCoords.lng, lat, lng)
      if (dist > 3.5) {
        setCreateGeocodingFeedback('Ponto selecionado muito distante do endereço informado. Mantenha o pino na área do estabelecimento.')
        return
      }
    }

    setCreateData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
    setCreateGeocodingFeedback('Ponto GPS refinado manualmente no mapa.')
  }

  const isCreateAddressComplete = Boolean(
    createData.postal_code?.trim() &&
    createData.state?.trim() &&
    createData.city?.trim() &&
    createData.street?.trim() &&
    createData.number?.trim() &&
    createData.neighborhood?.trim()
  )

  const isCreateValidToSubmit = Boolean(
    createData.name?.trim() &&
    (createDomainType === 'subdomain' ? createData.slug?.trim() : createData.custom_domain?.trim()) &&
    isCreateAddressComplete &&
    createData.latitude !== null &&
    createData.longitude !== null &&
    createData.admin_name?.trim() &&
    validateEmail(createData.admin_email, true).isValid
  )

  const handleCreateTenant = async (e: FormEvent) => {
    e.preventDefault()
    if (!isCreateValidToSubmit) {
      setCreateError('Preencha todos os dados obrigatórios das 3 abas e adquira a geolocalização no mapa antes de salvar.')
      return
    }

    setCreateError(null)
    setIsSubmittingCreate(true)

    try {
      const res = await api.post('/admin/tenants', {
        domain_type: createDomainType,
        name: createData.name,
        legal_name: createData.legal_name || null,
        document: createData.document || null,
        slug: createDomainType === 'subdomain' ? createData.slug : undefined,
        custom_domain: createDomainType === 'custom_domain' ? createData.custom_domain : undefined,
        email: createData.email || null,
        phone: createData.phone || null,
        postal_code: createData.postal_code || null,
        street: createData.street || null,
        number: createData.number || null,
        complement: createData.complement || null,
        neighborhood: createData.neighborhood || null,
        city: createData.city || null,
        state: createData.state || null,
        latitude: createData.latitude,
        longitude: createData.longitude,
        admin_name: createData.admin_name,
        admin_email: createData.admin_email,
        admin_phone: createData.admin_phone || null,
        admin_document: createData.admin_document || null,
      })
      const newTenant = res.data.tenant
      const adminUser = res.data.admin_user

      setSuccessModal({
        tenantName: newTenant.name,
        primaryUrl: newTenant.primary_url || newTenant.subdomain,
        adminEmail: adminUser.email,
        generatedPassword: res.data.generated_password,
      })

      setIsCreateOpen(false)
      fetchTenants()
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          data?: {
            message?: string
            errors?: Record<string, string[]>
          }
        }
      }
      const errs = axiosErr.response?.data?.errors
      if (errs) {
        const firstKey = Object.keys(errs)[0]
        setCreateError(errs[firstKey][0])
      } else {
        setCreateError(axiosErr.response?.data?.message || 'Erro ao cadastrar restaurante.')
      }
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // ─── LÓGICA DE ENDEREÇO & CEP NA EDIÇÃO ──────────────────────────────────
  const loadEditCities = useCallback(async (uf: string) => {
    if (!uf) {
      setEditCities([])
      return
    }
    const cities = await fetchCitiesByState(uf)
    setEditCities(cities)
  }, [])

  const handleOpenEdit = async (tenant: Tenant) => {
    try {
      const res = await api.get(`/admin/tenants/${tenant.id}`)
      const fullTenant = res.data.tenant
      setEditingTenant(fullTenant)
      
      const hasCustomDomain = Boolean(fullTenant.custom_domain)
      setEditDomainType(hasCustomDomain ? 'custom_domain' : 'subdomain')

      const initialLat = fullTenant.latitude !== null && fullTenant.latitude !== undefined ? Number(fullTenant.latitude) : null
      const initialLng = fullTenant.longitude !== null && fullTenant.longitude !== undefined ? Number(fullTenant.longitude) : null

      setEditData({
        name: fullTenant.name || '',
        legal_name: fullTenant.legal_name || '',
        document: fullTenant.document ? formatDocument(fullTenant.document) : '',
        slug: fullTenant.slug || '',
        custom_domain: fullTenant.custom_domain || '',
        email: fullTenant.email || '',
        phone: fullTenant.phone ? formatPhone(fullTenant.phone) : '',
        postal_code: fullTenant.postal_code ? formatCep(fullTenant.postal_code) : '',
        street: fullTenant.street || '',
        number: fullTenant.number || '',
        complement: fullTenant.complement || '',
        neighborhood: fullTenant.neighborhood || '',
        city: fullTenant.city || '',
        state: fullTenant.state || '',
        latitude: initialLat,
        longitude: initialLng,
        owner_name: fullTenant.owner?.name || '',
        owner_email: fullTenant.owner?.email || '',
        owner_phone: fullTenant.owner?.phone ? formatPhone(fullTenant.owner.phone) : '',
        owner_document: fullTenant.owner?.document ? formatCpf(fullTenant.owner.document) : '',
      })

      if (initialLat !== null && initialLng !== null) {
        setEditBaseCoords({ lat: initialLat, lng: initialLng })
      } else {
        setEditBaseCoords(null)
      }

      if (fullTenant.state) {
        loadEditCities(fullTenant.state)
      } else {
        setEditCities([])
      }

      setEditFieldErrors({})
      setEditError(null)
      setEditSuccess(null)
      setResetSuccessMessage(null)
      setEditCepStatus(null)
      setEditGeocodingFeedback(null)
      lastSearchedEditCep.current = fullTenant.postal_code || ''
      setEditTab('general')
    } catch (err) {
      console.error('Erro ao abrir edição:', err)
    }
  }

  const handleEditCepChange = async (value: string) => {
    const formatted = formatCep(value)
    const rawDigits = formatted.replace(/\D/g, '')

    setEditData((prev) => ({ ...prev, postal_code: formatted }))
    setEditFieldErrors((prev) => ({ ...prev, postal_code: undefined }))

    if (rawDigits.length === 8 && rawDigits !== lastSearchedEditCep.current.replace(/\D/g, '')) {
      lastSearchedEditCep.current = rawDigits
      setIsSearchingEditCep(true)
      setEditCepStatus('Consultando CEP...')

      const result = await searchCep(rawDigits)
      setIsSearchingEditCep(false)

      if (result) {
        if (result.isGeneralCityCep) {
          setEditCepStatus('CEP geral do município. Informe o logradouro e bairro abaixo.')
        } else {
          setEditCepStatus(null)
        }

        setEditData((prev) => ({
          ...prev,
          street: result.street || prev.street,
          neighborhood: result.neighborhood || prev.neighborhood,
          city: result.city || prev.city,
          state: result.state || prev.state,
          postal_code: result.postal_code,
        }))

        if (result.state) {
          loadEditCities(result.state)
        }
      } else {
        setEditCepStatus('CEP não localizado nas bases postais. Preencha o endereço manualmente.')
      }
    }
  }

  const handleEditAcquireGeolocation = async () => {
    setIsGeocodingEdit(true)
    setEditGeocodingFeedback(null)

    const coords = await geocodeAddress({
      street: editData.street,
      number: editData.number,
      neighborhood: editData.neighborhood,
      city: editData.city,
      state: editData.state,
      postal_code: editData.postal_code,
    })

    setIsGeocodingEdit(false)

    if (coords) {
      setEditData((prev) => ({
        ...prev,
        latitude: coords.lat,
        longitude: coords.lng,
      }))
      setEditBaseCoords({ lat: coords.lat, lng: coords.lng })

      if (coords.accuracy === 'exact') {
        setEditGeocodingFeedback('Ponto aproximado por numeração. Arraste o pino no mapa se desejar precisão na porta.')
      } else if (coords.accuracy === 'street') {
        setEditGeocodingFeedback('Rua localizada. Arraste o pino no mapa até a fachada do restaurante.')
      } else {
        setEditGeocodingFeedback('Cidade localizada. Arraste o pino no mapa até a rua e número do estabelecimento.')
      }
    } else {
      setEditGeocodingFeedback('Não foi possível obter coordenadas automáticas. Verifique os dados digitados.')
    }
  }

  const handleEditMapLocationChange = (lat: number, lng: number) => {
    if (editBaseCoords) {
      const dist = calculateDistanceKm(editBaseCoords.lat, editBaseCoords.lng, lat, lng)
      if (dist > 3.5) {
        setEditGeocodingFeedback('Ponto selecionado muito distante do endereço informado. Mantenha o pino na área do estabelecimento.')
        return
      }
    }

    setEditData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
    setEditGeocodingFeedback('Ponto GPS refinado manualmente no mapa.')
  }

  const isEditAddressComplete = Boolean(
    editData.postal_code?.trim() &&
    editData.state?.trim() &&
    editData.city?.trim() &&
    editData.street?.trim() &&
    editData.number?.trim() &&
    editData.neighborhood?.trim()
  )

  const isEditValidToSubmit = Boolean(
    editData.name?.trim() &&
    (editDomainType === 'subdomain' ? editData.slug?.trim() : editData.custom_domain?.trim()) &&
    isEditAddressComplete &&
    editData.latitude !== null &&
    editData.longitude !== null &&
    editData.owner_name?.trim() &&
    validateEmail(editData.owner_email, true).isValid
  )

  const handleUpdateTenant = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingTenant) return

    if (!isEditValidToSubmit) {
      setEditError('Preencha todos os dados obrigatórios e certifique-se de que a geolocalização foi adquirida antes de salvar.')
      return
    }

    setEditError(null)
    setEditSuccess(null)
    setIsSubmittingEdit(true)

    try {
      await api.put(`/admin/tenants/${editingTenant.id}`, {
        name: editData.name,
        legal_name: editData.legal_name || null,
        document: editData.document || null,
        domain_type: editDomainType,
        slug: editDomainType === 'subdomain' ? editData.slug : undefined,
        custom_domain: editDomainType === 'custom_domain' ? editData.custom_domain : undefined,
        email: editData.email || null,
        phone: editData.phone || null,
        postal_code: editData.postal_code || null,
        street: editData.street || null,
        number: editData.number || null,
        complement: editData.complement || null,
        neighborhood: editData.neighborhood || null,
        city: editData.city || null,
        state: editData.state || null,
        latitude: editData.latitude,
        longitude: editData.longitude,
        owner_name: editData.owner_name,
        owner_email: editData.owner_email,
        owner_phone: editData.owner_phone || null,
        owner_document: editData.owner_document || null,
      })
      
      setEditingTenant(null)
      fetchTenants()
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          data?: {
            message?: string
            errors?: Record<string, string[]>
          }
        }
      }
      const errs = axiosErr.response?.data?.errors
      if (errs) {
        const firstKey = Object.keys(errs)[0]
        setEditError(errs[firstKey][0])
      } else {
        setEditError(axiosErr.response?.data?.message || 'Erro ao salvar alterações.')
      }
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const handleResetPassword = async () => {
    if (!editingTenant) return
    setIsResettingPassword(true)
    setResetSuccessMessage(null)
    setEditError(null)

    try {
      await api.post(`/admin/tenants/${editingTenant.id}/reset-password`)
      setResetSuccessMessage(`Nova senha gerada e enviada por e-mail para ${editData.owner_email}.`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setEditError(axiosErr.response?.data?.message || 'Erro ao disparar redefinição de senha.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      setTogglingId(tenant.id)
      const res = await api.patch(`/admin/tenants/${tenant.id}/toggle-status`)
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, is_active: res.data.is_active } : t))
      )
    } catch (err) {
      console.error('Erro ao alterar status:', err)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return

    try {
      await api.delete(`/admin/tenants/${deletingTenant.id}`)
      setDeletingTenant(null)
      fetchTenants()
    } catch (err) {
      console.error('Erro ao excluir:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-[#F5DC55] selection:text-zinc-950">
      
      {/* Editorial Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-8">
          <Logo size="sm" />
          <nav className="flex items-center gap-3 sm:gap-6 text-xs font-mono">
            <Link to="/dashboard" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              01 / Visão Geral
            </Link>
            <span className="text-zinc-950 dark:text-zinc-100 border-b border-[#F5DC55] pb-0.5 font-semibold">
              02 / Restaurantes
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">
            {user?.name}
          </span>
          <NotificationCenter onOpenRequests={() => setIsChangeRequestsModalOpen(true)} />
          <ThemeToggle />
          <button
            onClick={logout}
            className="text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer ml-1"
            title="Encerrar Sessão"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-10 space-y-8">
        
        {/* Title Bar & Actions */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Super Admin // Gestão de Restaurantes
            </p>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50 mt-1">
              Restaurantes Parceiros
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsChangeRequestsModalOpen(true)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 border rounded-lg text-xs font-mono transition-all cursor-pointer ${
                pendingRequestsCount > 0
                  ? 'border-[#F5DC55]/80 bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-100 hover:bg-[#F5DC55]/20'
                  : 'border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55]" />
              <span>Solicitações de Alteração</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[#F5DC55] text-zinc-950 font-bold font-mono text-[10px] rounded-full">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsCreateOpen(true)
                setCreateTab('general')
                setCreateFieldErrors({})
                setCreateError(null)
                setCreateGeocodingFeedback(null)
                setCreateBaseCoords(null)
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Restaurante</span>
            </button>
          </div>
        </div>

        {/* Search / Filter bar */}
        <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Filtrar por nome, razão social, CNPJ, domínio ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none placeholder-zinc-400 font-mono text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Tenants List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 dark:text-zinc-500">
            <span>Restaurantes Cadastrados</span>
            <span>{tenants.length} {tenants.length === 1 ? 'restaurante' : 'restaurantes'}</span>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800/80 divide-y divide-zinc-200 dark:divide-zinc-800/80 rounded-lg overflow-hidden bg-white dark:bg-[#16171B]">
            
            {/* Table Header */}
            <div className="p-3 sm:px-6 grid grid-cols-12 text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-100/60 dark:bg-zinc-900/40">
              <span className="col-span-4 sm:col-span-3">Restaurante</span>
              <span className="col-span-4 sm:col-span-3">Endereço Web</span>
              <span className="hidden sm:block sm:col-span-3">Contato & Cidade</span>
              <span className="col-span-2 sm:col-span-1 text-center">Status</span>
              <span className="col-span-2 sm:col-span-2 text-right">Ações</span>
            </div>

            {/* Loading */}
            {isLoading ? (
              <div className="p-12 text-center text-zinc-400 text-xs font-mono flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#F5DC55]" />
                <span>Carregando restaurantes...</span>
              </div>
            ) : tenants.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <p className="text-sm font-light text-zinc-600 dark:text-zinc-400">
                  {search ? 'Nenhum restaurante encontrado para a busca.' : 'Nenhum restaurante cadastrado até o momento.'}
                </p>
                {!search && (
                  <button
                    onClick={() => {
                      setIsCreateOpen(true)
                      setCreateTab('general')
                    }}
                    className="text-xs font-mono text-[#D4B316] dark:text-[#F5DC55] hover:underline cursor-pointer"
                  >
                    + Criar o primeiro restaurante agora
                  </button>
                )}
              </div>
            ) : (
              tenants.map((t) => (
                <div 
                  key={t.id}
                  className="p-3 sm:px-6 grid grid-cols-12 items-center text-sm hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                >
                  {/* Name & ID/Document */}
                  <div className="col-span-4 sm:col-span-3 min-w-0 pr-2">
                    <p className="font-medium text-zinc-950 dark:text-zinc-50 truncate">
                      {t.name}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                      {t.document ? `CNPJ/CPF: ${formatDocument(t.document)}` : `ID: ${t.id.slice(0, 8)}...`}
                    </p>
                  </div>

                  {/* Subdomain & Custom Domain */}
                  <div className="col-span-4 sm:col-span-3 min-w-0 pr-2">
                    <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 block truncate">
                      {t.primary_url || t.subdomain}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                      {t.custom_domain ? 'Domínio próprio' : 'Subdomínio'}
                    </span>
                  </div>

                  {/* Contact / Location */}
                  <div className="hidden sm:block sm:col-span-3 min-w-0 text-xs font-mono text-zinc-600 dark:text-zinc-400 pr-2">
                    <p className="truncate">{t.email || (t.phone ? formatPhone(t.phone) : 'Sem contato')}</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                      {t.city ? `${t.city}/${t.state}` : 'Sem endereço cadastrado'}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 sm:col-span-1 text-center">
                    {t.is_active ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                        Inativo
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-1 sm:gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      title="Editar registro do restaurante"
                      className="p-1.5 rounded text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleStatus(t)}
                      disabled={togglingId === t.id}
                      title={t.is_active ? 'Desativar restaurante' : 'Ativar restaurante'}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        t.is_active
                          ? 'text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10'
                          : 'text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {togglingId === t.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Power className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => setDeletingTenant(t)}
                      title="Arquivar restaurante"
                      className="p-1.5 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

      </main>

      {/* ─── DRAWER: ONBOARDING / NOVO RESTAURANTE (3 ABAS) ──────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          <div 
            className="fixed inset-0"
            onClick={() => setIsCreateOpen(false)}
          />

          <div className="w-full max-w-2xl bg-[#F8F7F4] dark:bg-[#0F1012] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200 z-10">
            
            {/* Header da Gaveta */}
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#141416]">
              <div>
                <span className="text-[11px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55] tracking-wider block">
                  Super Admin // Cadastro de Restaurante
                </span>
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  Novo Restaurante Parceiro
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Abas do Formulário */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-mono">
              <button
                type="button"
                onClick={() => setCreateTab('general')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  createTab === 'general'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>01 / Estabelecimento</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('address')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  createTab === 'address'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>02 / Endereço</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('owner')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  createTab === 'owner'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>03 / Gestor</span>
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: ESTABELECIMENTO */}
              {createTab === 'general' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Nome Fantasia da Loja *
                    </label>
                    <input
                      type="text"
                      required
                      value={createData.name}
                      onChange={(e) => handleSlugAutoGenerate(e.target.value)}
                      onBlur={() => validateCreateField('name')}
                      placeholder="Ex: Trattoria Bella Napoli"
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                        createFieldErrors.name
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                      }`}
                    />
                    {createFieldErrors.name && (
                      <p className="text-[11px] font-mono text-red-500">{createFieldErrors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Razão Social
                      </label>
                      <input
                        type="text"
                        value={createData.legal_name}
                        onChange={(e) => setCreateData({ ...createData, legal_name: e.target.value })}
                        placeholder="Bella Napoli Alimentos Ltda"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        CNPJ / CPF da Loja
                      </label>
                      <input
                        type="text"
                        value={createData.document}
                        onChange={(e) => {
                          setCreateData({ ...createData, document: formatDocument(e.target.value) })
                          setCreateFieldErrors((prev) => ({ ...prev, document: undefined }))
                        }}
                        onBlur={() => validateCreateField('document')}
                        placeholder="00.000.000/0001-00"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                          createFieldErrors.document
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.document && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.document}</p>
                      )}
                    </div>
                  </div>

                  {/* Cards de Tipo de Domínio */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Tipo de Domínio *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCreateDomainType('subdomain')}
                        className={`p-3 text-left border rounded transition-all cursor-pointer ${
                          createDomainType === 'subdomain'
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
                        onClick={() => setCreateDomainType('custom_domain')}
                        className={`p-3 text-left border rounded transition-all cursor-pointer ${
                          createDomainType === 'custom_domain'
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

                    {createDomainType === 'subdomain' ? (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center">
                          <input
                            type="text"
                            required
                            value={createData.slug}
                            onChange={(e) => {
                              setCreateData({ ...createData, slug: formatSlug(e.target.value) })
                              setCreateFieldErrors((prev) => ({ ...prev, slug: undefined }))
                            }}
                            onBlur={() => validateCreateField('slug')}
                            placeholder="exemplo-napoli"
                            className={`flex-1 px-3.5 py-2 bg-transparent border border-r-0 rounded-l text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                              createFieldErrors.slug
                                ? 'border-red-500 focus:border-red-500'
                                : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                            }`}
                          />
                          <span className="px-3.5 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 rounded-r text-xs font-mono text-zinc-500">
                            .doispalitos.tech
                          </span>
                        </div>
                        {createFieldErrors.slug && (
                          <p className="text-[11px] font-mono text-red-500">{createFieldErrors.slug}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 pt-1">
                        <input
                          type="text"
                          required
                          value={createData.custom_domain}
                          onChange={(e) => {
                            setCreateData({ ...createData, custom_domain: e.target.value.toLowerCase().trim() })
                            setCreateFieldErrors((prev) => ({ ...prev, custom_domain: undefined }))
                          }}
                          onBlur={() => validateCreateField('custom_domain')}
                          placeholder="ex: delivery.napoli.com.br"
                          className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                            createFieldErrors.custom_domain
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                          }`}
                        />
                        {createFieldErrors.custom_domain ? (
                          <p className="text-[11px] font-mono text-red-500">{createFieldErrors.custom_domain}</p>
                        ) : (
                          <p className="text-[10px] font-mono text-zinc-400">
                            CNAME apontado para <span className="text-zinc-700 dark:text-zinc-300">doispalitos.tech</span>.
                          </p>
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
                        value={createData.email}
                        onChange={(e) => {
                          setCreateData({ ...createData, email: e.target.value })
                          setCreateFieldErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        onBlur={() => validateCreateField('email')}
                        placeholder="contato@restaurante.com"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                          createFieldErrors.email
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.email && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Telefone / WhatsApp Comercial
                      </label>
                      <input
                        type="text"
                        value={createData.phone}
                        onChange={(e) => {
                          setCreateData({ ...createData, phone: formatPhone(e.target.value) })
                          setCreateFieldErrors((prev) => ({ ...prev, phone: undefined }))
                        }}
                        onBlur={() => validateCreateField('phone')}
                        placeholder="(00) 00000-0000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                          createFieldErrors.phone
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.phone && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ENDEREÇO NO ONBOARDING */}
              {createTab === 'address' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500 flex items-center justify-between">
                        <span>CEP *</span>
                        {isSearchingCreateCep && (
                          <Loader2 className="w-3 h-3 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />
                        )}
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        value={createData.postal_code}
                        onChange={(e) => handleCreateCepChange(e.target.value)}
                        onBlur={() => validateCreateField('postal_code')}
                        placeholder="00000-000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          createFieldErrors.postal_code
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.postal_code && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.postal_code}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Estado (UF) *
                      </label>
                      <div className="relative">
                        <select
                          value={createData.state}
                          onChange={(e) => {
                            setCreateData({ ...createData, state: e.target.value, city: '' })
                            loadCreateCities(e.target.value)
                          }}
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
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Cidade *
                      </label>
                      <div className="relative">
                        <select
                          value={createData.city}
                          onChange={(e) => setCreateData({ ...createData, city: e.target.value })}
                          disabled={!createData.state}
                          className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none appearance-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="" className="dark:bg-zinc-900">
                            {createData.state ? 'Selecione a cidade' : 'Escolha a UF'}
                          </option>
                          {createCities.map((c) => (
                            <option key={c} value={c} className="dark:bg-zinc-900">
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {createCepStatus && (
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {createCepStatus}
                    </p>
                  )}

                  {/* Logradouro + Número */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Logradouro (Rua / Av.) *
                      </label>
                      <input
                        type="text"
                        value={createData.street}
                        onChange={(e) => {
                          setCreateData({ ...createData, street: e.target.value })
                          setCreateFieldErrors((prev) => ({ ...prev, street: undefined }))
                        }}
                        onBlur={() => validateCreateField('street')}
                        placeholder="Ex: Avenida Paulista"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          createFieldErrors.street
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.street && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.street}</p>
                      )}
                    </div>
                    <div className="sm:col-span-1 space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Número *
                      </label>
                      <input
                        type="text"
                        value={createData.number}
                        onChange={(e) => {
                          setCreateData({ ...createData, number: e.target.value })
                          setCreateFieldErrors((prev) => ({ ...prev, number: undefined }))
                        }}
                        onBlur={() => validateCreateField('number')}
                        placeholder="1000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          createFieldErrors.number
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.number && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.number}</p>
                      )}
                    </div>
                  </div>

                  {/* Bairro + Complemento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        value={createData.neighborhood}
                        onChange={(e) => {
                          setCreateData({ ...createData, neighborhood: e.target.value })
                          setCreateFieldErrors((prev) => ({ ...prev, neighborhood: undefined }))
                        }}
                        onBlur={() => validateCreateField('neighborhood')}
                        placeholder="Ex: Bela Vista"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          createFieldErrors.neighborhood
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.neighborhood && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.neighborhood}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Complemento (Opcional)
                      </label>
                      <input
                        type="text"
                        value={createData.complement}
                        onChange={(e) => setCreateData({ ...createData, complement: e.target.value })}
                        placeholder="Sala 12, Bloco B"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Botão Adquirir Geolocalização */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={handleCreateAcquireGeolocation}
                      disabled={!isCreateAddressComplete || isGeocodingCreate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer self-start"
                    >
                      {isGeocodingCreate ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                      ) : (
                        <LocateFixed className="w-3.5 h-3.5 text-zinc-950" />
                      )}
                      <span>Adquirir Geolocalização</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      <span>Lat:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 select-all">
                        {createData.latitude !== null ? createData.latitude.toFixed(6) : '—'}
                      </span>
                      <span>| Lng:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 select-all">
                        {createData.longitude !== null ? createData.longitude.toFixed(6) : '—'}
                      </span>
                    </div>
                  </div>

                  {createGeocodingFeedback && (
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 italic">
                      {createGeocodingFeedback}
                    </p>
                  )}

                  {/* Mapa com ajuste fino restrito */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-mono uppercase text-zinc-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55]" />
                      Ajuste Fino de Precisão no Mapa
                    </label>

                    <LocationPickerMap
                      latitude={createData.latitude}
                      longitude={createData.longitude}
                      devicePosition={devicePosition}
                      isInteractive={createData.latitude !== null && createData.longitude !== null}
                      onLocationChange={handleCreateMapLocationChange}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: GESTOR NO ONBOARDING */}
              {createTab === 'owner' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Nome do Gestor *
                    </label>
                    <input
                      type="text"
                      required
                      value={createData.admin_name}
                      onChange={(e) => {
                        setCreateData({ ...createData, admin_name: e.target.value })
                        setCreateFieldErrors((prev) => ({ ...prev, admin_name: undefined }))
                      }}
                      onBlur={() => validateCreateField('admin_name')}
                      placeholder="Ex: Matteo Bianchi"
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                        createFieldErrors.admin_name
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                      }`}
                    />
                    {createFieldErrors.admin_name && (
                      <p className="text-[11px] font-mono text-red-500">{createFieldErrors.admin_name}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      E-mail de Acesso do Gestor *
                    </label>
                    <input
                      type="email"
                      required
                      value={createData.admin_email}
                      onChange={(e) => {
                        setCreateData({ ...createData, admin_email: e.target.value })
                        setCreateFieldErrors((prev) => ({ ...prev, admin_email: undefined }))
                      }}
                      onBlur={() => validateCreateField('admin_email')}
                      placeholder="matteo@bellanapoli.com.br"
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                        createFieldErrors.admin_email
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                      }`}
                    />
                    {createFieldErrors.admin_email && (
                      <p className="text-[11px] font-mono text-red-500">{createFieldErrors.admin_email}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Telefone / WhatsApp do Gestor
                      </label>
                      <input
                        type="text"
                        value={createData.admin_phone}
                        onChange={(e) => {
                          setCreateData({ ...createData, admin_phone: formatPhone(e.target.value) })
                          setCreateFieldErrors((prev) => ({ ...prev, admin_phone: undefined }))
                        }}
                        onBlur={() => validateCreateField('admin_phone')}
                        placeholder="(00) 00000-0000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                          createFieldErrors.admin_phone
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.admin_phone && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.admin_phone}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        CPF do Gestor
                      </label>
                      <input
                        type="text"
                        value={createData.admin_document}
                        onChange={(e) => {
                          setCreateData({ ...createData, admin_document: formatCpf(e.target.value) })
                          setCreateFieldErrors((prev) => ({ ...prev, admin_document: undefined }))
                        }}
                        onBlur={() => validateCreateField('admin_document')}
                        placeholder="000.000.000-00"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                          createFieldErrors.admin_document
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {createFieldErrors.admin_document && (
                        <p className="text-[11px] font-mono text-red-500">{createFieldErrors.admin_document}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {createError && (
                <div className="py-2.5 px-3 border-l-2 border-red-500 text-xs font-mono text-red-600 dark:text-red-400 bg-red-500/5">
                  {createError}
                </div>
              )}

              {/* Footer Navigation Buttons */}
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                {createTab !== 'general' ? (
                  <button
                    type="button"
                    onClick={() => setCreateTab(createTab === 'owner' ? 'address' : 'general')}
                    className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar</span>
                  </button>
                ) : <div />}

                {createTab !== 'owner' ? (
                  <button
                    type="button"
                    onClick={() => setCreateTab(createTab === 'general' ? 'address' : 'owner')}
                    className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-950 font-mono text-xs font-semibold uppercase rounded transition-colors cursor-pointer ml-auto flex items-center gap-1.5"
                  >
                    <span>Próximo</span>
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isCreateValidToSubmit || isSubmittingCreate}
                    className="px-6 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 text-zinc-950 font-bold font-mono text-xs uppercase rounded transition-all cursor-pointer ml-auto flex items-center gap-2"
                  >
                    {isSubmittingCreate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Salvar Restaurante</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DRAWER: REGISTRO // EDIÇÃO (3 ABAS) ─────────────────────────────── */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          <div 
            className="fixed inset-0"
            onClick={() => setEditingTenant(null)}
          />

          <div className="w-full max-w-2xl bg-[#F8F7F4] dark:bg-[#0F1012] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200 z-10">
            
            {/* Header da Gaveta */}
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#141416]">
              <div>
                <span className="text-[11px] font-mono uppercase text-[#D4B316] dark:text-[#F5DC55] tracking-wider block">
                  Super Admin // Editar Restaurante
                </span>
                <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
                  {editingTenant.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingTenant(null)}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Abas do Formulário */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-mono">
              <button
                type="button"
                onClick={() => setEditTab('general')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  editTab === 'general'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>01 / Estabelecimento</span>
              </button>
              <button
                type="button"
                onClick={() => setEditTab('address')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  editTab === 'address'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>02 / Endereço</span>
              </button>
              <button
                type="button"
                onClick={() => setEditTab('owner')}
                className={`py-3 px-4 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  editTab === 'owner'
                    ? 'border-[#F5DC55] text-zinc-950 dark:text-zinc-50 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>03 / Gestor</span>
              </button>
            </div>

            <form onSubmit={handleUpdateTenant} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: ESTABELECIMENTO */}
              {editTab === 'general' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Nome Fantasia *
                    </label>
                    <input
                      type="text"
                      required
                      value={editData.name}
                      onChange={(e) => {
                        setEditData({ ...editData, name: e.target.value })
                        setEditFieldErrors((prev) => ({ ...prev, name: undefined }))
                      }}
                      onBlur={() => validateEditField('name')}
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                        editFieldErrors.name
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                      }`}
                    />
                    {editFieldErrors.name && (
                      <p className="text-[11px] font-mono text-red-500">{editFieldErrors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Razão Social
                      </label>
                      <input
                        type="text"
                        value={editData.legal_name}
                        onChange={(e) => setEditData({ ...editData, legal_name: e.target.value })}
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        CNPJ / CPF
                      </label>
                      <input
                        type="text"
                        value={editData.document}
                        onChange={(e) => {
                          setEditData({ ...editData, document: formatDocument(e.target.value) })
                          setEditFieldErrors((prev) => ({ ...prev, document: undefined }))
                        }}
                        onBlur={() => validateEditField('document')}
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.document
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.document && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.document}</p>
                      )}
                    </div>
                  </div>

                  {/* Cards de Domínio */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Tipo de Domínio *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditDomainType('subdomain')}
                        className={`p-3 text-left border rounded transition-all cursor-pointer ${
                          editDomainType === 'subdomain'
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
                        onClick={() => setEditDomainType('custom_domain')}
                        className={`p-3 text-left border rounded transition-all cursor-pointer ${
                          editDomainType === 'custom_domain'
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

                    {editDomainType === 'subdomain' ? (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center">
                          <input
                            type="text"
                            required
                            value={editData.slug}
                            onChange={(e) => {
                              setEditData({ ...editData, slug: formatSlug(e.target.value) })
                              setEditFieldErrors((prev) => ({ ...prev, slug: undefined }))
                            }}
                            onBlur={() => validateEditField('slug')}
                            className={`flex-1 px-3.5 py-2 bg-transparent border border-r-0 rounded-l text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                              editFieldErrors.slug
                                ? 'border-red-500 focus:border-red-500'
                                : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                            }`}
                          />
                          <span className="px-3.5 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 rounded-r text-xs font-mono text-zinc-500">
                            .doispalitos.tech
                          </span>
                        </div>
                        {editFieldErrors.slug && (
                          <p className="text-[11px] font-mono text-red-500">{editFieldErrors.slug}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 pt-1">
                        <input
                          type="text"
                          required
                          value={editData.custom_domain}
                          onChange={(e) => {
                            setEditData({ ...editData, custom_domain: e.target.value.toLowerCase().trim() })
                            setEditFieldErrors((prev) => ({ ...prev, custom_domain: undefined }))
                          }}
                          onBlur={() => validateEditField('custom_domain')}
                          placeholder="ex: pedidos.bellanapoli.com.br"
                          className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none ${
                            editFieldErrors.custom_domain
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                          }`}
                        />
                        {editFieldErrors.custom_domain ? (
                          <p className="text-[11px] font-mono text-red-500">{editFieldErrors.custom_domain}</p>
                        ) : (
                          <p className="text-[10px] font-mono text-zinc-400">
                            CNAME apontado para <span className="text-zinc-700 dark:text-zinc-300">doispalitos.tech</span>.
                          </p>
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
                        value={editData.email}
                        onChange={(e) => {
                          setEditData({ ...editData, email: e.target.value })
                          setEditFieldErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        onBlur={() => validateEditField('email')}
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.email
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.email && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Telefone / WhatsApp Comercial
                      </label>
                      <input
                        type="text"
                        value={editData.phone}
                        onChange={(e) => {
                          setEditData({ ...editData, phone: formatPhone(e.target.value) })
                          setEditFieldErrors((prev) => ({ ...prev, phone: undefined }))
                        }}
                        onBlur={() => validateEditField('phone')}
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.phone
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.phone && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ENDEREÇO NA EDIÇÃO */}
              {editTab === 'address' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500 flex items-center justify-between">
                        <span>CEP *</span>
                        {isSearchingEditCep && (
                          <Loader2 className="w-3 h-3 animate-spin text-[#D4B316] dark:text-[#F5DC55]" />
                        )}
                      </label>
                      <input
                        type="text"
                        maxLength={9}
                        value={editData.postal_code}
                        onChange={(e) => handleEditCepChange(e.target.value)}
                        onBlur={() => validateEditField('postal_code')}
                        placeholder="00000-000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.postal_code
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.postal_code && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.postal_code}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Estado (UF) *
                      </label>
                      <div className="relative">
                        <select
                          value={editData.state}
                          onChange={(e) => {
                            setEditData({ ...editData, state: e.target.value, city: '' })
                            loadEditCities(e.target.value)
                          }}
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
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Cidade *
                      </label>
                      <div className="relative">
                        <select
                          value={editData.city}
                          onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                          disabled={!editData.state}
                          className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none appearance-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="" className="dark:bg-zinc-900">
                            {editData.state ? 'Selecione a cidade' : 'Escolha a UF'}
                          </option>
                          {editCities.map((c) => (
                            <option key={c} value={c} className="dark:bg-zinc-900">
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {editCepStatus && (
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {editCepStatus}
                    </p>
                  )}

                  {/* Logradouro + Número */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Logradouro (Rua / Av.) *
                      </label>
                      <input
                        type="text"
                        value={editData.street}
                        onChange={(e) => {
                          setEditData({ ...editData, street: e.target.value })
                          setEditFieldErrors((prev) => ({ ...prev, street: undefined }))
                        }}
                        onBlur={() => validateEditField('street')}
                        placeholder="Av. Paulista"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.street
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.street && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.street}</p>
                      )}
                    </div>
                    <div className="sm:col-span-1 space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Número *
                      </label>
                      <input
                        type="text"
                        value={editData.number}
                        onChange={(e) => {
                          setEditData({ ...editData, number: e.target.value })
                          setEditFieldErrors((prev) => ({ ...prev, number: undefined }))
                        }}
                        onBlur={() => validateEditField('number')}
                        placeholder="1000"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.number
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.number && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.number}</p>
                      )}
                    </div>
                  </div>

                  {/* Bairro + Complemento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        value={editData.neighborhood}
                        onChange={(e) => {
                          setEditData({ ...editData, neighborhood: e.target.value })
                          setEditFieldErrors((prev) => ({ ...prev, neighborhood: undefined }))
                        }}
                        onBlur={() => validateEditField('neighborhood')}
                        placeholder="Bela Vista"
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.neighborhood
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.neighborhood && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.neighborhood}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={editData.complement}
                        onChange={(e) => setEditData({ ...editData, complement: e.target.value })}
                        placeholder="Sala 12, Bloco B"
                        className="w-full px-3.5 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#F5DC55] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Botão Adquirir Geolocalização */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={handleEditAcquireGeolocation}
                      disabled={!isEditAddressComplete || isGeocodingEdit}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer self-start"
                    >
                      {isGeocodingEdit ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                      ) : (
                        <LocateFixed className="w-3.5 h-3.5 text-zinc-950" />
                      )}
                      <span>Adquirir Geolocalização</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      <span>Lat:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 select-all">
                        {editData.latitude !== null ? editData.latitude.toFixed(6) : '—'}
                      </span>
                      <span>| Lng:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 select-all">
                        {editData.longitude !== null ? editData.longitude.toFixed(6) : '—'}
                      </span>
                    </div>
                  </div>

                  {editGeocodingFeedback && (
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 italic">
                      {editGeocodingFeedback}
                    </p>
                  )}

                  {/* Mapa com ajuste fino restrito */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-mono uppercase text-zinc-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55]" />
                      Ajuste Fino de Precisão no Mapa
                    </label>

                    <LocationPickerMap
                      latitude={editData.latitude}
                      longitude={editData.longitude}
                      devicePosition={devicePosition}
                      isInteractive={editData.latitude !== null && editData.longitude !== null}
                      onLocationChange={handleEditMapLocationChange}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: GESTOR NA EDIÇÃO */}
              {editTab === 'owner' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      Nome do Gestor *
                    </label>
                    <input
                      type="text"
                      required
                      value={editData.owner_name}
                      onChange={(e) => {
                        setEditData({ ...editData, owner_name: e.target.value })
                        setEditFieldErrors((prev) => ({ ...prev, owner_name: undefined }))
                      }}
                      onBlur={() => validateEditField('owner_name')}
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                        editFieldErrors.owner_name
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                      }`}
                    />
                    {editFieldErrors.owner_name && (
                      <p className="text-[11px] font-mono text-red-500">{editFieldErrors.owner_name}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-mono uppercase text-zinc-500">
                      E-mail de Acesso *
                    </label>
                    <input
                      type="email"
                      required
                      value={editData.owner_email}
                      onChange={(e) => {
                        setEditData({ ...editData, owner_email: e.target.value })
                        setEditFieldErrors((prev) => ({ ...prev, owner_email: undefined }))
                      }}
                      onBlur={() => validateEditField('owner_email')}
                      className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                        editFieldErrors.owner_email
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                      }`}
                    />
                    {editFieldErrors.owner_email && (
                      <p className="text-[11px] font-mono text-red-500">{editFieldErrors.owner_email}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        Telefone / WhatsApp do Gestor
                      </label>
                      <input
                        type="text"
                        value={editData.owner_phone}
                        onChange={(e) => {
                          setEditData({ ...editData, owner_phone: formatPhone(e.target.value) })
                          setEditFieldErrors((prev) => ({ ...prev, owner_phone: undefined }))
                        }}
                        onBlur={() => validateEditField('owner_phone')}
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.owner_phone
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.owner_phone && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.owner_phone}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-mono uppercase text-zinc-500">
                        CPF do Gestor
                      </label>
                      <input
                        type="text"
                        value={editData.owner_document}
                        onChange={(e) => {
                          setEditData({ ...editData, owner_document: formatCpf(e.target.value) })
                          setEditFieldErrors((prev) => ({ ...prev, owner_document: undefined }))
                        }}
                        onBlur={() => validateEditField('owner_document')}
                        className={`w-full px-3.5 py-2 bg-transparent border rounded text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none ${
                          editFieldErrors.owner_document
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-zinc-300 dark:border-zinc-800 focus:border-[#F5DC55]'
                        }`}
                      />
                      {editFieldErrors.owner_document && (
                        <p className="text-[11px] font-mono text-red-500">{editFieldErrors.owner_document}</p>
                      )}
                    </div>
                  </div>

                  {/* Botão de Disparo de Nova Senha */}
                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isResettingPassword}
                      className="w-full py-2.5 px-4 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 text-zinc-900 dark:text-zinc-100 font-mono text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isResettingPassword ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Redefinindo senha...</span>
                        </>
                      ) : (
                        <span>Redefinir e Enviar Nova Senha por E-mail</span>
                      )}
                    </button>

                    {resetSuccessMessage && (
                      <div className="p-3 border-l-2 border-emerald-500 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 select-all">
                        {resetSuccessMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {editError && (
                <div className="py-2.5 px-3 border-l-2 border-red-500 text-xs font-mono text-red-600 dark:text-red-400 bg-red-500/5">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="py-2.5 px-3 border-l-2 border-emerald-500 text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                  {editSuccess}
                </div>
              )}

              {/* Footer Navigation Buttons */}
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                {editTab !== 'general' ? (
                  <button
                    type="button"
                    onClick={() => setEditTab(editTab === 'owner' ? 'address' : 'general')}
                    className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar</span>
                  </button>
                ) : <div />}

                {editTab !== 'owner' ? (
                  <button
                    type="button"
                    onClick={() => setEditTab(editTab === 'general' ? 'address' : 'owner')}
                    className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-950 font-mono text-xs font-semibold uppercase rounded transition-colors cursor-pointer ml-auto flex items-center gap-1.5"
                  >
                    <span>Próximo</span>
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!isEditValidToSubmit || isSubmittingEdit}
                    className="px-6 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 text-zinc-950 font-bold font-mono text-xs uppercase rounded transition-all cursor-pointer ml-auto flex items-center gap-2"
                  >
                    {isSubmittingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Salvar Alterações</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONFIRMAÇÃO DE ARQUIVAMENTO (SOFT DELETE) ────────────────── */}
      {deletingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDeletingTenant(null)}
          />
          <div className="relative w-full max-w-md bg-[#F8F7F4] dark:bg-[#0F1012] border border-zinc-300 dark:border-zinc-800 p-8 rounded-lg shadow-xl z-10 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Desativar Restaurante
              </span>
              <h3 className="text-xl font-medium text-zinc-950 dark:text-zinc-50">
                {deletingTenant.name}
              </h3>
              <p className="text-xs font-light text-zinc-600 dark:text-zinc-400">
                Tem certeza que deseja desativar este restaurante? A loja ficará inacessível para novos pedidos, mas todos os registros e históricos permanecerão preservados com segurança.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeletingTenant(null)}
                className="w-1/2 py-2.5 border border-zinc-300 dark:border-zinc-800 text-xs font-mono uppercase rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTenant}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs font-mono uppercase rounded-lg cursor-pointer transition-colors"
              >
                Confirmar Desativação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setSuccessModal(null)}
          />
          <div className="relative w-full max-w-md bg-[#F8F7F4] dark:bg-[#0F1012] border border-zinc-300 dark:border-zinc-800 p-8 rounded-lg shadow-xl z-10 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-[#A68800] dark:text-[#F5DC55]">
                Restaurante Cadastrado com Sucesso
              </span>
              <h3 className="text-xl font-medium text-zinc-950 dark:text-zinc-50">
                {successModal.tenantName}
              </h3>
            </div>

            <div className="space-y-3 p-4 border border-zinc-200 dark:border-zinc-800 text-xs font-mono bg-zinc-100/50 dark:bg-zinc-900/50">
              <div>
                <span className="text-zinc-400 block">Endereço Web:</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-semibold select-all">
                  {successModal.primaryUrl}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">E-mail do Gestor:</span>
                <span className="text-zinc-950 dark:text-zinc-100 font-semibold select-all">
                  {successModal.adminEmail}
                </span>
              </div>
              {successModal.generatedPassword && (
                <div>
                  <span className="text-zinc-400 block">Senha Gerada (Enviada por E-mail):</span>
                  <span className="text-zinc-950 dark:text-zinc-100 font-semibold bg-[#F5DC55] px-1.5 py-0.5 rounded select-all text-[13px]">
                    {successModal.generatedPassword}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSuccessModal(null)}
              className="w-full py-3 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-semibold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL DE SOLICITAÇÕES DE ALTERAÇÃO CADASTRAL ────────────────────── */}
      <ChangeRequestsModal
        isOpen={isChangeRequestsModalOpen}
        onClose={() => {
          setIsChangeRequestsModalOpen(false)
          fetchTenants()
        }}
        onTenantUpdated={() => {
          fetchTenants()
        }}
      />

    </div>
  )
}
