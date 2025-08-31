import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface DailyBalance {
  date: string;
  plate_balance: number;
  days_count: number;
  rate_per_day: number;
  amount: number;
}

export interface SimpleBillData {
  client: Client;
  bill_number: string;
  bill_date: string;
  daily_balances: DailyBalance[];
  subtotal: number;
  extra_charges: number;
  discounts: number;
  grand_total: number;
  total_plates: number;
  total_days: number;
  rate_per_day: number;
}

export interface ExtraCharge {
  description: string;
  amount: number;
}

export interface Discount {
  description: string;
  amount: number;
}

export class SimpleBillingCalculator {
  private defaultRate: number;

  constructor(defaultRate: number = 1.00) {
    this.defaultRate = defaultRate;
  }

  setDefaultRate(rate: number) {
    this.defaultRate = rate;
  }

  async fetchClientLedgerData(clientId: string, startDate?: string, endDate?: string) {
    try {
      // Fetch all challans for the client
      const { data: challans, error: challansError } = await supabase
        .from('challans')
        .select(`
          id,
          challan_number,
          challan_date,
          client_id,
          challan_items (
            id,
            plate_size,
            borrowed_quantity,
            borrowed_stock
          )
        `)
        .eq('client_id', clientId)
        .gte('challan_date', startDate || '1900-01-01')
        .lte('challan_date', endDate || '2100-12-31')
        .order('challan_date');

      if (challansError) throw challansError;

      // Fetch all returns for the client
      const { data: returns, error: returnsError } = await supabase
        .from('returns')
        .select(`
          id,
          return_challan_number,
          return_date,
          client_id,
          return_line_items (
            id,
            plate_size,
            returned_quantity,
            returned_borrowed_stock
          )
        `)
        .eq('client_id', clientId)
        .gte('return_date', startDate || '1900-01-01')
        .lte('return_date', endDate || '2100-12-31')
        .order('return_date');

      if (returnsError) throw returnsError;

      return { challans: challans || [], returns: returns || [] };
    } catch (error) {
      console.error('Error fetching client ledger data:', error);
      throw error;
    }
  }

  calculateSimpleBilling(
    client: Client,
    challans: any[],
    returns: any[],
    billDate: string,
    ratePerDay: number = this.defaultRate,
    extraCharges: ExtraCharge[] = [],
    discounts: Discount[] = []
  ): SimpleBillData {
    // Create a map of all transaction dates with running plate balance
    const dateBalanceMap = new Map<string, number>();
    
    // Process all transactions chronologically
    const allTransactions: Array<{
      date: string;
      type: 'udhar' | 'jama';
      plates: number;
    }> = [];

    // Add udhar transactions
    challans.forEach(challan => {
      const totalPlates = challan.challan_items.reduce((sum: number, item: any) => 
        sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0
      );
      allTransactions.push({
        date: challan.challan_date,
        type: 'udhar',
        plates: totalPlates
      });
    });

    // Add jama transactions
    returns.forEach(returnRecord => {
      const totalPlates = returnRecord.return_line_items.reduce((sum: number, item: any) => 
        sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
      );
      allTransactions.push({
        date: returnRecord.return_date,
        type: 'jama',
        plates: totalPlates
      });
    });

    // Sort transactions by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance for each date
    let runningBalance = 0;
    const uniqueDates = new Set<string>();

    allTransactions.forEach(transaction => {
      uniqueDates.add(transaction.date);
      
      if (transaction.type === 'udhar') {
        runningBalance += transaction.plates;
      } else {
        runningBalance -= transaction.plates;
      }
      
      dateBalanceMap.set(transaction.date, runningBalance);
    });

    // Convert to sorted array of unique dates
    const sortedDates = Array.from(uniqueDates).sort();
    
    // Calculate daily balances according to the rule
    const dailyBalances: DailyBalance[] = [];
    let totalDays = 0;
    let totalPlatesUsed = 0;

    sortedDates.forEach((date, index) => {
      const plateBalance = dateBalanceMap.get(date) || 0;
      
      // First date doesn't count as a billing day (as per rule)
      const daysCount = index === 0 ? 0 : 1;
      const amount = plateBalance * daysCount * ratePerDay;
      
      dailyBalances.push({
        date,
        plate_balance: plateBalance,
        days_count: daysCount,
        rate_per_day: ratePerDay,
        amount
      });

      totalDays += daysCount;
      if (daysCount > 0) {
        totalPlatesUsed += plateBalance;
      }
    });

    // Calculate totals
    const subtotal = dailyBalances.reduce((sum, day) => sum + day.amount, 0);
    const extraChargesTotal = extraCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const discountsTotal = discounts.reduce((sum, discount) => sum + discount.amount, 0);
    const grandTotal = subtotal + extraChargesTotal - discountsTotal;

    return {
      client,
      bill_number: '', // Will be set by caller
      bill_date: billDate,
      daily_balances: dailyBalances,
      subtotal,
      extra_charges: extraChargesTotal,
      discounts: discountsTotal,
      grand_total: grandTotal,
      total_plates: totalPlatesUsed,
      total_days: totalDays,
      rate_per_day: ratePerDay
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