import { useState, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { KeyRound, ShieldAlert, Eye, EyeOff, Loader2, LogOut, CheckCircle2 } from 'lucide-react'

export function ForcePasswordChangeModal() {
  const { changePassword, logout, user } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMinLength = newPassword.length >= 8
  const isMatching = newPassword !== '' && newPassword === confirmPassword

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isMinLength) {
      setError('A nova senha deve conter no mínimo 8 caracteres.')
      return
    }

    if (!isMatching) {
      setError('As senhas digitadas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(newPassword, confirmPassword)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }
      const validationError = axiosErr.response?.data?.errors?.password?.[0]
      const msg = validationError || axiosErr.response?.data?.message || 'Erro ao redefinir a senha. Tente novamente.'
      setError(msg)
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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        role="dialog" 
        aria-modal="true" 
        className="w-full max-w-md bg-[#FAF9F6] dark:bg-[#141518] border border-zinc-300 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 text-zinc-900 dark:text-zinc-100"
      >
        {/* Header Icon + Pill */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#F5DC55]/20 dark:bg-[#F5DC55]/10 border border-[#F5DC55]/40 flex items-center justify-center text-[#D4B316] dark:text-[#F5DC55]">
              <KeyRound className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Primeiro Acesso // Segurança
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Defina sua Senha Definitiva
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
              Olá, <strong className="text-zinc-900 dark:text-zinc-200">{user?.name}</strong>. Por segurança, sua senha temporária precisa ser substituída por uma senha pessoal definitiva para você acessar o painel.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div className="space-y-1.5">
            <label 
              htmlFor="new-password"
              className="block text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                placeholder="Mínimo de 8 caracteres"
                className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 text-sm focus:border-[#F5DC55] dark:focus:border-[#F5DC55] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label 
              htmlFor="confirm-password"
              className="block text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Confirmar Nova Senha
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Digite novamente a nova senha"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900/70 border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 text-sm focus:border-[#F5DC55] dark:focus:border-[#F5DC55] focus:outline-none transition-colors"
            />
          </div>

          {/* Validation Checklist */}
          <div className="py-1 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            <div className={`flex items-center gap-2 ${isMinLength ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${isMinLength ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-600'}`} />
              <span>Mínimo de 8 caracteres</span>
            </div>
            <div className={`flex items-center gap-2 ${isMatching ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${isMatching ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-600'}`} />
              <span>Senhas conferem exatamente</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !isMinLength || !isMatching}
            className="w-full mt-2 py-3 px-4 bg-[#F5DC55] hover:bg-[#E5CB3C] text-zinc-950 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando e desbloqueando...</span>
              </>
            ) : (
              <span>Salvar Nova Senha & Desbloquear Painel</span>
            )}
          </button>
        </form>

        {/* Footer Logout Option */}
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-mono flex items-center gap-1.5 transition-colors py-1 px-2 rounded cursor-pointer disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>Sair desta conta</span>
          </button>
        </div>
      </div>
    </div>
  )
}
