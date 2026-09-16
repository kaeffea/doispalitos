import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationCenter } from '@/components/NotificationCenter'
import api from '@/lib/api'
import { LogOut, ArrowRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Tenant {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  is_active: boolean
  users_count: number
  subdomain: string
  created_at: string
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/tenants')
      .then((res) => setTenants(res.data.tenants))
      .catch((err) => console.error('Erro ao buscar estatísticas:', err))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-[#F5DC55] selection:text-zinc-950">

      {/* Editorial Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-8">
          <Logo size="sm" />
          <nav className="flex items-center gap-3 sm:gap-6 text-xs font-mono">
            <span className="text-zinc-950 dark:text-zinc-100 border-b border-[#F5DC55] pb-0.5 font-semibold">
              01 / Visão Geral
            </span>
            <Link to="/restaurants" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              02 / Restaurantes
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">
            {user?.name}
          </span>
          <NotificationCenter />
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

      {/* Main Editorial Content (No Cards) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-10 space-y-12">
        
        {/* Title & Status Block */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-8 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Ambiente // Super Administrador
            </p>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
              Painel do Sistema
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/restaurants"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F5DC55] hover:bg-[#E5CB3C] active:scale-[0.99] text-zinc-950 font-semibold text-xs tracking-wide uppercase transition-all rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Gerenciar Restaurantes</span>
            </Link>
          </div>
        </div>

        {/* Minimal Metric Ledger */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border-y border-zinc-200 dark:border-zinc-800/80 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800/80">
          <div className="py-6 sm:px-6 first:pl-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1">
              Restaurantes Cadastrados
            </span>
            <span className="text-3xl font-medium text-zinc-950 dark:text-zinc-50">
              {isLoading ? '...' : tenants.length}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-1 font-mono">
              Restaurantes ativos na plataforma
            </span>
          </div>

          <div className="py-6 sm:px-6">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1">
              Pedidos Hoje
            </span>
            <span className="text-3xl font-medium text-zinc-950 dark:text-zinc-50">0</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-1 font-mono">
              Monitoramento em tempo real
            </span>
          </div>

          <div className="py-6 sm:px-6 last:pr-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1">
              Status da Plataforma
            </span>
            <span className="text-3xl font-medium text-emerald-600 dark:text-emerald-400">Online</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-1 font-mono">
              Sistemas e APIs operacionais
            </span>
          </div>
        </div>

        {/* Section: Ledger of Tenants */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-950 dark:text-zinc-100">
              Restaurantes Recentes
            </h2>
            <Link
              to="/restaurants"
              className="text-xs font-mono text-[#D4B316] dark:text-[#F5DC55] hover:underline inline-flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Clean Editorial Table */}
          <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-none divide-y divide-zinc-200 dark:divide-zinc-800/80">
            <div className="p-3 sm:px-6 grid grid-cols-12 text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-100/40 dark:bg-zinc-900/30">
              <span className="col-span-5">Restaurante</span>
              <span className="col-span-4">Subdomínio</span>
              <span className="col-span-3 text-right">Status</span>
            </div>

            {tenants.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-light">
                  Nenhum restaurante parceiro registrado ainda.
                </p>
                <Link
                  to="/restaurants"
                  className="text-xs font-mono text-[#D4B316] dark:text-[#F5DC55] hover:underline block"
                >
                  + Realizar primeiro onboarding
                </Link>
              </div>
            ) : (
              tenants.slice(0, 5).map((t) => (
                <div 
                  key={t.id}
                  className="p-3 sm:px-6 grid grid-cols-12 items-center text-sm hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors"
                >
                  <div className="col-span-5 min-w-0 pr-2">
                    <p className="font-medium text-zinc-950 dark:text-zinc-50 truncate">
                      {t.name}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate">
                      {t.email || 'Sem e-mail'}
                    </p>
                  </div>

                  <div className="col-span-4 min-w-0 pr-2">
                    <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate block">
                      {t.subdomain}
                    </span>
                  </div>

                  <div className="col-span-3 text-right">
                    {t.is_active ? (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 px-6 sm:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
        <span>doispalitos.tech // superadmin</span>
        <span>Dois Palitos — Plataforma de Gestão Gastronômica</span>
      </footer>

    </div>
  )
}
