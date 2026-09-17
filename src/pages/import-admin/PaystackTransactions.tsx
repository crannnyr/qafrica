import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertCircle,
  CreditCard,
  User,
  Calendar,
  Hash,
  Banknote,
  Copy,
  Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const PAGE_SIZE = 50

type Transaction = {
  id: number
  domain?: string | null
  status?: string | null
  reference?: string | null
  amount?: number | null
  message?: string | null
  gateway_response?: string | null
  paid_at?: string | null
  created_at?: string | null
  channel?: string | null
  currency?: string | null
  ip_address?: string | null
  metadata?: Record<string, any> | null
  customer?: {
    id?: number | null
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    customer_code?: string | null
    phone?: string | null
  } | null
  authorization?: {
    authorization_code?: string | null
    bin?: string | null
    last4?: string | null
    exp_month?: string | null
    exp_year?: string | null
    channel?: string | null
    card_type?: string | null
    bank?: string | null
    country_code?: string | null
    brand?: string | null
    reusable?: boolean | null
    signature?: string | null
  } | null
  fees?: number | null
  plan?: any
  requested_amount?: number | null
  transaction_date?: string | null
}

type PaginationMeta = {
  page: number
  perPage: number
  pageCount: number
  skipped: number
  totalVolume: number
}

type TimelineEvent = {
  type?: string | null
  time?: string | null
  message?: string | null
  status?: string | null
  data?: any
}

function formatMoney(amount?: number | null, currency = 'NGN') {
  const value = Number(amount || 0) / 100

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(status?: string | null) {
  if (!status) return 'Unknown'

  return status.charAt(0).toUpperCase() + status.slice(1)
}

function StatusBadge({
  status,
}: {
  status?: string | null
}) {
  const normalized = String(status || '').toLowerCase()

  if (normalized === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 size={13} />
        Successful
      </span>
    )
  }

  if (normalized === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600">
        <XCircle size={13} />
        Failed
      </span>
    )
  }

  if (normalized === 'abandoned') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
        <Clock3 size={13} />
        Abandoned
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 px-2.5 py-1 text-xs font-medium text-gray-600">
      <AlertCircle size={13} />
      {statusLabel(status)}
    </span>
  )
}

function getCustomerName(transaction: Transaction) {
  const first = transaction.customer?.first_name || ''
  const last = transaction.customer?.last_name || ''

  const name = `${first} ${last}`.trim()

  return name || transaction.customer?.email || 'Unknown customer'
}

function getPaymentType(transaction: Transaction) {
  const metadata = transaction.metadata

  if (!metadata) return '—'

  return (
    metadata.type ||
    metadata.payment_type ||
    metadata.kind ||
    '—'
  )
}

