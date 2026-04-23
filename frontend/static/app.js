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
  loginAccount,
  logout,
  removeExpense,
  removeSubscription,
  registerAccount,
  resolveTrial,
  setUser,
  setAuth
} from './data.js'

const page = document.body.dataset.page || ''
const appPages = ['dashboard', 'parent-dashboard', 'subscriptions', 'trials', 'expenses', 'settings']

if (appPages.includes(page) && !isLoggedIn()) {
  window.location.href = './login.html'
}

function byId(id) {
  return document.getElementById(id)
}

function formatCurrency(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN')}`
}

function getRole() {
  return getUser().role === 'parent' ? 'parent' : 'student'
}

function isParentRole() {
  return getRole() === 'parent'
}

function getDashboardPath(role = getRole()) {
  return role === 'parent' ? './parent-dashboard.html' : './dashboard.html'
}

function syncDashboardAccess() {
  const role = getRole()
  if (page === 'dashboard' && role === 'parent') {
    window.location.href = './parent-dashboard.html'
    return false
  }

  if (page === 'parent-dashboard' && role !== 'parent') {
    window.location.href = './dashboard.html'
    return false
  }

  return true
}

function daysUntil(dateStr) {
  if (!dateStr) return 999
  const now = new Date()
  // Normalise both dates to midnight local time for an accurate day diff
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const parts = String(dateStr).split('-').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return 999
  const thenMidnight = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(thenMidnight.getTime())) return 999
  return Math.ceil((thenMidnight - todayMidnight) / (1000 * 60 * 60 * 24))
}

function showFatalError(message) {
  const wrap = document.body
  if (!wrap) return
  wrap.innerHTML = `<div class="page"><section class="hero"><h1>Connection issue</h1><p class="muted">${message}</p></section></div>`
}

function mountShell() {
  if ((page === 'dashboard' || page === 'parent-dashboard') && !syncDashboardAccess()) return

  const nav = [
    [getRole() === 'parent' ? 'parent-dashboard' : 'dashboard', getDashboardPath(), 'Dashboard'],
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
  if (userName) {
    const roleLabel = user.role === 'parent' ? 'Parent' : 'Student'
    userName.insertAdjacentHTML('beforeend', ` <span class="role-tag">${roleLabel} account</span>`)
  }

  const topTitle = byId('top-title')
  if (topTitle) {
    const titleMap = {
      dashboard: `Hello, ${user.name}`,
      'parent-dashboard': `${user.name}'s family overview`,
      subscriptions: isParentRole() ? `${user.student_name || 'Student'}'s Subscriptions` : 'My Subscriptions',
      trials: isParentRole() ? `${user.student_name || 'Student'}'s Trial Center` : 'Trial Center',
      expenses: isParentRole() ? `${user.student_name || 'Student'}'s Expenses` : 'Expenses',
      settings: 'Settings',
    }
    topTitle.textContent = titleMap[page] || 'SubScript'
  }

  const logoutBtn = byId('logout-btn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout().finally(() => {
        window.location.href = './login.html'
      })
    })
  }
}

function renderDashboard() {
  if (!syncDashboardAccess()) return

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

  byId('dashboard-expenses').innerHTML = expenses.length
    ? expenses
        .slice(0, 5)
        .map((expense) => `<div class="card"><strong>${expense.description || expense.category}</strong><p class="muted">${expense.category} • ${expense.spent_at}</p><p>${formatCurrency(expense.amount)}</p></div>`)
        .join('')
    : '<p class="muted">No expenses added yet.</p>'
}

