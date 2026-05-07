# Controle Pessoal de Financas

Sistema simples para controle pessoal de receitas e despesas, feito para rodar no navegador e salvar dados em um banco Supabase na nuvem.

## Funcionalidades

- Cadastro de receitas e despesas
- Categorias personalizadas por lancamento
- Resumo de receitas, despesas e saldo
- Filtro por mes
- Lista de lancamentos recentes
- Persistencia em Supabase
- Modo local automatico quando o Supabase ainda nao foi configurado

## Como usar

Abra o arquivo `index.html` no navegador.

Para usar banco de dados na nuvem, crie um projeto no Supabase e execute este SQL no editor SQL:

```sql
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  transaction_date date not null,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Allow anon read transactions"
on public.transactions
for select
to anon
using (true);

create policy "Allow anon insert transactions"
on public.transactions
for insert
to anon
with check (true);

create policy "Allow anon update transactions"
on public.transactions
for update
to anon
using (true)
with check (true);

create policy "Allow anon delete transactions"
on public.transactions
for delete
to anon
using (true);
```

Depois edite `app.js` e preencha:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA_ANON";
```

> Para uso pessoal simples, essa configuracao funciona. Para dados financeiros reais e privados, o ideal e adicionar login e regras RLS por usuario.

