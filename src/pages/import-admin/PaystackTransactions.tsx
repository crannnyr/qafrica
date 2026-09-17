import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader,
  RefreshCw,
  X,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  CreditCard,
  User,
  Banknote,
  Calendar,
} from 'lucide-react'
import CONFIG from '@/lib/config'
import { toast } from 'sonner'

const EDGE_URL =
  `${CONFIG.SUPABASE_URL}/functions/v1/paystack-transactions`

const PAGE_SIZE = 50

interface PaystackCustomer {
  id?: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  customer_code?: string
}

interface Authorization {
  authorization_code?: string
  bin?: string
  last4?: string
  exp_month?: string
  exp_year?: string
  channel?: string
  card_type?: string
  bank?: string
  country_code?: string
  brand?: string
  reusable?: boolean
  signature?: string
}

interface Transaction {
  id: number
  reference?: string | null
  amount?: number | null
  requested_amount?: number | null
  currency?: string | null
  status?: string | null
  channel?: string | null
  fees?: number | null
  message?: string | null
  gateway_response?: string | null
  paid_at?: string | null
  created_at?: string | null
  transaction_date?: string | null
  ip_address?: string | null
  metadata?: Record<string, unknown> | null
  customer?: PaystackCustomer | null
  authorization?: Authorization | null
}

interface TimelineEvent {
  type?: string | null
  message?: string | null
  status?: string | null
  time?: string | null
  data?: unknown
}

interface Pagination {
  page: number
  perPage: number
  pageCount: number
  skipped: number
  totalVolume: number
}

function fmtAmount(
  amount: number | null | undefined,
  currency = 'NGN',
) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0) / 100)
}

function fmtDate(
  value: string | null | undefined,
) {
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

function customerName(
  customer?: PaystackCustomer | null,
) {
  const name =
    `${customer?.first_name || ''} ${customer?.last_name || ''}`
      .trim()

  return name || 'Unknown customer'
}

function statusBadge(status?: string | null) {
  switch (String(status || '').toLowerCase()) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3 h-3" />
          Successful
        </span>
      )

    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      )

    case 'abandoned':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">
          <Clock className="w-3 h-3" />
          Abandoned
        </span>
      )

    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
          <AlertCircle className="w-3 h-3" />
          {status || 'Unknown'}
        </span>
      )
  }
}

