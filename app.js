const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

const storageKey = "personal-finance-transactions";
const hasSupabaseConfig = SUPABASE_URL && SUPABASE_ANON_KEY;
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const form = document.querySelector("#transactionForm");
const formMessage = document.querySelector("#formMessage");
const storageStatus = document.querySelector("#storageStatus");
const monthFilter = document.querySelector("#monthFilter");
const transactionsEl = document.querySelector("#transactions");
const transactionCount = document.querySelector("#transactionCount");
const incomeTotal = document.querySelector("#incomeTotal");
const expenseTotal = document.querySelector("#expenseTotal");
const balanceTotal = document.querySelector("#balanceTotal");
const transactionDate = document.querySelector("#transactionDate");

let transactions = [];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return todayIso().slice(0, 7);
}

function showMessage(message) {
  formMessage.textContent = message;
  window.setTimeout(() => {
    formMessage.textContent = "";
  }, 3000);
}

function normalizeTransaction(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    type: row.type,
    category: row.category,
    transaction_date: row.transaction_date,
    created_at: row.created_at,
  };
}

function loadLocalTransactions() {
  const saved = window.localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved).map(normalizeTransaction) : [];
}

function saveLocalTransactions() {
  window.localStorage.setItem(storageKey, JSON.stringify(transactions));
}

async function fetchTransactions() {
  if (!supabaseClient) {
    transactions = loadLocalTransactions();
    return;
  }

  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showMessage("Nao foi possivel carregar o Supabase. Usando dados locais.");
    transactions = loadLocalTransactions();
    return;
  }

  transactions = data.map(normalizeTransaction);
}

async function createTransaction(transaction) {
  if (!supabaseClient) {
    transactions = [transaction, ...transactions];
    saveLocalTransactions();
    return;
  }

  const { error } = await supabaseClient.from("transactions").insert(transaction);
  if (error) {
    throw error;
  }
}

async function deleteTransaction(id) {
  if (!supabaseClient) {
    transactions = transactions.filter((transaction) => transaction.id !== id);
    saveLocalTransactions();
    render();
    return;
  }

  const { error } = await supabaseClient.from("transactions").delete().eq("id", id);
  if (error) {
    showMessage("Nao foi possivel apagar esse lancamento.");
    return;
  }

  await fetchTransactions();
  render();
}

function filteredTransactions() {
  const selectedMonth = monthFilter.value;
  return transactions.filter((transaction) =>
    selectedMonth ? transaction.transaction_date.startsWith(selectedMonth) : true
  );
}

function renderSummary(items) {
  const totals = items.reduce(
    (acc, transaction) => {
      if (transaction.type === "income") {
        acc.income += transaction.amount;
      } else {
        acc.expense += transaction.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  incomeTotal.textContent = currencyFormatter.format(totals.income);
  expenseTotal.textContent = currencyFormatter.format(totals.expense);
  balanceTotal.textContent = currencyFormatter.format(totals.income - totals.expense);
}

function renderTransactions(items) {
  transactionCount.textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;

  if (!items.length) {
    transactionsEl.innerHTML = '<div class="empty">Nenhum lancamento encontrado.</div>';
    return;
  }

  transactionsEl.innerHTML = items
    .map((transaction) => {
      const date = new Date(`${transaction.transaction_date}T00:00:00`).toLocaleDateString("pt-BR");
      const sign = transaction.type === "income" ? "+" : "-";
      const amountClass = transaction.type === "income" ? "income" : "expense";

      return `
        <article class="transaction">
          <div>
            <h3>${escapeHtml(transaction.description)}</h3>
            <p>${escapeHtml(transaction.category)} - ${date}</p>
          </div>
          <span class="amount ${amountClass}">${sign} ${currencyFormatter.format(transaction.amount)}</span>
          <button class="delete-button" type="button" data-id="${transaction.id}" aria-label="Apagar lancamento">X</button>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  const items = filteredTransactions();
  renderSummary(items);
  renderTransactions(items);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const transaction = {
    id: crypto.randomUUID(),
    description: formData.get("description").trim(),
    amount: Number(formData.get("amount")),
    type: formData.get("type"),
    category: formData.get("category").trim(),
    transaction_date: formData.get("transactionDate"),
    created_at: new Date().toISOString(),
  };

  try {
    await createTransaction(transaction);
    await fetchTransactions();
    render();
    form.reset();
    transactionDate.value = todayIso();
    showMessage("Lancamento salvo.");
  } catch (error) {
    console.error(error);
    showMessage("Nao foi possivel salvar. Confira a configuracao.");
  }
});

transactionsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  await deleteTransaction(button.dataset.id);
});

monthFilter.addEventListener("change", render);

async function start() {
  storageStatus.textContent = hasSupabaseConfig ? "Supabase conectado" : "Modo local";
  transactionDate.value = todayIso();
  monthFilter.value = currentMonth();
  await fetchTransactions();
  render();
}

start();
