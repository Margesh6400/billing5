@@ .. @@
 import { LedgerPage } from './components/LedgerPage'
 import { StockPage } from './components/StockPage'
 import { BillingPage } from './components/BillingPage'
+import { PartnerStockPage } from './components/PartnerStockPage'
 import { ChallanManagementPage } from './components/ChallanManagementPage'
 import { BillManagementPage } from './components/BillManagementPage'
 import { Loader2 } from 'lucide-react'
@@ .. @@
         <Route path="/return" element={<ReturnPage />} />
         <Route path="/ledger" element={<LedgerPage />} />
         <Route path="/stock" element={<StockPage />} />
+        <Route path="/partner-stock" element={<PartnerStockPage />} />
         <Route path="/billing" element={<BillingPage />} />
         <Route path="/challans" element={<ChallanManagementPage />} />
         <Route path="/bills" element={<BillManagementPage />} />
         <Route path="*" element={<Navigate to="/" replace />} />
       </Route>
     </Routes>