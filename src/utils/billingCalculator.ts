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

  async getLastBillEndDate(clientId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('billing_period_end')
        .eq('client_id', clientId)
        .order('billing_period_end', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0].billing_period_end : null;
    } catch (error) {
      console.error('Error fetching last bill end date:', error);
      return null;
    }
  }

  async getFirstTransactionDate(clientId: string): Promise<string | null> {
    try {
      const { data: challans } = await supabase
        .from('challans')
        .select('challan_date')
        .eq('client_id', clientId)
        .order('challan_date', { ascending: true })
        .limit(1);

      const { data: returns } = await supabase
        .from('returns')
        .select('return_date')
        .eq('client_id', clientId)
        .order('return_date', { ascending: true })
        .limit(1);

      const dates = [
        ...(challans || []).map(c => c.challan_date),
        ...(returns || []).map(r => r.return_date)
      ].sort();

      return dates.length > 0 ? dates[0] : null;
    } catch (error) {
      console.error('Error fetching first transaction date:', error);
      return null;
    }
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

    // Add period start as first date
    const allDates = [
      periodStart,
      ...transactions.map(t => t.date),
      periodEnd
    ].sort();

    // Remove duplicates
    const uniqueDates = [...new Set(allDates)];

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
        runningStock -= transactionTotal;
      }

      // Calculate period until next transaction (or end date)
      const nextDate = i < transactions.length - 1 
        ? transactions[i + 1].date 
        : periodEnd;

      const fromDate = transactionDate;
      const toDate = nextDate;
      
      // Calculate days (exclusive of start date, inclusive of end date)
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
      net_due: totalAmount // Will be adjusted for previous payments
    };
  }

  async getPreviousPayments(clientId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('bill_payments')
        .select(`
          amount,
          bills!inner(client_id)
        `)
        .eq('bills.client_id', clientId);

      if (error) throw error;
      
      return (data || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
    } catch (error) {
      console.error('Error fetching previous payments:', error);
      return 0;
    }
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
        const match = lastBillNumber.match(/(\d+)$/);
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

  async calculateClientBilling(
    clientId: string,
    endDate: string,
    dailyRate?: number,
    serviceRate?: number
  ): Promise<BillingCalculation> {
    // Update rates if provided
    if (dailyRate !== undefined) this.dailyRate = dailyRate;
    if (serviceRate !== undefined) this.serviceRate = serviceRate;

    // Determine start date
    const lastBillEndDate = await this.getLastBillEndDate(clientId);
    const firstTransactionDate = await this.getFirstTransactionDate(clientId);
    
    let startDate: string;
    if (lastBillEndDate) {
      // Start from day after last bill
      const nextDay = new Date(lastBillEndDate);
      nextDay.setDate(nextDay.getDate() + 1);
      startDate = nextDay.toISOString().split('T')[0];
    } else if (firstTransactionDate) {
      startDate = firstTransactionDate;
    } else {
      // No transactions, use end date as start date
      startDate = endDate;
    }

    // Fetch transactions for the period
    const transactions = await this.fetchTransactions(clientId, startDate, endDate);

    // Calculate billing
    const calculation = this.calculateBilling(transactions, startDate, endDate);

    // Get previous payments
    const previousPayments = await this.getPreviousPayments(clientId);

    return {
      client_id: clientId,
      ...calculation,
      previous_payments: previousPayments,
      net_due: calculation.total_amount - previousPayments
    };
  }
}