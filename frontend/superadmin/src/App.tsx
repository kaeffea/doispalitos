import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import RestaurantsPage from '@/pages/RestaurantsPage'
import { Loader2 } from 'lucide-react'

function RootRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#E5CB3C] dark:text-[#F5DC55] animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Navigate to="/dashboard" replace />
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#E5CB3C] dark:text-[#F5DC55] animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#E5CB3C] dark:text-[#F5DC55] animate-spin" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          
          <Route
            path="/restaurants"
            element={
              <PrivateRoute>
                <RestaurantsPage />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
