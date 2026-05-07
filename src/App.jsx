import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CreditCard,
  Database,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  Trash2,
  WalletCards,
  X
} from 'lucide-react'
import {
  CLOUD_ENABLED,
  getCloudSession,
  loadCloudData,
  onCloudAuthChange,
  saveCloudData,
  signInCloud,
  signOutCloud,
  signUpCloud
} from './cloudStore'

const STORAGE_KEY = 'finance-vitor-data-v2'

const DEFAULT_DATA = {
  categories: ['Mercado', 'Moradia', 'Transporte', 'Saude', 'Lazer', 'Emprestimo', 'Consorcio', 'Financiamento', 'Salario'],
  banks: ['Nubank', 'Itau', 'Santander', 'Caixa'],
  suppliers: ['Mercado Livre', 'Amazon', 'Posto', 'Farmacia', 'Cliente', 'Empresa'],
  transactions: [],
  lastId: 0
}

const AUTOMATIC_DEBIT_CATEGORIES = ['Emprestimo', 'Consorcio', 'Financiamento']

const emptyForm = {
  type: 'Despesa',
  description: '',
  amount: '',
  releaseDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  category: '',
  supplier: '',
  bank: '',
  paymentMethod: 'Debito',
  installments: '1'
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...DEFAULT_DATA, ...JSON.parse(saved) } : DEFAULT_DATA
  } catch {
    return DEFAULT_DATA
  }
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function monthKey(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthName(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function addMonths(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setMonth(date.getMonth() + amount)
  return date.toISOString().slice(0, 10)
}

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function App() {
  const [data, setData] = useState(loadData)
  const cloudHydrated = useRef(false)
  const [cloudUser, setCloudUser] = useState(null)
  const [syncStatus, setSyncStatus] = useState(CLOUD_ENABLED ? 'Entre para sincronizar na nuvem' : 'Modo local')
  const [authForm, setAuthForm] = useState({ email: '', password: '', mode: 'login', error: '' })
  const [activePage, setActivePage] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [drawer, setDrawer] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    category: DEFAULT_DATA.categories[0],
    supplier: DEFAULT_DATA.suppliers[0],
    bank: DEFAULT_DATA.banks[0]
  }))
  const [registerTab, setRegisterTab] = useState('banks')
  const [registerValue, setRegisterValue] = useState('')

  useEffect(() => {
    let active = true

    async function prepareCloud() {
      if (!CLOUD_ENABLED) {
        cloudHydrated.current = true
        return
      }

      try {
        const session = await getCloudSession()
        if (!active) return
        setCloudUser(session?.user || null)
        if (!session?.user) {
          cloudHydrated.current = true
          return
        }
      } catch {
        if (active) setSyncStatus('Nuvem indisponivel, usando este navegador')
        cloudHydrated.current = true
      }
    }

    const unsubscribe = onCloudAuthChange((session) => {
      setCloudUser(session?.user || null)
    })
    prepareCloud()
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    async function hydrateUserCloud() {
      if (!CLOUD_ENABLED || !cloudUser) return
      cloudHydrated.current = false
      setSyncStatus('Carregando dados da nuvem...')
      try {
        const cloudData = await loadCloudData(cloudUser.id)
        if (!active) return
        if (cloudData) setData({ ...DEFAULT_DATA, ...cloudData })
        setSyncStatus('Sincronizado na nuvem')
      } catch {
        if (active) setSyncStatus('Erro ao carregar a nuvem')
      } finally {
        cloudHydrated.current = true
      }
    }
    hydrateUserCloud()
    return () => {
      active = false
    }
  }, [cloudUser])

  useEffect(() => {
    if (!cloudHydrated.current) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

    if (!CLOUD_ENABLED || !cloudUser) return
    setSyncStatus('Salvando na nuvem...')
    const timeout = window.setTimeout(async () => {
      try {
        await saveCloudData(cloudUser.id, data)
        setSyncStatus('Sincronizado na nuvem')
      } catch {
        setSyncStatus('Erro ao salvar na nuvem')
      }
    }, 600)

    return () => window.clearTimeout(timeout)
  }, [cloudUser, data])

  async function submitAuth(event) {
    event.preventDefault()
    setAuthForm((current) => ({ ...current, error: '' }))
    try {
      if (authForm.mode === 'signup') {
        await signUpCloud(authForm.email, authForm.password)
      } else {
        await signInCloud(authForm.email, authForm.password)
      }
      setAuthForm({ email: '', password: '', mode: 'login', error: '' })
    } catch (error) {
      setAuthForm((current) => ({ ...current, error: error.message || 'Nao foi possivel entrar' }))
    }
  }

  async function signOut() {
    await signOutCloud()
    setSyncStatus('Entre para sincronizar na nuvem')
  }

  const todayKey = monthKey(new Date().toISOString().slice(0, 10))
  const automaticDebit = AUTOMATIC_DEBIT_CATEGORIES.includes(form.category)
  const shouldParcel = form.paymentMethod === 'Credito' || automaticDebit
  const resolvedPaymentMethod = automaticDebit ? 'Debito automatico' : form.paymentMethod

  const transactions = useMemo(() => {
    return [...data.transactions].sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.id - a.id)
  }, [data.transactions])

  const filteredTransactions = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return transactions
    return transactions.filter((item) =>
      [item.id, item.type, item.description, item.category, item.supplier, item.bank, item.paymentMethod, item.installment]
        .join(' ')
        .toLowerCase()
        .includes(text)
    )
  }, [query, transactions])

  const totals = useMemo(() => {
    const monthTransactions = data.transactions.filter((item) => monthKey(item.dueDate) === todayKey)
    const monthIncome = monthTransactions.filter((item) => item.type === 'Receita').reduce((sum, item) => sum + Number(item.amount), 0)
    const monthExpense = monthTransactions.filter((item) => item.type === 'Despesa').reduce((sum, item) => sum + Number(item.amount), 0)
    const allIncome = data.transactions.filter((item) => item.type === 'Receita').reduce((sum, item) => sum + Number(item.amount), 0)
    const allExpense = data.transactions.filter((item) => item.type === 'Despesa').reduce((sum, item) => sum + Number(item.amount), 0)
    return { monthIncome, monthExpense, monthBalance: monthIncome - monthExpense, allIncome, allExpense, allBalance: allIncome - allExpense }
  }, [data.transactions, todayKey])

  const invoices = useMemo(() => {
    const grouped = new Map()
    data.transactions
      .filter((item) => item.type === 'Despesa')
      .forEach((item) => {
        const key = monthKey(item.dueDate)
        const current = grouped.get(key) || { key, total: 0, items: [] }
        current.total += Number(item.amount)
        current.items.push(item)
        grouped.set(key, current)
      })
    return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [data.transactions])

  const categoryReport = useMemo(() => {
    return data.categories.map((category) => {
      const items = data.transactions.filter((item) => item.category === category)
      const income = items.filter((item) => item.type === 'Receita').reduce((sum, item) => sum + Number(item.amount), 0)
      const expense = items.filter((item) => item.type === 'Despesa').reduce((sum, item) => sum + Number(item.amount), 0)
      return { category, income, expense, total: income - expense, count: items.length }
    })
  }, [data.categories, data.transactions])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function createTransaction(event) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return

    const installments = Math.max(Number(shouldParcel ? form.installments : 1) || 1, 1)
    const firstId = data.lastId + 1
    const valueByInstallment = amount / installments
    const created = Array.from({ length: installments }, (_, index) => ({
      id: firstId + index,
      type: form.type,
      description: form.description.trim() || form.category,
      amount: valueByInstallment,
      releaseDate: form.releaseDate,
      dueDate: addMonths(form.dueDate, index),
      category: form.category,
      supplier: form.supplier,
      bank: form.bank,
      paymentMethod: resolvedPaymentMethod,
      installment: `${index + 1}/${installments}`
    }))

    setData((current) => ({
      ...current,
      transactions: [...current.transactions, ...created],
      lastId: firstId + installments - 1
    }))
    setForm({ ...emptyForm, category: data.categories[0] || '', supplier: data.suppliers[0] || '', bank: data.banks[0] || '' })
    setDrawer(null)
  }

  function saveEdit(event) {
    event.preventDefault()
    setData((current) => ({
      ...current,
      transactions: current.transactions.map((item) => (item.id === editing.id ? editing : item))
    }))
    setEditing(null)
  }

  function removeTransaction(id) {
    setData((current) => ({
      ...current,
      transactions: current.transactions.filter((item) => item.id !== id)
    }))
    setEditing(null)
  }

  function addRegister() {
    const value = registerValue.trim()
    if (!value) return
    setData((current) => {
      const list = current[registerTab]
      if (list.some((item) => item.toLowerCase() === value.toLowerCase())) return current
      return { ...current, [registerTab]: [...list, value] }
    })
    setRegisterValue('')
  }

  function removeRegister(value) {
    setData((current) => ({
      ...current,
      [registerTab]: current[registerTab].filter((item) => item !== value)
    }))
  }

  function resetData() {
    if (!confirm('Deseja apagar todos os dados salvos neste navegador?')) return
    setData(DEFAULT_DATA)
    setEditing(null)
    setDrawer(null)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f1] text-[#171717]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-[#d9d6ca] bg-[#fbfaf6] px-5 py-6 lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#104c3f] text-white">
            <WalletCards size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Finance Vitor</h1>
            <p className="text-sm text-[#6b675e]">Controle pessoal</p>
          </div>
        </div>

        <nav className="space-y-2">
          <NavButton icon={LayoutDashboard} label="Resumo" active={activePage === 'dashboard'} onClick={() => setActivePage('dashboard')} />
          <NavButton icon={ReceiptText} label="Lancamentos" active={activePage === 'transactions'} onClick={() => setActivePage('transactions')} />
          <NavButton icon={CreditCard} label="Faturas" active={activePage === 'invoices'} onClick={() => setActivePage('invoices')} />
          <NavButton icon={Database} label="Cadastros" active={activePage === 'registers'} onClick={() => setActivePage('registers')} />
        </nav>

        <div className="mt-auto rounded-lg border border-[#ddd8c9] bg-white p-4">
          <SyncBadge status={syncStatus} />
          {CLOUD_ENABLED && !cloudUser && <AuthBox form={authForm} setForm={setAuthForm} submit={submitAuth} />}
          {CLOUD_ENABLED && cloudUser && (
            <button onClick={signOut} className="mb-4 w-full rounded-lg border border-[#ddd8c9] bg-[#fbfaf6] px-3 py-2 text-sm font-semibold text-[#5f5a50]">
              Sair da nuvem
            </button>
          )}
          <p className="text-sm text-[#6b675e]">Saldo geral</p>
          <strong className={classNames('mt-1 block text-2xl', totals.allBalance >= 0 ? 'text-[#104c3f]' : 'text-[#9f2d20]')}>{money(totals.allBalance)}</strong>
          <button onClick={resetData} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#ead1cb] bg-[#fff6f3] px-3 py-2 text-sm font-semibold text-[#9f2d20]">
            <Trash2 size={16} />
            Limpar dados
          </button>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-[#d9d6ca] bg-[#f5f5f1]/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#8b6f2f]">{monthName(todayKey)}</p>
              <h2 className="text-2xl font-bold md:text-3xl">{pageTitle(activePage)}</h2>
              <p className="mt-1 text-sm text-[#6b675e] lg:hidden">{syncStatus}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MobileNav activePage={activePage} setActivePage={setActivePage} />
              {CLOUD_ENABLED && !cloudUser && (
                <button onClick={() => setDrawer('auth')} className="inline-flex items-center gap-2 rounded-lg border border-[#d9d6ca] bg-white px-4 py-3 text-sm font-bold text-[#104c3f] lg:hidden">
                  Entrar nuvem
                </button>
              )}
              {CLOUD_ENABLED && cloudUser && (
                <button onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border border-[#d9d6ca] bg-white px-4 py-3 text-sm font-bold text-[#5f5a50] lg:hidden">
                  Sair
                </button>
              )}
              <button onClick={() => setDrawer('new')} className="inline-flex items-center gap-2 rounded-lg bg-[#104c3f] px-4 py-3 text-sm font-bold text-white shadow-sm">
                <Plus size={18} />
                Novo lancamento
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8">
          {activePage === 'dashboard' && (
            <Dashboard totals={totals} invoices={invoices} categoryReport={categoryReport} transactions={transactions.slice(0, 6)} />
          )}

          {activePage === 'transactions' && (
            <TransactionsPage
              query={query}
              setQuery={setQuery}
              transactions={filteredTransactions}
              onEdit={setEditing}
            />
          )}

          {activePage === 'invoices' && <InvoicesPage invoices={invoices} onOpen={(invoice) => setDrawer({ type: 'invoice', invoice })} />}

          {activePage === 'registers' && (
            <RegistersPage
              active={registerTab}
              setActive={setRegisterTab}
              value={registerValue}
              setValue={setRegisterValue}
              data={data}
              add={addRegister}
              remove={removeRegister}
            />
          )}
        </div>
      </main>

      {drawer === 'new' && (
        <Drawer title="Novo lancamento" onClose={() => setDrawer(null)}>
          <TransactionForm
            form={form}
            setField={updateForm}
            submit={createTransaction}
            categories={data.categories}
            suppliers={data.suppliers}
            banks={data.banks}
            automaticDebit={automaticDebit}
            shouldParcel={shouldParcel}
            resolvedPaymentMethod={resolvedPaymentMethod}
            submitLabel="Salvar lancamento"
          />
        </Drawer>
      )}

      {drawer === 'auth' && (
        <Drawer title="Nuvem" onClose={() => setDrawer(null)}>
          <p className="mb-5 text-sm text-[#6b675e]">Entre para sincronizar seus dados em qualquer dispositivo.</p>
          <AuthBox form={authForm} setForm={setAuthForm} submit={submitAuth} />
        </Drawer>
      )}

      {editing && (
        <Drawer title={`Lancamento #${editing.id}`} onClose={() => setEditing(null)}>
          <EditForm
            transaction={editing}
            setTransaction={setEditing}
            submit={saveEdit}
            remove={() => removeTransaction(editing.id)}
            categories={data.categories}
            suppliers={data.suppliers}
            banks={data.banks}
          />
        </Drawer>
      )}

      {drawer?.type === 'invoice' && (
        <Drawer title={monthName(drawer.invoice.key)} onClose={() => setDrawer(null)}>
          <div className="mb-5 rounded-lg border border-[#ddd8c9] bg-white p-4">
            <p className="text-sm text-[#6b675e]">Total da fatura</p>
            <strong className="text-3xl">{money(drawer.invoice.total)}</strong>
          </div>
          <TransactionList transactions={drawer.invoice.items} onEdit={setEditing} />
        </Drawer>
      )}
    </div>
  )
}

function SyncBadge({ status }) {
  const isCloud = status.toLowerCase().includes('nuvem')
  return (
    <div className={classNames('mb-4 rounded-lg border px-3 py-2 text-sm font-semibold', isCloud ? 'border-[#c9dfd5] bg-[#eef8f3] text-[#104c3f]' : 'border-[#ddd8c9] bg-[#fbfaf6] text-[#6b675e]')}>
      {status}
    </div>
  )
}

function AuthBox({ form, setForm, submit }) {
  return (
    <form onSubmit={submit} className="mb-4 space-y-2">
      <input
        type="email"
        value={form.email}
        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        className="min-h-10 w-full rounded-lg border border-[#d6d0bf] bg-white px-3 text-sm outline-none focus:border-[#104c3f]"
        placeholder="E-mail"
        required
      />
      <input
        type="password"
        value={form.password}
        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        className="min-h-10 w-full rounded-lg border border-[#d6d0bf] bg-white px-3 text-sm outline-none focus:border-[#104c3f]"
        placeholder="Senha"
        minLength={6}
        required
      />
      {form.error && <p className="text-xs font-semibold text-[#9f2d20]">{form.error}</p>}
      <button className="w-full rounded-lg bg-[#104c3f] px-3 py-2 text-sm font-bold text-white">
        {form.mode === 'signup' ? 'Criar conta' : 'Entrar'}
      </button>
      <button
        type="button"
        onClick={() => setForm((current) => ({ ...current, mode: current.mode === 'signup' ? 'login' : 'signup', error: '' }))}
        className="w-full text-xs font-semibold text-[#5f5a50]"
      >
        {form.mode === 'signup' ? 'Ja tenho conta' : 'Criar conta na nuvem'}
      </button>
    </form>
  )
}

function pageTitle(page) {
  return {
    dashboard: 'Resumo financeiro',
    transactions: 'Lancamentos',
    invoices: 'Faturas',
    registers: 'Cadastros'
  }[page]
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition',
        active ? 'bg-[#104c3f] text-white' : 'text-[#4b4740] hover:bg-[#efede5]'
      )}
    >
      <Icon size={18} />
      {label}
    </button>
  )
}

