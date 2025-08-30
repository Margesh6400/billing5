@@ .. @@
 import React, { useState, useEffect } from 'react';
-import { supabase } from '../../lib/supabase';
-import { Database } from '../../lib/supabase';
-import { useAuth } from '../../hooks/useAuth';
-import { BillingCalculator, BillingCalculation } from '../../utils/billingCalculator';
-import { 
-  Receipt, 
-  Search, 
-  User, 
-  Calendar, 
-  DollarSign, 
-  Download, 
-  Plus, 
-  Lock,
-  Calculator,
-  FileText,
-  CreditCard,
-  CheckCircle,
-  Clock,
-  AlertTriangle
-} from 'lucide-react';
+import { SimpleBillManagement } from './SimpleBillManagement';
 
-
-type Client = Database['public']['Tables']['clients']['Row'];
-
 export function BillManagement() {
-  const { user } = useAuth();
-  return <BillManagement />;
+  return <SimpleBillManagement />;
 }