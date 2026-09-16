import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'

export interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
}

interface SearchableComboboxProps {
  value: string
  onChange: (val: string, selectedOption?: ComboboxOption) => void
  options: (ComboboxOption | string)[]
  placeholder?: string
  allowCustom?: boolean
  customLabelPrefix?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
}

export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = 'Selecione ou digite...',
  allowCustom = true,
  customLabelPrefix = 'Criar novo:',
  className = '',
  inputClassName = '',
  disabled = false,
  required = false,
  autoFocus = false,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normaliza opções
  const normalizedOptions: ComboboxOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt }
    }
    return opt
  })

  // Sincroniza query quando value externo muda
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  // Filtra opções
  const filtered = query.trim()
    ? normalizedOptions.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
      )
    : normalizedOptions

  const exactMatch = normalizedOptions.find(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase()
  )

  // Fecha no clique externo
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option: ComboboxOption) => {
    setQuery(option.label)
    onChange(option.value, option)
    setIsOpen(false)
  }

  const handleCreateCustom = () => {
    const trimmed = query.trim()
    if (trimmed) {
      onChange(trimmed, { value: trimmed, label: trimmed })
      setIsOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setIsOpen(true)
        return
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex])
      } else if (allowCustom && query.trim() && !exactMatch) {
        handleCreateCustom()
      } else if (exactMatch) {
        handleSelect(exactMatch)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative font-mono text-xs ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          className={`w-full px-3 py-2 pr-8 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-[#F5DC55] focus:outline-none transition-colors ${inputClassName}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen(!isOpen)
            if (!isOpen) inputRef.current?.focus()
          }}
          className="absolute right-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-0.5"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Flutuante */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-[#151619] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 text-xs divide-y divide-zinc-100 dark:divide-zinc-800/50">
          
          {/* Opções Filtradas */}
          {filtered.length > 0 ? (
            <div className="py-0.5">
              {filtered.map((opt, idx) => {
                const isSelected = value === opt.value || value.toLowerCase() === opt.label.toLowerCase()
                const isHighlighted = highlightedIndex === idx

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                      isHighlighted
                        ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-zinc-50'
                        : isSelected
                        ? 'bg-[#F5DC55]/10 text-zinc-950 dark:text-zinc-50 font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-zinc-400 truncate">{opt.sublabel}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.5 bg-zinc-200/60 dark:bg-zinc-800 text-[10px] rounded text-zinc-500">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#D4B316] dark:text-[#F5DC55]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : !allowCustom ? (
            <div className="px-3 py-3 text-center text-zinc-400 text-xs">
              Nenhuma opção encontrada.
            </div>
          ) : null}

          {/* Opção de Cadastrar Novo se não houver match exato */}
          {allowCustom && query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateCustom}
              className="w-full text-left px-3 py-2.5 text-xs text-[#D4B316] dark:text-[#F5DC55] hover:bg-[#F5DC55]/10 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{customLabelPrefix} &quot;{query.trim()}&quot;</span>
            </button>
          )}

        </div>
      )}
    </div>
  )
}
