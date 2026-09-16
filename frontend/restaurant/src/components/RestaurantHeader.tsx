import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Logo } from '@/components/Logo'
import { NotificationCenter } from '@/components/NotificationCenter'
import {
  Bike,
  ExternalLink,
  Globe,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  Settings,
  UtensilsCrossed,
  Layers,
} from 'lucide-react'

export interface RestaurantHeaderProps {
  activeTab: 'dashboard' | 'settings' | 'menu' | 'inventory' | 'site' | 'orders' | 'kds'
}

export function RestaurantHeader({ activeTab }: RestaurantHeaderProps) {
  const { user, tenant, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsProfileMenuOpen(true)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsProfileMenuOpen(false)
    }, 220)
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isProfileMenuOpen])

  // Get user initials
  const getUserInitials = (name?: string) => {
    if (!name) return 'DP'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const storeUrl = tenant
    ? tenant.custom_domain
      ? (tenant.custom_domain.startsWith('http') ? tenant.custom_domain : `https://${tenant.custom_domain}`)
      : `https://${tenant.subdomain}.doispalitos.tech`
    : '#'

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0F1012]/80 backdrop-blur-md px-4 sm:px-12 py-3 flex items-center justify-between sticky top-0 z-40">
      
      {/* Left: Logo + Restaurant Clickable Link + Nav Links */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Logo size="sm" />

        {/* Nome do Restaurante - Link Direto para o Site Público */}
        {tenant && (
          <div className="pl-3 sm:pl-4 border-l border-zinc-200 dark:border-zinc-800">
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium font-mono text-zinc-900 dark:text-zinc-100 bg-zinc-200/60 dark:bg-zinc-800/80 hover:bg-[#F5DC55]/20 dark:hover:bg-[#F5DC55]/20 px-2.5 py-1 rounded transition-colors inline-flex items-center gap-1.5 border border-transparent hover:border-[#F5DC55]/40 group"
              title="Abrir cardápio público do restaurante em nova janela"
            >
              <span className="truncate max-w-[120px] sm:max-w-[200px]">{tenant.name}</span>
              <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-[#F5DC55] transition-colors shrink-0" />
            </a>
          </div>
        )}

        {/* Navegação Horizontal Desktop */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-mono ml-2">
          <Link
            to="/dashboard"
            className={`transition-colors py-1 ${
              activeTab === 'dashboard'
                ? 'text-zinc-950 dark:text-zinc-100 border-b-2 border-[#F5DC55] font-bold'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Visão Geral
          </Link>

          <Link
            to="/settings"
            className={`transition-colors py-1 ${
              activeTab === 'settings'
                ? 'text-zinc-950 dark:text-zinc-100 border-b-2 border-[#F5DC55] font-bold'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Configurações
          </Link>

          <Link
            to="/menu"
            className={`transition-colors py-1 ${
              activeTab === 'menu'
                ? 'text-zinc-950 dark:text-zinc-100 border-b-2 border-[#F5DC55] font-bold'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Cardápio
          </Link>

          <Link
            to="/inventory"
            className={`transition-colors py-1 ${
              activeTab === 'inventory'
                ? 'text-zinc-950 dark:text-zinc-100 border-b-2 border-[#F5DC55] font-bold'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Estoque & Insumos
          </Link>

          <Link
            to="/site"
            className={`transition-colors py-1 ${
              activeTab === 'site'
                ? 'text-zinc-950 dark:text-zinc-100 border-b-2 border-[#F5DC55] font-bold'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Meu Site
          </Link>

          <Link
            to="/orders"
            className={`transition-colors py-1 ${
              activeTab === 'orders'
                ? 'text-zinc-950 dark:text-zinc-100 border-b-2 border-[#F5DC55] font-bold'
                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Pedidos
          </Link>
        </nav>
      </div>

      {/* Right: Notificações, Perfil e Mobile Menu Trigger */}
      <div className="flex items-center gap-2">
        
        {/* Notificações discretas com sino */}
        <NotificationCenter />

        {/* Dropdown de Perfil Compacto com Hover e Click seguros */}
        <div
          className="relative"
          ref={menuRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-zinc-300 dark:border-zinc-700/80 hover:border-[#F5DC55] dark:hover:border-[#F5DC55] bg-white dark:bg-[#141416] transition-all cursor-pointer group shadow-xs"
            title="Menu do Usuário"
          >
            <div className="w-7 h-7 rounded-full bg-[#F5DC55] text-zinc-950 font-bold font-mono text-[11px] flex items-center justify-center shadow-xs">
              {getUserInitials(user?.name)}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-transform" />
          </button>

          {/* Janela Suspensa (Popover) do Perfil com área contínua (pt-2) */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full pt-1.5 w-64 z-50">
              <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden font-mono text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                
                {/* Header do Perfil */}
                <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <p className="font-semibold text-zinc-950 dark:text-zinc-50 truncate text-xs">
                    {user?.name || 'Gestor da Loja'}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-light">
                    {user?.email}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-[10px] text-zinc-700 dark:text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{tenant?.name || 'Restaurante'}</span>
                  </div>
                </div>

                {/* Opções e Ações */}
                <div className="p-2 space-y-1">
                  
                  {/* Toggle Claro / Escuro */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      {theme === 'dark' ? (
                        <Sun className="w-3.5 h-3.5 text-[#F5DC55]" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                      <span>Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {theme === 'dark' ? 'P/ Claro' : 'P/ Escuro'}
                    </span>
                  </button>

                  {/* Sair */}
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da Conta</span>
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Mobile Menu Hamburger Button (< lg) */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer ml-1"
          aria-label="Abrir menu de navegação"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0F1012] px-6 py-4 shadow-xl z-30 font-mono text-xs space-y-2 animate-in slide-in-from-top-2 duration-150">
          <Link
            to="/dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold border-l-2 border-[#F5DC55]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-zinc-500" />
            <span>Visão Geral</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold border-l-2 border-[#F5DC55]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Settings className="w-4 h-4 text-zinc-500" />
            <span>Configurações da Loja</span>
          </Link>

          <Link
            to="/menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
              activeTab === 'menu'
                ? 'bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold border-l-2 border-[#F5DC55]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-zinc-500" />
            <span>Cardápio & Itens</span>
          </Link>

          <Link
            to="/inventory"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
              activeTab === 'inventory'
                ? 'bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold border-l-2 border-[#F5DC55]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Layers className="w-4 h-4 text-zinc-500" />
            <span>Controle de Estoque & Insumos</span>
          </Link>

          <Link
            to="/site"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
              activeTab === 'site'
                ? 'bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold border-l-2 border-[#F5DC55]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Globe className="w-4 h-4 text-zinc-500" />
            <span>Meu Site</span>
          </Link>

          <Link
            to="/orders"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
              activeTab === 'orders'
                ? 'bg-[#F5DC55]/15 text-zinc-950 dark:text-zinc-50 font-bold border-l-2 border-[#F5DC55]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Bike className="w-4 h-4 text-zinc-500" />
            <span>Pedidos</span>
          </Link>
        </div>
      )}

    </header>
  )
}
