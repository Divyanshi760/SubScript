import {
  addExpense,
  addSubscription,
  bootstrapStore,
  computeBudgetSummary,
  getExpenses,
  getSubscriptions,
  getTrials,
  getUser,
  isLoggedIn,
  logout,
  removeExpense,
  removeSubscription,
  resolveTrial,
  setAuth,
  setUser,
} from './data.js'

bootstrapStore()

const page = document.body.dataset.page || ''
const appPages = ['dashboard', 'subscriptions', 'trials', 'expenses', 'settings']

if (appPages.includes(page) && !isLoggedIn()) {
  window.location.href = './login.html'
}

function byId(id) {
  return document.getElementById(id)
}

function formatCurrency(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN')}`
}

function daysUntil(dateStr) {
  const now = new Date()
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return 999
  return Math.ceil((then - now) / (1000 * 60 * 60 * 24))
}

function mountShell() {
  const nav = [
    ['dashboard', './dashboard.html', 'Dashboard'],
    ['subscriptions', './subscriptions.html', 'Subscriptions'],
    ['trials', './trials.html', 'Trials'],
    ['expenses', './expenses.html', 'Expenses'],
    ['settings', './settings.html', 'Settings'],
  ]

  const sidebar = byId('sidebar-nav')
  if (!sidebar) return

  sidebar.innerHTML = nav
    .map(([key, href, label]) => `<a class="${key === page ? 'active' : ''}" href="${href}">${label}</a>`)
    .join('')

  const user = getUser()
  const userName = byId('user-name')
  const userEmail = byId('user-email')
  if (userName) userName.textContent = user.name
  if (userEmail) userEmail.textContent = user.email

  const topTitle = byId('top-title')
  if (topTitle) {
    const titleMap = {
      dashboard: `Hello, ${user.name}`,
      subscriptions: 'My Subscriptions',
      trials: 'Trial Center',
      expenses: 'Expenses',
      settings: 'Settings',
    }
    topTitle.textContent = titleMap[page] || 'SubScript'
  }

  const logoutBtn = byId('logout-btn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout()
      window.location.href = './login.html'
    })
  }
}

function renderDashboard() {
  const summary = computeBudgetSummary()
  const subscriptions = getSubscriptions()
  const trials = getTrials().filter((trial) => trial.status === 'pending')
  const expenses = getExpenses()

  byId('allowance-value').textContent = formatCurrency(summary.allowance)
  byId('subscription-value').textContent = formatCurrency(summary.subscriptionTotal)
  byId('daily-value').textContent = formatCurrency(summary.safeDaily)

  byId('dashboard-trials').innerHTML = trials.length
    ? trials
        .map((trial) => {
          const days = daysUntil(trial.trial_end_date)
          return `<div class="card"><strong>${trial.service_name}</strong><p class="muted">Ends in ${days} days</p><p class="muted">Expected ${formatCurrency(trial.expected_price)}</p></div>`
        })
        .join('')
    : '<p class="muted">No active trials right now.</p>'

  const nextCharges = subscriptions
    .map((item) => ({ ...item, diff: daysUntil(item.renewal_date) }))
    .filter((item) => item.diff >= 0 && item.diff <= 7)
    .sort((a, b) => a.diff - b.diff)

  byId('dashboard-charges').innerHTML = nextCharges.length
    ? nextCharges
        .map((item) => `<div class="card"><strong>${item.service_name}</strong><p class="muted">Renews in ${item.diff} day(s)</p><p>${formatCurrency(item.amount)}</p></div>`)
        .join('')
    : '<p class="muted">No charges in next 7 days.</p>'

  byId('dashboard-expenses').innerHTML = expenses
    .slice(0, 5)
    .map((expense) => `<div class="card"><strong>${expense.description || expense.category}</strong><p class="muted">${expense.category} • ${expense.spent_at}</p><p>${formatCurrency(expense.amount)}</p></div>`)
    .join('')
}

function renderSubscriptions() {
  const listWrap = byId('subscriptions-list')
  const totalWrap = byId('subscriptions-total')

  function paint() {
    const subscriptions = getSubscriptions()
    const total = subscriptions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    totalWrap.textContent = `${formatCurrency(total)} per month across ${subscriptions.length} services`

    listWrap.innerHTML = subscriptions.length
      ? subscriptions
          .map(
            (sub) => `<div class="card"><div class="row" style="justify-content:space-between"><div><strong>${sub.service_name}</strong><p class="muted">${sub.billing_cycle} • Renews ${sub.renewal_date}</p></div><div><strong>${formatCurrency(sub.amount)}</strong></div></div><div class="row"><button class="btn btn-danger" data-remove-sub="${sub.id}">Delete</button></div></div>`,
          )
          .join('')
      : '<p class="muted">No subscriptions found.</p>'

    document.querySelectorAll('[data-remove-sub]').forEach((button) => {
      button.addEventListener('click', () => {
        removeSubscription(button.dataset.removeSub)
        paint()
      })
    })
  }

  const form = byId('subscription-form')
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fd = new FormData(form)
    const service_name = String(fd.get('service_name') || '').trim()
    const amount = Number(fd.get('amount') || 0)
    const billing_cycle = String(fd.get('billing_cycle') || 'monthly')
    const renewal_date = String(fd.get('renewal_date') || '')
    if (!service_name || amount <= 0) return

    addSubscription({
      service_name,
      amount,
      billing_cycle,
      renewal_date: renewal_date || new Date().toISOString().slice(0, 10),
    })

    form.reset()
    paint()
  })

  paint()
}

