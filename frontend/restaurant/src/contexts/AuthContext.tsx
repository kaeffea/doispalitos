import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '@/lib/api'

export interface RestaurantUser {
  id: string | number
  name: string
  email: string
  role: 'admin' | 'manager' | 'kitchen'
  must_change_password?: boolean
}

export interface Tenant {
  id: string
  name: string
  slug: string
  custom_domain: string | null
  subdomain: string
  is_active: boolean
  settings?: any
}

interface AuthContextType {
  user: RestaurantUser | null
  tenant: Tenant | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (password: string, password_confirmation: string) => Promise<void>
  updateTenantSettings: (newSettings: any) => void
  refreshUserAndTenant: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RestaurantUser | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('restaurant_token'))
  const [isLoading, setIsLoading] = useState(true)

  const refreshUserAndTenant = async () => {
    try {
      const res = await api.get('/restaurant/me')
      if (['admin', 'manager', 'kitchen'].includes(res.data.user?.role)) {
        setUser(res.data.user)
        setTenant(res.data.tenant)
      }
    } catch (err) {
      console.error('Erro ao recarregar dados do usuário/restaurante:', err)
    }
  }

  useEffect(() => {
    if (token) {
      api.get('/restaurant/me')
        .then((res) => {
          if (['admin', 'manager', 'kitchen'].includes(res.data.user?.role)) {
            setUser(res.data.user)
            setTenant(res.data.tenant)
          } else {
            throw new Error('Não autorizado')
          }
        })
        .catch(() => {
          localStorage.removeItem('restaurant_token')
          setToken(null)
          setUser(null)
          setTenant(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const res = await api.post('/restaurant/login', { email, password })
    const { token: newToken, user: newUser, tenant: newTenant } = res.data

    if (!['admin', 'manager', 'kitchen'].includes(newUser.role)) {
      throw new Error('Acesso negado. Apenas operadores e gestores do restaurante.')
    }

    localStorage.setItem('restaurant_token', newToken)
    setToken(newToken)
    setUser(newUser)
    setTenant(newTenant)
  }

  const logout = async () => {
    try {
      await api.post('/restaurant/logout')
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err)
    } finally {
      localStorage.removeItem('restaurant_token')
      setToken(null)
      setUser(null)
      setTenant(null)
    }
  }

  const changePassword = async (password: string, password_confirmation: string) => {
    const res = await api.post('/restaurant/change-password', {
      password,
      password_confirmation,
    })
    if (res.data?.user) {
      setUser(res.data.user)
    } else {
      setUser((prev) => (prev ? { ...prev, must_change_password: false } : null))
    }
  }

  const updateTenantSettings = (newSettings: any) => {
    setTenant((prev) => (prev ? { ...prev, settings: newSettings } : null))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        login,
        logout,
        changePassword,
        updateTenantSettings,
        refreshUserAndTenant,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
