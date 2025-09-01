import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface LedgerEntry {
  date: string;
  plates_before: number; // પ્લેટ્સ column - balance before this entry
  udhar: number;
  jama: number;
  balance_after: number; // બાકી પ્લેટ્સ - balance after this entry
  days: number;
  rent_amount: number;
  challan_number: string;
  entry_type: 'udhar' | 'jama';
}

export interface BillingRates {
  daily_rent_rate: number;      // ₹1 by default
  service_charge_rate: number;  // ₹7 by default  
  worker_charge: number;        // ₹100 by default
  lost_plate_penalty: number;   // ₹250 by default
}

export interface ExtraItem {
  note: string;
  item_count: number;
  price: number;
  total: number; // Auto-calculated: item_count × price
}

export interface Payment {
  note: string;
  payment_amount: number;
}

export interface EnhancedGujaratiBillData {
  client: Client;
  bill_number: string;
  bill_date: string;
  ledger_entries: LedgerEntry[];
  
  // Core calculations (unchanged)
  total_rent: number;
  total_plates_issued: number;
  service_charge: number;
  worker_charge: number;
  lost_plates_count: number;
  lost_plate_penalty: number;
  advance_paid: number;
  
  // NEW: Extra items and payments
  extra_items: ExtraItem[];
  payments: Payment[];
  
  // NEW: Enhanced totals
  extra_charges_total: number;
  discounts_total: number;
  total_payments: number;
  core_total: number; // Rent + Service + Worker + Lost Plates
  adjusted_total: number; // Core + Extra Charges - Discounts
  final_due: number; // Adjusted Total - (Advance + Payments)
  
  // Rates used
  rates: BillingRates;
}

export class EnhancedGujaratiBillingCalculator {
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

  async fetchClientTransactionData(clientId: string, startDate?: string, endDate?: string) {
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
      console.error('Error fetching client transaction data:', error);
      throw error;
    }
  }

  calculateEnhancedGujaratiBill(
    client: Client,
    challans: any[],
    returns: any[],
    billDate: string,
    rates: Partial<BillingRates> = {},
    advancePaid: number = 0,
    extraItems: ExtraItem[] = [],
    payments: Payment[] = []
  ): EnhancedGujaratiBillData {
    const finalRates = { ...this.defaultRates, ...rates };

    // Step 1: Create all entries and sort by date ascending
    const allEntries: Array<{
      date: string;
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
      
      allEntries.push({
        date: returnRecord.return_date,
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
        return a.sort_priority - b.sort_priority;
      }
      return dateCompare;
    });

    // Step 3: Build ledger entries with પ્લેટ્સ column and days calculation
    const ledgerEntries: LedgerEntry[] = [];
    let currentBalance = 0;

    allEntries.forEach((entry, index) => {
      const platesBefore = currentBalance; // Balance before this entry
      
      // Apply balance change
      if (entry.type === 'udhar') {
        currentBalance += entry.plates;
      } else {
        currentBalance -= entry.plates;
        // Ensure balance never goes negative
        currentBalance = Math.max(0, currentBalance);
      }

      // Calculate days until next entry or bill date
      let days = 0;
      let rentAmount = 0;

      if (index < allEntries.length - 1) {
        // Calculate days until next entry
        const currentDate = new Date(entry.date);
        const nextDate = new Date(allEntries[index + 1].date);
        days = Math.ceil((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Apply jama rule: if this is jama, reduce days by 1
        if (entry.type === 'jama' && days > 0) {
          days = days - 1;
        }
      } else {
        // Last entry: calculate until bill date
        const currentDate = new Date(entry.date);
        const billDateObj = new Date(billDate);
        days = Math.ceil((billDateObj.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Apply jama rule: if this is jama, reduce days by 1
        if (entry.type === 'jama' && days > 0) {
          days = days - 1;
        }
      }

      // Ensure no negative days
      days = Math.max(0, days);

      // Calculate rent for this period using balance AFTER the entry
      if (days > 0 && currentBalance > 0) {
        rentAmount = currentBalance * days * finalRates.daily_rent_rate;
      }

      ledgerEntries.push({
        date: entry.date,
        plates_before: platesBefore,
        udhar: entry.type === 'udhar' ? entry.plates : 0,
        jama: entry.type === 'jama' ? entry.plates : 0,
        balance_after: currentBalance,
        days: days,
        rent_amount: rentAmount,
        challan_number: entry.challan_number,
        entry_type: entry.type
      });
    });

    // Step 4: Calculate core totals (unchanged logic)
    const totalRent = ledgerEntries.reduce((sum, entry) => sum + entry.rent_amount, 0);
    
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

    const lostPlatesCount = Math.max(0, totalPlatesIssued - totalPlatesReturned);

    // Calculate core charges
    const serviceCharge = 0; // Service charge removed
    const workerCharge = finalRates.worker_charge;
    const lostPlatePenalty = lostPlatesCount * finalRates.lost_plate_penalty;

    // Step 5: NEW - Calculate extra items
    const extraChargesTotal = extraItems
      .filter(item => item.price > 0)
      .reduce((sum, item) => sum + item.total, 0);
    
    const discountsTotal = extraItems
      .filter(item => item.price < 0)
      .reduce((sum, item) => sum + Math.abs(item.total), 0);

    // Step 6: NEW - Calculate payments
    const totalPayments = payments.reduce((sum, payment) => sum + payment.payment_amount, 0);

    // Step 7: NEW - Enhanced total calculation
    const coreTotal = totalRent + workerCharge + lostPlatePenalty;
    const adjustedTotal = coreTotal + extraChargesTotal - discountsTotal;
    const finalDue = Math.max(0, adjustedTotal - (advancePaid + totalPayments));

    return {
      client,
      bill_number: '', // Will be set by caller
      bill_date: billDate,
      ledger_entries: ledgerEntries,
      total_rent: totalRent,
      total_plates_issued: totalPlatesIssued,
      service_charge: serviceCharge,
      worker_charge: workerCharge,
      lost_plates_count: lostPlatesCount,
      lost_plate_penalty: lostPlatePenalty,
      advance_paid: advancePaid,
      
      // NEW fields
      extra_items: extraItems,
      payments: payments,
      extra_charges_total: extraChargesTotal,
      discounts_total: discountsTotal,
      total_payments: totalPayments,
      core_total: coreTotal,
      adjusted_total: adjustedTotal,
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
    return startDate === endDate ? start : `${start} થી ${end}`;
  }

  calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Helper function to separate extra charges and discounts
  getExtraCharges(extraItems: ExtraItem[]): ExtraItem[] {
    return extraItems.filter(item => item.price > 0);
  }

  getDiscounts(extraItems: ExtraItem[]): ExtraItem[] {
    return extraItems.filter(item => item.price < 0);
  }

  // Helper function to validate extra items
  validateExtraItems(extraItems: ExtraItem[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    extraItems.forEach((item, index) => {
      if (!item.note || item.note.trim() === '') {
        errors.push(`Extra item ${index + 1}: Note is required`);
      }
      if (item.item_count <= 0) {
        errors.push(`Extra item ${index + 1}: Item count must be greater than 0`);
      }
      if (item.price === 0) {
        errors.push(`Extra item ${index + 1}: Price cannot be zero`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper function to validate payments
  validatePayments(payments: Payment[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    payments.forEach((payment, index) => {
      if (!payment.note || payment.note.trim() === '') {
        errors.push(`Payment ${index + 1}: Note is required`);
      }
      if (payment.payment_amount <= 0) {
        errors.push(`Payment ${index + 1}: Payment amount must be greater than 0`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}