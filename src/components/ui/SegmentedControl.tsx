import { cn } from '../../lib/cn'

export function SegmentedControl<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="inline-grid grid-flow-col rounded-lg bg-white p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={value === option}
          className={cn('min-h-11 rounded-md px-3 text-xs font-semibold text-zinc-600 transition hover:text-zinc-950 sm:px-4', value === option && 'bg-zinc-950 text-white hover:text-white')}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
