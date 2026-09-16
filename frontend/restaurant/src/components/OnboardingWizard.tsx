import { useState, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import { TimeInput } from '@/components/TimeInput'
import {
  KeyRound,
  Clock,
  Truck,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
  AlertCircle,
  Store,
} from 'lucide-react'

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
]

export function OnboardingWizard() {
  const { user, tenant, changePassword, updateTenantSettings, refreshUserAndTenant, logout } = useAuth()

  // Steps:
  // 1: Password (only if must_change_password)
  // 2: Channels (Delivery, Pickup, Dine-in)
  // 3: Hours (7 days, free TimeInput)
  // 4: Delivery Fees (only if delivery is enabled)
  // 5: Payments (Pix, Credit, Debit, Cash)
  // 6: Completion
  const [currentStep, setCurrentStep] = useState<number>(() => {
    return user?.must_change_password ? 1 : 2
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Step 1: Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 2: Channels
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [pickupEnabled, setPickupEnabled] = useState(false)
  const [dineInEnabled, setDineInEnabled] = useState(false)

  // Step 3: Hours (strictly empty by default)
  const [openingHours, setOpeningHours] = useState<Record<string, { open: boolean; start: string; end: string }>>({
    monday: { open: false, start: '', end: '' },
    tuesday: { open: false, start: '', end: '' },
    wednesday: { open: false, start: '', end: '' },
    thursday: { open: false, start: '', end: '' },
    friday: { open: false, start: '', end: '' },
    saturday: { open: false, start: '', end: '' },
    sunday: { open: false, start: '', end: '' },
  })

  // Step 4: Delivery Fees (strictly blank)
  const [feeMode, setFeeMode] = useState<'fixed_radius' | 'dynamic_km' | 'custom_neighborhoods'>('fixed_radius')
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>('')
  const [fixedFee, setFixedFee] = useState<string>('')
  const [dynamicBaseFee, setDynamicBaseFee] = useState<string>('')
  const [dynamicFeePerKm, setDynamicFeePerKm] = useState<string>('')
  const [minOrderAmount, setMinOrderAmount] = useState<string>('')

  // Step 5: Payments
  const [paymentMethods, setPaymentMethods] = useState({
    pix: false,
    credit_card: false,
    debit_card: false,
    cash: false,
  })

  // Password Submit
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('A nova senha deve ter no mínimo 8 dígitos.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(newPassword, confirmPassword)
      setCurrentStep(2)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg = axiosErr.response?.data?.errors?.password?.[0] || axiosErr.response?.data?.message || 'Erro ao alterar a senha.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Navigation Logic
  const handleNextFromHours = () => {
    setError(null)
    // Se delivery próprio não foi selecionado, pula direto para pagamentos (Passo 5)
    if (!deliveryEnabled) {
      setCurrentStep(5)
    } else {
      setCurrentStep(4)
    }
  }

  const handleBackFromPayments = () => {
    setError(null)
    if (!deliveryEnabled) {
      setCurrentStep(3)
    } else {
      setCurrentStep(4)
    }
  }

  // Finish Onboarding
  const handleFinishOnboarding = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      const sanitizedSettings = {
        delivery: {
          enabled: deliveryEnabled,
          fee_mode: deliveryEnabled ? feeMode : 'fixed_radius',
          max_distance_km: deliveryEnabled && maxDistanceKm ? Number(maxDistanceKm.replace(',', '.')) : null,
          fixed_fee: deliveryEnabled && fixedFee ? Number(fixedFee.replace(',', '.')) : null,
          dynamic_base_fee: deliveryEnabled && dynamicBaseFee ? Number(dynamicBaseFee.replace(',', '.')) : null,
          dynamic_fee_per_km: deliveryEnabled && dynamicFeePerKm ? Number(dynamicFeePerKm.replace(',', '.')) : null,
          min_order_amount: deliveryEnabled && minOrderAmount ? Number(minOrderAmount.replace(',', '.')) : null,
          neighborhood_fees: tenant?.settings?.delivery?.neighborhood_fees || [],
        },
        pickup: {
          enabled: pickupEnabled,
        },
        dine_in: {
          enabled: dineInEnabled,
        },
        opening_hours: openingHours,
        payment_methods: paymentMethods,
        onboarding_completed: true,
      }

      const res = await api.put('/restaurant/settings', {
        settings: sanitizedSettings,
      })

      if (res.data?.settings) {
        updateTenantSettings(res.data.settings)
      }
      await refreshUserAndTenant()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || 'Erro ao salvar configuração inicial. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const stepsDefinition = [
    ...(user?.must_change_password ? [{ id: 1, title: 'Senha', icon: KeyRound }] : []),
    { id: 2, title: 'Canais', icon: Store },
    { id: 3, title: 'Horários', icon: Clock },
    ...(deliveryEnabled ? [{ id: 4, title: 'Entrega', icon: Truck }] : []),
    { id: 5, title: 'Pagamento', icon: CreditCard },
    { id: 6, title: 'Conclusão', icon: CheckCircle2 },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      
      {/* Right-Side Slide-Over Drawer */}
      <div 
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl bg-white dark:bg-[#121316] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300 text-zinc-900 dark:text-zinc-100"
      >
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col gap-4 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Primeiro Acesso // {tenant?.name || 'Restaurante'}
              </span>
              <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Configuração Inicial da Loja
              </h2>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-xs font-mono text-zinc-400 hover:text-red-500 flex items-center gap-1.5 transition-colors p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px]">Sair</span>
            </button>
          </div>

          {/* Stepper Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {stepsDefinition.map((step, idx) => {
              const isPast = currentStep > step.id
              const isCurrent = currentStep === step.id
              const Icon = step.icon

              return (
                <div key={step.id} className="flex items-center gap-1 flex-1 min-w-[58px]">
                  <div
                    className={`flex items-center gap-1.5 py-1 px-2 rounded border text-xs font-mono w-full justify-center transition-all ${
                      isCurrent
                        ? 'border-zinc-900 dark:border-zinc-100 text-zinc-950 dark:text-zinc-50 font-bold bg-zinc-200/50 dark:bg-zinc-800/50'
                        : isPast
                        ? 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 bg-transparent'
                        : 'border-transparent text-zinc-400 dark:text-zinc-600'
                    }`}
                  >
                    {isPast ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline text-[11px] truncate">{step.title}</span>
                  </div>
                  {idx < stepsDefinition.length - 1 && (
                    <div className="w-2 h-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* STEP 1: PASSWORD CHANGE */}
          {currentStep === 1 && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  Defina sua Senha Pessoal Definitiva
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Substitua a senha provisória de acesso por uma senha pessoal com no mínimo 8 dígitos.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-3 py-2 pr-10 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs font-mono text-zinc-500">
                  <div className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mínimo de 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-2 ${newPassword && newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Senhas conferem exatamente</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-mono font-medium rounded transition-opacity flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Salvar Senha e Prosseguir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: CHANNELS (DELIVERY, PICKUP, DINE-IN) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  Canais de Atendimento Operados
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Selecione as modalidades disponíveis no restaurante. Lojas sem entregadores próprios podem deixar o delivery desmarcado.
                </p>
              </div>

              <div className="space-y-3">
                
                {/* Delivery Próprio */}
                <label className={`p-4 rounded border flex items-start gap-3.5 cursor-pointer transition-colors ${
                  deliveryEnabled
                    ? 'border-zinc-900 dark:border-zinc-200 bg-zinc-100/50 dark:bg-zinc-800/40'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}>
                  <input
                    type="checkbox"
                    checked={deliveryEnabled}
                    onChange={(e) => setDeliveryEnabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-zinc-950 dark:accent-zinc-100 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold font-mono uppercase block text-zinc-950 dark:text-zinc-100">
                      Delivery Próprio
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Entregas realizadas com frota ou motoboys próprios do restaurante até o endereço do cliente.
                    </p>
                  </div>
                </label>

                {/* Retirada no Balcão */}
                <label className={`p-4 rounded border flex items-start gap-3.5 cursor-pointer transition-colors ${
                  pickupEnabled
                    ? 'border-zinc-900 dark:border-zinc-200 bg-zinc-100/50 dark:bg-zinc-800/40'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}>
                  <input
                    type="checkbox"
                    checked={pickupEnabled}
                    onChange={(e) => setPickupEnabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-zinc-950 dark:accent-zinc-100 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold font-mono uppercase block text-zinc-950 dark:text-zinc-100">
                      Retirada no Balcão (Takeaway)
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Cliente faz o pedido online e retira presencialmente no estabelecimento sem custo de entrega.
                    </p>
                  </div>
                </label>

                {/* Consumo no Salão / Mesas */}
                <label className={`p-4 rounded border flex items-start gap-3.5 cursor-pointer transition-colors ${
                  dineInEnabled
                    ? 'border-zinc-900 dark:border-zinc-200 bg-zinc-100/50 dark:bg-zinc-800/40'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}>
                  <input
                    type="checkbox"
                    checked={dineInEnabled}
                    onChange={(e) => setDineInEnabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-zinc-950 dark:accent-zinc-100 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold font-mono uppercase block text-zinc-950 dark:text-zinc-100">
                      Consumo no Salão / Mesas
                    </span>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Atendimento interno presencial, comanda digital por mesa ou balcão.
                    </p>
                  </div>
                </label>

              </div>

              <div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/80">
                {user?.must_change_password ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-mono font-medium rounded transition-opacity flex items-center gap-2 cursor-pointer"
                >
                  <span>Avançar para Horários</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: OPERATING HOURS (FREE INPUT, NO DEFAULTS) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  Horários de Abertura da Loja
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Marque os dias em que a loja funciona e digite livremente o horário de início e término.
                </p>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900/40">
                {DAYS_OF_WEEK.map((day) => {
                  const conf = openingHours[day.key] || { open: false, start: '', end: '' }
                  return (
                    <div key={day.key} className="p-3 sm:px-4 flex items-center justify-between gap-4 text-xs font-mono">
                      
                      <div className="flex items-center gap-3 min-w-[130px]">
                        <input
                          type="checkbox"
                          checked={conf.open}
                          onChange={(e) => {
                            const isOpen = e.target.checked
                            setOpeningHours((prev) => ({
                              ...prev,
                              [day.key]: { ...conf, open: isOpen },
                            }))
                          }}
                          className="w-4 h-4 accent-zinc-950 dark:accent-zinc-100 rounded cursor-pointer"
                        />
                        <span className={conf.open ? 'font-medium text-zinc-950 dark:text-zinc-100' : 'text-zinc-400'}>
                          {day.label}
                        </span>
                      </div>

                      {conf.open ? (
                        <div className="flex items-center gap-2">
                          <TimeInput
                            value={conf.start || ''}
                            onChange={(val) => {
                              setOpeningHours((prev) => ({
                                ...prev,
                                [day.key]: { ...conf, start: val },
                              }))
                            }}
                          />
                          <span className="text-zinc-400">às</span>
                          <TimeInput
                            value={conf.end || ''}
                            onChange={(val) => {
                              setOpeningHours((prev) => ({
                                ...prev,
                                [day.key]: { ...conf, end: val },
                              }))
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[11px] italic">Fechado</span>
                      )}

                    </div>
                  )
                })}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleNextFromHours}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-mono font-medium rounded transition-opacity flex items-center gap-2 cursor-pointer"
                >
                  <span>{deliveryEnabled ? 'Avançar para Entrega' : 'Avançar para Pagamentos'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: DELIVERY RULES (ONLY IF DELIVERY ENABLED) */}
          {currentStep === 4 && deliveryEnabled && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  Modelo de Cobrança do Delivery
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Defina como a taxa de entrega própria será calculada.
                </p>
              </div>

              {/* Fee Mode Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { key: 'fixed_radius', title: 'Taxa Fixa', desc: 'Cobrança de valor único dentro do raio de alcance.' },
                  { key: 'dynamic_km', title: 'Por Quilômetro', desc: 'Taxa base mais valor por quilômetro percorrido.' },
                  { key: 'custom_neighborhoods', title: 'Por Bairros', desc: 'Definição manual de taxas específicas para cada bairro.' },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setFeeMode(mode.key as any)}
                    className={`p-3.5 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      feeMode === mode.key
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/50 dark:bg-zinc-800/50 font-medium'
                        : 'border-zinc-200 dark:border-zinc-800 bg-transparent'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-mono uppercase block text-zinc-950 dark:text-zinc-100">
                        {mode.title}
                      </span>
                      <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                        {mode.desc}
                      </p>
                    </div>
                    {feeMode === mode.key && (
                      <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-zinc-100 mt-2.5 self-end" />
                    )}
                  </button>
                ))}
              </div>

              {/* Mode Specific Inputs without fake examples */}
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded space-y-4 bg-zinc-50/40 dark:bg-zinc-900/30">
                {feeMode === 'fixed_radius' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                        Taxa de Entrega (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fixedFee}
                        onChange={(e) => setFixedFee(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                        Raio Máximo de Alcance (km)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={maxDistanceKm}
                        onChange={(e) => setMaxDistanceKm(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {feeMode === 'dynamic_km' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                        Taxa Base (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={dynamicBaseFee}
                        onChange={(e) => setDynamicBaseFee(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                        Valor por Km (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={dynamicFeePerKm}
                        onChange={(e) => setDynamicFeePerKm(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                        Raio Máximo (km)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={maxDistanceKm}
                        onChange={(e) => setMaxDistanceKm(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {feeMode === 'custom_neighborhoods' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">
                      Você poderá cadastrar e ativar cada bairro e suas respectivas taxas no mapa de Configurações após este assistente.
                    </p>
                    <div className="space-y-1.5 max-w-xs">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                        Raio Limite Estimado (km)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={maxDistanceKm}
                        onChange={(e) => setMaxDistanceKm(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Min Order Amount */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 block">
                      Valor Mínimo para Pedido (R$)
                    </label>
                    <span className="text-[11px] text-zinc-400">Opcional (deixe vazio se não houver)</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-24 px-3 py-1.5 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded text-sm font-mono text-right focus:border-zinc-950 dark:focus:border-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-mono font-medium rounded transition-opacity flex items-center gap-2 cursor-pointer"
                >
                  <span>Avançar para Pagamentos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: PAYMENT METHODS */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  Formas de Pagamento Aceitas
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Indique quais meios de cobrança estarão habilitados para o cliente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'pix', title: 'Pix Instantâneo' },
                  { key: 'credit_card', title: 'Cartão de Crédito' },
                  { key: 'debit_card', title: 'Cartão de Débito' },
                  { key: 'cash', title: 'Dinheiro em Espécie' },
                ].map((pm) => {
                  const isChecked = Boolean(paymentMethods[pm.key as keyof typeof paymentMethods])
                  return (
                    <label
                      key={pm.key}
                      className={`p-3.5 rounded border flex items-center gap-3 cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-zinc-900 dark:border-zinc-200 bg-zinc-100/50 dark:bg-zinc-800/40'
                          : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setPaymentMethods((prev) => ({
                            ...prev,
                            [pm.key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-zinc-950 dark:accent-zinc-100 rounded cursor-pointer"
                      />
                      <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {pm.title}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={handleBackFromPayments}
                  className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-mono font-medium rounded transition-opacity flex items-center gap-2 cursor-pointer"
                >
                  <span>Revisar e Concluir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: COMPLETION SUMMARY */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  Pronto para Operar
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Confira o resumo das configurações. Você poderá alterar qualquer parâmetro a qualquer momento no menu Configurações.
                </p>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded divide-y divide-zinc-200 dark:divide-zinc-800 text-xs font-mono">
                
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-zinc-400">Canais Ativos:</span>
                  <span className="text-zinc-950 dark:text-zinc-50">
                    {[
                      deliveryEnabled ? 'Delivery Próprio' : null,
                      pickupEnabled ? 'Balcão' : null,
                      dineInEnabled ? 'Salão/Mesas' : null,
                    ].filter(Boolean).join(', ') || 'Nenhum canal selecionado'}
                  </span>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-zinc-400">Dias de Abertura:</span>
                  <span className="text-zinc-950 dark:text-zinc-50">
                    {Object.values(openingHours).filter((d) => d.open).length} dias configurados
                  </span>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-zinc-400">Logística de Entrega:</span>
                  <span className="text-zinc-950 dark:text-zinc-50">
                    {deliveryEnabled
                      ? feeMode === 'custom_neighborhoods'
                        ? 'Por Bairros'
                        : feeMode === 'dynamic_km'
                        ? 'Dinâmica/Km'
                        : 'Taxa Fixa'
                      : 'Sem entrega própria'}
                  </span>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-zinc-400">Pagamentos Aceitos:</span>
                  <span className="text-zinc-950 dark:text-zinc-50">
                    {[
                      paymentMethods.pix ? 'Pix' : null,
                      paymentMethods.credit_card ? 'Crédito' : null,
                      paymentMethods.debit_card ? 'Débito' : null,
                      paymentMethods.cash ? 'Dinheiro' : null,
                    ].filter(Boolean).join(', ') || 'A definir'}
                  </span>
                </div>

              </div>

              <div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 font-mono font-medium text-xs rounded transition-opacity flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Concluir e Acessar o Painel</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
