import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCircle2, XCircle, Clock, X } from 'lucide-react'
import api from '@/lib/api'

interface NotificationItem {
  id: string
  type: string
  category: string
  status: string
  title: string
  message: string
  admin_notes?: string
  reviewer?: string
  created_at: string
  reviewed_at?: string
}

const LAST_SEEN_KEY = 'doispalitos_restaurant_notif_last_seen'

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const calculateUnread = (items: NotificationItem[]): number => {
    try {
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY)
      if (!lastSeen) {
        return items.length
      }
      const lastSeenTime = new Date(lastSeen).getTime()
      return items.filter((n) => {
        const itemTime = new Date(n.reviewed_at || n.created_at).getTime()
        return itemTime > lastSeenTime
      }).length
    } catch {
      return 0
    }
  }

  const markAllAsRead = () => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
      setUnreadCount(0)
    } catch {
      // Fallback
    }
  }

  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      const res = await api.get('/restaurant/notifications')
      const items: NotificationItem[] = res.data.notifications || []
      setNotifications(items)
      setUnreadCount(calculateUnread(items))
    } catch (err) {
      console.error('Erro ao buscar notificações:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true)
      markAllAsRead()
      fetchNotifications()
    } else {
      setIsOpen(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-medium uppercase rounded">Aprovada</span>
      case 'edited_and_approved':
        return <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-medium uppercase rounded">Editada</span>
      case 'rejected':
        return <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-mono font-medium uppercase rounded">Recusada</span>
      case 'pending':
      default:
        return <span className="px-2 py-0.5 bg-[#F5DC55] text-zinc-950 text-[10px] font-mono font-bold uppercase rounded">Pendente</span>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'edited_and_approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      case 'pending':
      default:
        return <Clock className="w-4 h-4 text-[#D4B316] dark:text-[#F5DC55] shrink-0 mt-0.5" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão de Sino */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title="Notificações e Avisos"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F5DC55] ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold font-mono text-zinc-950 dark:text-zinc-50 uppercase tracking-wider">
                Notificações
              </span>
              {notifications.length > 0 && (
                <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono rounded">
                  {notifications.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista de Notificações */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-zinc-400">
                Carregando histórico...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-400 space-y-1">
                <p>Nenhuma notificação recente.</p>
                <p className="text-[11px] text-zinc-500 font-light">Todas as atualizações da loja aparecerão aqui.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-3.5 space-y-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {getStatusIcon(n.status)}
                      <div>
                        <p className="text-xs font-medium text-zinc-950 dark:text-zinc-100 leading-snug">
                          {n.title}
                        </p>
                        <p className="text-[11px] font-light text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(n.status)}
                  </div>

                  {n.admin_notes && (
                    <div className="ml-6 p-2 bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-mono text-zinc-800 dark:text-zinc-200">
                      <span className="font-semibold text-zinc-500 block text-[10px] uppercase">Motivo / Notas da Administração:</span>
                      {n.admin_notes}
                    </div>
                  )}

                  <div className="ml-6 text-[10px] font-mono text-zinc-400">
                    {new Date(n.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
