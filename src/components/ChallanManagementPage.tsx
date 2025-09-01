import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/supabase'
import { 
  FileText, 
  RotateCcw, 
  Search, 
  Download, 
  Calendar, 
  User, 
  Package, 
  Trash2, 
  Edit3,
  Eye,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Hash,
  MapPin,
  Phone
} from 'lucide-react'
import { PrintableChallan } from './challans/PrintableChallan'
import { generateJPGChallan, downloadJPGChallan } from '../utils/jpgChallanGenerator'
import { ChallanData } from './challans/types'
import { useAuth } from '../hooks/useAuth'

type Client = Database['public']['Tables']['clients']['Row']
type Challan = Database['public']['Tables']['challans']['Row']
type ChallanItem = Database['public']['Tables']['challan_items']['Row']
type Return = Database['public']['Tables']['returns']['Row']
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row']

interface ChallanWithItems extends Challan {
  challan_items: ChallanItem[]
  client: Client
}

interface ReturnWithItems extends Return {
  return_line_items: ReturnLineItem[]
  client: Client
}

type FilterStatus = 'all' | 'active' | 'completed'
type SortBy = 'date_desc' | 'date_asc' | 'client_name' | 'challan_number'

export function ChallanManagementPage() {
  const { user } = useAuth()
  const [udharChallans, setUdharChallans] = useState<ChallanWithItems[]>([])
  const [jamaChallans, setJamaChallans] = useState<ReturnWithItems[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [challanData, setChallanData] = useState<ChallanData | null>(null)
  const [activeTab, setActiveTab] = useState<'udhar' | 'jama'>('udhar')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date_desc')
  const [expandedChallan, setExpandedChallan] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchChallans()
    
    // Set up real-time subscriptions
    const challanSubscription = supabase
      .channel('challans_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challans' }, () => {
        fetchChallans()
      })
      .subscribe()

    const returnsSubscription = supabase
      .channel('returns_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'returns' }, () => {
        fetchChallans()
      })
      .subscribe()

    return () => {
      challanSubscription.unsubscribe()
      returnsSubscription.unsubscribe()
    }
  }, [])

  const fetchChallans = async () => {
    try {
      // Fetch udhar challans
      const { data: udharData, error: udharError } = await supabase
        .from('challans')
        .select(`
          *,
          challan_items (*),
          client:clients (*)
        `)
        .order('created_at', { ascending: false })

      if (udharError) throw udharError

      // Fetch jama challans
      const { data: jamaData, error: jamaError } = await supabase
        .from('returns')
        .select(`
          *,
          return_line_items (*),
          client:clients (*)
        `)
        .order('created_at', { ascending: false })

      if (jamaError) throw jamaError

      setUdharChallans(udharData || [])
      setJamaChallans(jamaData || [])
    } catch (error) {
      console.error('Error fetching challans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUdharChallan = async (challanId: number) => {
    if (!user?.isAdmin) {
      alert('Only admin can delete challans.')
      return
    }

    if (!confirm('Are you sure you want to delete this udhar challan? This will also update stock quantities.')) {
      return
    }

    try {
      // First, get the challan items to revert stock
      const { data: challanItems, error: itemsError } = await supabase
        .from('challan_items')
        .select('*')
        .eq('challan_id', challanId)

      if (itemsError) throw itemsError

      // Revert stock quantities for each item
      for (const item of challanItems || []) {
        const { data: stockItem, error: stockFetchError } = await supabase
          .from('stock')
          .select('*')
          .eq('plate_size', item.plate_size)
          .single()

        if (stockFetchError) {
          console.error('Error fetching stock for', item.plate_size, stockFetchError)
          continue
        }

        // Revert stock: add back to available, subtract from on_rent
        const newAvailableQuantity = stockItem.available_quantity + item.borrowed_quantity
        const newOnRentQuantity = Math.max(0, stockItem.on_rent_quantity - item.borrowed_quantity)

        const { error: stockUpdateError } = await supabase
          .from('stock')
          .update({
            available_quantity: newAvailableQuantity,
            on_rent_quantity: newOnRentQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', stockItem.id)

        if (stockUpdateError) {
          console.error('Error updating stock for', item.plate_size, stockUpdateError)
        }
      }

      // Delete the challan (cascade will delete items)
      const { error: deleteError } = await supabase
        .from('challans')
        .delete()
        .eq('id', challanId)

      if (deleteError) throw deleteError

      alert('Udhar challan deleted successfully and stock updated!')
      await fetchChallans()
    } catch (error) {
      console.error('Error deleting udhar challan:', error)
      alert('Error deleting challan. Please try again.')
    }
  }

  const handleDeleteJamaChallan = async (returnId: number) => {
    if (!user?.isAdmin) {
      alert('Only admin can delete challans.')
      return
    }

    if (!confirm('Are you sure you want to delete this jama challan? This will also update stock quantities.')) {
      return
    }

    try {
      // First, get the return line items to revert stock
      const { data: returnItems, error: itemsError } = await supabase
        .from('return_line_items')
        .select('*')
        .eq('return_id', returnId)

      if (itemsError) throw itemsError

      // Revert stock quantities for each item
      for (const item of returnItems || []) {
        const { data: stockItem, error: stockFetchError } = await supabase
          .from('stock')
          .select('*')
          .eq('plate_size', item.plate_size)
          .single()

        if (stockFetchError) {
          console.error('Error fetching stock for', item.plate_size, stockFetchError)
          continue
        }

        // Revert stock: subtract from available, add back to on_rent
        const damagedQty = item.damaged_quantity || 0
        const lostQty = item.lost_quantity || 0
        const goodReturnedQty = item.returned_quantity - damagedQty - lostQty

        const newAvailableQuantity = Math.max(0, stockItem.available_quantity - goodReturnedQty)
        const newOnRentQuantity = stockItem.on_rent_quantity + item.returned_quantity

        const { error: stockUpdateError } = await supabase
          .from('stock')
          .update({
            available_quantity: newAvailableQuantity,
            on_rent_quantity: newOnRentQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', stockItem.id)

        if (stockUpdateError) {
          console.error('Error updating stock for', item.plate_size, stockUpdateError)
        }
      }

      // Delete the return (cascade will delete items)
      const { error: deleteError } = await supabase
        .from('returns')
        .delete()
        .eq('id', returnId)

      if (deleteError) throw deleteError

      alert('Jama challan deleted successfully and stock updated!')
      await fetchChallans()
    } catch (error) {
      console.error('Error deleting jama challan:', error)
      alert('Error deleting challan. Please try again.')
    }
  }

  const handleDownloadChallan = async (challan: ChallanWithItems | ReturnWithItems, type: 'udhar' | 'jama') => {
    try {
      const downloadKey = `${type}-${challan.id}`
      setDownloading(downloadKey)

      const challanDataForPDF: ChallanData = {
        type: type === 'udhar' ? 'issue' : 'return',
        challan_number: type === 'udhar' ? (challan as ChallanWithItems).challan_number : (challan as ReturnWithItems).return_challan_number,
        date: type === 'udhar' ? (challan as ChallanWithItems).challan_date : (challan as ReturnWithItems).return_date,
        client: {
          id: challan.client.id,
          name: challan.client.name,
          site: challan.client.site || '',
          mobile: challan.client.mobile_number || ''
        },
        driver_name: challan.driver_name || undefined,
        plates: type === 'udhar' 
          ? (challan as ChallanWithItems).challan_items.map(item => ({
              size: item.plate_size,
              quantity: item.borrowed_quantity,
              borrowed_stock: item.borrowed_stock || 0,
              notes: item.partner_stock_notes || '',
            }))
          : (challan as ReturnWithItems).return_line_items.map(item => ({
              size: item.plate_size,
              quantity: item.returned_quantity,
              borrowed_stock: item.returned_borrowed_stock || 0,
              damaged_quantity: item.damaged_quantity || 0,
              lost_quantity: item.lost_quantity || 0,
              notes: item.damage_notes || '',
            })),
        total_quantity: type === 'udhar'
          ? (challan as ChallanWithItems).challan_items.reduce((sum, item) => sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0)
          : (challan as ReturnWithItems).return_line_items.reduce((sum, item) => sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0)
      }

      setChallanData(challanDataForPDF)
      await new Promise(resolve => setTimeout(resolve, 500))

      const jpgDataUrl = await generateJPGChallan(challanDataForPDF)
      downloadJPGChallan(jpgDataUrl, `${type}-challan-${challanDataForPDF.challan_number}`)

      setChallanData(null)
    } catch (error) {
      console.error('Error downloading challan:', error)
      alert('Error downloading challan. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  const toggleChallanExpansion = (challanId: string) => {
    setExpandedChallan(expandedChallan === challanId ? null : challanId)
  }

  // Filter and sort functions
  const filterChallans = <T extends ChallanWithItems | ReturnWithItems>(challans: T[]): T[] => {
    return challans.filter(challan => {
      // Search filter
      const searchMatch = !searchTerm || (
        challan.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        challan.client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activeTab === 'udhar' 
          ? (challan as ChallanWithItems).challan_number.toLowerCase().includes(searchTerm.toLowerCase())
          : (challan as ReturnWithItems).return_challan_number.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )

      if (!searchMatch) return false

      // Status filter (only for udhar)
      if (activeTab === 'udhar' && filterStatus !== 'all') {
        const udharChallan = challan as ChallanWithItems
        if (filterStatus === 'active' && udharChallan.status !== 'active') return false
        if (filterStatus === 'completed' && udharChallan.status !== 'completed') return false
      }

      return true
    })
  }

  const sortChallans = <T extends ChallanWithItems | ReturnWithItems>(challans: T[]): T[] => {
    return [...challans].sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          const dateA = activeTab === 'udhar' ? (a as ChallanWithItems).challan_date : (a as ReturnWithItems).return_date
          const dateB = activeTab === 'udhar' ? (b as ChallanWithItems).challan_date : (b as ReturnWithItems).return_date
          return new Date(dateB).getTime() - new Date(dateA).getTime()
        case 'date_asc':
          const dateA2 = activeTab === 'udhar' ? (a as ChallanWithItems).challan_date : (a as ReturnWithItems).return_date
          const dateB2 = activeTab === 'udhar' ? (b as ChallanWithItems).challan_date : (b as ReturnWithItems).return_date
          return new Date(dateA2).getTime() - new Date(dateB2).getTime()
        case 'client_name':
          return a.client.name.localeCompare(b.client.name)
        case 'challan_number':
          const numberA = activeTab === 'udhar' ? (a as ChallanWithItems).challan_number : (a as ReturnWithItems).return_challan_number
          const numberB = activeTab === 'udhar' ? (b as ChallanWithItems).challan_number : (b as ReturnWithItems).return_challan_number
          return numberA.localeCompare(numberB)
        default:
          return 0
      }
    })
  }

  const filteredAndSortedUdharChallans = sortChallans(filterChallans(udharChallans))
  const filteredAndSortedJamaChallans = sortChallans(filterChallans(jamaChallans))

  const resetFilters = () => {
    setSearchTerm('')
    setFilterStatus('all')
    setSortBy('date_desc')
  }

  const hasActiveFilters = searchTerm !== '' || filterStatus !== 'all' || sortBy !== 'date_desc'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Challan Management</h1>
          <p className="text-gray-600">Loading challans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hidden Printable Challan */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {challanData && (
          <div id={`challan-${challanData.challan_number}`}>
            <PrintableChallan data={challanData} />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Challan Management</h1>
        <p className="text-gray-600">View and manage all udhar and jama challans</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('udhar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'udhar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Udhar Challans ({filteredAndSortedUdharChallans.length})
            </button>
            <button
              onClick={() => setActiveTab('jama')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'jama'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Jama Challans ({filteredAndSortedJamaChallans.length})
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search by client, challan number..."
                  />
                </div>
              </div>

              {activeTab === 'udhar' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date_desc">Date (Newest First)</option>
                  <option value="date_asc">Date (Oldest First)</option>
                  <option value="client_name">Client Name</option>
                  <option value="challan_number">Challan Number</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Challans List */}
        <div className="space-y-4">
          {activeTab === 'udhar' ? (
            filteredAndSortedUdharChallans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No udhar challans found</p>
              </div>
            ) : (
              filteredAndSortedUdharChallans.map((challan) => (
                <UdharChallanCard
                  key={challan.id}
                  challan={challan}
                  onDownload={() => handleDownloadChallan(challan, 'udhar')}
                  onDelete={() => handleDeleteUdharChallan(challan.id)}
                  downloading={downloading === `udhar-${challan.id}`}
                  expanded={expandedChallan === `udhar-${challan.id}`}
                  onToggleExpand={() => toggleChallanExpansion(`udhar-${challan.id}`)}
                  isAdmin={user?.isAdmin || false}
                />
              ))
            )
          ) : (
            filteredAndSortedJamaChallans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <RotateCcw className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No jama challans found</p>
              </div>
            ) : (
              filteredAndSortedJamaChallans.map((challan) => (
                <JamaChallanCard
                  key={challan.id}
                  challan={challan}
                  onDownload={() => handleDownloadChallan(challan, 'jama')}
                  onDelete={() => handleDeleteJamaChallan(challan.id)}
                  downloading={downloading === `jama-${challan.id}`}
                  expanded={expandedChallan === `jama-${challan.id}`}
                  onToggleExpand={() => toggleChallanExpansion(`jama-${challan.id}`)}
                  isAdmin={user?.isAdmin || false}
                />
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}

// Udhar Challan Card Component
interface UdharChallanCardProps {
  challan: ChallanWithItems
  onDownload: () => void
  onDelete: () => void
  downloading: boolean
  expanded: boolean
  onToggleExpand: () => void
  isAdmin: boolean
}

function UdharChallanCard({ challan, onDownload, onDelete, downloading, expanded, onToggleExpand, isAdmin }: UdharChallanCardProps) {
  const totalQuantity = challan.challan_items.reduce((sum, item) => sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0)
  const daysAgo = Math.floor((new Date().getTime() - new Date(challan.challan_date).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">#{challan.challan_number}</h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(challan.challan_date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {totalQuantity} plates
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {daysAgo} days ago
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              challan.status === 'active' 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {challan.status === 'active' ? 'Active' : 'Completed'}
            </span>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
              disabled={downloading}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Client Details */}
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Client Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Hash className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">ID:</span>
                <span className="font-medium">{challan.client.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{challan.client.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">Site:</span>
                <span className="font-medium">{challan.client.site}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">Mobile:</span>
                <span className="font-medium">{challan.client.mobile_number}</span>
              </div>
              {challan.driver_name && (
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">Driver:</span>
                  <span className="font-medium">{challan.driver_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Plate Details */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-600" />
              Plate Details
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Plate Size</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Own Stock</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Borrowed Stock</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {challan.challan_items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-3 py-2 font-medium">{item.plate_size}</td>
                      <td className="px-3 py-2 text-center">{item.borrowed_quantity}</td>
                      <td className="px-3 py-2 text-center text-red-600 font-medium">
                        {item.borrowed_stock || 0}
                      </td>
                      <td className="px-3 py-2 text-center font-bold">
                        {item.borrowed_quantity + (item.borrowed_stock || 0)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {item.partner_stock_notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Jama Challan Card Component
interface JamaChallanCardProps {
  challan: ReturnWithItems
  onDownload: () => void
  onDelete: () => void
  downloading: boolean
  expanded: boolean
  onToggleExpand: () => void
  isAdmin: boolean
}

function JamaChallanCard({ challan, onDownload, onDelete, downloading, expanded, onToggleExpand, isAdmin }: JamaChallanCardProps) {
  const totalQuantity = challan.return_line_items.reduce((sum, item) => 
    sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
  )
  const daysAgo = Math.floor((new Date().getTime() - new Date(challan.return_date).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <RotateCcw className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">#{challan.return_challan_number}</h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(challan.return_date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {totalQuantity} plates
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {daysAgo} days ago
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              Returned
            </span>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
              disabled={downloading}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Client Details */}
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Client Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Hash className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">ID:</span>
                <span className="font-medium">{challan.client.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{challan.client.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">Site:</span>
                <span className="font-medium">{challan.client.site}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">Mobile:</span>
                <span className="font-medium">{challan.client.mobile_number}</span>
              </div>
              {challan.driver_name && (
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-600">Driver:</span>
                  <span className="font-medium">{challan.driver_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Plate Details */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-600" />
              Plate Details
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Plate Size</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Own Stock</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Borrowed Stock</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Damaged</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Lost</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {challan.return_line_items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-3 py-2 font-medium">{item.plate_size}</td>
                      <td className="px-3 py-2 text-center">{item.returned_quantity}</td>
                      <td className="px-3 py-2 text-center text-purple-600 font-medium">
                        {item.returned_borrowed_stock || 0}
                      </td>
                      <td className="px-3 py-2 text-center text-red-600">
                        {item.damaged_quantity || 0}
                      </td>
                      <td className="px-3 py-2 text-center text-red-600">
                        {item.lost_quantity || 0}
                      </td>
                      <td className="px-3 py-2 text-center font-bold">
                        {item.returned_quantity + (item.returned_borrowed_stock || 0)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {item.damage_notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}