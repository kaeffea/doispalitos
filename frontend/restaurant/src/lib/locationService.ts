import axios from 'axios'

export interface BrazilianState {
  uf: string
  name: string
}

export const BRAZILIAN_STATES: BrazilianState[] = [
  { uf: 'AC', name: 'Acre (AC)' },
  { uf: 'AL', name: 'Alagoas (AL)' },
  { uf: 'AP', name: 'Amapá (AP)' },
  { uf: 'AM', name: 'Amazonas (AM)' },
  { uf: 'BA', name: 'Bahia (BA)' },
  { uf: 'CE', name: 'Ceará (CE)' },
  { uf: 'DF', name: 'Distrito Federal (DF)' },
  { uf: 'ES', name: 'Espírito Santo (ES)' },
  { uf: 'GO', name: 'Goiás (GO)' },
  { uf: 'MA', name: 'Maranhão (MA)' },
  { uf: 'MT', name: 'Mato Grosso (MT)' },
  { uf: 'MS', name: 'Mato Grosso do Sul (MS)' },
  { uf: 'MG', name: 'Minas Gerais (MG)' },
  { uf: 'PA', name: 'Pará (PA)' },
  { uf: 'PB', name: 'Paraíba (PB)' },
  { uf: 'PR', name: 'Paraná (PR)' },
  { uf: 'PE', name: 'Pernambuco (PE)' },
  { uf: 'PI', name: 'Piauí (PI)' },
  { uf: 'RJ', name: 'Rio de Janeiro (RJ)' },
  { uf: 'RN', name: 'Rio Grande do Norte (RN)' },
  { uf: 'RS', name: 'Rio Grande do Sul (RS)' },
  { uf: 'RO', name: 'Rondônia (RO)' },
  { uf: 'RR', name: 'Roraima (RR)' },
  { uf: 'SC', name: 'Santa Catarina (SC)' },
  { uf: 'SP', name: 'São Paulo (SP)' },
  { uf: 'SE', name: 'Sergipe (SE)' },
  { uf: 'TO', name: 'Tocantins (TO)' },
]

const citiesCache: Record<string, string[]> = {}

export async function fetchCitiesByState(uf: string): Promise<string[]> {
  const cleanUf = uf.toUpperCase().trim()
  if (!cleanUf) return []

  if (citiesCache[cleanUf]) {
    return citiesCache[cleanUf]
  }

  try {
    const res = await axios.get<{ nome: string }[]>(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cleanUf}/municipios`
    )
    const cities = res.data.map((item) => item.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    citiesCache[cleanUf] = cities
    return cities
  } catch (err) {
    console.error(`Erro ao buscar cidades para UF ${cleanUf}:`, err)
    return []
  }
}

export interface CepResult {
  street: string
  neighborhood: string
  city: string
  state: string
  postal_code: string
  isGeneralCityCep?: boolean
}

export async function searchCep(cep: string): Promise<CepResult | null> {
  const cleanCep = cep.replace(/\D/g, '')
  if (cleanCep.length !== 8) return null

  // 1. Tentar ViaCEP
  try {
    const res = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`, { timeout: 4000 })
    if (res.data && !res.data.erro && res.data.localidade) {
      const isGeneral = !res.data.logradouro && cleanCep.endsWith('000')
      return {
        street: res.data.logradouro || '',
        neighborhood: res.data.bairro || '',
        city: res.data.localidade || '',
        state: (res.data.uf || '').toUpperCase(),
        postal_code: cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2'),
        isGeneralCityCep: isGeneral,
      }
    }
  } catch {
    // Fallback
  }

  // 2. Fallback BrasilAPI
  try {
    const res = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, { timeout: 4000 })
    if (res.data && res.data.city) {
      const isGeneral = !res.data.street && cleanCep.endsWith('000')
      return {
        street: res.data.street || '',
        neighborhood: res.data.neighborhood || '',
        city: res.data.city || '',
        state: (res.data.state || '').toUpperCase(),
        postal_code: cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2'),
        isGeneralCityCep: isGeneral,
      }
    }
  } catch {
    // Fallback falhou
  }

  return null
}

/**
 * Geocodificação inteligente com tolerância a CEPs e ruas do interior do Brasil.
 * Nunca faz queries de CEP isolado sem amarrar à cidade e ao estado.
 */
export async function geocodeAddress(address: {
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  postal_code?: string
}): Promise<{ lat: number; lng: number; accuracy: 'exact' | 'street' | 'neighborhood' | 'city' } | null> {
  const cleanStreet = (address.street || '').trim()
  const cleanNumber = (address.number || '').trim()
  const cleanNeighborhood = (address.neighborhood || '').trim()
  const cleanCity = (address.city || '').trim()
  const cleanState = (address.state || '').trim()

  if (!cleanCity || !cleanState) return null

  // Remove prefixos como "Rua ", "Avenida ", "Av. ", "Travessa " para buscas flexíveis
  const streetWithoutPrefix = cleanStreet.replace(/^(rua|avenida|av\.|travessa|praça|alameda|rodovia|estrada)\s+/i, '').trim()

  // Tentativas ordenadas da mais específica para a mais abrangente, sempre com cidade e estado
  const attempts: { query: string; accuracy: 'exact' | 'street' | 'neighborhood' | 'city' }[] = []

  if (cleanStreet && cleanNumber) {
    attempts.push({
      query: `${cleanStreet}, ${cleanNumber}, ${cleanCity}, ${cleanState}, Brasil`,
      accuracy: 'exact',
    })
    attempts.push({
      query: `${streetWithoutPrefix}, ${cleanNumber}, ${cleanCity}, ${cleanState}, Brasil`,
      accuracy: 'exact',
    })
  }

  if (cleanStreet) {
    if (cleanNeighborhood) {
      attempts.push({
        query: `${cleanStreet}, ${cleanNeighborhood}, ${cleanCity}, ${cleanState}, Brasil`,
        accuracy: 'street',
      })
    }
    attempts.push({
      query: `${cleanStreet}, ${cleanCity}, ${cleanState}, Brasil`,
      accuracy: 'street',
    })
    if (streetWithoutPrefix !== cleanStreet) {
      attempts.push({
        query: `${streetWithoutPrefix}, ${cleanCity}, ${cleanState}, Brasil`,
        accuracy: 'street',
      })
    }
  }

  if (cleanNeighborhood) {
    attempts.push({
      query: `${cleanNeighborhood}, ${cleanCity}, ${cleanState}, Brasil`,
      accuracy: 'neighborhood',
    })
  }

  // Fallback seguro: centro urbano do município
  attempts.push({
    query: `${cleanCity}, ${cleanState}, Brasil`,
    accuracy: 'city',
  })

  for (const attempt of attempts) {
    try {
      const res = await axios.get<{ lat: string; lon: string; display_name: string }[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: attempt.query,
            format: 'json',
            limit: 3,
            countrycodes: 'br',
          },
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
          timeout: 4000,
        }
      )

      if (res.data && res.data.length > 0) {
        // Valida se o resultado está pelo menos no estado correto
        const match = res.data.find(
          (item) =>
            item.display_name.toLowerCase().includes(cleanCity.toLowerCase()) ||
            item.display_name.toLowerCase().includes(cleanState.toLowerCase())
        ) || res.data[0]

        return {
          lat: parseFloat(match.lat),
          lng: parseFloat(match.lon),
          accuracy: attempt.accuracy,
        }
      }
    } catch {
      // Tenta a próxima tentativa mais genérica
    }
  }

  return null
}
