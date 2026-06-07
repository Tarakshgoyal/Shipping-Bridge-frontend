import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type View = 'auth' | 'orders' | 'tracking' | 'docs' | 'monitoring'

type Credentials = {
  username: string
  password: string
}

type ApiResult = {
  title: string
  body: unknown
  ok: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://shipping-bridge-backend.onrender.com'
const PROVIDER_NAME = 'Shiprocket'

const initialCredentials: Credentials = {
  username: '',
  password: '',
}

function App() {
  const [view, setView] = useState<View>('auth')
  const [credentials, setCredentials] = useState<Credentials>(initialCredentials)
  const [savedCredentials, setSavedCredentials] = useState<Credentials | null>(null)
  const [status, setStatus] = useState('Ready')
  const [result, setResult] = useState<ApiResult>({
    title: 'Session output',
    body: { message: 'Responses from the Spring Boot gateway appear here.' },
    ok: true,
  })
  const [orderId, setOrderId] = useState('1')
  const [trackingOrderId, setTrackingOrderId] = useState('1')

  const authHeader = useMemo(() => {
    if (!savedCredentials?.username || !savedCredentials.password) return ''
    return `Basic ${btoa(`${savedCredentials.username}:${savedCredentials.password}`)}`
  }, [savedCredentials])

  async function request(path: string, options: RequestInit = {}, title = path, includeAuth = true) {
    setStatus(`Calling ${path}`)
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(includeAuth && authHeader ? { Authorization: authHeader } : {}),
          ...options.headers,
        },
      })
      const text = await response.text()
      const body = text ? JSON.parse(text) : { status: response.status }
      setResult({ title, body, ok: response.ok })
      setStatus(response.ok ? 'Request completed' : `Request failed with ${response.status}`)
      return { response, body }
    } catch (error) {
      setResult({ title, body: { error: String(error) }, ok: false })
      setStatus('Request failed')
      return null
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '')
    const password = String(form.get('password') ?? '')
    const payload = {
      username,
      email: String(form.get('email') ?? ''),
      password,
    }
    const outcome = await request(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload), headers: {} },
      'Register user',
      false,
    )
    if (outcome?.response.ok) {
      setCredentials({ username, password })
      setSavedCredentials({ username, password })
    }
  }

  function saveLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavedCredentials(credentials)
    setResult({
      title: 'Credentials stored',
      body: { username: credentials.username, status: 'Use verified credentials for protected API calls.' },
      ok: true,
    })
    setStatus('Credentials ready')
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const token = encodeURIComponent(String(form.get('token') ?? ''))
    await request(`/api/auth/verify?token=${token}`, { method: 'GET', headers: {} }, 'Verify email', false)
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await request(
      '/api/shipping/calculate',
      {
        method: 'POST',
        body: JSON.stringify({
          pickupPincode: String(form.get('pickupPincode') ?? ''),
          deliveryPincode: String(form.get('deliveryPincode') ?? ''),
          weight: Number(form.get('weight') ?? 0),
        }),
      },
      'Shipping cost calculation',
    )
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const outcome = await request(
      '/api/orders',
      {
        method: 'POST',
        body: JSON.stringify({
          customerName: String(form.get('customerName') ?? ''),
          phone: String(form.get('phone') ?? ''),
          address: String(form.get('address') ?? ''),
          pincode: String(form.get('pincode') ?? ''),
          weight: Number(form.get('weight') ?? 0),
          amount: Number(form.get('amount') ?? 0),
        }),
      },
      'Create order',
    )
    const id = outcome?.body && typeof outcome.body === 'object' && 'orderId' in outcome.body ? String(outcome.body.orderId) : ''
    if (id) {
      setOrderId(id)
      setTrackingOrderId(id)
    }
  }

  async function fetchOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await request(`/api/orders/${orderId}`, { method: 'GET' }, 'Fetch order details')
  }

  async function refreshTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await request(`/api/orders/${trackingOrderId}/tracking`, { method: 'GET' }, 'Refresh tracking')
  }

  async function fetchDocs() {
    await request('/v3/docs', { method: 'GET', headers: {} }, 'OpenAPI JSON', false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">LG</span>
          <div>
            <p className="eyebrow">Logistics Gateway</p>
            <h1>Integration Console</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {[
            ['auth', 'Authentication'],
            ['orders', 'Orders'],
            ['tracking', 'Tracking'],
            ['docs', 'API Docs'],
            ['monitoring', 'Monitoring'],
          ].map(([key, label]) => (
            <button
              className={view === key ? 'nav-item active' : 'nav-item'}
              key={key}
              onClick={() => setView(key as View)}
              type="button"
            >
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="session-card">
          <p className="eyebrow">Backend</p>
          <code>{API_BASE}</code>
          <span className="pill provider">SHIPROCKET</span>
          <span className={savedCredentials ? 'pill success' : 'pill'}>{savedCredentials ? 'AUTH READY' : 'NO AUTH'}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Spring Boot Bridge</p>
            <h2>{titleFor(view)}</h2>
          </div>
          <div className="topbar-actions">
            <div className="provider-badge">
              <span className="dot good"></span>
              <span>{PROVIDER_NAME} live mode</span>
            </div>
            <div className="status-strip">
              <span className={result.ok ? 'dot good' : 'dot bad'}></span>
              <span>{status}</span>
            </div>
          </div>
        </header>

        <section className="content-grid">
          <div className="primary-panel">
            {view === 'auth' && (
              <AuthPanel
                credentials={credentials}
                setCredentials={setCredentials}
                onRegister={register}
                onSaveLogin={saveLogin}
                onVerify={verify}
              />
            )}
            {view === 'orders' && (
              <OrdersPanel
                onCalculate={calculate}
                onCreateOrder={createOrder}
                onFetchOrder={fetchOrder}
                orderId={orderId}
                setOrderId={setOrderId}
              />
            )}
            {view === 'tracking' && (
              <TrackingPanel
                trackingOrderId={trackingOrderId}
                setTrackingOrderId={setTrackingOrderId}
                onRefreshTracking={refreshTracking}
              />
            )}
            {view === 'docs' && <DocsPanel onFetchDocs={fetchDocs} />}
            {view === 'monitoring' && <MonitoringPanel authReady={Boolean(savedCredentials)} />}
          </div>

          <aside className="response-panel">
            <div className="panel-heading">
              <p className="eyebrow">{result.ok ? 'Response' : 'Error'}</p>
              <h3>{result.title}</h3>
            </div>
            <pre>{JSON.stringify(result.body, null, 2)}</pre>
          </aside>
        </section>
      </main>
    </div>
  )
}

function AuthPanel({
  credentials,
  setCredentials,
  onRegister,
  onSaveLogin,
  onVerify,
}: {
  credentials: Credentials
  setCredentials: (credentials: Credentials) => void
  onRegister: (event: FormEvent<HTMLFormElement>) => void
  onSaveLogin: (event: FormEvent<HTMLFormElement>) => void
  onVerify: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="panel-stack">
      <section className="tool-panel">
        <div className="panel-heading">
          <p className="eyebrow">POST /api/auth/register</p>
          <h3>Create verified operator account</h3>
        </div>
        <form className="form-grid" onSubmit={onRegister}>
          <label>
            Username
            <input name="username" placeholder="john_doe" required minLength={3} />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="john@example.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" placeholder="password123" required minLength={8} />
          </label>
          <button type="submit">Register and Send Email</button>
        </form>
      </section>

      <section className="split-panels">
        <form className="tool-panel compact" onSubmit={onSaveLogin}>
          <div className="panel-heading">
            <p className="eyebrow">HTTP Basic</p>
            <h3>Store API credentials</h3>
          </div>
          <label>
            Username
            <input value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
            />
          </label>
          <button type="submit">Use Credentials</button>
        </form>

        <form className="tool-panel compact" onSubmit={onVerify}>
          <div className="panel-heading">
            <p className="eyebrow">GET /api/auth/verify</p>
            <h3>Verify token manually</h3>
          </div>
          <label>
            Verification token
            <input name="token" placeholder="Paste token from email link" required />
          </label>
          <button type="submit">Verify Email</button>
        </form>
      </section>
    </div>
  )
}

function OrdersPanel({
  onCalculate,
  onCreateOrder,
  onFetchOrder,
  orderId,
  setOrderId,
}: {
  onCalculate: (event: FormEvent<HTMLFormElement>) => void
  onCreateOrder: (event: FormEvent<HTMLFormElement>) => void
  onFetchOrder: (event: FormEvent<HTMLFormElement>) => void
  orderId: string
  setOrderId: (orderId: string) => void
}) {
  return (
    <div className="panel-stack">
      <ShiprocketStatusPanel />

      <section className="split-panels">
        <form className="tool-panel" onSubmit={onCalculate}>
          <div className="panel-heading">
            <p className="eyebrow">POST /api/shipping/calculate</p>
            <h3>Shiprocket rate calculator</h3>
          </div>
          <label>
            Pickup pincode
            <input name="pickupPincode" defaultValue="110001" required pattern="\d{6}" />
          </label>
          <label>
            Delivery pincode
            <input name="deliveryPincode" defaultValue="560001" required pattern="\d{6}" />
          </label>
          <label>
            Weight
            <input name="weight" type="number" step="0.01" defaultValue="1.5" required />
          </label>
          <button type="submit">Calculate Rate</button>
        </form>

        <form className="tool-panel" onSubmit={onFetchOrder}>
          <div className="panel-heading">
            <p className="eyebrow">GET /api/orders/:id</p>
            <h3>Order lookup</h3>
          </div>
          <label>
            Order ID
            <input value={orderId} onChange={(event) => setOrderId(event.target.value)} />
          </label>
          <button type="submit">Fetch Order</button>
        </form>
      </section>

      <form className="tool-panel" onSubmit={onCreateOrder}>
        <div className="panel-heading">
          <p className="eyebrow">POST /api/orders</p>
          <h3>Create Shiprocket shipment</h3>
        </div>
        <div className="form-grid two">
          <label>
            Customer name
            <input name="customerName" defaultValue="John Doe" required />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue="9876543210" required pattern="\d{10}" />
          </label>
          <label>
            Address
            <input name="address" defaultValue="Sample Address" required />
          </label>
          <label>
            Pincode
            <input name="pincode" defaultValue="560001" required pattern="\d{6}" />
          </label>
          <label>
            Weight
            <input name="weight" type="number" step="0.01" defaultValue="1.5" required />
          </label>
          <label>
            Amount
            <input name="amount" type="number" step="0.01" defaultValue="1200" required />
          </label>
        </div>
        <button type="submit">Create Order and Assign AWB</button>
      </form>
    </div>
  )
}

function ShiprocketStatusPanel() {
  return (
    <section className="shiprocket-panel">
      <div>
        <p className="eyebrow">Provider</p>
        <h3>Shiprocket external API</h3>
      </div>
      <div className="provider-flow" aria-label="Shiprocket request flow">
        {['API user login', 'Serviceability', 'Adhoc order', 'AWB assignment', 'AWB tracking'].map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
    </section>
  )
}

function TrackingPanel({
  trackingOrderId,
  setTrackingOrderId,
  onRefreshTracking,
}: {
  trackingOrderId: string
  setTrackingOrderId: (id: string) => void
  onRefreshTracking: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="panel-stack">
      <form className="tool-panel" onSubmit={onRefreshTracking}>
        <div className="panel-heading">
          <p className="eyebrow">GET /api/orders/:id/tracking</p>
          <h3>Shiprocket AWB tracking sync</h3>
        </div>
        <label>
          Order ID
          <input value={trackingOrderId} onChange={(event) => setTrackingOrderId(event.target.value)} />
        </label>
        <button type="submit">Refresh Tracking</button>
      </form>
      <div className="timeline">
        {['CREATED', 'AWB_ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].map((step, index) => (
          <div className={index < 3 ? 'timeline-step active' : 'timeline-step'} key={step}>
            <span></span>
            <div>
              <p className="eyebrow">Milestone {index + 1}</p>
              <strong>{step}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DocsPanel({ onFetchDocs }: { onFetchDocs: () => void }) {
  return (
    <div className="panel-stack">
      <section className="tool-panel">
        <div className="panel-heading">
          <p className="eyebrow">GET /v3/docs</p>
          <h3>API documentation portal</h3>
        </div>
        <p className="muted">Fetch the backend OpenAPI JSON and inspect the Shiprocket-backed shipping schema from the response panel.</p>
        <button type="button" onClick={onFetchDocs}>
          Load OpenAPI JSON
        </button>
      </section>
      <section className="tool-panel">
        <div className="panel-heading">
          <p className="eyebrow">Shiprocket runtime</p>
          <h3>Backend environment needed on Render</h3>
        </div>
        <div className="env-grid">
          {[
            'LOGISTICS_PROVIDER=shiprocket',
            'SHIPROCKET_EMAIL=<api-user-email>',
            'SHIPROCKET_PASSWORD=<api-user-password>',
            'SHIPROCKET_PICKUP_LOCATION=Primary',
            'SHIPROCKET_PICKUP_POSTCODE=110001',
          ].map((item) => (
            <code key={item}>{item}</code>
          ))}
        </div>
      </section>
      <section className="endpoint-table">
        {[
          ['POST', '/api/auth/register', 'Create an account and send verification email'],
          ['GET', '/api/auth/verify', 'Verify email token'],
          ['POST', '/api/shipping/calculate', 'Calculate Shiprocket serviceability and rate'],
          ['POST', '/api/orders', 'Create Shiprocket order and assign AWB'],
          ['GET', '/api/orders/{id}', 'Fetch local order'],
          ['GET', '/api/orders/{id}/tracking', 'Sync Shiprocket AWB tracking status'],
        ].map(([method, path, description]) => (
          <div className="endpoint-row" key={path}>
            <span className={`method ${method.toLowerCase()}`}>{method}</span>
            <code>{path}</code>
            <p>{description}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

function MonitoringPanel({ authReady }: { authReady: boolean }) {
  return (
    <div className="metrics-grid">
      {[
        ['API Base', API_BASE, 'good'],
        ['Auth State', authReady ? 'Credentials stored' : 'Waiting for credentials', authReady ? 'good' : 'warn'],
        ['Provider', 'Shiprocket external API', 'good'],
        ['Shipment ID', 'AWB returned as trackingId', 'good'],
        ['Cache', 'In-memory Spring cache active', 'good'],
      ].map(([label, value, tone]) => (
        <div className="metric-card" key={label}>
          <p className="eyebrow">{label}</p>
          <strong>{value}</strong>
          <span className={`dot ${tone}`}></span>
        </div>
      ))}
    </div>
  )
}

function titleFor(view: View) {
  const titles: Record<View, string> = {
    auth: 'Authentication Portal',
    orders: 'Order Management Dashboard',
    tracking: 'Real-time Tracking Interface',
    docs: 'API Documentation Portal',
    monitoring: 'System Monitoring & Health',
  }
  return titles[view]
}

export default App
