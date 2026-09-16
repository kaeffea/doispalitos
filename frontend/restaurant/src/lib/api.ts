import axios from 'axios'

/**
 * Cliente HTTP configurado para o Portal do Restaurante do Doispalitos.
 * - Injeta o token Sanctum específico do restaurante
 * - Redireciona para /login ao receber 401
 */
const RAW_API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '')

const api = axios.create({
  baseURL: RAW_API_URL ? `${RAW_API_URL}/api/v1` : '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Injeta o token em todas as requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('restaurant_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Limpa sessão em caso de token inválido/expirado
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('restaurant_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api