function MobileNav({ activePage, setActivePage }) {
  const items = [
    ['dashboard', LayoutDashboard],
    ['transactions', ReceiptText],
    ['invoices', CreditCard],
    ['registers', Database]
  ]
  return (
    <div className="flex rounded-lg border border-[#d9d6ca] bg-white p-1 lg:hidden">
      {items.map(([page, Icon]) => (
        <button
          key={page}
          aria-label={pageTitle(page)}
          onClick={() => setActivePage(page)}
          className={classNames('grid h-10 w-10 place-items-center rounded-md', activePage === page ? 'bg-[#104c3f] text-white' : 'text-[#5f5a50]')}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  )
}

function Dashboard({ totals, invoices, categoryReport, transactions }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Receitas do mes" value={money(totals.monthIncome)} icon={ArrowUpRight} tone="green" />
        <Metric title="Despesas do mes" value={money(totals.monthExpense)} icon={ArrowDownRight} tone="red" />
        <Metric title="Saldo previsto" value={money(totals.monthBalance)} icon={Banknote} tone={totals.monthBalance >= 0 ? 'green' : 'red'} />
        <Metric title="Faturas futuras" value={invoices.filter((item) => item.key >= monthKey(new Date().toISOString().slice(0, 10))).length} icon={CalendarDays} tone="gold" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Ultimos lancamentos">
          <TransactionList transactions={transactions} compact />
        </Panel>
        <Panel title="Categorias">
          <div className="space-y-3">
            {categoryReport.map((item) => (
              <div key={item.category} className="rounded-lg border border-[#e4dfd1] bg-[#fbfaf6] p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong>{item.category}</strong>
                  <span className="text-sm text-[#6b675e]">{item.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#e8e3d5]">
                  <div className="h-2 rounded-full bg-[#c48a2c]" style={{ width: `${Math.min((item.expense / Math.max(1, categoryReport.reduce((max, x) => Math.max(max, x.expense), 1))) * 100, 100)}%` }} />
                </div>
                <p className="mt-2 text-sm text-[#6b675e]">Despesas: {money(item.expense)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  )
}

function TransactionsPage({ query, setQuery, transactions, onEdit }) {
  return (
    <Panel title="Todos os lancamentos" action={<SearchBox value={query} setValue={setQuery} />}>
      <TransactionList transactions={transactions} onEdit={onEdit} />
    </Panel>
  )
}

function InvoicesPage({ invoices, onOpen }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {invoices.length === 0 && <EmptyState text="Nenhuma fatura foi criada ainda." />}
      {invoices.map((invoice) => (
        <button key={invoice.key} onClick={() => onOpen(invoice)} className="rounded-lg border border-[#ddd8c9] bg-white p-5 text-left shadow-sm transition hover:border-[#b9aa82]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#8b6f2f]">Fatura</p>
              <h3 className="mt-1 text-xl font-bold capitalize">{monthName(invoice.key)}</h3>
              <p className="mt-1 text-sm text-[#6b675e]">{invoice.items.length} lancamento(s)</p>
            </div>
            <strong className="text-2xl">{money(invoice.total)}</strong>
          </div>
        </button>
      ))}
    </div>
  )
}

function RegistersPage({ active, setActive, value, setValue, data, add, remove }) {
  const tabs = [
    ['banks', 'Bancos'],
    ['suppliers', 'Fornecedores'],
    ['categories', 'Categorias']
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="rounded-lg border border-[#ddd8c9] bg-white p-3">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setActive(key)} className={classNames('mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold', active === key ? 'bg-[#104c3f] text-white' : 'hover:bg-[#f2efe6]')}>
            <Settings2 size={16} />
            {label}
          </button>
        ))}
      </div>
      <Panel title={tabs.find(([key]) => key === active)?.[1]}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            className="min-h-11 flex-1 rounded-lg border border-[#d6d0bf] bg-white px-4 outline-none focus:border-[#104c3f]"
            placeholder="Novo cadastro"
          />
          <button onClick={add} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#104c3f] px-4 py-3 text-sm font-bold text-white">
            <Plus size={18} />
            Adicionar
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data[active].map((item) => (
            <div key={item} className="flex items-center justify-between gap-3 rounded-lg border border-[#e4dfd1] bg-[#fbfaf6] p-4">
              <strong>{item}</strong>
              <button aria-label={`Excluir ${item}`} onClick={() => remove(item)} className="grid h-9 w-9 place-items-center rounded-lg text-[#9f2d20] hover:bg-[#fff1ed]">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function Metric({ title, value, icon: Icon, tone }) {
  const tones = {
    green: 'bg-[#e7f1ec] text-[#104c3f]',
    red: 'bg-[#fff1ed] text-[#9f2d20]',
    gold: 'bg-[#fff4d9] text-[#8b6f2f]'
  }
  return (
    <div className="rounded-lg border border-[#ddd8c9] bg-white p-5 shadow-sm">
      <div className={classNames('mb-5 grid h-11 w-11 place-items-center rounded-lg', tones[tone])}>
        <Icon size={21} />
      </div>
      <p className="text-sm text-[#6b675e]">{title}</p>
      <strong className="mt-1 block text-2xl">{value}</strong>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-lg border border-[#ddd8c9] bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SearchBox({ value, setValue }) {
  return (
    <label className="relative block w-full sm:w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#817a6d]" size={17} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-[#d6d0bf] bg-[#fbfaf6] pl-10 pr-4 outline-none focus:border-[#104c3f]"
        placeholder="Pesquisar"
      />
    </label>
  )
}

function TransactionList({ transactions, onEdit, compact = false }) {
  if (!transactions.length) return <EmptyState text="Nenhum lancamento encontrado." />
  return (
    <div className="space-y-3">
      {transactions.map((item) => (
        <button
          key={item.id}
          onClick={() => onEdit?.(item)}
          className={classNames('w-full rounded-lg border border-[#e4dfd1] bg-[#fbfaf6] p-4 text-left transition', onEdit && 'hover:border-[#b9aa82]')}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{item.description}</strong>
                <span className="rounded-md bg-[#eee9dd] px-2 py-1 text-xs font-semibold text-[#5f5a50]">#{item.id}</span>
                <span className="rounded-md bg-[#eee9dd] px-2 py-1 text-xs font-semibold text-[#5f5a50]">{item.installment}</span>
              </div>
              {!compact && <p className="mt-1 text-sm text-[#6b675e]">{item.category} | {item.supplier} | {item.bank} | {item.paymentMethod}</p>}
              <p className="mt-1 text-xs text-[#817a6d]">Vencimento: {item.dueDate}</p>
            </div>
            <strong className={classNames('text-lg', item.type === 'Receita' ? 'text-[#104c3f]' : 'text-[#9f2d20]')}>
              {item.type === 'Receita' ? '+' : '-'} {money(item.amount)}
            </strong>
          </div>
        </button>
      ))}
    </div>
  )
}

function TransactionForm({ form, setField, submit, categories, suppliers, banks, automaticDebit, shouldParcel, resolvedPaymentMethod, submitLabel }) {
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Tipo">
        <div className="grid grid-cols-2 gap-2">
          {['Despesa', 'Receita'].map((type) => (
            <button key={type} type="button" onClick={() => setField('type', type)} className={classNames('rounded-lg border px-4 py-3 font-semibold', form.type === type ? 'border-[#104c3f] bg-[#e7f1ec] text-[#104c3f]' : 'border-[#d6d0bf] bg-white')}>
              {type}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Descricao"><Input value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Ex: supermercado" /></Field>
      <Field label="Valor total"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data de lancamento"><Input type="date" value={form.releaseDate} onChange={(event) => setField('releaseDate', event.target.value)} required /></Field>
        <Field label="Vencimento"><Input type="date" value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} required /></Field>
      </div>
      <Field label="Categoria"><Select value={form.category} onChange={(event) => setField('category', event.target.value)} items={categories} /></Field>
      <Field label="Fornecedor"><Select value={form.supplier} onChange={(event) => setField('supplier', event.target.value)} items={suppliers} /></Field>
      <Field label="Banco"><Select value={form.bank} onChange={(event) => setField('bank', event.target.value)} items={banks} /></Field>
      {!automaticDebit && (
        <Field label="Forma de pagamento">
          <div className="grid grid-cols-3 gap-2">
            {['Debito', 'Credito', 'PIX'].map((method) => (
              <button key={method} type="button" onClick={() => setField('paymentMethod', method)} className={classNames('rounded-lg border px-3 py-3 text-sm font-semibold', form.paymentMethod === method ? 'border-[#104c3f] bg-[#e7f1ec] text-[#104c3f]' : 'border-[#d6d0bf] bg-white')}>
                {method}
              </button>
            ))}
          </div>
        </Field>
      )}
      {shouldParcel && <Field label="Parcelas"><Input type="number" min="1" value={form.installments} onChange={(event) => setField('installments', event.target.value)} /></Field>}
      <div className="rounded-lg border border-[#ddd8c9] bg-[#fbfaf6] p-4">
        <p className="text-sm text-[#6b675e]">Previa</p>
        <strong>{money(form.amount)} em {shouldParcel ? form.installments : 1}x</strong>
        <p className="text-sm text-[#6b675e]">Forma: {resolvedPaymentMethod}</p>
      </div>
      <button className="w-full rounded-lg bg-[#104c3f] px-4 py-3 font-bold text-white">{submitLabel}</button>
    </form>
  )
}

function EditForm({ transaction, setTransaction, submit, remove, categories, suppliers, banks }) {
  const setField = (field, value) => setTransaction((current) => ({ ...current, [field]: value }))
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-[#ddd8c9] bg-white p-4">
        <p className="text-sm text-[#6b675e]">Valor</p>
        <strong className={classNames('text-3xl', transaction.type === 'Receita' ? 'text-[#104c3f]' : 'text-[#9f2d20]')}>{money(transaction.amount)}</strong>
      </div>
      <Field label="Descricao"><Input value={transaction.description} onChange={(event) => setField('description', event.target.value)} /></Field>
      <Field label="Valor"><Input type="number" step="0.01" value={transaction.amount} onChange={(event) => setField('amount', Number(event.target.value))} /></Field>
      <Field label="Categoria"><Select value={transaction.category} onChange={(event) => setField('category', event.target.value)} items={categories} /></Field>
      <Field label="Fornecedor"><Select value={transaction.supplier} onChange={(event) => setField('supplier', event.target.value)} items={suppliers} /></Field>
      <Field label="Banco"><Select value={transaction.bank} onChange={(event) => setField('bank', event.target.value)} items={banks} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lancamento"><Input type="date" value={transaction.releaseDate} onChange={(event) => setField('releaseDate', event.target.value)} /></Field>
        <Field label="Vencimento"><Input type="date" value={transaction.dueDate} onChange={(event) => setField('dueDate', event.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3">
        <button type="submit" className="rounded-lg bg-[#104c3f] px-4 py-3 font-bold text-white">Salvar</button>
        <button type="button" onClick={remove} className="rounded-lg border border-[#ead1cb] bg-[#fff6f3] px-4 py-3 font-bold text-[#9f2d20]">Excluir</button>
      </div>
    </form>
  )
}

function Drawer({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <button aria-label="Fechar painel" onClick={onClose} className="flex-1" />
      <aside className="h-full w-full max-w-xl overflow-auto bg-[#f5f5f1] p-5 shadow-2xl md:p-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button aria-label="Fechar" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-[#ddd8c9] bg-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#5f5a50]">{label}</span>
      {children}
    </label>
  )
}

function Input(props) {
  return <input {...props} className="min-h-11 w-full rounded-lg border border-[#d6d0bf] bg-white px-4 outline-none focus:border-[#104c3f]" />
}

function Select({ items, ...props }) {
  return (
    <select {...props} className="min-h-11 w-full rounded-lg border border-[#d6d0bf] bg-white px-4 outline-none focus:border-[#104c3f]" required>
      <option value="">Selecione</option>
      {items.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  )
}

function EmptyState({ text }) {
  return <div className="rounded-lg border border-dashed border-[#cfc8b6] bg-[#fbfaf6] p-6 text-center text-[#6b675e]">{text}</div>
}
