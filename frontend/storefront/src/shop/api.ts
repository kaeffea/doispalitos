import axios from 'axios'
import type { SfOverrides, SfTheme, PageSection, StoreCategory, StoreData, StoreStatus } from '../studio/types'

const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

const api = axios.create({
  baseURL: RAW_API_URL ? `${RAW_API_URL}/api/v1` : '/api/v1',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

export interface ResolvedStore {
  tenant: StoreData & {
    street?: string | null
    number?: string | null
    complement?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    latitude?: number | null
    longitude?: number | null
  }
  settings: {
    delivery: Record<string, unknown>
    pickup: Record<string, unknown>
    dine_in: Record<string, unknown>
    opening_hours: Record<string, { open: boolean; start: string; end: string }>
    payment_methods: Record<string, boolean | number>
  }
  live: { is_open: boolean; prep_time_min: number | null; is_manually_closed: boolean }
  storefront: { theme: SfTheme; sections: PageSection[]; overrides: SfOverrides } | null
  menu: { categories: StoreCategory[]; products: Array<Record<string, unknown>> }
}

export type Channel = 'delivery' | 'pickup' | 'dine_in'

export interface CartSelection {
  group_id: string
  group_name: string
  option_ids: string[]
}

export interface CheckoutPayload {
  customer_name: string
  customer_phone: string
  channel: Channel
  address?: Record<string, string | number | undefined>
  table_number?: string
  payment_method: string
  change_for?: number
  notes?: string
  items: Array<{
    product_id: string
    quantity: number
    notes?: string
    options?: Array<{ group_id: string; option_ids: string[] }>
  }>
}

export async function resolveStore(slug: string): Promise<ResolvedStore> {
  const { data } = await api.get(`/storefront/${slug}/resolve`)
  return data
}

export async function resolveByHost(): Promise<ResolvedStore> {
  const { data } = await api.get('/storefront/by-host')
  return data
}

/* Descobre a loja: ?loja= (dev) → subdomínio → domínio próprio → demo */
export function detectStore(): { slug?: string; byHost?: boolean } {
  if (typeof window === 'undefined') return {}
  const loja = new URLSearchParams(window.location.search).get('loja')
  if (loja) return { slug: loja }
  const host = window.location.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.vercel.app') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return {}
  }
  if (host.endsWith('.doispalitos.tech')) {
    const sub = host.slice(0, -'.doispalitos.tech'.length)
    if (sub && !['www', 'api', 'app', 'adm'].includes(sub) && !sub.includes('.')) {
      return { slug: sub }
    }
    return {}
  }
  return { byHost: true }
}

export async function fetchDeliveryFee(slug: string, payload: Record<string, unknown>): Promise<number> {
  const { data } = await api.post(`/storefront/${slug}/delivery-fee`, payload)
  return Number(data.delivery_fee) || 0
}

export async function createOrder(slug: string, payload: CheckoutPayload) {
  const { data } = await api.post(`/storefront/${slug}/orders`, payload)
  return data.order
}

export async function trackOrder(uuid: string) {
  const { data } = await api.get(`/storefront/orders/${uuid}`)
  return data as { order: Record<string, unknown>; store: { name: string; phone: string } }
}

export type { StoreStatus }
