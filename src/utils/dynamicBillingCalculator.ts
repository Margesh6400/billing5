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

export interface DateRangeBilling {
  start_date: string;
  end_date: string;
  plate_balance: number;
  days: number;
  rent_amount: number;
  date_range_display: string; // Formatted for display
}

export interface ExtraCharge {
  note: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface Discount {
  note: string;
  quantity: number;
  rate: number;
  total: number; // Will be negative
}

export interface ServiceChargeConfig {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number; // Percentage (0-100) or fixed amount
}

export interface DynamicBillData {
  client: Client;
  bill_number: string;
  bill_date: string;
  ledger_entries: LedgerEntry[];
  date_ranges: DateRangeBilling[];
  
  // Rent calculation
  total_rent: number;
  per_day_rate: number;
  
  // Service charge
  service_charge_config: ServiceChargeConfig;
  service_charge_amount: number;
  
  // Extra items
  extra_charges: ExtraCharge[];
  discounts: Discount[];
  
  // Totals
  extra_charges_total: number;
  discounts_total: number;
  grand_total: number;
  final_payment: number;
}

export class DynamicBillingCalculator {
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

  calculateDynamicBill(
    client: Client,
    challans: any[],
    returns: any[],
    billDate: string,
    perDayRate: number = 1.00,
    serviceChargeConfig: ServiceChargeConfig = { enabled: false, type: 'fixed', value: 0 },
    extraCharges: ExtraCharge[] = [],
    discounts: Discount[] = []
  ): DynamicBillData {
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
    const dateRanges: DateRangeBilling[] = [];
    let currentBalance = 0;
    let totalRent = 0;

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
      let endDate = billDate;

      if (index < allEntries.length - 1) {
        // Calculate days until next entry
        const currentDate = new Date(entry.date);
        const nextDate = new Date(allEntries[index + 1].date);
        days = Math.ceil((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Apply jama rule: if this is jama, reduce days by 1
        if (entry.type === 'jama' && days > 0) {
          days = days - 1;
        }

        // End date is day before next entry
        const endDateObj = new Date(nextDate);
        endDateObj.setDate(endDateObj.getDate() - 1);
        endDate = endDateObj.toISOString().split('T')[0];
      } else {
        // Last entry: calculate until bill date
        const currentDate = new Date(entry.date);
        const billDateObj = new Date(billDate);
        days = Math.ceil((billDateObj.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Apply jama rule: if this is jama, reduce days by 1
        if (entry.type === 'jama' && days > 0) {
          days = days - 1;
        }
        
        endDate = billDate;
      }

      // Ensure no negative days
      days = Math.max(0, days);

      // Calculate rent for this period using balance AFTER the entry
      if (days > 0 && currentBalance > 0) {
        rentAmount = currentBalance * days * perDayRate;
        totalRent += rentAmount;

        // Add to date ranges for display
        const startDateFormatted = new Date(entry.date).toLocaleDateString('en-GB');
        const endDateFormatted = new Date(endDate).toLocaleDateString('en-GB');
        const dateRangeDisplay = entry.date === endDate ? startDateFormatted : `${startDateFormatted} થી ${endDateFormatted}`;

        dateRanges.push({
          start_date: entry.date,
          end_date: endDate,
          plate_balance: currentBalance,
          days: days,
          rent_amount: rentAmount,
          date_range_display: dateRangeDisplay
        });
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

    // Step 4: Calculate service charge
    let serviceChargeAmount = 0;
    if (serviceChargeConfig.enabled) {
      if (serviceChargeConfig.type === 'percentage') {
        serviceChargeAmount = (totalRent * serviceChargeConfig.value) / 100;
      } else {
        serviceChargeAmount = serviceChargeConfig.value;
      }
    }

    // Step 5: Calculate totals
    const extraChargesTotal = extraCharges.reduce((sum, charge) => sum + charge.total, 0);
    const discountsTotal = discounts.reduce((sum, discount) => sum + Math.abs(discount.total), 0);
    
    const grandTotal = totalRent + serviceChargeAmount + extraChargesTotal - discountsTotal;
    const finalPayment = Math.max(0, grandTotal); // Ensure no negative final payment

    return {
      client,
      bill_number: '', // Will be set by caller
      bill_date: billDate,
      ledger_entries: ledgerEntries,
      date_ranges: dateRanges,
      total_rent: totalRent,
      per_day_rate: perDayRate,
      service_charge_config: serviceChargeConfig,
      service_charge_amount: serviceChargeAmount,
      extra_charges: extraCharges,
      discounts: discounts,
      extra_charges_total: extraChargesTotal,
      discounts_total: discountsTotal,
      grand_total: grandTotal,
      final_payment: finalPayment
    };
  }

  async generateNextBillNumber(): Promise<string> {
    try {
      // Get the highest bill number from existing bills
      const { data, error } = await supabase
        .from('bills')
        .select('bill_number')
        .order('generated_at', { ascending: false })
        .limit(1);

      if (error && error.code !== '42P01') throw error; // Ignore table not found error

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastBillNumber = data[0].bill_number;
        const match = lastBillNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      return nextNumber.toString();
    } catch (error) {
      console.error('Error generating bill number:', error);
      return Date.now().toString().slice(-4);
    }
  }

  // Validation functions
  validateBillData(billData: DynamicBillData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check bill number
    if (!billData.bill_number || billData.bill_number.trim() === '') {
      errors.push('બિલ નંબર આવશ્યક છે');
    }

    // Check dates are ascending
    const dates = billData.ledger_entries.map(entry => new Date(entry.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] < dates[i - 1]) {
        errors.push('તારીખો વધતા ક્રમમાં હોવી જોઈએ');
        break;
      }
    }

    // Check no negative days
    const hasNegativeDays = billData.ledger_entries.some(entry => entry.days < 0);
    if (hasNegativeDays) {
      errors.push('નકારાત્મક દિવસોની મંજૂરી નથી');
    }

    // Check balance never goes negative
    const hasNegativeBalance = billData.ledger_entries.some(entry => entry.balance_after < 0);
    if (hasNegativeBalance) {
      errors.push('બેલેન્સ પ્લેટ્સ નકારાત્મક ન હોઈ શકે');
    }

    // Validate final balance calculation
    const totalUdhar = billData.ledger_entries.reduce((sum, entry) => sum + entry.udhar, 0);
    const totalJama = billData.ledger_entries.reduce((sum, entry) => sum + entry.jama, 0);
    const finalBalance = billData.ledger_entries[billData.ledger_entries.length - 1]?.balance_after || 0;
    
    if (totalUdhar - totalJama !== finalBalance) {
      errors.push('કુલ ઉધાર - કુલ જમા = અંતિમ બેલેન્સ મેળ ખાતો નથી');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
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
}