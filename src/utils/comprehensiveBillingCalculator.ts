import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface LedgerEntry {
  date: string;
  udhar: number; // Issued plates
  jama: number;  // Returned plates
  balance: number; // Running balance
  entry_type: 'udhar' | 'jama';
  challan_number: string;
}

export interface DateRangeBilling {
  start_date: string;
  end_date: string;
  plate_balance: number;
  days: number;
  rent_amount: number;
}

export interface BillingRates {
  daily_rent_rate: number;      // ₹1 by default
  service_charge_rate: number;  // ₹7 by default
  worker_charge: number;        // ₹100 by default
  lost_plate_penalty: number;   // ₹250 by default
}

export interface ComprehensiveBillData {
  client: Client;
  bill_number: string;
  bill_date: string;
  ledger_entries: LedgerEntry[];
  date_ranges: DateRangeBilling[];
  
  // Calculations
  total_rent: number;
  total_plates_issued: number;
  service_charge: number;
  worker_charge: number;
  lost_plates_count: number;
  lost_plate_penalty: number;
  grand_total: number;
  advance_paid: number;
  final_due: number;
  
  // Rates used
  rates: BillingRates;
}

export class ComprehensiveBillingCalculator {
  private defaultRates: BillingRates = {
    daily_rent_rate: 1.00,
    service_charge_rate: 7.00,
    worker_charge: 100.00,
    lost_plate_penalty: 250.00
  };

  constructor(rates?: Partial<BillingRates>) {
    if (rates) {
      this.defaultRates = { ...this.defaultRates, ...rates };
    }
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

  calculateComprehensiveBilling(
    client: Client,
    challans: any[],
    returns: any[],
    billDate: string,
    rates: Partial<BillingRates> = {},
    advancePaid: number = 0
  ): ComprehensiveBillData {
    const finalRates = { ...this.defaultRates, ...rates };

    // Step 1: Create ledger entries
    const ledgerEntries: LedgerEntry[] = [];
    let runningBalance = 0;

    // Process udhar entries
    challans.forEach(challan => {
      const totalPlates = challan.challan_items.reduce((sum: number, item: any) => 
        sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0
      );
      
      runningBalance += totalPlates;
      
      ledgerEntries.push({
        date: challan.challan_date,
        udhar: totalPlates,
        jama: 0,
        balance: runningBalance,
        entry_type: 'udhar',
        challan_number: challan.challan_number
      });
    });

    // Process jama entries
    returns.forEach(returnRecord => {
      const totalPlates = returnRecord.return_line_items.reduce((sum: number, item: any) => 
        sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
      );
      
      runningBalance -= totalPlates;
      
      ledgerEntries.push({
        date: returnRecord.return_date,
        udhar: 0,
        jama: totalPlates,
        balance: runningBalance,
        entry_type: 'jama',
        challan_number: returnRecord.return_challan_number
      });
    });

    // Sort all entries by date
    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Step 2: Calculate date ranges for billing
    const dateRanges: DateRangeBilling[] = [];

    for (let i = 0; i < ledgerEntries.length; i++) {
      const currentEntry = ledgerEntries[i];
      const nextEntry = ledgerEntries[i + 1];
      
      let startDate = currentEntry.date;
      let endDate: string;
      let days: number;

      if (nextEntry) {
        // Calculate until the day before next entry
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

      // Use balance at this point for billing
      const plateBalance = currentEntry.balance;
      const rentAmount = plateBalance * days * finalRates.daily_rent_rate;

      dateRanges.push({
        start_date: startDate,
        end_date: endDate,
        plate_balance: plateBalance,
        days: days,
        rent_amount: rentAmount
      });
    }

    // Step 3: Calculate totals
    const totalRent = dateRanges.reduce((sum, range) => sum + range.rent_amount, 0);
    
    // Calculate total plates issued (for service charge)
    const totalPlatesIssued = challans.reduce((sum, challan) => {
      return sum + challan.challan_items.reduce((itemSum: number, item: any) => 
        itemSum + item.borrowed_quantity + (item.borrowed_stock || 0), 0
      );
    }, 0);

    // Calculate total plates returned
    const totalPlatesReturned = returns.reduce((sum, returnRecord) => {
      return sum + returnRecord.return_line_items.reduce((itemSum: number, item: any) => 
        itemSum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
      );
    }, 0);

    // Calculate lost plates
    const lostPlatesCount = Math.max(0, totalPlatesIssued - totalPlatesReturned);

    // Calculate charges
    const serviceCharge = totalPlatesIssued * finalRates.service_charge_rate;
    const workerCharge = finalRates.worker_charge;
    const lostPlatePenalty = lostPlatesCount * finalRates.lost_plate_penalty;

    // Calculate grand total
    const grandTotal = totalRent + serviceCharge + workerCharge + lostPlatePenalty;
    const finalDue = grandTotal - advancePaid;

    return {
      client,
      bill_number: '', // Will be set by caller
      bill_date: billDate,
      ledger_entries,
      date_ranges,
      total_rent: totalRent,
      total_plates_issued: totalPlatesIssued,
      service_charge: serviceCharge,
      worker_charge: workerCharge,
      lost_plates_count: lostPlatesCount,
      lost_plate_penalty: lostPlatePenalty,
      grand_total: grandTotal,
      advance_paid: advancePaid,
      final_due: finalDue,
      rates: finalRates
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
    return startDate === endDate ? start : `${start} – ${end}`;
  }

  calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}