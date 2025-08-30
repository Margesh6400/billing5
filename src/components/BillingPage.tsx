import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { BillManagement } from './billing/BillManagement';
import { 
  Receipt, 
  Search, 
  User, 
  Calendar, 
  DollarSign, 
  Download, 
  Plus, 
  Lock,
  Calculator,
  FileText,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { BillingCalculator, BillingCalculation } from '../utils/billingCalculator';
type Client = Database['public']['Tables']['clients']['Row'];
export function BillingPage() {
  const { user } = useAuth();
  return <BillManagement />;
}