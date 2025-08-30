import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, UserWithRole } from './hooks/useAuth'
import { AuthForm } from './components/AuthForm'
import { MobileLayout } from './components/MobileLayout'
import { MobileDashboard } from './components/MobileDashboard'
import { MobileIssueRental } from './components/MobileIssueRental'
import { MobileReturnRental } from './components/MobileReturnRental'
import { MobileClientsPage } from './components/MobileClientsPage'
import { MobileStockPage } from './components/MobileStockPage'
import { MobileLedgerPage } from './components/mobile/MobileLedgerPage'
import { ChallanManagementPage } from './components/ChallanManagementPage'
import { MobileBillingPage } from './components/MobileBillingPage'
import { LanguageProvider } from './contexts/LanguageContext'
import { Loader2 } from 'lucide-react'

function App() {
  const { user, loading } = useAuth()
  const [authMode, setAuthMode] = React.useState<'signin' | 'signup'>('signin')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 font-gujarati">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="font-medium text-gray-700">લોડ થઈ રહ્યું છે...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm mode={authMode} onModeChange={setAuthMode} />;
  }

  return (
    <LanguageProvider>
      <MobileLayout>
        <Routes>
          <Route path="/" element={<MobileDashboard />} />
          <Route path="/issue" element={<MobileIssueRental />} />
          <Route path="/return" element={<MobileReturnRental />} />
          <Route path="/clients" element={<MobileClientsPage />} />
          <Route path="/stock" element={<MobileStockPage />} />
          <Route path="/ledger" element={<MobileLedgerPage />} />
          <Route path="/challans" element={<ChallanManagementPage />} />
          <Route path="/bills" element={<MobileBillingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MobileLayout>
    </LanguageProvider>
  )
}

export default App;
