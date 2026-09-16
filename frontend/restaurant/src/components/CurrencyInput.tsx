import React from 'react'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  required?: boolean
}

export const formatCurrencyBRL = (val: number): string => {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  disabled = false,
  autoFocus = false,
  required = false,
}) => {
  const displayValue = formatCurrencyBRL(value)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      // Remove last digit in centavos
      const rawCents = Math.round((value || 0) * 100)
      const newCents = Math.floor(rawCents / 10)
      onChange(newCents / 100)
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      onChange(0)
      return
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const digit = parseInt(e.key, 10)
      const rawCents = Math.round((value || 0) * 100)
      
      // Limit to 999.999,99 (8 digits of cents)
      if (rawCents > 9999999) return

      const newCents = rawCents * 10 + digit
      onChange(newCents / 100)
      return
    }

    // Allow navigation keys, Tab, Enter, etc.
    if (
      ['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return
    }

    // Block any other key like letters, commas, periods
    e.preventDefault()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    // Extract only digits from pasted text
    const cleanDigits = text.replace(/\D/g, '')
    if (cleanDigits) {
      const cents = parseInt(cleanDigits, 10)
      if (!isNaN(cents)) {
        onChange(cents / 100)
      }
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={() => {}} // Controlled via onKeyDown and onPaste
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      required={required}
      className={className}
    />
  )
}
