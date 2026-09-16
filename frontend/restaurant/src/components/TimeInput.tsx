import { useState, useEffect, ChangeEvent } from 'react'

interface TimeInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function isValidTime24h(timeStr: string): boolean {
  if (!timeStr || timeStr.trim() === '') return true
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/
  return regex.test(timeStr.trim())
}

function formatRawDigits(raw: string): string {
  // Retira tudo que não for dígito e limita a 4 caracteres numéricos
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function TimeInput({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = '--:--',
}: TimeInputProps) {
  const [displayValue, setDisplayValue] = useState(value || '')
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setDisplayValue(value || '')
    if (value && value.length === 5) {
      setHasError(!isValidTime24h(value))
    } else {
      setHasError(false)
    }
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Se o usuário apagou tudo
    if (!raw.trim()) {
      setDisplayValue('')
      setHasError(false)
      onChange('')
      return
    }

    const formatted = formatRawDigits(raw)
    setDisplayValue(formatted)

    if (formatted.length === 5) {
      const valid = isValidTime24h(formatted)
      setHasError(!valid)
      if (valid) {
        onChange(formatted)
      }
    } else {
      setHasError(false)
      onChange(formatted)
    }
  }

  const handleBlur = () => {
    const val = displayValue.trim()
    if (!val) {
      setDisplayValue('')
      setHasError(false)
      onChange('')
      return
    }

    // Se digitou apenas a hora (ex: "18" ou "9"), completa com minutos zerados se a hora for válida
    if (/^\d{1,2}$/.test(val)) {
      const hNum = parseInt(val, 10)
      if (hNum >= 0 && hNum <= 23) {
        const completed = `${String(hNum).padStart(2, '0')}:00`
        setDisplayValue(completed)
        setHasError(false)
        onChange(completed)
        return
      }
    }

    // Se já tiver 5 caracteres, valida formato final
    if (val.length === 5) {
      const valid = isValidTime24h(val)
      setHasError(!valid)
      if (valid) {
        onChange(val)
      }
    } else {
      // Formato incompleto (ex: "18:")
      setHasError(true)
    }
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-16 px-2 py-1 text-center bg-transparent border rounded font-mono text-xs transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
          hasError
            ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-500/5 focus:border-red-500'
            : 'border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100'
        } ${className}`}
        title={hasError ? 'Horário inválido (use 00:00 a 23:59)' : undefined}
      />
      {hasError && (
        <span className="text-[9px] font-mono text-red-500 absolute -bottom-4 tracking-tighter whitespace-nowrap">
          Inválido
        </span>
      )}
    </div>
  )
}
