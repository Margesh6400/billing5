import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { BillManagement } from './billing/BillManagement';
import { 
  Receipt, 
  Search, 
  User, 
  Calculator,
  Download,
  Plus,
  Lock,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';


export function MobileBillingPage() {
  return <BillManagement />;
}