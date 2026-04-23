const API_BASE = 'http://localhost/SubScript/backend/'
const AUTH_KEY = 'subscript_auth'
const ROLE_KEY = 'subscript_role'

const DEFAULT_USER = {
  id: '',
  role: 'student',
  name: '',
  email: '',
  monthly_allowance: 0,
  month_start_date: 1,
  student_name: '',
  parent_name: '',
  preferences: {
    renewAlert1d: true,
    trialAlert1d: true,
    burnWarning: true,
  },
}

const cache = {
  user: { ...DEFAULT_USER },
  subscriptions: [],
  expenses: [],
  trials: [],
  role: localStorage.getItem(ROLE_KEY) || 'student',
}

function normalizeRole(role) {
  return role === 'parent' ? 'parent' : 'student'
}

function mergeState(payload = {}) {
  // payload is the inner `data` object: { user, subscriptions, expenses, trials }
  if (!payload || !payload.user) return cache

  cache.user = { ...DEFAULT_USER, ...payload.user }
  cache.subscriptions = Array.isArray(payload.subscriptions) ? payload.subscriptions : []
  cache.expenses = Array.isArray(payload.expenses) ? payload.expenses : []
  cache.trials = Array.isArray(payload.trials) ? payload.trials : []
  cache.role = normalizeRole(cache.user.role || cache.role)

  localStorage.setItem(ROLE_KEY, cache.role)
  return cache
}

async function request(path, options = {}) {
  try {
    const init = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    }

    // If no body, remove Content-Type header to avoid preflight in some cases
    if (!init.body) delete init.headers['Content-Type']

    const response = await fetch(new URL(path, API_BASE).href, init)

    const text = await response.text()

    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      console.error('INVALID JSON:', text)
      return { ok: false, data: {}, error: `Invalid server response from ${path}` }
    }

    if (!response.ok) {
      console.error('HTTP ERROR:', response.status, data)
      return { ok: false, data: data || {}, error: data.error || `HTTP ${response.status}` }
    }

    // data is the parsed JSON body, e.g. { ok: true, data: { user, subscriptions, ... } }
    return { ok: true, data }
  } catch (err) {
    console.error('NETWORK ERROR:', err)
    return { ok: false, data: {}, error: String(err) }
  }
}

export function setViewerRole(role) {
  cache.role = normalizeRole(role)
  localStorage.setItem(ROLE_KEY, cache.role)
}

export function getViewerRole() {
  return normalizeRole(localStorage.getItem(ROLE_KEY) || cache.role)
}

export async function loginAccount(payload) {
  const response = await request('login.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(response.error || 'Sign in failed.')
  }

  // response.data = { ok: true, data: { user, subscriptions, ... } }
  // we need the inner .data field
  mergeState(response.data.data)
  setAuth(true)
  return cache
}

export async function registerAccount(payload) {
  const response = await request('register.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(response.error || 'Registration failed.')
  }

  mergeState(response.data.data)
  setAuth(true)
  return cache
}

export async function bootstrapStore() {
  const payload = await request('bootstrap.php')
  if (!payload.ok || !payload.data || !payload.data.data) return cache
  return mergeState(payload.data.data)
}

export function getUser() {
  return cache.user
}

export async function setUser(next) {
  const payload = await request('updateUser.php', {
    method: 'POST',
    body: JSON.stringify(next),
  })

  if (!payload.ok || !payload.data || !payload.data.data) return null

  mergeState(payload.data.data)
  return cache.user
}

export function getSubscriptions() {
  return cache.subscriptions
}

export async function addSubscription(payload) {
  const response = await request('addSubscription.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok || !response.data || !response.data.data) return null

  mergeState(response.data.data)
  return cache.subscriptions
}

export async function removeSubscription(id) {
  const response = await request('deleteSubscription.php', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })

  if (!response.ok || !response.data || !response.data.data) return null

  mergeState(response.data.data)
  return cache.subscriptions
}

export function getTrials() {
  return cache.trials
}

export async function resolveTrial(id, action) {
  const response = await request('resolveTrial.php', {
    method: 'POST',
    body: JSON.stringify({ id, action }),
  })

  if (!response.ok || !response.data || !response.data.data) return null

  mergeState(response.data.data)
  return cache.trials
}

export function getExpenses() {
  return cache.expenses
}

export async function addExpense(payload) {
  const response = await request('addExpense.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok || !response.data || !response.data.data) return null

  mergeState(response.data.data)
  return cache.expenses
}

export async function removeExpense(id) {
  const response = await request('deleteExpense.php', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })

  if (!response.ok || !response.data || !response.data.data) return null

  mergeState(response.data.data)
  return cache.expenses
}

export function setAuth(isLoggedIn) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(Boolean(isLoggedIn)))
}

export function isLoggedIn() {
  return Boolean(JSON.parse(localStorage.getItem(AUTH_KEY) || 'false'))
}

export async function logout() {
  try {
    await request('logout.php', { method: 'POST', body: JSON.stringify({}) })
  } finally {
    cache.user = { ...DEFAULT_USER }
    cache.subscriptions = []
    cache.expenses = []
    cache.trials = []
    setAuth(false)
  }
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