function renderParentDashboard() {
  if (!syncDashboardAccess()) return

  const user = getUser()
  const summary = computeBudgetSummary()
  const subscriptions = getSubscriptions()
  const trials = getTrials().filter((trial) => trial.status === 'pending')
  const expenses = getExpenses().sort((a, b) => String(b.spent_at).localeCompare(String(a.spent_at)))
  const highestExpense = expenses[0]
  const nextCharges = subscriptions
    .map((item) => ({ ...item, diff: daysUntil(item.renewal_date) }))
    .filter((item) => item.diff >= 0 && item.diff <= 14)
    .sort((a, b) => a.diff - b.diff)

  byId('allowance-value').textContent = formatCurrency(summary.allowance)
  byId('subscription-value').textContent = formatCurrency(summary.subscriptionTotal)
  byId('remaining-value').textContent = formatCurrency(summary.remaining)

  byId('parent-summary').innerHTML = [
    `<div class="card"><strong>Student</strong><p class="muted">${user.student_name || 'Student profile connected'}</p></div>`,
    `<div class="card"><strong>Spent this month</strong><p>${formatCurrency(summary.monthExpenses)}</p></div>`,
    `<div class="card"><strong>Safe daily target</strong><p>${formatCurrency(summary.safeDaily)}</p></div>`,
    `<div class="card"><strong>Latest purchase</strong><p class="muted">${highestExpense ? `${highestExpense.description || highestExpense.category} • ${formatCurrency(highestExpense.amount)}` : 'No recent expenses'}</p></div>`,
  ].join('')

  byId('dashboard-charges').innerHTML = nextCharges.length
    ? nextCharges
        .map((item) => `<div class="card"><strong>${item.service_name}</strong><p class="muted">Charge in ${item.diff} day(s)</p><p>${formatCurrency(item.amount)}</p></div>`)
        .join('')
    : '<p class="muted">No charges scheduled in the next 14 days.</p>'

  byId('dashboard-trials').innerHTML = trials.length
    ? trials
        .map((trial) => `<div class="card"><strong>${trial.service_name}</strong><p class="muted">Ends ${trial.trial_end_date}</p><p>Expected ${formatCurrency(trial.expected_price)}</p></div>`)
        .join('')
    : '<p class="muted">No pending trials need attention.</p>'

  byId('dashboard-expenses').innerHTML = expenses.length
    ? expenses
        .slice(0, 4)
        .map((expense) => `<div class="card"><strong>${expense.description || expense.category}</strong><p class="muted">${expense.spent_at}</p><p>${formatCurrency(expense.amount)}</p></div>`)
        .join('')
    : '<p class="muted">No student expenses recorded yet.</p>'
}

function renderSubscriptions() {
  const parentView = isParentRole()
  const listWrap = byId('subscriptions-list')
  const totalWrap = byId('subscriptions-total')
  const overviewTitle = byId('subscriptions-overview-title')
  const readOnlyNote = byId('subscriptions-readonly-note')

  if (overviewTitle) {
    overviewTitle.textContent = parentView ? 'Student Subscription Overview' : 'Overview'
  }

  if (readOnlyNote) {
    readOnlyNote.style.display = parentView ? 'block' : 'none'
  }

  if (parentView) {
    const form = byId('subscription-form')
    if (form) form.style.display = 'none'
  }

  function paint() {
    const subscriptions = getSubscriptions()
    const total = subscriptions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    totalWrap.textContent = parentView
      ? `${formatCurrency(total)} per month across ${subscriptions.length} student services`
      : `${formatCurrency(total)} per month across ${subscriptions.length} services`

    listWrap.innerHTML = subscriptions.length
      ? subscriptions
          .map(
            (sub) => `<div class="card"><div class="row" style="justify-content:space-between"><div><strong>${sub.service_name}</strong><p class="muted">${sub.billing_cycle} • Renews ${sub.renewal_date}</p></div><div><strong>${formatCurrency(sub.amount)}</strong></div></div>${parentView ? '<p class="muted" style="margin-bottom: 0;">Monitoring only</p>' : `<div class="row"><button class="btn btn-danger" data-remove-sub="${sub.id}">Delete</button></div>`}</div>`,
          )
          .join('')
      : '<p class="muted">No subscriptions found.</p>'

    if (!parentView) {
      document.querySelectorAll('[data-remove-sub]').forEach((button) => {
        button.addEventListener('click', async () => {
          await removeSubscription(button.dataset.removeSub)
          paint()
        })
      })
    }
  }

  const form = byId('subscription-form')
  if (form && !parentView) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(form)
      const service_name = String(fd.get('service_name') || '').trim()
      const amount = Number(fd.get('amount') || 0)
      const billing_cycle = String(fd.get('billing_cycle') || 'monthly')
      const renewal_date = String(fd.get('renewal_date') || '')
      if (!service_name || amount <= 0) return

      await addSubscription({
        service_name,
        amount,
        billing_cycle,
        renewal_date: renewal_date || new Date().toISOString().slice(0, 10),
      })

      form.reset()
      paint()
    })
  }

  paint()
}

