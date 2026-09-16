/**
 * Utilitários de Máscaras e Formatações em Tempo Real (PT-BR)
 */

export function cleanDigits(value: string): string {
  return (value || '').replace(/\D/g, '')
}

/**
 * Formata telefone / WhatsApp dinamicamente (10 ou 11 dígitos):
 * (11) 9999-9999 ou (11) 99999-9999
 */
export function formatPhone(value: string): string {
  const digits = cleanDigits(value).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

/**
 * Formata CPF ou CNPJ dinamicamente baseado na quantidade de dígitos:
 * Até 11 dígitos: 000.000.000-00 (CPF)
 * 12 a 14 dígitos: 00.000.000/0001-00 (CNPJ)
 */
export function formatDocument(value: string): string {
  const digits = cleanDigits(value).slice(0, 14)
  if (!digits) return ''

  if (digits.length <= 11) {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }

  // CNPJ: 00.000.000/0001-00
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

/**
 * Formata estritamente CPF (11 dígitos): 000.000.000-00
 */
export function formatCpf(value: string): string {
  const digits = cleanDigits(value).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

/**
 * Formata estritamente CNPJ (14 dígitos): 00.000.000/0001-00
 */
export function formatCnpj(value: string): string {
  const digits = cleanDigits(value).slice(0, 14)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

/**
 * Formata CEP (8 dígitos): 00000-000
 */
export function formatCep(value: string): string {
  const digits = cleanDigits(value).slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

/**
 * Formata slug: apenas minúsculas, números e hífens
 */
export function formatSlug(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

/**
 * ─── VALIDAÇÕES ─────────────────────────────────────────────────────────────
 */

export function validateEmail(email: string, isRequired = false): { isValid: boolean; error?: string } {
  const trimmed = (email || '').trim()
  if (!trimmed) {
    return isRequired ? { isValid: false, error: 'E-mail é obrigatório.' } : { isValid: true }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'E-mail inválido. Deve conter "@" e um domínio válido (ex: .com, .com.br).' }
  }
  return { isValid: true }
}

export function validatePhone(phone: string, isRequired = false): { isValid: boolean; error?: string } {
  const digits = cleanDigits(phone)
  if (!digits) {
    return isRequired ? { isValid: false, error: 'Telefone é obrigatório.' } : { isValid: true }
  }
  if (digits.length < 10 || digits.length > 11) {
    return { isValid: false, error: 'Telefone incompleto. Digite DDD + número (10 ou 11 dígitos).' }
  }
  return { isValid: true }
}

export function validateDocument(document: string, isRequired = false): { isValid: boolean; error?: string } {
  const digits = cleanDigits(document)
  if (!digits) {
    return isRequired ? { isValid: false, error: 'Documento é obrigatório.' } : { isValid: true }
  }
  if (digits.length !== 11 && digits.length !== 14) {
    return { isValid: false, error: 'Documento incompleto. Digite 11 dígitos para CPF ou 14 dígitos para CNPJ.' }
  }
  return { isValid: true }
}

export function validateCpf(cpf: string, isRequired = false): { isValid: boolean; error?: string } {
  const digits = cleanDigits(cpf)
  if (!digits) {
    return isRequired ? { isValid: false, error: 'CPF é obrigatório.' } : { isValid: true }
  }
  if (digits.length !== 11) {
    return { isValid: false, error: 'CPF incompleto. Deve conter exatamente 11 dígitos.' }
  }
  return { isValid: true }
}

export function validateCep(cep: string, isRequired = false): { isValid: boolean; error?: string } {
  const digits = cleanDigits(cep)
  if (!digits) {
    return isRequired ? { isValid: false, error: 'CEP é obrigatório.' } : { isValid: true }
  }
  if (digits.length !== 8) {
    return { isValid: false, error: 'CEP incompleto. Deve conter 8 dígitos.' }
  }
  return { isValid: true }
}
