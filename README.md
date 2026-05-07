
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #0F0F0F;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEYS = {
  categories: 'finance-categories',
  banks: 'finance-banks',
  suppliers: 'finance-suppliers',
  transactions: 'finance-transactions',
  lastId: 'finance-last-id'
}

const INITIAL_CATEGORIES = []
const INITIAL_BANKS = []
const INITIAL_SUPPLIERS = []
const INITIAL_TRANSACTIONS = []
const AUTOMATIC_DEBIT_TYPES = ['Empréstimo', 'Consórcio', 'Financiamento']

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function addMonths(dateString, monthsToAdd) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setMonth(date.getMonth() + monthsToAdd)
  return date.toISOString().split('T')[0]
}

function getMonthKey(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm text-[#A5A5A5] mb-2">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full bg-[#222222] border border-[#303030] focus:border-[#8A05BE] outline-none px-5 py-4 rounded-2xl text-white placeholder:text-[#6F6F6F] transition-all duration-200 ${props.className || ''}`}
    />
  )
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className="w-full bg-[#222222] border border-[#303030] focus:border-[#8A05BE] outline-none px-5 py-4 rounded-2xl text-white transition-all duration-200"
    />
  )
}

function StatCard({ label, value, sub, highlight }) {
  return (
    <div className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-7">
      <p className="text-[#8D8D8D] text-sm mb-3">{label}</p>
      <h2 className={`text-3xl font-bold tracking-tight ${highlight ? 'text-[#A855F7]' : ''}`}>{value}</h2>
      {sub && <p className="text-[#6F6F6F] mt-2 text-sm">{sub}</p>}
    </div>
  )
}

