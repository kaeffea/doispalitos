import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '@/lib/api'

export interface SuperAdminUser {
  id: string | number
  name: string
  email: string
  role: 'super_admin'
}

interface AuthContextType {
  user: SuperAdminUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SuperAdminUser | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('superadmin_token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.get('/admin/me')
        .then((res) => {
          if (res.data.user?.role === 'super_admin') {
            setUser(res.data.user)
          } else {
            throw new Error('Não autorizado')
          }
        })
        .catch(() => {
          localStorage.removeItem('superadmin_token')
          setToken(null)
          setUser(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const res = await api.post('/admin/login', { email, password })
    const { token: newToken, user: newUser } = res.data

    if (newUser.role !== 'super_admin') {
      throw new Error('Acesso negado. Apenas superadministradores.')
    }

    localStorage.setItem('superadmin_token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = async () => {
    try {
      await api.post('/admin/logout')
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err)
    } finally {
      localStorage.removeItem('superadmin_token')
      setToken(null)
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
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