export default function PaystackTransactions({
  token,
}: {
  token: string
}) {
  const [transactions, setTransactions] =
    useState<Transaction[]>([])

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      perPage: PAGE_SIZE,
      pageCount: 0,
      skipped: 0,
      totalVolume: 0,
    })

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] =
    useState<Transaction[] | null>(null)
  const [searchLoading, setSearchLoading] =
    useState(false)
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [isLoading, setIsLoading] =
    useState(true)

  const [selected, setSelected] =
    useState<Transaction | null>(null)

  const [detailsLoading, setDetailsLoading] =
    useState(false)

  const [detailsError, setDetailsError] =
    useState('')

  const [timeline, setTimeline] =
    useState<TimelineEvent[]>([])

  const [copied, setCopied] =
    useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
  
    try {
      const params = new URLSearchParams()
  
      params.set('action', 'list')
      params.set('page', String(page))
  
      if (status !== 'all') {
        params.set('status', status)
      }
  
      if (from) {
        params.set('from', from)
      }
  
      if (to) {
        params.set('to', to)
      }
  
      const response = await fetch(
        `${EDGE_URL}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Manager-Token': token,
          },
        },
      )
  
      const data =
        await response.json().catch(() => null)
  
      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            'Failed to load Paystack transactions',
        )
      }
  
      setTransactions(
        Array.isArray(data.data)
          ? data.data
          : [],
      )
  
      setPagination({
        page: Number(
          data.meta?.page || page,
        ),
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
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to load transactions',
      )
  
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [
    token,
    page,
    status,
    from,
    to,
  ])

  useEffect(() => {
    load()
  }, [load])

  const visibleTransactions =
    useMemo(() => {
      const q =
        search.trim().toLowerCase()

      if (!q || q.includes('@')) {
        return transactions
      }

      return transactions.filter(
        transaction => {
          const reference =
            transaction.reference
              ?.toLowerCase() || ''

          const email =
            transaction.customer?.email
              ?.toLowerCase() || ''

          const name =
            customerName(
              transaction.customer,
            ).toLowerCase()

          return (
            reference.includes(q) ||
            email.includes(q) ||
            name.includes(q)
          )
        },
      )
    }, [transactions, search])

  const viewTransaction = async (
    transaction: Transaction,
  ) => {
    setSelected(transaction)
    setTimeline([])
    setDetailsError('')
    setDetailsLoading(true)

    try {
      const detailsResponse =
        await fetch(
          `${EDGE_URL}?action=details&id=${encodeURIComponent(
            String(transaction.id),
          )}`,
          {
            headers: {
              'X-Manager-Token': token,
            },
          },
        )

      const detailsData =
        await detailsResponse
          .json()
          .catch(() => null)

      if (
        !detailsResponse.ok ||
        !detailsData?.success
      ) {
        throw new Error(
          detailsData?.error ||
            'Failed to load transaction details',
        )
      }

      setSelected(
        detailsData.data,
      )

      const timelineResponse =
        await fetch(
          `${EDGE_URL}?action=timeline&id=${encodeURIComponent(
            String(transaction.id),
          )}`,
          {
            headers: {
              'X-Manager-Token': token,
            },
          },
        )

      const timelineData =
        await timelineResponse
          .json()
          .catch(() => null)

      if (
        timelineResponse.ok &&
        timelineData?.success &&
        Array.isArray(timelineData.data)
      ) {
        setTimeline(
          timelineData.data,
        )
      }
    } catch (error) {
      setDetailsError(
        error instanceof Error
          ? error.message
          : 'Failed to load transaction',
      )
    } finally {
      setDetailsLoading(false)
    }
  }

  const copy = async (
    value: string,
    key: string,
  ) => {
    try {
      await navigator.clipboard.writeText(
        value,
      )

      setCopied(key)

      window.setTimeout(() => {
        setCopied(null)
      }, 1500)
    } catch {
      toast.error(
        'Could not copy value',
      )
    }
  }

  const totalPages = Math.max(
    pagination.pageCount,
    1,
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-gray-400" />

            <div>
              <p className="font-semibold text-gray-800 text-sm">
                Paystack Transactions
              </p>

              <p className="text-[10px] text-gray-400 mt-0.5">
                50 transactions per page
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={isLoading}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-gray-400 ${
                isLoading
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />

            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search reference, customer or email…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none"
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

            <input
              type="date"
              value={from}
              onChange={e => {
                setFrom(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none"
            />

            <input
              type="date"
              value={to}
              onChange={e => {
                setTo(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
              <p className="text-xs text-gray-400 mt-2">
                Loading transactions…
              </p>
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <CreditCard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                No transactions found.
              </p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Reference
                  </th>

                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Customer
                  </th>

                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Amount
                  </th>

                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Channel
                  </th>

                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Status
                  </th>

                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Date
                  </th>

                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {visibleTransactions.map(
                  transaction => (
                    <tr
                      key={transaction.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-mono font-bold text-gray-800">
                          {transaction.reference ||
                            '—'}
                        </p>

                        <p className="text-[10px] text-gray-300 mt-0.5">
                          #{transaction.id}
                        </p>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="text-xs font-semibold text-gray-800">
                          {customerName(
                            transaction.customer,
                          )}
                        </p>

                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {transaction.customer
                            ?.email || '—'}
                        </p>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="text-xs font-bold text-gray-800">
                          {fmtAmount(
                            transaction.amount,
                            transaction.currency ||
                              'NGN',
                          )}
                        </p>

                        {transaction.fees !=
                          null && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Fee:{' '}
                            {fmtAmount(
                              transaction.fees,
                              transaction.currency ||
                                'NGN',
                            )}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-600 capitalize">
                          {transaction.channel ||
                            '—'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {statusBadge(
                          transaction.status,
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-xs text-gray-600">
                          {fmtDate(
                            transaction.paid_at ||
                              transaction.created_at,
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() =>
                            viewTransaction(
                              transaction,
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-700 text-white text-[10px] font-bold transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading &&
          visibleTransactions.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">
                Page{' '}
                <span className="font-bold text-gray-700">
                  {page}
                </span>{' '}
                of{' '}
                <span className="font-bold text-gray-700">
                  {totalPages}
                </span>
              </p>

              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setPage(p =>
                      Math.max(p - 1, 1),
                    )
                  }
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600 disabled:opacity-30"
                >
                  <ChevronLeft className="w-3 h-3 inline" />
                  Previous
                </button>

                <button
                  onClick={() =>
                    setPage(p =>
                      Math.min(
                        p + 1,
                        totalPages,
                      ),
                    )
                  }
                  disabled={
                    page >= totalPages
                  }
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600 disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="w-3 h-3 inline" />
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Details modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onMouseDown={e => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setSelected(null)
            }
          }}
        >
          <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 text-sm">
                  Transaction details
                </p>

                <p className="text-[10px] text-gray-400 mt-0.5">
                  {selected.reference ||
                    `Transaction #${selected.id}`}
                </p>
              </div>

              <button
                onClick={() =>
                  setSelected(null)
                }
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {detailsLoading ? (
                <div className="py-12 text-center">
                  <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
                  <p className="text-xs text-gray-400 mt-2">
                    Loading full transaction…
                  </p>
                </div>
              ) : detailsError ? (
                <div className="bg-red-50 text-red-600 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {detailsError}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <SummaryCard
                      label="Amount"
                      value={fmtAmount(
                        selected.amount,
                        selected.currency ||
                          'NGN',
                      )}
                    />

                    <SummaryCard
                      label="Status"
                      value={
                        selected.status ||
                        '—'
                      }
                    />

                    <SummaryCard
                      label="Channel"
                      value={
                        selected.channel ||
                        '—'
                      }
                    />

                    <SummaryCard
                      label="Fees"
                      value={
                        selected.fees !=
                        null
                          ? fmtAmount(
                              selected.fees,
                              selected.currency ||
                                'NGN',
                            )
                          : '—'
                      }
                    />
                  </div>

                  <DetailSection
                    icon={
                      <Banknote className="w-4 h-4" />
                    }
                    title="Transaction"
                  >
                    <DetailGrid
                      rows={[
                        [
                          'Transaction ID',
                          String(
                            selected.id,
                          ),
                          'transaction-id',
                        ],
                        [
                          'Reference',
                          selected.reference ||
                            '—',
                          'reference',
                        ],
                        [
                          'Currency',
                          selected.currency ||
                            '—',
                        ],
                        [
                          'Gateway response',
                          selected.gateway_response ||
                            '—',
                        ],
                        [
                          'Message',
                          selected.message ||
                            '—',
                        ],
                        [
                          'IP address',
                          selected.ip_address ||
                            '—',
                        ],
                        [
                          'Created',
                          fmtDate(
                            selected.created_at,
                          ),
                        ],
                        [
                          'Paid',
                          fmtDate(
                            selected.paid_at,
                          ),
                        ],
                      ]}
                      copied={copied}
                      onCopy={copy}
                    />
                  </DetailSection>

                  <DetailSection
                    icon={
                      <User className="w-4 h-4" />
                    }
                    title="Customer"
                  >
                    <DetailGrid
                      rows={[
                        [
                          'Name',
                          customerName(
                            selected.customer,
                          ),
                        ],
                        [
                          'Email',
                          selected.customer
                            ?.email ||
                            '—',
                        ],
                        [
                          'Phone',
                          selected.customer
                            ?.phone ||
                            '—',
                        ],
                        [
                          'Customer code',
                          selected.customer
                            ?.customer_code ||
                            '—',
                        ],
                      ]}
                    />
                  </DetailSection>

                  {selected.authorization && (
                    <DetailSection
                      icon={
                        <CreditCard className="w-4 h-4" />
                      }
                      title="Authorization"
                    >
                      <DetailGrid
                        rows={[
                          [
                            'Channel',
                            selected.authorization
                              ?.channel ||
                              '—',
                          ],
                          [
                            'Card type',
                            selected.authorization
                              ?.card_type ||
                              '—',
                          ],
                          [
                            'Brand',
                            selected.authorization
                              ?.brand ||
                              '—',
                          ],
                          [
                            'Bank',
                            selected.authorization
                              ?.bank ||
                              '—',
                          ],
                          [
                            'BIN',
                            selected.authorization
                              ?.bin ||
                              '—',
                          ],
                          [
                            'Last 4',
                            selected.authorization
                              ?.last4 ||
                              '—',
                          ],
                          [
                            'Expiry',
                            selected.authorization
                              ?.exp_month &&
                            selected.authorization
                              ?.exp_year
                              ? `${selected.authorization.exp_month}/${selected.authorization.exp_year}`
                              : '—',
                          ],
                          [
                            'Country',
                            selected.authorization
                              ?.country_code ||
                              '—',
                          ],
                          [
                            'Reusable',
                            selected.authorization
                              ?.reusable
                              ? 'Yes'
                              : 'No',
                          ],
                        ]}
                      />
                    </DetailSection>
                  )}

                  {selected.metadata && (
                    <DetailSection
                      icon={
                        <Calendar className="w-4 h-4" />
                      }
                      title="Metadata"
                    >
                      <pre className="bg-gray-950 text-gray-100 text-[10px] leading-5 rounded-xl p-4 overflow-auto max-h-72">
                        {JSON.stringify(
                          selected.metadata,
                          null,
                          2,
                        )}
                      </pre>
                    </DetailSection>
                  )}

                  <DetailSection
                    icon={
                      <Calendar className="w-4 h-4" />
                    }
                    title="Timeline"
                  >
                    {timeline.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No timeline information available.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {timeline.map(
                          (event, index) => (
                            <div
                              key={index}
                              className="border border-gray-100 rounded-xl p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-gray-800">
                                  {event.type ||
                                    event.status ||
                                    'Event'}
                                </p>

                                <span className="text-[10px] text-gray-400">
                                  {fmtDate(
                                    event.time,
                                  )}
                                </span>
                              </div>

                              {event.message && (
                                <p className="text-[11px] text-gray-500 mt-1">
                                  {event.message}
                                </p>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </DetailSection>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>

      <p className="text-sm font-bold text-gray-800 mt-1 capitalize">
        {value}
      </p>
    </div>
  )
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5 text-gray-500">
        {icon}

        <h4 className="text-xs font-bold text-gray-800">
          {title}
        </h4>
      </div>

      {children}
    </section>
  )
}

function DetailGrid({
  rows,
  copied,
  onCopy,
}: {
  rows: Array<
    [
      string,
      string,
      string?,
    ]
  >
  copied?: string | null
  onCopy?: (
    value: string,
    key: string,
  ) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map(
        ([label, value, copyKey]) => (
          <div
            key={label}
            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5"
          >
            <p className="text-[10px] text-gray-400">
              {label}
            </p>

            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-xs font-medium text-gray-800 break-all">
                {value}
              </p>

              {copyKey &&
                onCopy &&
                value !== '—' && (
                  <button
                    onClick={() =>
                      onCopy(
                        value,
                        copyKey,
                      )
                    }
                    className="shrink-0 p-1 rounded hover:bg-white"
                  >
                    {copied ===
                    copyKey ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                )}
            </div>
          </div>
        ),
      )}
    </div>
  )
}
