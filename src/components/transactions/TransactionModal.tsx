import { Plus, Trash } from '@phosphor-icons/react'
import type { FormEvent } from 'react'
import { TODAY } from '../../lib/formatters'
import type { BatchEntry, TransactionType } from '../../types/finance'
import { Button } from '../ui/Button'
import { FormField, inputClassName } from '../ui/FormField'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'

export const NEW_EXPENSE = '__new_expense__'

type TransactionModalProps = {
  formType: TransactionType
  entries: BatchEntry[]
  expenseNames: string[]
  traderNames: string[]
  showNotes: boolean
  error: string
  saving: boolean
  onClose: () => void
  onTypeChange: (type: TransactionType) => void
  onEntryChange: (id: string, field: keyof BatchEntry, value: string) => void
  onAddEntry: () => void
  onRemoveEntry: (id: string) => void
  onShowNotesChange: (show: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function TransactionModal({ formType, entries, expenseNames, traderNames, showNotes, error, saving, onClose, onTypeChange, onEntryChange, onAddEntry, onRemoveEntry, onShowNotesChange, onSubmit }: TransactionModalProps) {
  return (
    <Modal title="Catat transaksi" description="Pilih jenis transaksi lalu isi data." onClose={onClose} onSubmit={onSubmit}>
      <SegmentedControl value={formType} options={['Komisi', 'Pengeluaran']} onChange={onTypeChange} label="Jenis transaksi" />
      <FormField label="Tanggal transaksi" className="mt-5">
        <input className={inputClassName} name="date" type="date" defaultValue={TODAY} max={TODAY} autoFocus required />
      </FormField>

      <div className="mb-3 mt-6 flex items-end justify-between gap-4">
        <div>
          <strong className="text-sm text-zinc-950">Daftar {formType === 'Komisi' ? 'pemasukan' : 'pengeluaran'}</strong>
          <span className="mt-1 block text-xs text-zinc-500">Isi semua baris yang ingin disimpan sekaligus.</span>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{entries.length} baris</span>
      </div>

      <div className="grid gap-3">
        {entries.map((entry, index) => (
          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" key={entry.id}>
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-sm">{formType === 'Komisi' ? 'Pemasukan' : 'Pengeluaran'} {index + 1}</strong>
              {entries.length > 1 && <Button variant="ghost" size="sm" className="size-9 px-0" type="button" onClick={() => onRemoveEntry(entry.id)} aria-label={`Hapus baris ${index + 1}`}><Trash size={17} /></Button>}
            </div>
            {formType === 'Komisi' ? (
              <FormField label="Nama supplier">
                <input className={inputClassName} list="trader-suggestions" value={entry.name} onChange={(event) => onEntryChange(entry.id, 'name', event.target.value)} placeholder="Ketik atau pilih nama" autoComplete="off" required />
              </FormField>
            ) : (
              <>
                <FormField label="Nama pengeluaran">
                  <select className={inputClassName} value={entry.name} onChange={(event) => onEntryChange(entry.id, 'name', event.target.value)} required>
                    {expenseNames.map((name) => <option value={name} key={name}>{name}</option>)}
                    <option value={NEW_EXPENSE}>+ Buat pengeluaran baru</option>
                  </select>
                </FormField>
                {entry.name === NEW_EXPENSE && <FormField label="Pengeluaran baru" className="mt-3 rounded-lg border border-zinc-200 bg-white p-3"><input className={inputClassName} value={entry.customName} onChange={(event) => onEntryChange(entry.id, 'customName', event.target.value)} placeholder="Contoh: Perawatan mesin" required /></FormField>}
              </>
            )}
            <FormField label="Jumlah" className="mt-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 font-semibold text-zinc-500">Rp</span>
                <input className={`${inputClassName} pl-10 tabular-nums`} type="text" inputMode="numeric" value={entry.amount} onChange={(event) => onEntryChange(entry.id, 'amount', event.target.value)} placeholder="0" required />
              </div>
            </FormField>
          </section>
        ))}
      </div>

      {formType === 'Komisi' && <datalist id="trader-suggestions">{traderNames.map((name) => <option value={name} key={name} />)}</datalist>}
      <Button className="mt-3 w-full border-dashed" variant="secondary" type="button" onClick={onAddEntry}><Plus size={18} weight="bold" />Tambah {formType === 'Komisi' ? 'pemasukan' : 'pengeluaran'}</Button>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-zinc-700">
        <input className="size-4 accent-zinc-950" type="checkbox" checked={showNotes} onChange={(event) => onShowNotesChange(event.target.checked)} />
        Tambahkan catatan
      </label>
      {showNotes && <FormField label="Catatan (opsional)" className="mt-2"><textarea className={`${inputClassName} min-h-24 py-3`} name="note" rows={3} placeholder="Tambahkan keterangan untuk transaksi ini" /></FormField>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">{error}</p>}
      <Button className="mt-5 w-full" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : `Simpan ${entries.length} ${formType === 'Komisi' ? 'pemasukan' : 'pengeluaran'}`}</Button>
    </Modal>
  )
}
