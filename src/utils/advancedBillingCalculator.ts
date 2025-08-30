import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface BillingEntry {
  date: string;
  plate_balance: number;
  entry_type: 'udhar' | 'jama';
  challan_number: string;
  running_balance: number;
}

export interface DateRangeBilling {
  start_date: string;
  end_date: string;
  plate_balance: number;
  days: number;
  rate_per_day: number;
  amount: number;
  entry_type: 'range' | 'single';
}

export interface AdvancedBillData {
  client: Client;
  bill_number: string;
  bill_date: string;
  billing_entries: BillingEntry[];
  date_ranges: DateRangeBilling[];
  subtotal: number;
  adjustments: number;
  grand_total: number;
  total_days: number;
  total_plate_days: number;
  rate_per_day: number;
}

export interface BillAdjustment {
  description: string;
  amount: number;
  type: 'charge' | 'discount';
}

export class AdvancedBillingCalculator {
  private defaultRate: number;

  constructor(defaultRate: number = 2.00) {
    this.defaultRate = defaultRate;
  }

  setDefaultRate(rate: number) {
    this.defaultRate = rate;
  }

  async fetchClientTransactions(clientId: string, startDate?: string, endDate?: string) {
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
      console.error('Error fetching client transactions:', error);
      throw error;
    }
  }

  calculateDateRangeBilling(
    client: Client,
    challans: any[],
    returns: any[],
    billDate: string,
    ratePerDay: number = this.defaultRate,
    adjustments: BillAdjustment[] = []
  ): AdvancedBillData {
    // Create chronological entries with running balance
    const allEntries: BillingEntry[] = [];
    let runningBalance = 0;

    // Process udhar entries
    challans.forEach(challan => {
      const totalPlates = challan.challan_items.reduce((sum: number, item: any) => 
        sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0
      );
      
      runningBalance += totalPlates;
      
      allEntries.push({
        date: challan.challan_date,
        plate_balance: totalPlates,
        entry_type: 'udhar',
        challan_number: challan.challan_number,
        running_balance: runningBalance
      });
    });

    // Process jama entries
    returns.forEach(returnRecord => {
      const totalPlates = returnRecord.return_line_items.reduce((sum: number, item: any) => 
        sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
      );
      
      runningBalance -= totalPlates;
      
      allEntries.push({
        date: returnRecord.return_date,
        plate_balance: -totalPlates, // Negative for returns
        entry_type: 'jama',
        challan_number: returnRecord.return_challan_number,
        running_balance: runningBalance
      });
    });

    // Sort all entries by date
    allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate date ranges according to your billing logic
    const dateRanges: DateRangeBilling[] = [];
    let totalDays = 0;
    let totalPlatedays = 0;

    for (let i = 0; i < allEntries.length; i++) {
      const currentEntry = allEntries[i];
      const nextEntry = allEntries[i + 1];
      
      let startDate = currentEntry.date;
      let endDate: string;
      let days: number;

      if (nextEntry) {
        // Intermediate entry: calculate until one day before next entry
        const nextDate = new Date(nextEntry.date);
        const endDateObj = new Date(nextDate);
        endDateObj.setDate(endDateObj.getDate() - 1);
        endDate = endDateObj.toISOString().split('T')[0];
        
        // Calculate days between current and next entry
        const currentDate = new Date(currentEntry.date);
        days = Math.ceil((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Last entry: calculate until bill date
        endDate = billDate;
        const currentDate = new Date(currentEntry.date);
        const billDateObj = new Date(billDate);
        days = Math.ceil((billDateObj.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Use running balance at this point for billing
      const plateBalance = currentEntry.running_balance;
      const amount = plateBalance * days * ratePerDay;

      dateRanges.push({
        start_date: startDate,
        end_date: endDate,
        plate_balance: plateBalance,
        days: days,
        rate_per_day: ratePerDay,
        amount: amount,
        entry_type: nextEntry ? 'range' : 'single'
      });

      totalDays += days;
      totalPlatedays += plateBalance * days;
    }

    // Calculate totals
    const subtotal = dateRanges.reduce((sum, range) => sum + range.amount, 0);
    const adjustmentTotal = adjustments.reduce((sum, adj) => 
      sum + (adj.type === 'charge' ? adj.amount : -adj.amount), 0
    );
    const grandTotal = subtotal + adjustmentTotal;

    return {
      client,
      bill_number: '', // Will be set by caller
      bill_date: billDate,
      billing_entries: allEntries,
      date_ranges: dateRanges,
      subtotal,
      adjustments: adjustmentTotal,
      grand_total: grandTotal,
      total_days: totalDays,
      total_plate_days: totalPlatedays,
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

  formatDateRange(startDate: string, endDate: string): string {
    const start = new Date(startDate).toLocaleDateString('en-GB');
    const end = new Date(endDate).toLocaleDateString('en-GB');
    return startDate === endDate ? start : `${start} - ${end}`;
  }

  calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  }
}