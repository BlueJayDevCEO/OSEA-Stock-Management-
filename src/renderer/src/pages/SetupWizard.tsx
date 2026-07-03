import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Database,
  FolderOpen,
  HardDrive,
  Waves
} from 'lucide-react'
import type { DataDirCheckResult } from '@shared/types'
import { useApp } from '@renderer/lib/store'
import { Field } from '@renderer/components/ui'

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
  { code: 'THB', symbol: '฿', label: 'Thai Baht (฿)' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso (₱)' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah (Rp)' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso (MX$)' },
  { code: 'EGP', symbol: 'E£', label: 'Egyptian Pound (E£)' }
]

/**
 * First-run setup. The customer decides where their business data lives —
 * OSEA hosts nothing and can access nothing.
 */
export function SetupWizard({ onComplete }: { onComplete: () => Promise<void> }): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [storage, setStorage] = useState<'local' | 'cloud'>('local')
  const [dataDir, setDataDir] = useState('')
  const [defaultDir, setDefaultDir] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [vatRate, setVatRate] = useState('20')
  const [staffName, setStaffName] = useState('')
  const [loadDemoData, setLoadDemoData] = useState(true)

  // Existing-database protection: before we let setup finish, we check
  // whether the chosen folder already has an OSEA Dive Manager database so
  // we can warn instead of silently reusing (and overwriting the settings
  // of) someone else's data.
  const [existingInfo, setExistingInfo] = useState<DataDirCheckResult | null>(null)
  const [checkingDir, setCheckingDir] = useState(false)

  useEffect(() => {
    void window.osea.app.getDefaultDataDir().then(async (dir) => {
      setDefaultDir(dir)
      setDataDir(dir)
      setCheckingDir(true)
      const found = await checkFolder(dir)
      setCheckingDir(false)
      setExistingInfo(found)
    })
  }, [])

  const checkFolder = async (dir: string): Promise<DataDirCheckResult | null> => {
    try {
      const result = await window.osea.app.checkDataDir(dir || null)
      return result.exists ? result : null
    } catch {
      return null
    }
  }

  const chooseFolder = async (): Promise<void> => {
    const dir = await window.osea.app.chooseDirectory()
    if (!dir) return
    setDataDir(dir)
    setExistingInfo(null)
    setCheckingDir(true)
    const found = await checkFolder(dir)
    setCheckingDir(false)
    setExistingInfo(found)
  }

  const useDefaultFolder = async (): Promise<void> => {
    setDataDir(defaultDir)
    setExistingInfo(null)
    setCheckingDir(true)
    const found = await checkFolder(defaultDir)
    setCheckingDir(false)
    setExistingInfo(found)
  }

  const continueFromStorageStep = async (): Promise<void> => {
    setCheckingDir(true)
    const found = await checkFolder(dataDir)
    setCheckingDir(false)
    setExistingInfo(found)
    if (!found) setStep(2)
  }

  const useExistingDatabase = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.osea.app.setup({
        provider: 'sqlite',
        dataDir: dataDir || null,
        business: {},
        loadDemoData: false
      })
      await onComplete()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not open the existing database.')
      setBusy(false)
    }
  }

  const finish = async (): Promise<void> => {
    if (!businessName.trim()) {
      toast('error', 'Please enter your business name.')
      setStep(2)
      return
    }
    setBusy(true)
    try {
      const cur = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
      await window.osea.app.setup({
        provider: 'sqlite',
        dataDir: dataDir || null,
        business: {
          businessName: businessName.trim(),
          currency: cur.code,
          currencySymbol: cur.symbol,
          defaultVatRate: Number(vatRate) || 0,
          staffName: staffName.trim()
        },
        loadDemoData
      })
      await onComplete()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Setup failed.')
      setBusy(false)
    }
  }

  const steps = ['Welcome', 'Data Storage', 'Your Business', 'Finish']

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-ocean-950 via-surface-dark to-abyss-950 p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ocean-400 to-reef-500 shadow-pop">
            <Waves size={26} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">OSEA Dive Manager</div>
            <div className="text-sm text-ocean-200/70">Inventory for professional dive centres</div>
          </div>
        </div>

        <div className="card !bg-white/95 p-8 backdrop-blur dark:!bg-surface-card/95">
          {/* progress */}
          <div className="mb-8 flex items-center gap-2">
            {steps.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i < step
                      ? 'bg-reef-500 text-white'
                      : i === step
                        ? 'bg-ocean-600 text-white'
                        : 'bg-abyss-200 text-abyss-500 dark:bg-abyss-800'
                  }`}
                >
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium max-sm:hidden ${i === step ? 'text-abyss-900 dark:text-abyss-100' : 'text-abyss-400'}`}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <div className="h-px flex-1 bg-abyss-200 dark:bg-abyss-800" />
                )}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold">Welcome aboard</h2>
              <p className="mt-2 text-sm leading-relaxed text-abyss-500 dark:text-abyss-400">
                OSEA Dive Manager runs entirely on your machine. Your inventory, rentals, sales and
                reports work with no internet connection — perfect for remote dive centres — and
                your data belongs to you alone. This short setup takes about a minute.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  'Track every rental asset with its own QR-coded equipment passport',
                  'Run your retail shop with full stock movement history',
                  'Purchase orders, sales, reports and label printing — all offline',
                  'Back up, export and move your data whenever you like'
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-reef-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold">Where should your business data live?</h2>
              <p className="mt-1 text-sm text-abyss-500 dark:text-abyss-400">
                You own your data. OSEA is a software company, not a hosting company.
              </p>
              <div className="mt-5 space-y-3">
                <button
                  onClick={() => setStorage('local')}
                  className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                    storage === 'local'
                      ? 'border-ocean-500 bg-ocean-50/60 dark:bg-ocean-900/20'
                      : 'border-abyss-200 hover:border-abyss-300 dark:border-abyss-700'
                  }`}
                >
                  <HardDrive size={22} className="mt-0.5 shrink-0 text-ocean-600 dark:text-ocean-300" />
                  <span>
                    <span className="flex items-center gap-2 font-semibold">
                      Create a local database
                      <span className="rounded-full bg-reef-500/15 px-2 py-0.5 text-xs font-semibold text-reef-700 dark:text-reef-300">
                        Recommended
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-abyss-500 dark:text-abyss-400">
                      Everything stored on this computer in a single database file. No internet
                      required, ever. You choose the folder — including a network drive or synced
                      folder if you want your own off-site copy.
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => setStorage('cloud')}
                  className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                    storage === 'cloud'
                      ? 'border-ocean-500 bg-ocean-50/60 dark:bg-ocean-900/20'
                      : 'border-abyss-200 hover:border-abyss-300 dark:border-abyss-700'
                  }`}
                >
                  <Cloud size={22} className="mt-0.5 shrink-0 text-abyss-400" />
                  <span>
                    <span className="font-semibold">Connect your own cloud database</span>
                    <span className="mt-1 block text-sm text-abyss-500 dark:text-abyss-400">
                      PostgreSQL, MySQL, SQL Server or Firebase — on an account you own. Cloud
                      database adapters ship as a free update in version 1.1; the storage layer is
                      already built for them. Start local today and migrate with one export/import
                      when your provider is available.
                    </span>
                  </span>
                </button>
              </div>

              {storage === 'local' && (
                <div className="mt-5">
                  <Field label="Data folder">
                    <div className="flex gap-2">
                      <input className="input font-mono !text-xs" value={dataDir} readOnly />
                      <button className="btn-secondary shrink-0" onClick={chooseFolder}>
                        <FolderOpen size={15} /> Choose…
                      </button>
                    </div>
                  </Field>
                  {defaultDir && dataDir !== defaultDir && (
                    <button
                      className="mt-2 text-xs text-ocean-600 hover:underline dark:text-ocean-300"
                      onClick={useDefaultFolder}
                    >
                      Use the default location instead
                    </button>
                  )}

                  {existingInfo && (
                    <div className="mt-4 rounded-xl border-2 border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100">
                      <div className="flex items-start gap-2.5 font-semibold">
                        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                        This folder already has an OSEA Dive Manager database.
                      </div>
                      <p className="mt-2 leading-relaxed">
                        {existingInfo.businessName ? (
                          <>
                            It belongs to <strong>{existingInfo.businessName}</strong>.
                          </>
                        ) : (
                          "OSEA Dive Manager couldn't read its business name, but the database file is present."
                        )}{' '}
                        {existingInfo.counts && (
                          <>
                            It already contains {existingInfo.counts.rental_assets ?? 0} rental assets,{' '}
                            {existingInfo.counts.products ?? 0} products, {existingInfo.counts.sales ?? 0} sales and{' '}
                            {existingInfo.counts.purchase_orders ?? 0} purchase orders.
                          </>
                        )}
                      </p>
                      <p className="mt-2">
                        To protect this data, OSEA Dive Manager will not change its business name,
                        currency, VAT rate or load demo data over it.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="btn-primary !bg-amber-600 hover:!bg-amber-700"
                          onClick={useExistingDatabase}
                          disabled={busy}
                        >
                          {busy ? 'Opening…' : 'Use this existing database'}
                        </button>
                        <button className="btn-secondary" onClick={chooseFolder} disabled={busy}>
                          Choose a different folder
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {storage === 'cloud' && (
                <div className="mt-5 rounded-lg border border-amber-400/40 bg-amber-50 p-3.5 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  Cloud adapters arrive in v1.1. To continue today, select{' '}
                  <strong>Create a local database</strong> — your data exports cleanly whenever
                  you're ready to move it.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold">Tell us about your dive centre</h2>
              <div className="mt-5 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <Field label="Business name" className="col-span-2">
                  <input
                    className="input"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Blue Horizon Dive Resort"
                    autoFocus
                  />
                </Field>
                <Field label="Currency">
                  <select
                    className="input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Default VAT / sales tax %">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="50"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                  />
                </Field>
                <Field label="Your name (shown on sales & logs)" className="col-span-2">
                  <input
                    className="input"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold">Ready to dive in</h2>
              <p className="mt-1 text-sm text-abyss-500 dark:text-abyss-400">
                Your database will be created at:
              </p>
              <div className="mt-2 rounded-lg bg-abyss-100 px-3 py-2 font-mono text-xs dark:bg-abyss-800/70">
                {dataDir}\osea-dive-manager.db
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-abyss-200 p-4 dark:border-abyss-700">
                <input
                  type="checkbox"
                  checked={loadDemoData}
                  onChange={(e) => setLoadDemoData(e.target.checked)}
                  className="mt-0.5 accent-ocean-600"
                />
                <span>
                  <span className="flex items-center gap-2 font-semibold">
                    <Database size={15} /> Load demo inventory
                  </span>
                  <span className="mt-1 block text-sm text-abyss-500 dark:text-abyss-400">
                    A realistic sample dive centre — rental fleet, shop stock, sales history and
                    purchase orders — so you can explore every feature immediately. Skip this to
                    start with a clean slate.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              className="btn-ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
            >
              <ArrowLeft size={15} /> Back
            </button>
            {step < 3 ? (
              <button
                className="btn-primary"
                onClick={() => (step === 1 && storage === 'local' ? continueFromStorageStep() : setStep((s) => s + 1))}
                disabled={(step === 1 && (storage === 'cloud' || existingInfo !== null)) || checkingDir}
              >
                {checkingDir ? (
                  'Checking…'
                ) : (
                  <>
                    Continue <ArrowRight size={15} />
                  </>
                )}
              </button>
            ) : (
              <button className="btn-primary" onClick={finish} disabled={busy}>
                {busy ? 'Setting up…' : loadDemoData ? 'Create & load demo data' : 'Create my database'}
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ocean-200/50">
          OSEA Dive Manager v1.0 · Your data never leaves your control
        </p>
      </div>
    </div>
  )
}