function renderTrials() {
  const parentView = isParentRole()
  const pendingWrap = byId('trials-pending')
  const resolvedWrap = byId('trials-resolved')
  const pendingTitle = byId('trials-pending-title')
  const resolvedTitle = byId('trials-resolved-title')

  if (pendingTitle) pendingTitle.textContent = parentView ? 'Student Pending Trials' : 'Pending Trials'
  if (resolvedTitle) resolvedTitle.textContent = parentView ? 'Student Trial History' : 'Resolved Trials'

  function paint() {
    const trials = getTrials()
    const pending = trials.filter((trial) => trial.status === 'pending')
    const resolved = trials.filter((trial) => trial.status !== 'pending')

    pendingWrap.innerHTML = pending.length
      ? pending
          .map((trial) => {
            const days = daysUntil(trial.trial_end_date)
            return `<div class="card"><strong>${trial.service_name}</strong><p class="muted">Ends in ${days} days • ${trial.trial_end_date}</p><p class="muted">Expected charge ${formatCurrency(trial.expected_price)}</p>${parentView ? '<p class="muted" style="margin-bottom: 0;">Monitoring only</p>' : `<div class="row"><button class="btn btn-danger" data-trial-action="cancel" data-trial-id="${trial.id}">Cancel</button><button class="btn btn-primary" data-trial-action="keep" data-trial-id="${trial.id}">Keep</button></div>`}</div>`
          })
          .join('')
      : '<p class="muted">No active trials detected.</p>'

    resolvedWrap.innerHTML = resolved.length
      ? resolved
          .map((trial) => `<div class="card"><strong>${trial.service_name}</strong><p class="muted">${trial.status}</p></div>`)
          .join('')
      : '<p class="muted">No resolved trials yet.</p>'

    if (!parentView) {
      document.querySelectorAll('[data-trial-action]').forEach((button) => {
        button.addEventListener('click', async () => {
          await resolveTrial(button.dataset.trialId, button.dataset.trialAction)
          paint()
        })
      })
    }
  }

  paint()
}

