import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface LedgerEntry {
  date: string;
  effective_date: string;
  plates_before: number;
  udhar: number;
  jama: number;
  balance_after: number;
  entry_type: 'udhar' | 'jama';
  challan_number: string;
  sort_priority: number;
}

export interface DateRangeBilling {
  start_date: string;
  end_date: string;
  plate_balance: number;
  days: number;
  rent_amount: number;
  entry_info?: string;
}

export interface BillingRates {
  daily_rent_rate: number;
  service_charge_percentage: number; // Changed back to percentage for compatibility
}

export interface ExtraCharge {
  note: string;
  date: string;
  item_count: number;
  price: number;
  total: number;
}

export interface Discount {
  note: string;
  date: string;
  item_count: number;
  price: number;
  total: number;
}

export interface Payment {
  note: string;
  date: string;
  payment_amount: number;
}

export interface ComprehensiveBillData {
  client: Client;
  bill_number: string;
  bill_date: string;
  ledger_entries: LedgerEntry[];
  date_ranges: DateRangeBilling[];
  
  // Dynamic total plates calculation
  total_plates_udhar: number; // Total udhar plates
  total_plates_jama: number; // Total jama plates
  total_plates: number; // Net plates (udhar - jama) - EDITABLE
  total_udhar: number; // Rent calculation from date ranges
  
  // Dynamic service charge with per-plate rate
  service_rate_per_plate: number; // Rate per plate (₹/plate) - EDITABLE
  service_charge_percentage: number; // For display compatibility
  service_charge: number; // total_plates × service_rate_per_plate - EDITABLE
  
  // User-defined sections
  extra_charges: ExtraCharge[];
  extra_charges_total: number;
  discounts: Discount[];
  discounts_total: number;
  payments: Payment[];
  payments_total: number;
  
  // Final calculations
  grand_total: number;
  advance_paid: number;
  final_due: number;
  balance_carry_forward: number;
  
  // Account closure option
  account_closure: 'close' | 'continue';
  
  rates: BillingRates;
}

export class ComprehensiveBillingCalculator {
  private defaultRates: BillingRates = {
    daily_rent_rate: 1.00,
    service_charge_percentage: 10.0 // Keep for compatibility
  };

  constructor(rates?: Partial<BillingRates>) {
    if (rates) {
      this.defaultRates = { ...this.defaultRates, ...rates };
    }
  }