export default function App() {
  const menu = ['Lançamento', 'Relatórios', 'Faturas', 'Controle', 'Banco de Dados']
  const [activePage, setActivePage] = useState('Lançamento')
  const [activeDatabaseTab, setActiveDatabaseTab] = useState('Banco')

  const [categories, setCategories] = useState(() => readStorage(STORAGE_KEYS.categories, INITIAL_CATEGORIES))
  const [banks, setBanks] = useState(() => readStorage(STORAGE_KEYS.banks, INITIAL_BANKS))
  const [suppliers, setSuppliers] = useState(() => readStorage(STORAGE_KEYS.suppliers, INITIAL_SUPPLIERS))
  const [transactions, setTransactions] = useState(() => readStorage(STORAGE_KEYS.transactions, INITIAL_TRANSACTIONS))
  const [lastTransactionId, setLastTransactionId] = useState(() => readStorage(STORAGE_KEYS.lastId, 0))

  const [newDatabaseItem, setNewDatabaseItem] = useState('')
  const [editingDatabaseItem, setEditingDatabaseItem] = useState(null)
  const [editedDatabaseItem, setEditedDatabaseItem] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [isEditingTransaction, setIsEditingTransaction] = useState(false)
  const [selectedReportCategory, setSelectedReportCategory] = useState(null)
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState(null)

  const [form, setForm] = useState({
    type: 'Despesa',
    description: '',
    amount: '',
    releaseDate: '',
    dueDate: '',
    category: '',
    supplier: '',
    bank: '',
    paymentMethod: 'Débito',
    installments: '1'
  })

  useEffect(() => localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories)), [categories])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.banks, JSON.stringify(banks)), [banks])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.suppliers, JSON.stringify(suppliers)), [suppliers])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions)), [transactions])
  useEffect(() => localStorage.setItem(STORAGE_KEYS.lastId, JSON.stringify(lastTransactionId)), [lastTransactionId])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      category: current.category || categories[0] || '',
      supplier: current.supplier || suppliers[0] || '',
      bank: current.bank || banks[0] || ''
    }))
  }, [categories, suppliers, banks])

  const isAutomaticDebit = AUTOMATIC_DEBIT_TYPES.includes(form.category)
  const needsInstallments = form.paymentMethod === 'Crédito' || isAutomaticDebit
  const resolvedPaymentMethod = isAutomaticDebit ? 'Débito automático' : form.paymentMethod
  const currentMonthKey = getMonthKey(new Date().toISOString().split('T')[0])

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return transactions
    return transactions.filter((t) => [t.id, t.type, t.description, t.category, t.supplier, t.bank, t.paymentMethod, t.installmentLabel].join(' ').toLowerCase().includes(term))
  }, [searchTerm, transactions])

  const invoicesByMonth = useMemo(() => {
    const grouped = {}
    transactions.filter((t) => t.type === 'Despesa').forEach((t) => {
      const key = getMonthKey(t.dueDate)
      if (!grouped[key]) grouped[key] = { monthKey: key, label: getMonthLabel(key), total: 0, transactions: [] }
      grouped[key].total += Number(t.amount)
      grouped[key].transactions.push(t)
    })
    return Object.values(grouped).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [transactions])

  const currentMonthInvoice = invoicesByMonth.find((i) => i.monthKey === currentMonthKey)
  const futureInvoices = invoicesByMonth.filter((i) => i.monthKey > currentMonthKey)
  const selectedInvoiceData = invoicesByMonth.find((i) => i.monthKey === selectedInvoiceMonth)

  const categoryReports = useMemo(() => {
    return categories.map((category) => {
      const items = transactions.filter((t) => t.category === category)
      const totalRevenue = items.filter((t) => t.type === 'Receita').reduce((sum, t) => sum + Number(t.amount), 0)
      const totalExpense = items.filter((t) => t.type === 'Despesa').reduce((sum, t) => sum + Number(t.amount), 0)
      return { category, totalRevenue, totalExpense, quantity: items.length, transactions: items }
    })
  }, [categories, transactions])

  const selectedCategoryReport = categoryReports.find((r) => r.category === selectedReportCategory)
  const monthRevenue = transactions.filter((t) => t.type === 'Receita' && getMonthKey(t.dueDate) === currentMonthKey).reduce((sum, t) => sum + Number(t.amount), 0)

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function getDatabaseList() {
    if (activeDatabaseTab === 'Banco') return banks
    if (activeDatabaseTab === 'Fornecedores') return suppliers
    return categories
  }

  function setDatabaseList(updater) {
    if (activeDatabaseTab === 'Banco') return setBanks(updater)
    if (activeDatabaseTab === 'Fornecedores') return setSuppliers(updater)
    return setCategories(updater)
  }

  function addDatabaseItem() {
    const item = newDatabaseItem.trim()
    if (!item) return
    setDatabaseList((list) => list.some((x) => x.toLowerCase() === item.toLowerCase()) ? list : [...list, item])
    setNewDatabaseItem('')
  }

  function saveDatabaseItem(oldItem) {
    const newItem = editedDatabaseItem.trim()
    if (!newItem) return
    setDatabaseList((list) => list.map((item) => item === oldItem ? newItem : item))
    setTransactions((list) => list.map((t) => ({
      ...t,
      bank: t.bank === oldItem ? newItem : t.bank,
      supplier: t.supplier === oldItem ? newItem : t.supplier,
      category: t.category === oldItem ? newItem : t.category
    })))
    setEditingDatabaseItem(null)
    setEditedDatabaseItem('')
  }

  function removeDatabaseItem(itemToRemove) {
    setDatabaseList((list) => list.filter((item) => item !== itemToRemove))
  }

  function createTransaction(event) {
    event.preventDefault()
    const installments = Math.max(Number(form.installments) || 1, 1)
    const nextId = lastTransactionId + 1
    const installmentAmount = Number(form.amount) / installments
    const newTransactions = Array.from({ length: installments }, (_, index) => ({
      id: nextId + index,
      type: form.type,
      description: form.description || `${form.category} sem descrição`,
      amount: installmentAmount,
      installmentLabel: `${index + 1}/${installments}`,
      releaseDate: form.releaseDate,
      dueDate: addMonths(form.dueDate || form.releaseDate, index),
      category: form.category,
      supplier: form.supplier,
      bank: form.bank,
      paymentMethod: resolvedPaymentMethod
    }))
    setTransactions((list) => [...list, ...newTransactions])
    setLastTransactionId(nextId + installments - 1)
    setForm({ type: 'Despesa', description: '', amount: '', releaseDate: '', dueDate: '', category: categories[0] || '', supplier: suppliers[0] || '', bank: banks[0] || '', paymentMethod: 'Débito', installments: '1' })
    setIsNewDrawerOpen(false)
  }

  function saveTransactionEdit() {
    setTransactions((list) => list.map((t) => t.id === selectedTransaction.id ? selectedTransaction : t))
    setIsEditingTransaction(false)
  }

  function deleteSelectedTransaction() {
    setTransactions((list) => list.filter((t) => t.id !== selectedTransaction.id))
    setSelectedTransaction(null)
    setIsEditingTransaction(false)
  }

  function resetAllData() {
    if (!confirm('Tem certeza que deseja limpar todos os dados?')) return
    setTransactions([])
    setCategories([])
    setBanks([])
    setSuppliers([])
    setLastTransactionId(0)
    setForm({ type: 'Despesa', description: '', amount: '', releaseDate: '', dueDate: '', category: '', supplier: '', bank: '', paymentMethod: 'Débito', installments: '1' })
    setSelectedTransaction(null)
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white flex font-sans">
      <aside className="w-72 bg-[#171717] border-r border-[#2A2A2A] p-6 flex flex-col justify-between">
        <div>
          <div className="mb-12">
            <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
            <p className="text-[#7A7A7A] text-sm mt-1">Controle financeiro pessoal</p>
          </div>
          <nav className="space-y-3">
            {menu.map((item) => (
              <button key={item} onClick={() => setActivePage(item)} className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-200 text-left ${activePage === item ? 'bg-[#232323] border border-[#8A05BE] text-white shadow-lg shadow-purple-900/20' : 'hover:bg-[#222222] text-[#B3B3B3]'}`}>
                <div className={`w-2 h-2 rounded-full ${activePage === item ? 'bg-[#8A05BE]' : 'bg-[#5A5A5A]'}`} />
                <span className="text-[15px] font-medium">{item}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="bg-[#1E1E1E] rounded-3xl p-5 border border-[#2A2A2A]">
          <p className="text-sm text-[#8F8F8F]">Usuário</p>
          <h2 className="mt-1 text-lg font-semibold">Vitor Gama</h2>
          <button onClick={resetAllData} className="mt-4 w-full bg-[#2A1515] hover:bg-[#351919] border border-red-900/40 transition-all duration-200 px-4 py-3 rounded-2xl text-sm font-medium text-red-300">Limpar tudo</button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-auto relative">
        {activePage === 'Lançamento' && (
          <>
            <div className="flex items-center justify-between mb-10">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">Lançamentos</h1>
                <p className="text-[#8B8B8B] mt-2 text-lg">Cadastre, pesquise e acompanhe seus lançamentos financeiros.</p>
              </div>
              <button onClick={() => setIsNewDrawerOpen(true)} className="bg-[#8A05BE] hover:bg-[#9F2BCE] transition-all duration-200 px-6 py-4 rounded-2xl font-medium shadow-lg shadow-purple-900/30">+ Novo lançamento</button>
            </div>

            <section className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-8">
              <div className="flex items-center justify-between mb-8 gap-6">
                <div>
                  <h2 className="text-2xl font-semibold">Lançamentos</h2>
                  <p className="text-[#7D7D7D] mt-1">Procure e visualize todos os lançamentos.</p>
                </div>
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar lançamento..." className="bg-[#232323] border border-[#2E2E2E] focus:border-[#8A05BE] outline-none px-5 py-3 rounded-2xl text-sm text-white placeholder:text-[#6F6F6F] w-72 transition-all duration-200" />
              </div>

              <div className="space-y-4">
                {filteredTransactions.length === 0 && <p className="text-[#8B8B8B] bg-[#222222] rounded-2xl p-6">Nenhum lançamento cadastrado.</p>}
                {filteredTransactions.map((t) => (
                  <button key={t.id} onClick={() => { setSelectedTransaction(t); setIsEditingTransaction(false) }} className="w-full grid grid-cols-[1fr_auto] gap-6 bg-[#222222] hover:bg-[#282828] transition-all duration-200 rounded-2xl px-6 py-5 text-left">
                    <div className="flex items-center gap-5">
                      <div className="bg-[#2A2A2A] border border-[#3A3A3A] w-12 h-12 rounded-2xl flex items-center justify-center text-sm text-[#A8A8A8] font-semibold">#{t.id}</div>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap"><h3 className="font-medium text-lg">{t.description}</h3><span className="text-xs px-3 py-1 rounded-full bg-[#2C2C2C] text-[#BDBDBD]">{t.installmentLabel}</span><span className="text-xs px-3 py-1 rounded-full bg-[#2C2C2C] text-[#BDBDBD]">{t.type}</span></div>
                        <p className="text-sm text-[#8A8A8A] mt-2">{t.category} • {t.supplier} • {t.bank} • {t.paymentMethod}</p>
                        <p className="text-xs text-[#6F6F6F] mt-1">Lançamento: {t.releaseDate} • Vencimento: {t.dueDate}</p>
                      </div>
                    </div>
                    <p className={`font-semibold text-lg self-center ${t.type === 'Receita' ? 'text-[#A855F7]' : 'text-white'}`}>{t.type === 'Receita' ? '+' : '-'} {formatCurrency(t.amount)}</p>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {activePage === 'Relatórios' && (
          <>
            <PageTitle title="Relatórios" subtitle="Veja o macro dos seus gastos e recebimentos por categoria." />
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard label="Total de despesas" value={formatCurrency(transactions.filter((t) => t.type === 'Despesa').reduce((sum, t) => sum + Number(t.amount), 0))} />
              <StatCard label="Total de receitas" value={formatCurrency(transactions.filter((t) => t.type === 'Receita').reduce((sum, t) => sum + Number(t.amount), 0))} highlight />
              <StatCard label="Categorias usadas" value={categoryReports.filter((r) => r.quantity > 0).length} />
            </section>
            <section className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-8">
              <h2 className="text-2xl font-semibold mb-2">Gastos e recebimentos por categoria</h2>
              <p className="text-[#7D7D7D] mb-8">Clique em uma categoria para abrir todos os lançamentos vinculados.</p>
              <div className="space-y-4">
                {categoryReports.length === 0 && <p className="text-[#8B8B8B] bg-[#222222] rounded-2xl p-6">Nenhuma categoria cadastrada.</p>}
                {categoryReports.map((r) => (
                  <button key={r.category} onClick={() => setSelectedReportCategory(r.category)} className="w-full grid grid-cols-[1fr_auto] gap-6 bg-[#222222] hover:bg-[#282828] rounded-2xl px-6 py-5 text-left">
                    <div><h3 className="font-medium text-lg">{r.category}</h3><p className="text-sm text-[#8A8A8A] mt-1">{r.quantity} lançamento(s)</p></div>
                    <div className="text-right"><p className="text-sm text-[#8A8A8A]">Despesas</p><p className="text-xl font-semibold">{formatCurrency(r.totalExpense)}</p>{r.totalRevenue > 0 && <p className="text-sm text-[#A855F7]">Receita: {formatCurrency(r.totalRevenue)}</p>}</div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {activePage === 'Faturas' && (
          <>
            <PageTitle title="Faturas" subtitle="Visualize quanto será pago em cada mês, incluindo parcelas futuras." />
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard label="Fatura do mês atual" value={currentMonthInvoice ? formatCurrency(currentMonthInvoice.total) : 'R$ 0,00'} sub={getMonthLabel(currentMonthKey)} />
              <StatCard label="Próximas faturas" value={futureInvoices.length} sub="Meses futuros identificados" />
              <StatCard label="Parcelas futuras" value={transactions.filter((t) => t.installmentLabel !== '1/1').length} sub="Lançamentos parcelados" />
            </section>
            <section className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-8">
              <h2 className="text-2xl font-semibold mb-2">Gastos por mês</h2>
              <p className="text-[#7D7D7D] mb-8">O sistema usa o vencimento para entender em qual mês a conta será paga.</p>
              <div className="space-y-4">
                {invoicesByMonth.length === 0 && <p className="text-[#8B8B8B] bg-[#222222] rounded-2xl p-6">Nenhuma fatura identificada.</p>}
                {invoicesByMonth.map((i) => <button key={i.monthKey} onClick={() => setSelectedInvoiceMonth(i.monthKey)} className="w-full grid grid-cols-[1fr_auto] gap-6 bg-[#222222] hover:bg-[#282828] rounded-2xl px-6 py-5 text-left"><div><h3 className="font-medium text-lg capitalize">{i.label}</h3><p className="text-sm text-[#8A8A8A] mt-1">{i.transactions.length} lançamento(s)</p></div><div className="text-right"><p className="text-sm text-[#8A8A8A]">Total</p><p className="text-2xl font-semibold">{formatCurrency(i.total)}</p></div></button>)}
              </div>
            </section>
          </>
        )}

        {activePage === 'Controle' && (
          <>
            <PageTitle title="Controle" subtitle="Visão geral da sua situação financeira e compromissos fixos." />
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard label="Receita do mês" value={formatCurrency(monthRevenue)} highlight />
              <StatCard label="Despesa do mês" value={formatCurrency(currentMonthInvoice?.total || 0)} />
              <StatCard label="Saldo previsto" value={formatCurrency(monthRevenue - (currentMonthInvoice?.total || 0))} />
              <StatCard label="Próximos meses" value={futureInvoices.length} sub="Faturas futuras" />
            </section>
            <section className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-2">Compromissos fixos</h2>
              <p className="text-[#7D7D7D] mb-8">Identifica empréstimos, consórcios, financiamentos e despesas parceladas.</p>
              <div className="space-y-4">
                {transactions.filter((t) => AUTOMATIC_DEBIT_TYPES.includes(t.category) || t.installmentLabel !== '1/1').map((t) => <div key={t.id} className="grid grid-cols-[1fr_auto] gap-6 bg-[#222222] border border-[#303030] rounded-2xl px-6 py-5"><div><h3 className="font-medium text-lg">{t.description}</h3><p className="text-sm text-[#8A8A8A] mt-1">{t.category} • {t.bank} • {t.installmentLabel}</p></div><p className="text-xl font-semibold self-center">{formatCurrency(t.amount)}</p></div>)}
              </div>
            </section>
            <section className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-8">
              <h2 className="text-2xl font-semibold mb-8">Previsão das próximas faturas</h2>
              <div className="space-y-4">{futureInvoices.map((i) => <div key={i.monthKey} className="grid grid-cols-[1fr_auto] gap-6 bg-[#222222] border border-[#303030] rounded-2xl px-6 py-5"><div><h3 className="font-medium text-lg capitalize">{i.label}</h3><p className="text-sm text-[#8A8A8A] mt-1">{i.transactions.length} lançamento(s)</p></div><p className="text-2xl font-semibold self-center">{formatCurrency(i.total)}</p></div>)}</div>
            </section>
          </>
        )}

        {activePage === 'Banco de Dados' && (
          <>
            <PageTitle title="Banco de Dados" subtitle="Cadastre as opções que aparecem nos lançamentos." />
            <section className="grid grid-cols-[260px_1fr] gap-6">
              <aside className="bg-[#171717] border border-[#2A2A2A] rounded-[28px] p-5 h-fit">
                <p className="text-sm text-[#7D7D7D] mb-4 px-2">Tabelas</p>
                <div className="space-y-3">{['Banco', 'Fornecedores', 'Categoria'].map((tab) => <button key={tab} onClick={() => { setActiveDatabaseTab(tab); setNewDatabaseItem(''); setEditingDatabaseItem(null) }} className={`w-full text-left px-5 py-4 rounded-2xl ${activeDatabaseTab === tab ? 'bg-[#232323] border border-[#8A05BE]' : 'bg-[#1E1E1E] border border-[#2A2A2A] text-[#BDBDBD]'}`}>{tab}</button>)}</div>
              </aside>
              <div className="bg-[#1B1B1B] border border-[#2A2A2A] rounded-[28px] p-8">
                <h2 className="text-2xl font-semibold mb-2">{activeDatabaseTab}</h2>
                <p className="text-[#7D7D7D] mb-8">Tudo que for cadastrado aqui será usado na aba Lançamento.</p>
                <div className="flex gap-3 mb-8"><input value={newDatabaseItem} onChange={(e) => setNewDatabaseItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addDatabaseItem() }} placeholder={`Adicionar ${activeDatabaseTab.toLowerCase()}...`} className="flex-1 bg-[#232323] border border-[#2E2E2E] focus:border-[#8A05BE] outline-none px-5 py-4 rounded-2xl text-sm text-white placeholder:text-[#6F6F6F]" /><button onClick={addDatabaseItem} className="bg-[#8A05BE] hover:bg-[#9F2BCE] px-6 py-4 rounded-2xl text-sm font-medium">Adicionar</button></div>
                <div className="space-y-4">
                  {getDatabaseList().map((item) => <div key={item} className="flex items-center justify-between gap-4 bg-[#222222] border border-[#303030] rounded-2xl px-6 py-5">{editingDatabaseItem === item ? <input value={editedDatabaseItem} onChange={(e) => setEditedDatabaseItem(e.target.value)} className="flex-1 bg-[#171717] border border-[#8A05BE] outline-none px-5 py-3 rounded-2xl" /> : <div><p className="font-medium text-lg">{item}</p><p className="text-sm text-[#7D7D7D] mt-1">Disponível nos lançamentos</p></div>}<div className="flex gap-3">{editingDatabaseItem === item ? <><button onClick={() => saveDatabaseItem(item)} className="bg-[#8A05BE] px-5 py-3 rounded-2xl text-sm">Salvar</button><button onClick={() => setEditingDatabaseItem(null)} className="bg-[#242424] px-5 py-3 rounded-2xl text-sm">Cancelar</button></> : <><button onClick={() => { setEditingDatabaseItem(item); setEditedDatabaseItem(item) }} className="bg-[#242424] px-5 py-3 rounded-2xl text-sm">Editar</button><button onClick={() => removeDatabaseItem(item)} className="bg-[#2A1515] border border-red-900/40 px-5 py-3 rounded-2xl text-sm text-red-300">Excluir</button></>}</div></div>)}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {selectedTransaction && <TransactionDrawer transaction={selectedTransaction} setTransaction={setSelectedTransaction} editing={isEditingTransaction} setEditing={setIsEditingTransaction} save={saveTransactionEdit} remove={deleteSelectedTransaction} categories={categories} suppliers={suppliers} banks={banks} />}
      {isNewDrawerOpen && <NewTransactionDrawer close={() => setIsNewDrawerOpen(false)} form={form} updateForm={updateForm} submit={createTransaction} categories={categories} suppliers={suppliers} banks={banks} isAutomaticDebit={isAutomaticDebit} needsInstallments={needsInstallments} resolvedPaymentMethod={resolvedPaymentMethod} />}
      {selectedCategoryReport && <ListDrawer title={selectedCategoryReport.category} subtitle="Categoria" close={() => setSelectedReportCategory(null)} totalLabel="Despesas" total={selectedCategoryReport.totalExpense} items={selectedCategoryReport.transactions} openTransaction={(t) => { setSelectedReportCategory(null); setSelectedTransaction(t) }} />}
      {selectedInvoiceData && <ListDrawer title={selectedInvoiceData.label} subtitle="Fatura" close={() => setSelectedInvoiceMonth(null)} totalLabel="Total do mês" total={selectedInvoiceData.total} items={selectedInvoiceData.transactions} openTransaction={(t) => { setSelectedInvoiceMonth(null); setSelectedTransaction(t) }} />}
    </div>
  )
}

function PageTitle({ title, subtitle }) {
  return <div className="flex items-center justify-between mb-10"><div><h1 className="text-4xl font-bold tracking-tight">{title}</h1><p className="text-[#8B8B8B] mt-2 text-lg">{subtitle}</p></div></div>
}

function Drawer({ children, close, width = 'w-[520px]' }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"><button aria-label="Fechar" onClick={close} className="flex-1" /><aside className={`${width} h-full bg-[#171717] border-l border-[#2A2A2A] p-8 overflow-auto shadow-2xl shadow-black`}>{children}</aside></div>
}

function NewTransactionDrawer({ close, form, updateForm, submit, categories, suppliers, banks, isAutomaticDebit, needsInstallments, resolvedPaymentMethod }) {
  return <Drawer close={close}><div className="flex items-start justify-between gap-6 mb-8"><div><h2 className="text-3xl font-bold tracking-tight">Novo lançamento</h2><p className="text-[#8B8B8B] mt-2">Preencha os dados para gerar o lançamento.</p></div><button onClick={close} className="bg-[#242424] hover:bg-[#2D2D2D] w-11 h-11 rounded-2xl text-[#C5C5C5]">×</button></div><form onSubmit={submit} className="space-y-5"><Field label="Receita ou despesa"><div className="grid grid-cols-2 gap-3">{['Receita', 'Despesa'].map((type) => <button key={type} type="button" onClick={() => updateForm('type', type)} className={`px-4 py-4 rounded-2xl border ${form.type === type ? 'bg-[#8A05BE] border-[#8A05BE]' : 'bg-[#222222] border-[#303030] text-[#BDBDBD]'}`}>{type}</button>)}</div></Field><Field label="Descrição"><TextInput value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Ex: Compra no mercado" /></Field><Field label="Valor total"><TextInput type="number" min="0" step="0.01" value={form.amount} onChange={(e) => updateForm('amount', e.target.value)} required /></Field><div className="grid grid-cols-2 gap-4"><Field label="Data de lançamento"><TextInput type="date" value={form.releaseDate} onChange={(e) => updateForm('releaseDate', e.target.value)} required /></Field><Field label="Vencimento"><TextInput type="date" value={form.dueDate} onChange={(e) => updateForm('dueDate', e.target.value)} required /></Field></div><Field label="Categoria"><SelectInput value={form.category} onChange={(e) => updateForm('category', e.target.value)} required><option value="">Selecione</option>{categories.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field><Field label="Fornecedor"><SelectInput value={form.supplier} onChange={(e) => updateForm('supplier', e.target.value)} required><option value="">Selecione</option>{suppliers.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field><Field label="Banco"><SelectInput value={form.bank} onChange={(e) => updateForm('bank', e.target.value)} required><option value="">Selecione</option>{banks.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field>{!isAutomaticDebit && <Field label="Forma de pagamento"><div className="grid grid-cols-3 gap-3">{['Débito', 'Crédito', 'PIX'].map((method) => <button key={method} type="button" onClick={() => updateForm('paymentMethod', method)} className={`px-4 py-4 rounded-2xl border ${form.paymentMethod === method ? 'bg-[#8A05BE] border-[#8A05BE]' : 'bg-[#222222] border-[#303030] text-[#BDBDBD]'}`}>{method}</button>)}</div></Field>}{isAutomaticDebit && <div className="bg-[#22152A] border border-[#8A05BE]/40 rounded-2xl p-5"><p className="text-sm text-[#D8B4FE] font-medium">Esta categoria será tratada como débito automático.</p></div>}{needsInstallments && <Field label="Número de parcelas"><TextInput type="number" min="1" value={form.installments} onChange={(e) => updateForm('installments', e.target.value)} /></Field>}<div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-5"><p className="text-sm text-[#8B8B8B] mb-2">Prévia</p><p className="text-lg font-semibold">{form.amount ? formatCurrency(Number(form.amount)) : 'R$ 0,00'} em {needsInstallments ? form.installments : '1'}x</p><p className="text-sm text-[#7D7D7D] mt-1">Forma: {resolvedPaymentMethod}</p></div><button type="submit" className="w-full bg-[#8A05BE] hover:bg-[#9F2BCE] px-6 py-4 rounded-2xl font-medium">Salvar lançamento</button></form></Drawer>
}

function TransactionDrawer({ transaction, setTransaction, editing, setEditing, save, remove, categories, suppliers, banks }) {
  const update = (field, value) => setTransaction((current) => ({ ...current, [field]: value }))
  return <Drawer close={() => { setTransaction(null); setEditing(false) }} width="w-[480px]"><div className="flex items-start justify-between gap-6 mb-8"><div><p className="text-sm text-[#8B8B8B] mb-2">Lançamento #{transaction.id}</p><h2 className="text-3xl font-bold tracking-tight">{transaction.description}</h2></div><button onClick={() => setTransaction(null)} className="bg-[#242424] w-11 h-11 rounded-2xl">×</button></div><div className="bg-[#111111] border border-[#2A2A2A] rounded-3xl p-6 mb-6"><p className="text-sm text-[#8B8B8B] mb-2">Valor</p><p className={`text-4xl font-bold ${transaction.type === 'Receita' ? 'text-[#A855F7]' : ''}`}>{transaction.type === 'Receita' ? '+' : '-'} {formatCurrency(transaction.amount)}</p></div>{!editing ? <div className="space-y-4">{[['ID', `#${transaction.id}`], ['Tipo', transaction.type], ['Categoria', transaction.category], ['Fornecedor', transaction.supplier], ['Banco', transaction.bank], ['Forma', transaction.paymentMethod], ['Parcela', transaction.installmentLabel], ['Lançamento', transaction.releaseDate], ['Vencimento', transaction.dueDate]].map(([label, value]) => <div key={label} className="bg-[#222222] border border-[#303030] rounded-2xl px-5 py-4"><p className="text-xs text-[#7D7D7D] mb-1">{label}</p><p>{value}</p></div>)}</div> : <div className="space-y-4"><Field label="Descrição"><TextInput value={transaction.description} onChange={(e) => update('description', e.target.value)} /></Field><Field label="Valor"><TextInput type="number" step="0.01" value={transaction.amount} onChange={(e) => update('amount', Number(e.target.value))} /></Field><Field label="Categoria"><SelectInput value={transaction.category} onChange={(e) => update('category', e.target.value)}>{categories.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field><Field label="Fornecedor"><SelectInput value={transaction.supplier} onChange={(e) => update('supplier', e.target.value)}>{suppliers.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field><Field label="Banco"><SelectInput value={transaction.bank} onChange={(e) => update('bank', e.target.value)}>{banks.map((x) => <option key={x}>{x}</option>)}</SelectInput></Field><div className="grid grid-cols-2 gap-4"><Field label="Lançamento"><TextInput type="date" value={transaction.releaseDate} onChange={(e) => update('releaseDate', e.target.value)} /></Field><Field label="Vencimento"><TextInput type="date" value={transaction.dueDate} onChange={(e) => update('dueDate', e.target.value)} /></Field></div></div>}<div className="grid grid-cols-2 gap-3 mt-8">{!editing ? <button onClick={() => setEditing(true)} className="bg-[#242424] px-5 py-4 rounded-2xl text-sm">Editar</button> : <button onClick={save} className="bg-[#8A05BE] px-5 py-4 rounded-2xl text-sm">Salvar alterações</button>}<button onClick={remove} className="bg-[#2A1515] border border-red-900/40 px-5 py-4 rounded-2xl text-sm text-red-300">Excluir</button></div></Drawer>
}

function ListDrawer({ title, subtitle, close, totalLabel, total, items, openTransaction }) {
  return <Drawer close={close} width="w-[540px]"><div className="flex items-start justify-between gap-6 mb-8"><div><p className="text-sm text-[#8B8B8B] mb-2">{subtitle}</p><h2 className="text-3xl font-bold tracking-tight capitalize">{title}</h2></div><button onClick={close} className="bg-[#242424] w-11 h-11 rounded-2xl">×</button></div><div className="bg-[#111111] border border-[#2A2A2A] rounded-3xl p-6 mb-6"><p className="text-sm text-[#8B8B8B] mb-2">{totalLabel}</p><p className="text-4xl font-bold">{formatCurrency(total)}</p></div><div className="space-y-4">{items.length === 0 && <p className="text-[#8B8B8B] bg-[#222222] rounded-2xl p-6">Nenhum lançamento encontrado.</p>}{items.map((t) => <button key={t.id} onClick={() => openTransaction(t)} className="w-full grid grid-cols-[1fr_auto] gap-4 bg-[#222222] hover:bg-[#282828] border border-[#303030] rounded-2xl px-5 py-4 text-left"><div><p className="font-medium">#{t.id} • {t.description}</p><p className="text-sm text-[#8A8A8A] mt-1">{t.category} • {t.bank} • {t.installmentLabel}</p><p className="text-xs text-[#6F6F6F] mt-1">Vencimento: {t.dueDate}</p></div><p className={`font-semibold self-center ${t.type === 'Receita' ? 'text-[#A855F7]' : ''}`}>{t.type === 'Receita' ? '+' : '-'} {formatCurrency(t.amount)}</p></button>)}</div></Drawer>
}

{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "react": "latest",
    "react-dom": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "tailwindcss": "latest",
    "postcss": "latest",
    "autoprefixer": "latest"
  }
}

<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Finance Vitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
