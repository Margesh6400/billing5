import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface Transaction {
  type: 'udhar' | 'jama';
  date: string;
  challan_number: string;
  items: Array<{
    plate_size: string;
    quantity: number;
    borrowed_stock?: number;
    returned_borrowed_stock?: number;
  }>;
}

export interface BillingPeriod {
  from_date: string;
  to_date: string;
  days: number;
  running_stock: number;
  daily_rate: number;
  charge: number;
}

export interface BillingCalculation {
  client_id: string;
  period_start: string;
  period_end: string;
  transactions: Transaction[];
  billing_periods: BillingPeriod[];
  total_udhar_quantity: number;
  service_charge: number;
  period_charges: number;
  total_amount: number;
  previous_payments: number;
  net_due: number;
}

export class BillingCalculator {
  private dailyRate: number;
  private serviceRate: number;

  constructor(dailyRate: number = 1.00, serviceRate: number = 0.50) {
    this.dailyRate = dailyRate;
    this.serviceRate = serviceRate;
  }

  async fetchTransactions(clientId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    try {
      // Fetch challans (udhar)
      const { data: challans, error: challansError } = await supabase
        .from('challans')
        .select(`
          challan_number,
          challan_date,
          challan_items (
            plate_size,
            borrowed_quantity,
            borrowed_stock
          )
        `)
        .eq('client_id', clientId)
        .gte('challan_date', startDate)
        .lte('challan_date', endDate)
        .order('challan_date');

      if (challansError) throw challansError;

      // Fetch returns (jama)
      const { data: returns, error: returnsError } = await supabase
        .from('returns')
        .select(`
          return_challan_number,
          return_date,
          return_line_items (
            plate_size,
            returned_quantity,
            returned_borrowed_stock
          )
        `)
        .eq('client_id', clientId)
        .gte('return_date', startDate)
        .lte('return_date', endDate)
        .order('return_date');

      if (returnsError) throw returnsError;

      const transactions: Transaction[] = [
        ...(challans || []).map(challan => ({
          type: 'udhar' as const,
          date: challan.challan_date,
          challan_number: challan.challan_number,
          items: challan.challan_items.map(item => ({
            plate_size: item.plate_size,
            quantity: item.borrowed_quantity,
            borrowed_stock: item.borrowed_stock || 0
          }))
        })),
        ...(returns || []).map(returnRecord => ({
          type: 'jama' as const,
          date: returnRecord.return_date,
          challan_number: returnRecord.return_challan_number,
          items: returnRecord.return_line_items.map(item => ({
            plate_size: item.plate_size,
            quantity: item.returned_quantity,
            returned_borrowed_stock: item.returned_borrowed_stock || 0
          }))
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  calculateBilling(
    transactions: Transaction[],
    periodStart: string,
    periodEnd: string
  ): Omit<BillingCalculation, 'client_id' | 'previous_payments'> {
    const billingPeriods: BillingPeriod[] = [];
    let runningStock = 0;
    let totalUdharQuantity = 0;

    // Process transactions chronologically
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const transactionDate = transaction.date;
      
      // Update running stock based on transaction
      const transactionTotal = transaction.items.reduce((sum, item) => {
        const regularQty = item.quantity || 0;
        const borrowedQty = transaction.type === 'udhar' 
          ? (item.borrowed_stock || 0)
          : (item.returned_borrowed_stock || 0);
        return sum + regularQty + borrowedQty;
      }, 0);

      if (transaction.type === 'udhar') {
        runningStock += transactionTotal;
        totalUdharQuantity += transactionTotal;
      } else {
        runningStock = Math.max(0, runningStock - transactionTotal);
      }

      // Calculate period until next transaction (or end date)
      const nextDate = i < transactions.length - 1 
        ? transactions[i + 1].date 
        : periodEnd;

      const fromDate = transactionDate;
      const toDate = nextDate;
      
      // Calculate days
      const daysDiff = Math.floor(
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 0 && runningStock > 0) {
        const charge = runningStock * daysDiff * this.dailyRate;
        
        billingPeriods.push({
          from_date: fromDate,
          to_date: toDate,
          days: daysDiff,
          running_stock: runningStock,
          daily_rate: this.dailyRate,
          charge: charge
        });
      }
    }

    // Calculate totals
    const periodCharges = billingPeriods.reduce((sum, period) => sum + period.charge, 0);
    const serviceCharge = totalUdharQuantity * this.serviceRate;
    const totalAmount = periodCharges + serviceCharge;

    return {
      period_start: periodStart,
      period_end: periodEnd,
      transactions,
      billing_periods: billingPeriods,
      total_udhar_quantity: totalUdharQuantity,
      service_charge: serviceCharge,
      period_charges: periodCharges,
      total_amount: totalAmount,
      net_due: totalAmount
    };
  }

  async generateNextBillNumber(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('bill_number')
        .order('generated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastBillNumber = data[0].bill_number;
        const match = lastBillNumber.match(/BILL-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return `BILL-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating bill number:', error);
      return `BILL-${Date.now().toString().slice(-4)}`;
    }
  }
}