export default function PaystackTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    perPage: PAGE_SIZE,
    pageCount: 0,
    skipped: 0,
    totalVolume: 0,
  })

  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)

  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  const [copied, setCopied] = useState('')

  const totalPages = Math.max(meta.pageCount || 1, 1)

  const hasPrevious = page > 1
  const hasNext = page < totalPages

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const params = new URLSearchParams()

      params.set('action', 'list')
      params.set('page', String(page))
      params.set('perPage', String(PAGE_SIZE))

      if (status !== 'all') {
        params.set('status', status)
      }

      if (from) {
        params.set('from', from)
      }

      if (to) {
        params.set('to', to)
      }

      /*
       * Paystack does not provide arbitrary free-text search
       * over all transaction fields through the list endpoint.
       *
       * We pass customer when the search value looks like
       * an email. Reference search is handled locally for
       * the transactions returned by the current page.
       */
      if (search.includes('@')) {
        params.set('customer', search.trim())
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-transactions?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            'Unable to load Paystack transactions.',
        )
      }

      setTransactions(data.data || [])

      setMeta({
        page: Number(data.meta?.page || page),
        perPage: Number(
          data.meta?.perPage || PAGE_SIZE,
        ),
        pageCount: Number(
          data.meta?.pageCount || 0,
        ),
        skipped: Number(
          data.meta?.skipped || 0,
        ),
        totalVolume: Number(
          data.meta?.totalVolume || 0,
        ),
      })
    } catch (err) {
      console.error(err)

      setTransactions([])

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load transactions.',
      )
    } finally {
      setLoading(false)
    }
  }, [page, status, from, to, search])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query || query.includes('@')) {
      return transactions
    }

    return transactions.filter((transaction) => {
      const reference =
        transaction.reference?.toLowerCase() || ''

      const customerEmail =
        transaction.customer?.email?.toLowerCase() || ''

      const customerName =
        getCustomerName(transaction).toLowerCase()

      return (
        reference.includes(query) ||
        customerEmail.includes(query) ||
        customerName.includes(query)
      )
    })
  }, [transactions, search])

  async function viewTransaction(
    transaction: Transaction,
  ) {
    setSelectedTransaction(transaction)
    setTimeline([])
    setDetailsError('')
    setLoadingDetails(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Your session has expired.')
      }

      const baseUrl =
        `${import.meta.env.VITE_SUPABASE_URL}` +
        '/functions/v1/paystack-transactions'

      const detailsUrl =
        `${baseUrl}?action=details&id=${encodeURIComponent(
          String(transaction.id),
        )}`

      const detailsResponse = await fetch(
        detailsUrl,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        },
      )

      const detailsData =
        await detailsResponse.json().catch(() => null)

      if (
        !detailsResponse.ok ||
        !detailsData?.success
      ) {
        throw new Error(
          detailsData?.error ||
            'Unable to load transaction details.',
        )
      }

      setSelectedTransaction(detailsData.data)

      /*
       * Timeline is useful but should not prevent
       * the transaction details from displaying.
       */
      try {
        const timelineUrl =
          `${baseUrl}?action=timeline&id=${encodeURIComponent(
            String(transaction.id),
          )}`

        const timelineResponse = await fetch(
          timelineUrl,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey:
                import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          },
        )

        const timelineData =
          await timelineResponse.json().catch(() => null)

        if (
          timelineResponse.ok &&
          timelineData?.success
        ) {
          setTimeline(
            Array.isArray(timelineData.data)
              ? timelineData.data
              : [],
          )
        }
      } catch (timelineError) {
        console.warn(
          'Unable to load transaction timeline:',
          timelineError,
        )
      }
    } catch (err) {
      console.error(err)

      setDetailsError(
        err instanceof Error
          ? err.message
          : 'Unable to load transaction details.',
      )
    } finally {
      setLoadingDetails(false)
    }
  }

  async function copyValue(
    value: string,
    key: string,
  ) {
    try {
      await navigator.clipboard.writeText(value)

      setCopied(key)

      window.setTimeout(() => {
        setCopied('')
      }, 1500)
    } catch {
      // Ignore clipboard errors.
    }
  }

  function resetFilters() {
    setSearch('')
    setStatus('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  function handleSearchChange(
    value: string,
  ) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusChange(
    value: string,
  ) {
    setStatus(value)
    setPage(1)
  }

  function handleFromChange(
    value: string,
  ) {
    setFrom(value)
    setPage(1)
  }

  function handleToChange(
    value: string,
  ) {
    setTo(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Paystack Transactions
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            View and inspect Paystack payment transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTransactions}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={
              loading ? 'animate-spin' : ''
            }
          />

          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) =>
                handleSearchChange(
                  event.target.value,
                )
              }
              placeholder="Search reference, customer or email..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              handleStatusChange(
                event.target.value,
              )
            }
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
          >
            <option value="all">
              All statuses
            </option>
            <option value="success">
              Successful
            </option>
            <option value="failed">
              Failed
            </option>
            <option value="abandoned">
              Abandoned
            </option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              From
            </label>

            <input
              type="date"
              value={from}
              onChange={(event) =>
                handleFromChange(
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              To
            </label>

            <input
              type="date"
              value={to}
              onChange={(event) =>
                handleToChange(
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Current page
          </p>

          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {visibleTransactions.length}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Maximum 50 transactions
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Page
          </p>

          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {page} / {totalPages}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Server-side pagination
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Page volume
          </p>

          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatMoney(meta.totalVolume)}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Paystack reported volume
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-medium">
              Unable to load transactions
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2
                size={20}
                className="animate-spin"
              />

              Loading Paystack transactions...
            </div>
          </div>
        ) : visibleTransactions.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <CreditCard
              size={40}
              className="text-gray-300"
            />

            <h3 className="mt-4 font-medium text-gray-900">
              No transactions found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Transaction
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Customer
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Amount
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Channel
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {visibleTransactions.map(
                    (transaction) => (
                      <tr
                        key={
                          transaction.id
                        }
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="max-w-[220px]">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {transaction.reference ||
                                '—'}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              ID #{transaction.id}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {getCustomerName(
                              transaction,
                            )}
                          </p>

                          <p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
                            {transaction.customer
                              ?.email ||
                              '—'}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatMoney(
                              transaction.amount,
                              transaction.currency ||
                                'NGN',
                            )}
                          </p>

                          {transaction.fees !=
                            null && (
                            <p className="mt-1 text-xs text-gray-400">
                              Fee:{' '}
                              {formatMoney(
                                transaction.fees,
                                transaction.currency ||
                                  'NGN',
                              )}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="text-sm capitalize text-gray-700">
                            {transaction.channel ||
                              '—'}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge
                            status={
                              transaction.status
                            }
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-sm text-gray-700">
                            {formatDate(
                              transaction.paid_at ||
                                transaction.created_at,
                            )}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              viewTransaction(
                                transaction,
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            <Eye size={15} />
                            View
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Page{' '}
                <span className="font-medium text-gray-900">
                  {page}
                </span>{' '}
                of{' '}
                <span className="font-medium text-gray-900">
                  {totalPages}
                </span>
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrevious || loading}
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={!hasNext || loading}
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1,
                        ),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedTransaction(null)
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Transaction Details
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Paystack transaction #
                  {selectedTransaction.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(
                    null,
                  )
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-6">
              {loadingDetails ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2
                      size={20}
                      className="animate-spin"
                    />
                    Loading transaction details...
                  </div>
                </div>
              ) : detailsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {detailsError}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main summary */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                        <Banknote size={14} />
                        Amount
                      </div>

                      <p className="mt-2 text-xl font-semibold text-gray-900">
                        {formatMoney(
                          selectedTransaction.amount,
                          selectedTransaction.currency ||
                            'NGN',
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-medium text-gray-500">
                        Status
                      </div>

                      <div className="mt-2">
                        <StatusBadge
                          status={
                            selectedTransaction.status
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-medium text-gray-500">
                        Channel
                      </div>

                      <p className="mt-2 text-sm font-semibold capitalize text-gray-900">
                        {selectedTransaction.channel ||
                          '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-medium text-gray-500">
                        Payment Type
                      </div>

                      <p className="mt-2 text-sm font-semibold text-gray-900">
                        {getPaymentType(
                          selectedTransaction,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Reference */}
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Hash
                        size={17}
                        className="text-gray-500"
                      />

                      <h4 className="font-semibold text-gray-900">
                        Transaction
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <DetailRow
                        label="Transaction ID"
                        value={String(
                          selectedTransaction.id,
                        )}
                        copyKey="transaction-id"
                        copied={copied}
                        onCopy={() =>
                          copyValue(
                            String(
                              selectedTransaction.id,
                            ),
                            'transaction-id',
                          )
                        }
                      />

                      <DetailRow
                        label="Reference"
                        value={
                          selectedTransaction.reference ||
                          '—'
                        }
                        copyKey="reference"
                        copied={copied}
                        onCopy={() =>
                          selectedTransaction.reference &&
                          copyValue(
                            selectedTransaction.reference,
                            'reference',
                          )
                        }
                      />

                      <DetailRow
                        label="Currency"
                        value={
                          selectedTransaction.currency ||
                          '—'
                        }
                      />

                      <DetailRow
                        label="Gateway Response"
                        value={
                          selectedTransaction.gateway_response ||
                          '—'
                        }
                      />

                      <DetailRow
                        label="Message"
                        value={
                          selectedTransaction.message ||
                          '—'
                        }
                      />

                      <DetailRow
                        label="IP Address"
                        value={
                          selectedTransaction.ip_address ||
                          '—'
                        }
                      />

                      <DetailRow
                        label="Created"
                        value={formatDate(
                          selectedTransaction.created_at,
                        )}
                      />

                      <DetailRow
                        label="Paid"
                        value={formatDate(
                          selectedTransaction.paid_at,
                        )}
                      />
                    </div>
                  </section>

                  {/* Customer */}
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <User
                        size={17}
                        className="text-gray-500"
                      />

                      <h4 className="font-semibold text-gray-900">
                        Customer
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <DetailRow
                        label="Name"
                        value={getCustomerName(
                          selectedTransaction,
                        )}
                      />

                      <DetailRow
                        label="Email"
                        value={
                          selectedTransaction.customer
                            ?.email || '—'
                        }
                      />

                      <DetailRow
                        label="Phone"
                        value={
                          selectedTransaction.customer
                            ?.phone || '—'
                        }
                      />

                      <DetailRow
                        label="Customer Code"
                        value={
                          selectedTransaction.customer
                            ?.customer_code || '—'
                        }
                      />
                    </div>
                  </section>

                  {/* Authorization */}
                  {selectedTransaction.authorization && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <CreditCard
                          size={17}
                          className="text-gray-500"
                        />

                        <h4 className="font-semibold text-gray-900">
                          Authorization
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <DetailRow
                          label="Channel"
                          value={
                            selectedTransaction
                              .authorization
                              ?.channel || '—'
                          }
                        />

                        <DetailRow
                          label="Card Type"
                          value={
                            selectedTransaction
                              .authorization
                              ?.card_type || '—'
                          }
                        />

                        <DetailRow
                          label="Brand"
                          value={
                            selectedTransaction
                              .authorization
                              ?.brand || '—'
                          }
                        />

                        <DetailRow
                          label="Bank"
                          value={
                            selectedTransaction
                              .authorization
                              ?.bank || '—'
                          }
                        />

                        <DetailRow
                          label="BIN"
                          value={
                            selectedTransaction
                              .authorization
                              ?.bin || '—'
                          }
                        />

                        <DetailRow
                          label="Last 4"
                          value={
                            selectedTransaction
                              .authorization
                              ?.last4 || '—'
                          }
                        />

                        <DetailRow
                          label="Expiry"
                          value={
                            selectedTransaction
                              .authorization
                              ?.exp_month &&
                            selectedTransaction
                              .authorization
                              ?.exp_year
                              ? `${selectedTransaction.authorization.exp_month}/${selectedTransaction.authorization.exp_year}`
                              : '—'
                          }
                        />

                        <DetailRow
                          label="Country"
                          value={
                            selectedTransaction
                              .authorization
                              ?.country_code || '—'
                          }
                        />

                        <DetailRow
                          label="Reusable"
                          value={
                            selectedTransaction
                              .authorization
                              ?.reusable
                              ? 'Yes'
                              : 'No'
                          }
                        />
                      </div>
                    </section>
                  )}

                  {/* Fees */}
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Banknote
                        size={17}
                        className="text-gray-500"
                      />

                      <h4 className="font-semibold text-gray-900">
                        Payment Amount
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <DetailRow
                        label="Amount"
                        value={formatMoney(
                          selectedTransaction.amount,
                          selectedTransaction.currency ||
                            'NGN',
                        )}
                      />

                      <DetailRow
                        label="Paystack Fee"
                        value={
                          selectedTransaction.fees !=
                          null
                            ? formatMoney(
                                selectedTransaction.fees,
                                selectedTransaction.currency ||
                                  'NGN',
                              )
                            : '—'
                        }
                      />

                      <DetailRow
                        label="Requested Amount"
                        value={
                          selectedTransaction.requested_amount !=
                          null
                            ? formatMoney(
                                selectedTransaction.requested_amount,
                                selectedTransaction.currency ||
                                  'NGN',
                              )
                            : '—'
                        }
                      />
                    </div>
                  </section>

                  {/* Metadata */}
                  {selectedTransaction.metadata && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <Hash
                          size={17}
                          className="text-gray-500"
                        />

                        <h4 className="font-semibold text-gray-900">
                          Metadata
                        </h4>
                      </div>

                      <pre className="max-h-80 overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                        {JSON.stringify(
                          selectedTransaction.metadata,
                          null,
                          2,
                        )}
                      </pre>
                    </section>
                  )}

                  {/* Timeline */}
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Calendar
                        size={17}
                        className="text-gray-500"
                      />

                      <h4 className="font-semibold text-gray-900">
                        Transaction Timeline
                      </h4>
                    </div>

                    {timeline.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        No timeline information available.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {timeline.map(
                          (event, index) => (
                            <div
                              key={index}
                              className="flex gap-3 rounded-xl border border-gray-200 p-4"
                            >
                              <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gray-400" />

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900">
                                    {event.type ||
                                      event.status ||
                                      'Event'}
                                  </p>

                                  {event.time && (
                                    <span className="text-xs text-gray-400">
                                      {formatDate(
                                        event.time,
                                      )}
                                    </span>
                                  )}
                                </div>

                                {event.message && (
                                  <p className="mt-1 text-sm text-gray-600">
                                    {event.message}
                                  </p>
                                )}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copyKey?: string
  copied?: string
  onCopy?: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="min-w-0 break-all text-sm text-gray-900">
          {value}
        </p>

        {copyKey && onCopy && value !== '—' && (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Copy"
          >
            {copied === copyKey ? (
              <Check
                size={14}
                className="text-emerald-600"
              />
            ) : (
              <Copy size={14} />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
