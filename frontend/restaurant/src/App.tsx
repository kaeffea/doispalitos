import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LoginPage from '@/pages/LoginPage'
import RestaurantDashboardPage from '@/pages/RestaurantDashboardPage'
import RestaurantSettingsPage from '@/pages/RestaurantSettingsPage'
import MenuPage from '@/pages/MenuPage'
import InventoryPage from '@/pages/InventoryPage'
import SiteStudioPage from '@/pages/SiteStudioPage'
import PedidosPage from '@/pages/PedidosPage'
import { OnboardingWizard } from '@/components/OnboardingWizard'
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
  const { user, tenant, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1012] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#E5CB3C] dark:text-[#F5DC55] animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const showOnboarding =
    Boolean(user.must_change_password) ||
    Boolean(tenant && tenant.settings && tenant.settings.onboarding_completed === false)

  return (
    <>
      {children}
      {showOnboarding && <OnboardingWizard />}
    </>
  )
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
                <RestaurantDashboardPage />
              </PrivateRoute>
            }
          />
          <Route path="/store/dashboard" element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <RestaurantSettingsPage />
              </PrivateRoute>
            }
          />
          <Route path="/store/settings" element={<Navigate to="/settings" replace />} />

          <Route
            path="/menu"
            element={
              <PrivateRoute>
                <MenuPage />
              </PrivateRoute>
            }
          />
          <Route path="/store/menu" element={<Navigate to="/menu" replace />} />

          <Route
            path="/inventory"
            element={
              <PrivateRoute>
                <InventoryPage />
              </PrivateRoute>
            }
          />
          <Route path="/store/inventory" element={<Navigate to="/inventory" replace />} />

          <Route
            path="/site"
            element={
              <PrivateRoute>
                <SiteStudioPage />
              </PrivateRoute>
            }
          />
          <Route path="/store/site" element={<Navigate to="/site" replace />} />

          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <PedidosPage />
              </PrivateRoute>
            }
          />
          <Route path="/store/orders" element={<Navigate to="/orders" replace />} />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
