/**
 * Retorna a data local no formato YYYY-MM-DD sem distorcao de fuso horario UTC.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formata uma string no formato YYYY-MM-DD para o formato pt-BR DD/MM/YYYY.
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const parts = dateStr.substring(0, 10).split('-')
  if (parts.length !== 3) return dateStr
  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}

/**
 * Aplica máscara de digitação para data DD/MM/AAAA conforme o usuário digita.
 */
export function formatDateMask(value: string): string {
  const digits = (value || '').replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

/**
 * Converte data DD/MM/AAAA para formato ISO YYYY-MM-DD.
 * Retorna null se for inválida ou incompleta.
 */
export function parseDateBRtoISO(dateBR: string): string | null {
  const clean = (dateBR || '').trim()
  if (!clean) return null
  const parts = clean.split('/')
  if (parts.length !== 3) return null

  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  if (year < 1900 || year > 2100) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const dateObj = new Date(year, month - 1, day)
  if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
    return null
  }

  const yStr = String(year)
  const mStr = String(month).padStart(2, '0')
  const dStr = String(day).padStart(2, '0')
  return `${yStr}-${mStr}-${dStr}`
}

/**
 * Converte data ISO YYYY-MM-DD para DD/MM/AAAA
 */
export function parseISOtoDateBR(isoDate?: string | null): string {
  if (!isoDate) return ''
  const parts = isoDate.substring(0, 10).split('-')
  if (parts.length !== 3) return isoDate
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