function renderTrials() {
  const pendingWrap = byId('trials-pending')
  const resolvedWrap = byId('trials-resolved')

  function paint() {
    const trials = getTrials()
    const pending = trials.filter((trial) => trial.status === 'pending')
    const resolved = trials.filter((trial) => trial.status !== 'pending')

    pendingWrap.innerHTML = pending.length
      ? pending
          .map((trial) => {
            const days = daysUntil(trial.trial_end_date)
            return `<div class="card"><strong>${trial.service_name}</strong><p class="muted">Ends in ${days} days • ${trial.trial_end_date}</p><p class="muted">Expected charge ${formatCurrency(trial.expected_price)}</p><div class="row"><button class="btn btn-danger" data-trial-action="cancel" data-trial-id="${trial.id}">Cancel</button><button class="btn btn-primary" data-trial-action="keep" data-trial-id="${trial.id}">Keep</button></div></div>`
          })
          .join('')
      : '<p class="muted">No active trials detected.</p>'

    resolvedWrap.innerHTML = resolved.length
      ? resolved
          .map((trial) => `<div class="card"><strong>${trial.service_name}</strong><p class="muted">${trial.status}</p></div>`)
          .join('')
      : '<p class="muted">No resolved trials yet.</p>'

    document.querySelectorAll('[data-trial-action]').forEach((button) => {
      button.addEventListener('click', () => {
        resolveTrial(button.dataset.trialId, button.dataset.trialAction)
        paint()
      })
    })
  }

  paint()
}

function renderExpenses() {
  const tableBody = byId('expenses-table-body')

  function paint() {
    const expenses = getExpenses().sort((a, b) => String(b.spent_at).localeCompare(String(a.spent_at)))
    tableBody.innerHTML = expenses.length
      ? expenses
          .map(
            (expense) => `<tr><td>${expense.spent_at}</td><td>${expense.category}</td><td>${expense.description || '-'}</td><td>${formatCurrency(expense.amount)}</td><td><button class="btn btn-danger" data-remove-expense="${expense.id}">Delete</button></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="muted">No expenses added yet.</td></tr>'

    document.querySelectorAll('[data-remove-expense]').forEach((button) => {
      button.addEventListener('click', () => {
        removeExpense(button.dataset.removeExpense)
        paint()
      })
    })

    const total = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    byId('expenses-total').textContent = formatCurrency(total)
  }

  const form = byId('expense-form')
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fd = new FormData(form)
    const amount = Number(fd.get('amount') || 0)
    const category = String(fd.get('category') || 'Other')
    const description = String(fd.get('description') || '').trim()
    const spent_at = String(fd.get('spent_at') || new Date().toISOString().slice(0, 10))

    if (amount <= 0) return
    addExpense({ amount, category, description, spent_at })
    form.reset()
    paint()
  })

  paint()
}

function renderSettings() {
  const user = getUser()
  byId('profile-name').textContent = user.name
  byId('profile-email').textContent = user.email

  const form = byId('settings-form')
  byId('allowance').value = user.monthly_allowance || ''
  byId('month_start_date').value = user.month_start_date || 1

  const prefs = user.preferences || {}
  byId('pref-renew').checked = Boolean(prefs.renewAlert1d)
  byId('pref-trial').checked = Boolean(prefs.trialAlert1d)
  byId('pref-burn').checked = Boolean(prefs.burnWarning)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fd = new FormData(form)

    setUser({
      monthly_allowance: Number(fd.get('allowance') || 0),
      month_start_date: Number(fd.get('month_start_date') || 1),
      preferences: {
        renewAlert1d: byId('pref-renew').checked,
        trialAlert1d: byId('pref-trial').checked,
        burnWarning: byId('pref-burn').checked,
      },
    })

    byId('settings-message').textContent = 'Settings saved.'
  })
}

function setupLoginPage() {
  const loginButton = byId('demo-login-btn')
  if (!loginButton) return

  loginButton.addEventListener('click', () => {
    bootstrapStore()
    setAuth(true)
    const user = getUser()
    if (!Number(user.monthly_allowance)) {
      window.location.href = './onboarding.html'
      return
    }
    window.location.href = './dashboard.html'
  })
}

function setupOnboardingPage() {
  const form = byId('onboarding-form')
  if (!form) return

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fd = new FormData(form)
    const monthly_allowance = Number(fd.get('monthly_allowance') || 0)
    const month_start_date = Number(fd.get('month_start_date') || 1)

    if (monthly_allowance <= 0) return

    setUser({ monthly_allowance, month_start_date })
    setAuth(true)
    window.location.href = './dashboard.html'
  })
}

mountShell()

if (page === 'login') setupLoginPage()
if (page === 'onboarding') setupOnboardingPage()
if (page === 'dashboard') renderDashboard()
if (page === 'subscriptions') renderSubscriptions()
if (page === 'trials') renderTrials()
if (page === 'expenses') renderExpenses()
if (page === 'settings') renderSettings()