  async fetchClientLedgerData(clientId: string, startDate?: string, endDate?: string) {
    try {
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
    advancePaid: number = 0,
    extraCharges: ExtraCharge[] = [],
    discounts: Discount[] = [],
    payments: Payment[] = [],
    overrideTotalPlates?: number,
    overrideServiceCharge?: number,
    serviceRatePerPlate: number = 10.0, // Default ₹10 per plate
    accountClosure: 'close' | 'continue' = 'continue'
  ): ComprehensiveBillData {
    const finalRates = { ...this.defaultRates, ...rates };

    // Step 1: Create all entries and sort by date
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
        effective_date: challan.challan_date,
        type: 'udhar',
        plates: totalPlates,
        challan_number: challan.challan_number,
        sort_priority: 1
      });
    });

    // Add jama entries
    returns.forEach(returnRecord => {
      const totalPlates = returnRecord.return_line_items.reduce((sum: number, item: any) => 
        sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0
      );
      
      const jamaDate = new Date(returnRecord.return_date);
      const effectiveDate = new Date(jamaDate);
      effectiveDate.setDate(effectiveDate.getDate() + 1);
      
      allEntries.push({
        date: returnRecord.return_date,
        effective_date: effectiveDate.toISOString().split('T')[0],
        type: 'jama',
        plates: totalPlates,
        challan_number: returnRecord.return_challan_number,
        sort_priority: 2
      });
    });

    // Sort entries by date, then by priority
    allEntries.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare === 0) {
        return a.sort_priority - b.sort_priority;
      }
      return dateCompare;
    });

    // Step 2: Build ledger entries
    const ledgerEntries: LedgerEntry[] = [];
    let currentBalance = 0;

    allEntries.forEach(entry => {
      const platesBefore = currentBalance;
      
      if (entry.type === 'udhar') {
        currentBalance += entry.plates;
      }
      
      ledgerEntries.push({
        date: entry.date,
        effective_date: entry.effective_date,
        plates_before: platesBefore,
        udhar: entry.type === 'udhar' ? entry.plates : 0,
        jama: entry.type === 'jama' ? entry.plates : 0,
        balance_after: entry.type === 'udhar' ? currentBalance : platesBefore,
        entry_type: entry.type,
        challan_number: entry.challan_number,
        sort_priority: entry.sort_priority
      });
    });

    // Step 3: Calculate date ranges for billing
    const dateRanges: DateRangeBilling[] = [];
    let effectiveBalance = 0;

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

    effectiveEntries.sort((a, b) => 
      new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
    );

    // Calculate billing ranges
    for (let i = 0; i < effectiveEntries.length; i++) {
      const currentEntry = effectiveEntries[i];
      const nextEntry = effectiveEntries[i + 1];
      
      effectiveBalance += currentEntry.balance_change;
      
      let startDate = currentEntry.effective_date;
      let endDate: string;
      let days: number;

      if (nextEntry) {
        const nextDate = new Date(nextEntry.effective_date);
        const endDateObj = new Date(nextDate);
        endDateObj.setDate(endDateObj.getDate() - 1);
        endDate = endDateObj.toISOString().split('T')[0];
        
        const currentDate = new Date(currentEntry.effective_date);
        days = Math.ceil((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        endDate = billDate;
        const currentDate = new Date(currentEntry.effective_date);
        const billDateObj = new Date(billDate);
        days = Math.ceil((billDateObj.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

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

    // Step 4: Calculate dynamic totals
    const totalUdhar = dateRanges.reduce((sum, range) => sum + range.rent_amount, 0);
    
    // Calculate total plates (udhar - jama) - DYNAMIC AND EDITABLE
    const totalPlatesUdhar = allEntries
      .filter(entry => entry.type === 'udhar')
      .reduce((sum, entry) => sum + entry.plates, 0);
    
    const totalPlatesJama = allEntries
      .filter(entry => entry.type === 'jama')
      .reduce((sum, entry) => sum + entry.plates, 0);
    
    const calculatedTotalPlates = totalPlatesUdhar - totalPlatesJama;
    const totalPlates = overrideTotalPlates !== undefined ? overrideTotalPlates : calculatedTotalPlates;
    
    // Calculate service charge based on total udhar plates
    const calculatedServiceCharge = totalPlatesUdhar * serviceRatePerPlate;
    const serviceCharge = overrideServiceCharge !== undefined ? overrideServiceCharge : calculatedServiceCharge;
    
    // Calculate totals for other sections
    const extraChargesTotal = extraCharges.reduce((sum, charge) => sum + charge.total, 0);
    const discountsTotal = discounts.reduce((sum, discount) => sum + discount.total, 0);
    const paymentsTotal = payments.reduce((sum, payment) => sum + payment.payment_amount, 0);

    // Final calculation
    const grandTotal = totalUdhar + serviceCharge + extraChargesTotal;
    const finalDue = grandTotal - discountsTotal - advancePaid - paymentsTotal;
    const balanceCarryForward = finalDue < 0 ? Math.abs(finalDue) : 0;

    return {
      client,
      bill_number: '',
      bill_date: billDate,
      ledger_entries: ledgerEntries,
      date_ranges: dateRanges,
      total_plates_udhar: totalPlatesUdhar,
      total_plates_jama: totalPlatesJama,
      total_plates: totalPlates,
      total_udhar: totalUdhar,
      service_rate_per_plate: serviceRatePerPlate,
      service_charge_percentage: finalRates.service_charge_percentage, // Keep for compatibility
      service_charge: serviceCharge,
      extra_charges: extraCharges,
      extra_charges_total: extraChargesTotal,
      discounts: discounts,
      discounts_total: discountsTotal,
      payments: payments,
      payments_total: paymentsTotal,
      grand_total: grandTotal,
      advance_paid: advancePaid,
      final_due: Math.max(0, finalDue),
      balance_carry_forward: balanceCarryForward,
      account_closure: accountClosure,
      rates: finalRates
    };
  }

  async generateNextBillNumber(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('bill_number')
        .order('bill_number', { ascending: false })
        .limit(1);

      if (error && error.code === '42P01') {
        return 'BILL-0001';
      }

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastBillNumber = data[0].bill_number;
        // Extract numeric part from bill number (e.g., "BILL-0005" -> 5)
        const match = lastBillNumber.match(/BILL-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
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