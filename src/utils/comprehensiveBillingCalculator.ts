import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface LedgerEntry {
  date: string;
  effective_date: string; // When the entry actually affects balance
  plates_before: number; // NEW: Balance before this entry
  udhar: number; // Issued plates
  jama: number;  // Returned plates
  balance_after: number; // Balance after applying this entry
  entry_type: 'udhar' | 'jama';
  challan_number: string;
  sort_priority: number; // For same-day sorting (udhar=1, jama=2)
}

export interface DateRangeBilling {
  start_date: string;
  end_date: string;
  plate_balance: number;
  days: number;
  rent_amount: number;
  entry_info?: string; // Additional info about the entry
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
            returned_borrowed_stock,
            damaged_quantity,
            lost_quantity
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

    // Step 1: Create all entries and sort by date ascending
    const allEntries: Array<{
      date: string;
      effective_date: string;
      type: 'udhar' | 'jama';
      plates: number;
      challan_number: string;
      sort_priority: number;
    }> = [];

    // Add udhar entries
    challans.forEach(challan => {
      const totalPlates = challan.challan_items.reduce((sum: number, item: any) => 
        sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0
      );
      
      allEntries.push({
        date: challan.challan_date,
        effective_date: challan.challan_date, // Udhar effective same day
        type: 'udhar',
        plates: totalPlates,
        challan_number: challan.challan_number,
        sort_priority: 1 // Udhar first if same day
      });
    });

    // Add jama entries
    returns.forEach(returnRecord => {
      const totalPlates = returnRecord.return_line_items.reduce((sum: number, item: any) => 
        sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
      );
      
      // Calculate effective date (next day for jama)
      const jamaDate = new Date(returnRecord.return_date);
      const effectiveDate = new Date(jamaDate);
      effectiveDate.setDate(effectiveDate.getDate() + 1);
      
      allEntries.push({
        date: returnRecord.return_date,
        effective_date: effectiveDate.toISOString().split('T')[0], // Jama effective next day
        type: 'jama',
        plates: totalPlates,
        challan_number: returnRecord.return_challan_number,
        sort_priority: 2 // Jama second if same day
      });
    });

    // Step 2: Sort entries by date ascending, then by priority (udhar before jama)
    allEntries.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare === 0) {
        return a.sort_priority - b.sort_priority; // Udhar before jama on same day
      }
      return dateCompare;
    });

    // Step 3: Build ledger entries with પ્લેટ્સ column
    const ledgerEntries: LedgerEntry[] = [];
    let currentBalance = 0;

    allEntries.forEach(entry => {
      const platesBefore = currentBalance; // Balance before this entry
      
      // Apply balance change based on entry type
      if (entry.type === 'udhar') {
        currentBalance += entry.plates; // Udhar increases balance immediately
      }
      // Note: Jama doesn't change currentBalance here since it's effective next day
      
      ledgerEntries.push({
        date: entry.date,
        effective_date: entry.effective_date,
        plates_before: platesBefore,
        udhar: entry.type === 'udhar' ? entry.plates : 0,
        jama: entry.type === 'jama' ? entry.plates : 0,
        balance_after: entry.type === 'udhar' ? currentBalance : platesBefore, // Show balance after udhar, before for jama
        entry_type: entry.type,
        challan_number: entry.challan_number,
        sort_priority: entry.sort_priority
      });
    });

    // Step 4: Calculate date ranges for billing using effective dates
    const dateRanges: DateRangeBilling[] = [];
    let effectiveBalance = 0;

    // Create a timeline of effective balance changes
    const effectiveEntries: Array<{
      effective_date: string;
      balance_change: number;
      entry_info: string;
    }> = [];

    allEntries.forEach(entry => {
      if (entry.type === 'udhar') {
        effectiveEntries.push({
          effective_date: entry.effective_date,
          balance_change: entry.plates,
          entry_info: `Udhar ${entry.plates} plates`
        });
      } else {
        effectiveEntries.push({
          effective_date: entry.effective_date,
          balance_change: -entry.plates,
          entry_info: `Jama ${entry.plates} plates (from ${entry.date})`
        });
      }
    });

    // Sort effective entries by effective date
    effectiveEntries.sort((a, b) => 
      new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
    );

    // Calculate billing ranges
    for (let i = 0; i < effectiveEntries.length; i++) {
      const currentEntry = effectiveEntries[i];
      const nextEntry = effectiveEntries[i + 1];
      
      // Apply balance change
      effectiveBalance += currentEntry.balance_change;
      
      let startDate = currentEntry.effective_date;
      let endDate: string;
      let days: number;

      if (nextEntry) {
        // Calculate until the day before next entry's effective date
        const nextDate = new Date(nextEntry.effective_date);
        const endDateObj = new Date(nextDate);
        endDateObj.setDate(endDateObj.getDate() - 1);
        endDate = endDateObj.toISOString().split('T')[0];
        
        // Calculate days between current effective date and next effective date
        const currentDate = new Date(currentEntry.effective_date);
        days = Math.ceil((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Last entry: calculate until bill date
        endDate = billDate;
        const currentDate = new Date(currentEntry.effective_date);
        const billDateObj = new Date(billDate);
        days = Math.ceil((billDateObj.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      // Only add range if there are days to bill and balance > 0
      if (days > 0 && effectiveBalance > 0) {
        const rentAmount = effectiveBalance * days * finalRates.daily_rent_rate;

        dateRanges.push({
          start_date: startDate,
          end_date: endDate,
          plate_balance: effectiveBalance,
          days: days,
          rent_amount: rentAmount,
          entry_info: currentEntry.entry_info
        });
      }
    }

    // Step 5: Calculate totals
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

    // Calculate lost plates (including damaged and lost from returns)
    const totalDamagedAndLost = returns.reduce((sum, returnRecord) => {
      return sum + returnRecord.return_line_items.reduce((itemSum: number, item: any) => 
        itemSum + (item.damaged_quantity || 0) + (item.lost_quantity || 0), 0
      );
    }, 0);

    const lostPlatesCount = Math.max(0, totalPlatesIssued - totalPlatesReturned + totalDamagedAndLost);

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
      ledger_entries: ledgerEntries,
      date_ranges: dateRanges,
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
      // Check if bills table exists, if not use a simple counter
      const { data, error } = await supabase
        .from('bills')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      if (error && error.code === '42P01') {
        // Table doesn't exist, start from 1
        return 'BILL-0001';
      }

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        nextNumber = data.length + 1;
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