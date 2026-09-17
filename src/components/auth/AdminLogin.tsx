import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { FormField, inputClassName } from '../ui/FormField'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin'

export function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      onLogin()
      return
    }
    setError('Username atau password salah.')
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-zinc-100 p-5">
      <section className="w-full max-w-[420px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-950/5 sm:p-10" aria-labelledby="login-title">
        <div className="flex items-center gap-3">
          <img className="size-10 rounded-full object-cover" src="/logo.png" alt="Logo Lapak Hj TIK MT" />
          <strong className="font-display text-lg font-extrabold">Lapak Hj TIK MT</strong>
        </div>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.08em] text-zinc-500">Akses administrator</p>
        <h1 id="login-title" className="mt-2 font-display text-3xl font-extrabold tracking-tight text-zinc-950">Masuk ke dashboard</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-600">Gunakan akun admin untuk mengelola catatan keuangan.</p>
        <form className="mt-7 grid gap-4" onSubmit={submit}>
          <FormField label="Username">
            <input id="admin-username" className={inputClassName} type="text" value={username} onChange={(event) => { setUsername(event.target.value); setError('') }} autoComplete="username" autoFocus required />
          </FormField>
          <FormField label="Password">
            <input id="admin-password" className={inputClassName} type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} autoComplete="current-password" required />
          </FormField>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">{error}</p>}
          <Button className="mt-1 w-full" type="submit">Masuk</Button>
        </form>
      </section>
    </main>
  )
}
