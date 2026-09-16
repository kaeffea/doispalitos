import { Route, Routes } from 'react-router-dom'
import ShopPage from './pages/ShopPage'
import TrackPage from './pages/TrackPage'

export default function App() {
  return (
    <Routes>
      <Route path="/pedido/:uuid" element={<TrackPage />} />
      <Route path="*" element={<ShopPage />} />
    </Routes>
  )
}
