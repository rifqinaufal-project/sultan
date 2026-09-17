import { PencilSimple, Trash } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import type { RemoteExpenseName } from '../../lib/financeRepository'
import { TODAY } from '../../lib/formatters'
import type { Transaction } from '../../types/finance'
import { Button } from '../ui/Button'
import { FormField, inputClassName } from '../ui/FormField'
import { Modal } from '../ui/Modal'

export function EditTransactionModal({ transaction, onClose, onSave }: { transaction: Transaction; onClose: () => void; onSave: (transaction: Transaction) => Promise<void> }) {
  const [draft, setDraft] = useState(transaction)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0 || draft.date > TODAY) {
      setError('Lengkapi nama, tanggal, dan jumlah transaksi dengan benar.')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...draft, name: draft.name.trim(), note: draft.note.trim() || '-' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit transaksi" description={`Perbarui data ${transaction.type === 'Komisi' ? 'pemasukan' : 'pengeluaran'}.`} onClose={onClose} onSubmit={save}>
      <FormField label="Nama"><input className={inputClassName} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></FormField>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Tanggal"><input className={inputClassName} type="date" value={draft.date} max={TODAY} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></FormField>
        <FormField label="Jumlah"><div className="relative"><span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 font-semibold text-zinc-500">Rp</span><input className={`${inputClassName} pl-10 tabular-nums`} type="text" inputMode="numeric" value={draft.amount ? new Intl.NumberFormat('id-ID').format(draft.amount) : ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value.replace(/\D/g, '')) })} required /></div></FormField>
      </div>
      <FormField label="Catatan" className="mt-4"><textarea className={`${inputClassName} min-h-24 py-3`} rows={3} value={draft.note === '-' ? '' : draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></FormField>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">{error}</p>}
      <Button className="mt-5 w-full" disabled={saving} type="submit">{saving ? 'Menyimpan...' : 'Simpan perubahan'}</Button>
    </Modal>
  )
}

type ExpenseNameModalProps = {
  items: RemoteExpenseName[]
  value: string
  editingId: string | null
  onNameChange: (value: string) => void
  onEdit: (item: RemoteExpenseName) => void
  onDelete: (item: RemoteExpenseName) => void
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onClose: () => void
}

export function ExpenseNameModal({ items, value, editingId, onNameChange, onEdit, onDelete, onSave, onClose }: ExpenseNameModalProps) {
  return (
    <Modal title="Kelola nama pengeluaran" description="Buat daftar nama yang akan muncul pada form pengeluaran." onClose={onClose} onSubmit={onSave} className="max-w-lg">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <FormField label={editingId ? 'Ubah nama pengeluaran' : 'Nama pengeluaran baru'}><input className={inputClassName} value={value} onChange={(event) => onNameChange(event.target.value)} placeholder="Contoh: Perawatan mesin" required /></FormField>
        <Button type="submit">{editingId ? 'Simpan' : 'Tambah'}</Button>
      </div>
      <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
        {items.map((item) => (
          <div className="flex min-h-14 items-center justify-between gap-3 py-2" key={item.id}>
            <strong className="text-sm">{item.name}</strong>
            <span className="flex gap-1">
              <Button variant="icon" size="sm" className="size-10 px-0" type="button" onClick={() => onEdit(item)} aria-label={`Edit nama pengeluaran ${item.name}`}><PencilSimple size={16} /></Button>
              <Button variant="danger" size="sm" className="size-10 px-0" type="button" onClick={() => onDelete(item)} aria-label={`Hapus nama pengeluaran ${item.name}`}><Trash size={16} /></Button>
            </span>
          </div>
        ))}
      </div>
    </Modal>
  )
}
