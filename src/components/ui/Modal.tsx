import type { FormEventHandler, ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'

type ModalProps = {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
  onSubmit?: FormEventHandler<HTMLFormElement>
  className?: string
}

export function Modal({ title, description, children, onClose, onSubmit, className }: ModalProps) {
  const titleId = `modal-${title.toLocaleLowerCase('id-ID').replace(/[^a-z0-9]+/g, '-')}`

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-zinc-950/60 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <form
        className={cn('relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-[540px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl shadow-zinc-950/20 sm:p-8', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <button type="button" className="absolute right-4 top-4 grid size-11 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950" onClick={onClose} aria-label="Tutup">
          <X size={22} />
        </button>
        <header className="mb-6 pr-12">
          <h2 id={titleId} className="font-display text-2xl font-extrabold tracking-tight text-zinc-950">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{description}</p>
        </header>
        {children}
      </form>
    </div>
  )
}
