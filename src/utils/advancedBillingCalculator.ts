import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface PlateRates {
  [plateSize: string]: number;
}

export interface MatchedChallan {
  issue_challan_number: string;
  issue_date: string;
  return_challan_number?: string;
  return_date: string; // Will be billing date if not returned
  plate_size: string;
  issued_quantity: number;
  returned_quantity: number;
  outstanding_quantity: number;
  days_used: number;
  rate_per_day: number;
  service_charge: number;
  is_partial_return: boolean;
  is_fully_returned: boolean;
  borrowed_stock?: number;
  returned_borrowed_stock?: number;
}

export interface BillCalculation {
  client_id: string;
  bill_date: string;
  matched_challans: MatchedChallan[];
  subtotal: number;
  extra_charges: number;
  discounts: number;
  grand_total: number;
  total_plates: number;
  total_days: number;
  total_challans: number;
}

export interface ExtraCharge {
  description: string;
  amount: number;
}

export interface Discount {
  description: string;
  amount: number;
}

export class AdvancedBillingCalculator {
  private plateRates: PlateRates;
  private defaultRate: number;

  constructor(plateRates: PlateRates = {}, defaultRate: number = 1.00) {
    this.plateRates = plateRates;
    this.defaultRate = defaultRate;
  }

  setPlateRates(rates: PlateRates) {
    this.plateRates = rates;
  }

  setDefaultRate(rate: number) {
    this.defaultRate = rate;
  }

  getRateForPlateSize(plateSize: string): number {
    return this.plateRates[plateSize] || this.defaultRate;
  }

  calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  async calculateBilling(
    clientId: string,
    billDate: string,
    extraCharges: ExtraCharge[] = [],
    discounts: Discount[] = [],
    startDate?: string,
    endDate?: string
  ): Promise<BillCalculation> {
    try {
      const { challans, returns } = await this.fetchClientTransactions(
        clientId, 
        startDate, 
        endDate || billDate
      );

      const matchedChallans: MatchedChallan[] = [];
      const processedChallanItems = new Set<string>();

      // Process each challan and match with returns
      for (const challan of challans) {
        for (const challanItem of challan.challan_items) {
          const itemKey = `${challan.id}-${challanItem.plate_size}`;
          if (processedChallanItems.has(itemKey)) continue;
          
          processedChallanItems.add(itemKey);

          // Find all returns for this plate size from this client
          const relevantReturns = returns.flatMap(returnRecord => 
            returnRecord.return_line_items
              .filter(item => item.plate_size === challanItem.plate_size)
              .map(item => ({
                ...item,
                return_date: returnRecord.return_date,
                return_challan_number: returnRecord.return_challan_number
              }))
          ).sort((a, b) => new Date(a.return_date).getTime() - new Date(b.return_date).getTime());

          const totalIssuedQuantity = challanItem.borrowed_quantity + (challanItem.borrowed_stock || 0);
          let remainingQuantity = totalIssuedQuantity;
          let totalReturnedQuantity = 0;

          // Calculate total returned quantity for this plate size
          for (const returnItem of relevantReturns) {
            const returnedQty = returnItem.returned_quantity + (returnItem.returned_borrowed_stock || 0);
            totalReturnedQuantity += returnedQty;
          }

          // Determine return status and date
          const isFullyReturned = totalReturnedQuantity >= totalIssuedQuantity;
          const isPartialReturn = totalReturnedQuantity > 0 && totalReturnedQuantity < totalIssuedQuantity;
          
          // Use the latest return date if any returns exist, otherwise use bill date
          const returnDate = relevantReturns.length > 0 
            ? relevantReturns[relevantReturns.length - 1].return_date 
            : billDate;

          const returnChallanNumber = relevantReturns.length > 0 
            ? relevantReturns[relevantReturns.length - 1].return_challan_number 
            : undefined;

          // Calculate days used
          const daysUsed = this.calculateDaysBetween(challan.challan_date, returnDate);
          
          // Get rate for this plate size
          const ratePerDay = this.getRateForPlateSize(challanItem.plate_size);
          
          // Calculate service charge for the quantity that was actually used
          const quantityForBilling = totalIssuedQuantity;
          const serviceCharge = quantityForBilling * daysUsed * ratePerDay;

          matchedChallans.push({
            issue_challan_number: challan.challan_number,
            issue_date: challan.challan_date,
            return_challan_number: returnChallanNumber,
            return_date: returnDate,
            plate_size: challanItem.plate_size,
            issued_quantity: totalIssuedQuantity,
            returned_quantity: totalReturnedQuantity,
            outstanding_quantity: Math.max(0, totalIssuedQuantity - totalReturnedQuantity),
            days_used: daysUsed,
            rate_per_day: ratePerDay,
            service_charge: serviceCharge,
            is_partial_return: isPartialReturn,
            is_fully_returned: isFullyReturned,
            borrowed_stock: challanItem.borrowed_stock || 0,
            returned_borrowed_stock: relevantReturns.reduce((sum, r) => sum + (r.returned_borrowed_stock || 0), 0)
          });
        }
      }

      // Calculate totals
      const subtotal = matchedChallans.reduce((sum, item) => sum + item.service_charge, 0);
      const extraChargesTotal = extraCharges.reduce((sum, charge) => sum + charge.amount, 0);
      const discountsTotal = discounts.reduce((sum, discount) => sum + discount.amount, 0);
      const grandTotal = subtotal + extraChargesTotal - discountsTotal;

      const totalPlates = matchedChallans.reduce((sum, item) => sum + item.issued_quantity, 0);
      const totalDays = matchedChallans.reduce((sum, item) => sum + item.days_used, 0);
      const totalChallans = new Set(matchedChallans.map(c => c.issue_challan_number)).size;

      return {
        client_id: clientId,
        bill_date: billDate,
        matched_challans: matchedChallans,
        subtotal,
        extra_charges: extraChargesTotal,
        discounts: discountsTotal,
        grand_total: grandTotal,
        total_plates: totalPlates,
        total_days: totalDays,
        total_challans: totalChallans
      };
    } catch (error) {
      console.error('Error calculating billing:', error);
      throw error;
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

  async getLastBillDate(clientId: string): Promise<string | null> {
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
      console.error('Error fetching last bill date:', error);
      return null;
    }
  }
}