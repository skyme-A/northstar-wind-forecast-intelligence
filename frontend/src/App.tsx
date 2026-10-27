
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Cloud,
  Database,
  Download,
  Gauge,
  Menu,
  RefreshCw,
  Sparkles,
  Wind,
  Zap,
  X,
} from 'lucide-react'

type Point = {
  startTime: string
  publishTime: string
  forecast: number
  actual: number
  error: number
  absoluteError: number
}

type Analysis = {
  period?: {
    startDate: string
    endDate: string
  }
  selectionPolicy?: string
  dataCounts: {
    actualRecords: number
    forecastRecords: number
    matchedIntervals: number
  }
  metrics: {
    mae: number | null
    rmse: number | null
    bias: number | null
    count: number
  }
  points: Point[]
  notice?: string
}

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').trim().replace(/\/+$/, '')

function createDemoData(startDate: string, endDate: string): Analysis {
  const points: Point[] = []
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T23:30:00Z`).getTime()
  for (let t = start, i = 0; t <= end && i < 1500; t += 1800000, i++) {
    const actual = Math.max(900, Math.round(10500 + Math.sin(i * Math.PI / 24) * 3000 + Math.sin(i * .11) * 500))
    const forecast = Math.max(0, actual + Math.round(Math.sin(i * .73) * 400))
    points.push({ startTime: new Date(t).toISOString(), publishTime: new Date(t - 3600000).toISOString(), forecast, actual, error: forecast - actual, absoluteError: Math.abs(forecast - actual) })
  }
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const errors = points.map(p => p.error)
  const abs = points.map(p => p.absoluteError)
  return {
    period: { startDate, endDate },
    selectionPolicy: 'Illustrative synthetic data',
    dataCounts: { actualRecords: points.length, forecastRecords: points.length, matchedIntervals: points.length },
    metrics: { mae: avg(abs), bias: avg(errors), rmse: points.length ? Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / points.length) : null, count: points.length },
    points,
    notice: 'Illustrative synthetic values only; these are not observed Elexon data.',
  }
}

const formatNumber = (
  value: number | null | undefined,
  digits = 0,
) => {
  if (value == null || !Number.isFinite(value)) return '—'

  return value.toLocaleString('en-GB', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })

function GlassCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`glass rounded-3xl ${className}`}>
      {children}
    </section>
  )
}

function App() {
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState('2026-01-31')
  const [data, setData] = useState<Analysis | null>(null)
  const [mode, setMode] = useState<'live' | 'demo'>('demo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState('all')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function loadData(nextMode: 'live' | 'demo' = mode) {
    setLoading(true)
    setError('')
    try {
      if (nextMode === 'demo') {
        setData(createDemoData(startDate, endDate))
        setMode('demo')
        setSelectedDay('all')
        return
      }
      const endpoint = `${API}/api/analysis?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`The API returned HTTP ${response.status}. Check that the backend is running.`)
      const result = (await response.json()) as Analysis
      if (!Array.isArray(result.points) || !result.metrics || !result.dataCounts) throw new Error('The API response has an unexpected format.')
      setData(result)
      setMode('live')
      setSelectedDay('all')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analysis data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData('demo')
    // Load illustrative data on the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableDays = useMemo(
    () =>
      [...new Set(
        (data?.points ?? []).map((point) =>
          point.startTime.slice(0, 10),
        ),
      )],
    [data],
  )

  const points = useMemo(() => {
    const allPoints = data?.points ?? []

    if (selectedDay === 'all') return allPoints

    return allPoints.filter(
      (point) => point.startTime.slice(0, 10) === selectedDay,
    )
  }, [data, selectedDay])

  const average = (values: number[]) =>
    values.length
      ? values.reduce((total, value) => total + value, 0) /
      values.length
      : null

  const averageActual = average(points.map((point) => point.actual))
  const averageAbsoluteError = average(
    points.map((point) => point.absoluteError),
  )
  const averageBias = average(points.map((point) => point.error))

  const calculatedRmse = points.length
    ? Math.sqrt(
      points.reduce(
        (total, point) => total + point.error * point.error,
        0,
      ) / points.length,
    )
    : null

  const chartData = points.map((point) => ({
    ...point,
    label: `${formatDate(point.startTime)} ${formatTime(point.startTime)}`,
  }))

  const latestPoint = points[points.length - 1]

  function exportCsv() {
    if (!points.length) {
      setError('There are no intervals to export.')
      return
    }

    const rows = [
      [
        'deliveryTimeUTC',
        'publicationTimeUTC',
        'forecastMW',
        'actualMW',
        'errorMW',
        'absoluteErrorMW',
      ],
      ...points.map((point) => [
        point.startTime,
        point.publishTime,
        point.forecast,
        point.actual,
        point.error,
        point.absoluteError,
      ]),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((value) =>
            `"${String(value).replace(/"/g, '""')}"`,
          )
          .join(','),
      )
      .join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'northstar-wind-analysis.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
  }

  const navigation = [
    { label: 'Forecast intelligence', icon: Activity, section: 'top' },
    { label: 'Accuracy analysis', icon: Gauge, section: 'accuracy' },
    { label: 'Interval analysis', icon: Database, section: 'intervals' },
  ]

  function navigateTo(section: string) {
    document.getElementById(section)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    setMobileMenuOpen(false)
  }

  const maeValue =
    mode === 'demo' ? data?.metrics.mae : averageAbsoluteError

  const biasValue =
    mode === 'demo' ? data?.metrics.bias : averageBias

  const rmseValue =
    mode === 'demo' ? data?.metrics.rmse : calculatedRmse

  const metricCards = [
    {
      title: 'Mean absolute error',
      value: formatNumber(maeValue),
      unit: 'MW',
      description: 'Average absolute forecast error',
      icon: Activity,
      theme: 'bg-blue-100 text-blue-700',
      glow: 'from-blue-200/60',
    },
    {
      title: 'Forecast bias',
      value: formatNumber(biasValue),
      unit: 'MW',
      description: 'Positive means overforecasting',
      icon: biasValue != null && biasValue < 0
        ? ArrowDownRight
        : ArrowUpRight,
      theme: 'bg-orange-100 text-orange-700',
      glow: 'from-orange-200/60',
    },
    {
      title: 'Average wind generation',
      value: formatNumber(averageActual),
      unit: 'MW',
      description: 'Average actual generation',
      icon: Wind,
      theme: 'bg-emerald-100 text-emerald-700',
      glow: 'from-emerald-200/60',
    },
    {
      title: 'Matched intervals',
      value: formatNumber(points.length),
      unit: 'intervals',
      description: 'Matched half-hourly records',
      icon: Database,
      theme: 'bg-violet-100 text-violet-700',
      glow: 'from-violet-200/60',
    },
  ]

  return (
    <div
      id="top"
      className="relative min-h-screen overflow-hidden bg-[#F4F7FF] text-[#20304A]"
    >
      {/* Ambient background colour */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-[#BFD7FF]/60 blur-3xl" />
        <div className="absolute -left-40 top-[35%] h-[430px] w-[430px] rounded-full bg-[#FFD6BD]/50 blur-3xl" />
        <div className="absolute -bottom-40 right-[24%] h-[420px] w-[420px] rounded-full bg-[#B7F0E5]/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1800px] gap-5 p-3 md:p-5">
        {/* Sidebar */}
        <aside
          className={`glass fixed inset-y-3 left-3 z-40 flex w-[260px] flex-col rounded-[28px] p-5 transition-transform duration-300 md:sticky md:top-5 md:h-[calc(100vh-40px)] md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]'
            }`}
        >
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#247BFD] to-[#75B8FF] text-white shadow-lg shadow-blue-200">
                <Wind size={25} />
              </div>

              <div>
                <div className="font-[Manrope] text-xl font-extrabold tracking-tight">
                  northstar
                </div>
                <div className="mt-1 text-[9px] font-bold tracking-[2px] text-slate-400">
                  ENERGY INTELLIGENCE
                </div>
              </div>
            </div>

            <button
              className="rounded-lg p-2 hover:bg-white md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-3 px-3 text-[10px] font-bold tracking-[2px] text-slate-400">
            WORKSPACE
          </div>

          <nav className="space-y-2">
            {navigation.map((item, index) => {
              const Icon = item.icon

              return (
                <button
                  key={item.label}
                  onClick={() => navigateTo(item.section)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 ${index === 0
                    ? 'border-blue-100 bg-gradient-to-r from-blue-50 to-white font-semibold text-blue-700 shadow-md shadow-blue-100/70'
                    : 'border-transparent text-slate-500 hover:border-white hover:bg-white/70 hover:text-slate-800'
                    }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>

                  {index === 1 && (
                    <span className="ml-auto rounded-full bg-[#D9F8EE] px-2 py-1 text-[9px] font-bold text-emerald-700">
                      KPI
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white bg-white/60 p-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-orange-400' : 'bg-emerald-500'
                  }`}
              />
              Data service
            </div>

            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              {loading ? 'Retrieving analysis…' : 'Ready to analyse data'}
            </p>

            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 size={13} />
              {mode === 'demo' ? 'Demo mode' : 'Live request mode'}
            </div>
          </div>
        </aside>

        {mobileMenuOpen && (
          <button
            className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Dismiss navigation"
          />
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <header className="glass mb-6 flex items-center justify-between rounded-2xl px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl p-2 hover:bg-white md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>

              <div className="text-xs text-slate-400">
                Analytics
                <span className="mx-2 text-blue-300">/</span>
                <span className="font-bold text-slate-700">
                  Wind forecast
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-white bg-white/70 px-4 py-2 text-[10px] font-bold tracking-wider text-slate-600 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                JANUARY 2026
              </span>

              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#FFD5BD] to-[#B9D7FF] text-xs font-extrabold text-[#405274]">
                NS
              </div>
            </div>
          </header>

          <section className="mb-6 flex animate-fade-up flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-[2px] text-blue-600">
                <span className="h-1 w-6 rounded-full bg-gradient-to-r from-[#247BFD] to-[#FFB38A]" />
                RENEWABLE GENERATION / UK NATIONAL
              </div>

              <h1 className="font-[Manrope] text-3xl font-extrabold tracking-tight text-[#20304A] sm:text-4xl">
                Wind forecast intelligence
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Understand forecast performance before the market moves.
                Explore generation, forecast error, and matched delivery intervals.
              </p>
            </div>

            <button
              onClick={() => void loadData(mode)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white bg-white/80 px-4 py-3 text-xs font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 xl:self-auto"
            >
              <RefreshCw
                size={15}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh data
            </button>
          </section>

          {/* Filters and actions */}
          <GlassCard className="mb-5 flex flex-wrap items-center gap-3 p-4">
            <div className="mr-1 flex items-center gap-2 pr-3 text-xs font-bold text-slate-600">
              <CalendarDays size={17} className="text-blue-500" />
              Analysis period
            </div>

            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              From
              <input
                className="w-[145px] rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              To
              <input
                className="w-[145px] rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>

            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => void loadData('live')}
                disabled={loading || startDate > endDate}
                className={`rounded-xl px-4 py-3 text-xs font-bold transition hover:-translate-y-0.5 disabled:opacity-50 ${mode === 'live'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'border border-slate-200 bg-white/80 text-slate-600 hover:border-blue-200'
                  }`}
              >
                {loading ? 'Loading…' : 'Run live analysis'}
              </button>

              <button
                onClick={() => void loadData('demo')}
                disabled={loading}
                className={`rounded-xl px-4 py-3 text-xs font-bold transition hover:-translate-y-0.5 disabled:opacity-50 ${mode === 'demo'
                  ? 'bg-gradient-to-r from-[#FFB38A] to-[#FF9C88] text-[#653D30] shadow-lg shadow-orange-100'
                  : 'border border-slate-200 bg-white/80 text-slate-600'
                  }`}
              >
                Demo data
              </button>

              <button
                title="Export CSV"
                onClick={exportCsv}
                disabled={!points.length}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-40"
              >
                <Download size={16} />
              </button>
            </div>
          </GlassCard>

          {error && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-700">
              <span>{error}</span>
              <button
                className="font-bold underline"
                onClick={() => void loadData('demo')}
              >
                Load demo instead
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Data provenance */}
              <div
                className={`mb-5 flex items-center gap-3 rounded-2xl border p-4 backdrop-blur-xl ${mode === 'demo'
                  ? 'border-orange-200 bg-orange-50/90'
                  : 'border-emerald-200 bg-emerald-50/90'
                  }`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${mode === 'demo'
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-emerald-100 text-emerald-700'
                    }`}
                >
                  {mode === 'demo' ? (
                    <CircleHelp size={19} />
                  ) : (
                    <CheckCircle2 size={19} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-extrabold ${mode === 'demo' ? 'text-orange-800' : 'text-emerald-800'
                      }`}
                  >
                    {mode === 'demo'
                      ? 'Illustrative demo data'
                      : 'Elexon API response'}
                  </p>

                  <p
                    className={`mt-1 text-xs leading-5 ${mode === 'demo' ? 'text-orange-700' : 'text-emerald-700'
                      }`}
                  >
                    {data.notice ||
                      (mode === 'demo'
                        ? 'Illustrative values only; these are not observed Elexon data.'
                        : `${data.dataCounts.matchedIntervals} matched intervals returned by the backend.`)}
                  </p>
                </div>

                <span className="hidden rounded-full bg-white/70 px-3 py-1.5 text-[9px] font-extrabold tracking-widest sm:block">
                  {mode === 'demo' ? 'SAMPLE' : 'LIVE REQUEST'}
                </span>
              </div>

              {/* KPI cards */}
              <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {metricCards.map((item, index) => {
                  const Icon = item.icon

                  return (
                    <article
                      key={item.title}
                      style={{ animationDelay: `${index * 100}ms` }}
                      className="glass group relative animate-fade-up overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-glass"
                    >
                      <div
                        className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${item.glow} to-transparent blur-2xl transition group-hover:scale-125`}
                      />

                      <div className="relative flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500">
                          {item.title}
                        </span>

                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${item.theme}`}
                        >
                          <Icon size={19} />
                        </span>
                      </div>

                      <div className="relative mt-5 flex flex-wrap items-baseline gap-2">
                        <span className="font-[Manrope] text-3xl font-extrabold tracking-tight text-[#20304A]">
                          {item.value}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {item.unit}
                        </span>
                      </div>

                      <div className="relative mt-4 border-t border-slate-200/70 pt-3 text-[10px] text-slate-400">
                        {item.description}
                      </div>
                    </article>
                  )
                })}
              </section>

              {/* Charts */}
              <section className="mb-5 grid grid-cols-1 gap-5 2xl:grid-cols-[1.7fr_1fr]">
                <GlassCard className="min-w-0 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-[Manrope] text-sm font-extrabold text-slate-800">
                        Forecast vs actual generation
                      </h2>
                      <p className="mt-1.5 text-xs text-slate-400">
                        Half-hourly national wind generation · MW
                      </p>
                    </div>

                    <div className="relative">
                      <select
                        aria-label="Filter delivery day"
                        value={selectedDay}
                        onChange={(event) =>
                          setSelectedDay(event.target.value)
                        }
                        className="max-w-[175px] appearance-none rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-3 pr-8 text-[11px] font-semibold text-slate-600 outline-none focus:border-blue-300"
                      >
                        <option value="all">All available days</option>
                        {availableDays.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="my-5 flex flex-wrap gap-5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-2">
                      <i className="h-2.5 w-2.5 rounded-full bg-[#247BFD]" />
                      Forecast
                    </span>
                    <span className="flex items-center gap-2">
                      <i className="h-2.5 w-2.5 rounded-full bg-[#39BFA6]" />
                      Actual generation
                    </span>
                  </div>

                  <div className="h-[290px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: -14, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient
                            id="northstarForecast"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#247BFD"
                              stopOpacity={0.28}
                            />
                            <stop
                              offset="100%"
                              stopColor="#247BFD"
                              stopOpacity={0}
                            />
                          </linearGradient>

                          <linearGradient
                            id="northstarActual"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#39BFA6"
                              stopOpacity={0.22}
                            />
                            <stop
                              offset="100%"
                              stopColor="#39BFA6"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 5"
                          stroke="#e4eaf5"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#94A3B8' }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={40}
                        />

                        <YAxis
                          tick={{ fontSize: 10, fill: '#94A3B8' }}
                          tickLine={false}
                          axisLine={false}
                          width={55}
                          tickFormatter={(value: number) =>
                            `${(value / 1000).toFixed(1)}k`
                          }
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 14,
                            border: '1px solid #e3eaf7',
                            fontSize: 12,
                          }}
                          labelStyle={{
                            color: '#64748b',
                            marginBottom: 6,
                          }}
                          formatter={(value, name) => [
                            `${formatNumber(Number(value))} MW`,
                            name === 'forecast' ? 'Forecast' : 'Actual generation',
                          ]}
                        />

                        <Area
                          type="monotone"
                          dataKey="forecast"
                          name="forecast"
                          stroke="#247BFD"
                          strokeWidth={2.5}
                          fill="url(#northstarForecast)"
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                          isAnimationActive
                          animationDuration={1100}
                        />

                        <Area
                          type="monotone"
                          dataKey="actual"
                          name="actual"
                          stroke="#39BFA6"
                          strokeWidth={2.5}
                          fill="url(#northstarActual)"
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                          isAnimationActive
                          animationDuration={1400}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-4 text-[10px] text-slate-400">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                      {points.length} intervals in current view
                    </span>
                    <span>All timestamps in UTC</span>
                  </div>
                </GlassCard>

                <GlassCard className="p-5 sm:p-6">
                  <div
                    id="accuracy"
                    className="flex scroll-mt-6 items-start justify-between gap-3"
                  >
                    <div>
                      <h2 className="font-[Manrope] text-sm font-extrabold text-slate-800">
                        Forecast error
                      </h2>
                      <p className="mt-1.5 text-xs text-slate-400">
                        Forecast minus actual · MW
                      </p>
                    </div>

                    <span className="rounded-full bg-violet-100 px-3 py-1.5 text-[9px] font-extrabold tracking-widest text-violet-600">
                      BIAS
                    </span>
                  </div>

                  <div className="mt-7 font-[Manrope] text-4xl font-extrabold tracking-tight text-slate-800">
                    {averageBias == null
                      ? '—'
                      : `${averageBias > 0 ? '+' : ''}${formatNumber(averageBias)}`}
                    <span className="ml-2 text-xs font-bold text-slate-400">
                      MW
                    </span>
                  </div>

                  <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">
                    {averageBias == null
                      ? 'No matched intervals are available for this selection.'
                      : averageBias > 0
                        ? 'Forecasts tend to overestimate generation in the selected intervals.'
                        : averageBias < 0
                          ? 'Forecasts tend to underestimate generation in the selected intervals.'
                          : 'Forecasts have zero average bias in the selected intervals.'}
                  </p>

                  <div className="mt-5 h-[125px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 5"
                          stroke="#e4eaf5"
                          vertical={false}
                        />
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={['auto', 'auto']} />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e3eaf7',
                            fontSize: 11,
                          }}
                          formatter={(value) => [
                            `${formatNumber(Number(value))} MW`,
                            'Forecast error',
                          ]}
                        />

                        <Line
                          type="monotone"
                          dataKey="error"
                          stroke="#9A7BE7"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5 }}
                          isAnimationActive
                          animationDuration={1300}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                    <span>
                      Underforecast <b className="text-violet-500">−</b>
                    </span>
                    <span>
                      Overforecast <b className="text-orange-500">+</b>
                    </span>
                  </div>

                  <div className="mt-5 border-t border-slate-200/70">
                    <div className="flex justify-between gap-3 border-b border-slate-200/70 py-4 text-[11px]">
                      <span className="text-slate-500">
                        Root mean squared error
                      </span>
                      <b className="text-slate-800">
                        {formatNumber(rmseValue)} MW
                      </b>
                    </div>

                    <div className="flex justify-between gap-3 py-4 text-[11px]">
                      <span className="text-slate-500">
                        Latest publication
                      </span>
                      <b className="text-right text-slate-800">
                        {latestPoint
                          ? `${formatDate(latestPoint.publishTime)} ${formatTime(latestPoint.publishTime)} UTC`
                          : '—'}
                      </b>
                    </div>
                  </div>
                </GlassCard>
              </section>

              {/* Interval table */}
              <GlassCard className="overflow-hidden">
                <div
                  id="intervals"
                  className="flex scroll-mt-6 flex-wrap items-center justify-between gap-3 p-5 sm:p-6"
                >
                  <div>
                    <h2 className="font-[Manrope] text-sm font-extrabold text-slate-800">
                      Interval-level analysis
                    </h2>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Matched delivery intervals and forecast publication times
                    </p>
                  </div>

                  <button
                    onClick={exportCsv}
                    disabled={!points.length}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-40"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead className="bg-blue-50/70 text-[9px] font-extrabold tracking-wider text-slate-400">
                      <tr>
                        {[
                          'DELIVERY INTERVAL (UTC)',
                          'FORECAST PUBLISHED (UTC)',
                          'FORECAST',
                          'ACTUAL',
                          'ERROR',
                          'STATUS',
                        ].map((heading) => (
                          <th key={heading} className="px-5 py-3.5">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {points.slice(0, 12).map((point) => (
                        <tr
                          key={`${point.startTime}-${point.publishTime}`}
                          className="border-b border-slate-100/80 transition hover:bg-blue-50/40"
                        >
                          <td className="px-5 py-4 text-xs font-bold text-slate-700">
                            {formatDate(point.startTime)}{' '}
                            {formatTime(point.startTime)}
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(point.publishTime)}{' '}
                            {formatTime(point.publishTime)}
                          </td>

                          <td className="px-5 py-4 text-xs font-semibold text-blue-700">
                            {formatNumber(point.forecast)}{' '}
                            <span className="text-slate-400">MW</span>
                          </td>

                          <td className="px-5 py-4 text-xs font-semibold text-emerald-700">
                            {formatNumber(point.actual)}{' '}
                            <span className="text-slate-400">MW</span>
                          </td>

                          <td
                            className={`px-5 py-4 text-xs font-bold ${point.error > 0
                              ? 'text-orange-600'
                              : 'text-violet-600'
                              }`}
                          >
                            {point.error > 0 ? '+' : ''}
                            {formatNumber(point.error)} MW
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1.5 text-[9px] font-bold ${Math.abs(point.error) < 300
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-orange-100 text-orange-700'
                                }`}
                            >
                              {Math.abs(point.error) < 300
                                ? 'Within range'
                                : 'Review'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {points.length === 0 && (
                    <div className="p-10 text-center text-sm text-slate-400">
                      No matched intervals are available for this selection.
                      Try another date or use demo data.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-4 text-[10px] text-slate-400">
                  <span>
                    Showing {Math.min(points.length, 12)} of {points.length}{' '}
                    intervals
                  </span>
                  <span>
                    Values in MW ·{' '}
                    {mode === 'demo' ? 'Illustrative sample' : 'API response'}
                  </span>
                </div>
              </GlassCard>

              <footer className="flex flex-wrap justify-between gap-3 px-2 py-6 text-[10px] text-slate-400">
                <span className="flex items-center gap-2">
                  <Cloud size={14} />
                  Forecast selection: {data.selectionPolicy || 'Backend-defined'}
                </span>
                <span>Northstar Analytics · Prototype</span>
              </footer>
            </>
          )}

          {!data && loading && (
            <GlassCard className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-blue-100 text-blue-600">
                <Sparkles size={25} />
              </div>
              <p className="font-[Manrope] text-lg font-extrabold">
                Preparing your dashboard
              </p>
              <p className="text-sm text-slate-500">
                Retrieving the requested analysis…
              </p>
            </GlassCard>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