function renderExpenses() {
  const parentView = isParentRole()
  const tableBody = byId('expenses-table-body')
  const form = byId('expense-form')
  const readOnlyNote = byId('expenses-readonly-note')
  const formTitle = byId('expenses-form-title')

  if (formTitle) {
    formTitle.textContent = parentView ? 'Student Expense Monitor' : 'Add Expense'
  }

  if (form) {
    form.style.display = parentView ? 'none' : 'flex'
  }

  if (readOnlyNote) {
    readOnlyNote.style.display = parentView ? 'block' : 'none'
  }

  function paint() {
    const expenses = getExpenses().sort((a, b) => String(b.spent_at).localeCompare(String(a.spent_at)))
    tableBody.innerHTML = expenses.length
      ? expenses
          .map(
            (expense) => `<tr><td>${expense.spent_at}</td><td>${expense.category}</td><td>${expense.description || '-'}</td><td>${formatCurrency(expense.amount)}</td><td>${parentView ? '<span class="muted">View only</span>' : `<button class="btn btn-danger" data-remove-expense="${expense.id}">Delete</button>`}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="muted">No expenses added yet.</td></tr>'

    if (!parentView) {
      document.querySelectorAll('[data-remove-expense]').forEach((button) => {
        button.addEventListener('click', async () => {
          await removeExpense(button.dataset.removeExpense)
          paint()
        })
      })
    }

    const total = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    byId('expenses-total').textContent = formatCurrency(total)
  }

  if (form && !parentView) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const fd = new FormData(form)
      const amount = Number(fd.get('amount') || 0)
      const category = String(fd.get('category') || 'Other')
      const description = String(fd.get('description') || '').trim()
      const spent_at = String(fd.get('spent_at') || new Date().toISOString().slice(0, 10))

      if (amount <= 0) return
      await addExpense({ amount, category, description, spent_at })
      form.reset()
      paint()
    })
  }

  paint()
}

function renderSettings() {
  const parentView = isParentRole()
  const user = getUser()
  byId('profile-name').textContent = user.name
  byId('profile-email').textContent = user.email
  const profileTitle = byId('settings-profile-title')
  const formTitle = byId('settings-form-title')
  const form = byId('settings-form')
  const readOnlyNote = byId('settings-readonly-note')

  if (profileTitle) {
    profileTitle.textContent = parentView ? 'Parent Profile' : 'Profile'
  }

  if (formTitle) {
    formTitle.textContent = parentView ? 'Student Budget Overview' : 'Budget and Notifications'
  }

  byId('allowance').value = user.monthly_allowance || ''
  byId('month_start_date').value = user.month_start_date || 1

  const prefs = user.preferences || {}
  byId('pref-renew').checked = Boolean(prefs.renewAlert1d)
  byId('pref-trial').checked = Boolean(prefs.trialAlert1d)
  byId('pref-burn').checked = Boolean(prefs.burnWarning)

  if (form) {
    if (parentView) {
      Array.from(form.elements).forEach((element) => {
        if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) {
          element.disabled = true
        }
      })
      if (readOnlyNote) readOnlyNote.style.display = 'block'
      byId('settings-message').textContent = 'Read-only parent view.'
    } else {
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const fd = new FormData(form)

        await setUser({
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
  }
}

function setupLoginPage() {
  const loginForm = byId('login-form')
  const registerForm = byId('register-form')
  const loginMessage = byId('login-message')
  const registerMessage = byId('register-message')
  const authPanels = document.querySelectorAll('[data-auth-panel]')
  const authSwitches = document.querySelectorAll('[data-auth-switch]')
  let selectedRole = 'student'
  let selectedPanel = 'login'

  function setAuthPanel(panel) {
    selectedPanel = panel === 'register' ? 'register' : 'login'
    authPanels.forEach((item) => {
      item.style.display = item.dataset.authPanel === selectedPanel ? 'grid' : 'none'
    })
    authSwitches.forEach((item) => {
      item.classList.toggle('active', item.dataset.authSwitch === selectedPanel)
    })
  }

  setAuthPanel(selectedPanel)

  document.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedRole = button.dataset.role === 'parent' ? 'parent' : 'student'
      document.querySelectorAll('[data-role]').forEach((item) => item.classList.toggle('active', item === button))
    })
  })

  authSwitches.forEach((button) => {
    button.addEventListener('click', () => {
      setAuthPanel(button.dataset.authSwitch || 'login')
    })
  })

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const submitButton = byId('login-submit-btn')
      const fd = new FormData(loginForm)
      if (submitButton) submitButton.disabled = true
      if (loginMessage) loginMessage.textContent = 'Signing in...'

      try {
        const store = await loginAccount({
          role: selectedRole,
          email: String(fd.get('email') || '').trim(),
          password: String(fd.get('password') || ''),
        })

        if (!store || !store.user) {
          if (loginMessage) loginMessage.textContent = 'Invalid server response from login.'
          return
        }

        if (store.user.role !== 'parent' && !Number(store.user.monthly_allowance)) {
          window.location.href = './onboarding.html'
          return
        }
        window.location.href = getDashboardPath(store.user.role)
      } catch (error) {
        console.error(error)
        if (loginMessage) loginMessage.textContent = error.message || 'Sign in failed.'
      } finally {
        if (submitButton) submitButton.disabled = false
      }
    })
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      const submitButton = byId('register-submit-btn')
      const fd = new FormData(registerForm)
      if (submitButton) submitButton.disabled = true
      if (registerMessage) registerMessage.textContent = 'Creating student and parent accounts...'

      try {
        const store = await registerAccount({
          student_name: String(fd.get('student_name') || '').trim(),
          student_email: String(fd.get('student_email') || '').trim(),
          student_password: String(fd.get('student_password') || ''),
          parent_name: String(fd.get('parent_name') || '').trim(),
          parent_email: String(fd.get('parent_email') || '').trim(),
          parent_password: String(fd.get('parent_password') || ''),
        })

        window.location.href = store.user.role === 'student' && !Number(store.user.monthly_allowance)
          ? './onboarding.html'
          : getDashboardPath(store.user.role)
      } catch (error) {
        console.error(error)
        if (registerMessage) registerMessage.textContent = error.message || 'Registration failed.'
      } finally {
        if (submitButton) submitButton.disabled = false
      }
    })
  }
}

function setupOnboardingPage() {
  const form = byId('onboarding-form')
  if (!form) return

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const fd = new FormData(form)
    const monthly_allowance = Number(fd.get('monthly_allowance') || 0)
    const month_start_date = Number(fd.get('month_start_date') || 1)

    if (monthly_allowance <= 0) return

    await setUser({ monthly_allowance, month_start_date })
    setAuth(true)
    window.location.href = getDashboardPath()
  })
}

async function initApp() {
  try {
    if (window.location.protocol === 'file:') {
      showFatalError('Open the app from http://localhost/SubScript/frontend/login.html instead of opening the HTML file directly.')
      return
    }

    if (page !== 'login') {
      await bootstrapStore()
    }

    mountShell()

    if (page === 'login') setupLoginPage()
    if (page === 'onboarding') setupOnboardingPage()
    if (page === 'dashboard') renderDashboard()
    if (page === 'parent-dashboard') renderParentDashboard()
    if (page === 'subscriptions') renderSubscriptions()
    if (page === 'trials') renderTrials()
    if (page === 'expenses') renderExpenses()
    if (page === 'settings') renderSettings()
  } catch (error) {
    console.error(error)
    if (appPages.includes(page)) {
      window.location.href = './login.html'
      return
    }
    showFatalError(error.message || 'Could not load the app.')
  }
}

initApp()
