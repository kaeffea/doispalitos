import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Loader2, ArrowRight, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: { email?: string[] }, message?: string } } }
      const msg =
        axiosErr.response?.data?.errors?.email?.[0] ||
        axiosErr.response?.data?.message ||
        'Credenciais inválidas de superadministrador.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col justify-between font-sans selection:bg-[#F5DC55] selection:text-zinc-950">
      
      {/* Top Header Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-5 flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-600 hidden sm:inline flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55]" />
            Acesso Restrito // Superadmin
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Editorial Split Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center">
        
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <p className="text-[12px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Núcleo de Governança // Super Admin
            </p>
            <h1 className="text-4xl sm:text-6xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50 leading-[1.08]">
              Controle global da plataforma.
            </h1>
          </div>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl font-light leading-relaxed">
            Painel de governança global, credenciamento de restaurantes parceiros e acompanhamento da plataforma.
          </p>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap gap-8 text-xs font-mono text-zinc-500">
            <div>
              <span className="text-zinc-950 dark:text-zinc-200 font-semibold block text-sm">Gestão Centralizada</span>
              <span>Restaurantes Parceiros</span>
            </div>
            <div>
              <span className="text-zinc-950 dark:text-zinc-200 font-semibold block text-sm">Super Admin</span>
              <span>Acesso Restrito</span>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-5 lg:pl-6">
          <div className="space-y-6">
            
            <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
              <h2 className="text-xl font-medium text-zinc-950 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>Autenticação Mestre</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                Informe as credenciais do superadministrador da rede.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-1.5">
                <label 
                  htmlFor="email" 
                  className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  E-mail do Administrador Mestre
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="admin@doispalitos.tech"
                  className="w-full px-3.5 py-3 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:border-[#F5DC55] focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label 
                  htmlFor="password" 
                  className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  Senha Mestre
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-3 bg-transparent border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:border-[#F5DC55] focus:outline-none transition-colors"
                />
              </div>

              {error && (
                <div className="py-2.5 px-3 border-l-2 border-red-500 text-xs font-mono text-red-600 dark:text-red-400 bg-red-500/5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-sm transition-all flex items-center justify-between rounded-lg cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validando Acesso Mestre...
                  </span>
                ) : (
                  <>
                    <span>Entrar no Painel Global</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

            <div className="pt-4 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
              Rota restrita // Registros de auditoria ativados.
            </div>

          </div>
        </div>

      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
        <span>doispalitos.tech // superadmin</span>
        <span>Área Protegida</span>
      </footer>

    </div>
  )
}
