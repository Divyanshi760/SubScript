const DEFAULT_USER = {
  id: 'u_1',
  name: 'Divyanshi',
  email: 'divyanshi@student.edu',
  monthly_allowance: 6000,
  month_start_date: 1,
  preferences: {
    renewAlert1d: true,
    trialAlert1d: true,
    burnWarning: true,
  },
}

const DEFAULT_SUBSCRIPTIONS = [
  { id: 's1', service_name: 'Spotify Family', amount: 299, billing_cycle: 'monthly', renewal_date: '2026-03-21' },
  { id: 's2', service_name: 'Netflix Basic', amount: 199, billing_cycle: 'monthly', renewal_date: '2026-03-23' },
  { id: 's3', service_name: 'Notion Plus', amount: 800, billing_cycle: 'monthly', renewal_date: '2026-03-30' },
  { id: 's4', service_name: 'Canva Pro', amount: 499, billing_cycle: 'monthly', renewal_date: '2026-03-24' },
]

const DEFAULT_TRIALS = [
  { id: 't1', service_name: 'Canva Pro Free Trial', trial_end_date: '2026-03-21', expected_price: 499, status: 'pending' },
  { id: 't2', service_name: 'Adobe CC Student', trial_end_date: '2026-03-25', expected_price: 1675, status: 'pending' },
  { id: 't3', service_name: 'Notion AI', trial_end_date: '2026-03-18', expected_price: 399, status: 'cancelled' },
]

const DEFAULT_EXPENSES = [
  { id: 'e1', amount: 340, category: 'Food', description: 'Zomato order', spent_at: '2026-03-18' },
  { id: 'e2', amount: 120, category: 'Transport', description: 'Metro card recharge', spent_at: '2026-03-17' },
  { id: 'e3', amount: 215, category: 'Food', description: 'Swiggy dinner', spent_at: '2026-03-16' },
  { id: 'e4', amount: 480, category: 'Fun', description: 'Movie night', spent_at: '2026-03-14' },
  { id: 'e5', amount: 150, category: 'Other', description: 'Printouts', spent_at: '2026-03-13' },
  { id: 'e6', amount: 90, category: 'Transport', description: 'Cab split', spent_at: '2026-03-12' },
]

const KEYS = {
  subscriptions: 'subscript_mock_subscriptions',
  expenses: 'subscript_mock_expenses',
  trials: 'subscript_mock_trials',
  user: 'subscript_mock_user',
  auth: 'subscript_mock_auth',
}

function safeParse(raw, fallback) {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function readArray(key, fallback) {
  const parsed = safeParse(localStorage.getItem(key), fallback)
  return Array.isArray(parsed) ? parsed : fallback
}

function writeArray(key, value) {
  const safeValue = Array.isArray(value) ? value : []
  localStorage.setItem(key, JSON.stringify(safeValue))
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function bootstrapStore() {
  if (!localStorage.getItem(KEYS.user)) localStorage.setItem(KEYS.user, JSON.stringify(DEFAULT_USER))
  if (!localStorage.getItem(KEYS.subscriptions)) writeArray(KEYS.subscriptions, DEFAULT_SUBSCRIPTIONS)
  if (!localStorage.getItem(KEYS.expenses)) writeArray(KEYS.expenses, DEFAULT_EXPENSES)
  if (!localStorage.getItem(KEYS.trials)) writeArray(KEYS.trials, DEFAULT_TRIALS)
}

export function getUser() {
  const parsed = safeParse(localStorage.getItem(KEYS.user), DEFAULT_USER)
  return parsed && typeof parsed === 'object' ? parsed : DEFAULT_USER
}

export function setUser(next) {
  const merged = { ...getUser(), ...(next || {}) }
  localStorage.setItem(KEYS.user, JSON.stringify(merged))
  return merged
}

export function getSubscriptions() {
  return readArray(KEYS.subscriptions, DEFAULT_SUBSCRIPTIONS)
}

export function setSubscriptions(next) {
  writeArray(KEYS.subscriptions, next)
  return getSubscriptions()
}

export function addSubscription(payload) {
  const next = [...getSubscriptions(), { id: uid('sub'), ...payload }]
  return setSubscriptions(next)
}

export function removeSubscription(id) {
  const next = getSubscriptions().filter((item) => item.id !== id)
  return setSubscriptions(next)
}

export function getTrials() {
  return readArray(KEYS.trials, DEFAULT_TRIALS)
}

export function setTrials(next) {
  writeArray(KEYS.trials, next)
  return getTrials()
}

export function resolveTrial(id, action) {
  const trials = getTrials().map((trial) => {
    if (trial.id !== id) return trial
    return { ...trial, status: action === 'keep' ? 'kept' : 'cancelled' }
  })
  return setTrials(trials)
}

export function getExpenses() {
  return readArray(KEYS.expenses, DEFAULT_EXPENSES)
}

export function setExpenses(next) {
  writeArray(KEYS.expenses, next)
  return getExpenses()
}

export function addExpense(payload) {
  const next = [...getExpenses(), { id: uid('exp'), ...payload }]
  return setExpenses(next)
}

export function removeExpense(id) {
  const next = getExpenses().filter((item) => item.id !== id)
  return setExpenses(next)
}

export function setAuth(isLoggedIn) {
  localStorage.setItem(KEYS.auth, JSON.stringify(Boolean(isLoggedIn)))
}

export function isLoggedIn() {
  return Boolean(safeParse(localStorage.getItem(KEYS.auth), false))
}

export function logout() {
  setAuth(false)
}

export function computeBudgetSummary() {
  const user = getUser()
  const subscriptions = getSubscriptions()
  const expenses = getExpenses()

  const allowance = Number(user.monthly_allowance) || 0
  const subscriptionTotal = subscriptions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthExpenses = expenses
    .filter((expense) => String(expense.spent_at || '').startsWith(monthPrefix))
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)

  const remaining = Math.max(allowance - subscriptionTotal - monthExpenses, 0)
  const today = now.getDate()
  const daysLeft = Math.max(30 - today + 1, 1)
  const safeDaily = Math.floor(remaining / daysLeft)

  return {
    allowance,
    subscriptionTotal,
    monthExpenses,
    remaining,
    safeDaily,
  }
}
