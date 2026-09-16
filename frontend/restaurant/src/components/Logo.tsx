interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const iconSizes = {
    sm: { w: 16, h: 22, barW: 4.5, barGap: 3.5, h1: 15, h2: 22 },
    md: { w: 22, h: 32, barW: 6.5, barGap: 5, h1: 21, h2: 32 },
    lg: { w: 30, h: 44, barW: 9, barGap: 7, h1: 29, h2: 44 },
  }

  const textSizes = {
    sm: 'text-sm font-medium tracking-tight',
    md: 'text-lg font-medium tracking-tight',
    lg: 'text-2xl font-medium tracking-tight',
  }

  const s = iconSizes[size]

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Símbolo: Dois Palitos na mesma altura no topo, sendo o 2º maior que o 1º */}
      <svg
        width={s.w}
        height={s.h}
        viewBox={`0 0 ${s.w} ${s.h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        {/* Palito 1 (Esquerdo - alinhado ao topo, mais curto) */}
        <rect
          x="0"
          y="0"
          width={s.barW}
          height={s.h1}
          rx={s.barW / 2}
          fill="#F5DC55"
        />
        {/* Palito 2 (Direito - alinhado ao topo, mais longo) */}
        <rect
          x={s.barW + s.barGap}
          y="0"
          width={s.barW}
          height={s.h2}
          rx={s.barW / 2}
          fill="#F5DC55"
        />
      </svg>

      {showText && (
        <span className={`font-mono text-zinc-900 dark:text-zinc-100 ${textSizes[size]}`}>
          dois<span className="text-[#D4B316] dark:text-[#F5DC55]">palitos</span>
        </span>
      )}
    </div>
  )
}
