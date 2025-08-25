import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { StockService, StockUpdateOperation } from './stockService';

type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type ReturnLineItem = Database['public']['Tables']['return_line_items']['Row'];

export interface ChallanData {
  id: number;
  challan_number: string;
  date: string;
  client_id: string;
  driver_name?: string;
  type: 'udhar' | 'jama';
  items: Array<{
    plate_size: string;
    quantity: number;
    borrowed_stock: number;
    notes: string;
  }>;
}

export class ChallanService {
  /**
   * Get challan data with items
   */
  static async getChallanData(challanId: number, type: 'udhar' | 'jama'): Promise<ChallanData | null> {
    try {
      if (type === 'udhar') {
        const { data, error } = await supabase
          .from('challans')
          .select('*, challan_items(*)')
          .eq('id', challanId)
          .single();

        if (error) throw error;

        return {
          id: data.id,
          challan_number: data.challan_number,
          date: data.challan_date,
          client_id: data.client_id,
          driver_name: data.driver_name || undefined,
          type: 'udhar',
          items: (data.challan_items as ChallanItem[]).map(item => ({
            plate_size: item.plate_size,
            quantity: item.borrowed_quantity,
            borrowed_stock: item.borrowed_stock || 0,
            notes: item.partner_stock_notes || ''
          }))
        };
      } else {
        const { data, error } = await supabase
          .from('returns')
          .select('*, return_line_items(*)')
          .eq('id', challanId)
          .single();

        if (error) throw error;

        return {
          id: data.id,
          challan_number: data.return_challan_number,
          date: data.return_date,
          client_id: data.client_id,
          driver_name: data.driver_name || undefined,
          type: 'jama',
          items: (data.return_line_items as ReturnLineItem[]).map(item => ({
            plate_size: item.plate_size,
            quantity: item.returned_quantity,
            borrowed_stock: item.returned_borrowed_stock || 0,
            notes: item.damage_notes || ''
          }))
        };
      }
    } catch (error) {
      console.error('Error fetching challan data:', error);
      return null;
    }
  }

  /**
   * Create new challan with stock updates
   */
  static async createChallan(
    type: 'udhar' | 'jama',
    challanNumber: string,
    date: string,
    clientId: string,
    driverName: string,
    plateData: Record<string, { quantity: number; borrowedStock: number; notes: string }>
  ): Promise<{ success: boolean; error?: string; challanId?: number }> {
    try {
      // Calculate stock operations
      const stockOperations = StockService.calculateChallanStockOperations(type, plateData);
      
      // Validate stock operations
      const validation = await StockService.validateStockOperations(stockOperations);
      if (!validation.valid) {
        return {
          success: false,
          error: `Stock validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Create challan record
      let challanId: number;
      
      if (type === 'udhar') {
        const { data, error } = await supabase
          .from('challans')
          .insert([{
            challan_number: challanNumber,
            client_id: clientId,
            challan_date: date,
            driver_name: driverName || null,
            status: 'active'
          }])
          .select()
          .single();

        if (error) throw error;
        challanId = data.id;

        // Create challan items
        const validItems = Object.entries(plateData)
          .filter(([_, data]) => data.quantity > 0 || data.borrowedStock > 0)
          .map(([plateSize, data]) => ({
            challan_id: challanId,
            plate_size: plateSize,
            borrowed_quantity: data.quantity,
            borrowed_stock: data.borrowedStock,
            partner_stock_notes: data.notes || null
          }));

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('challan_items')
            .insert(validItems);

          if (itemsError) throw itemsError;
        }
      } else {
        const { data, error } = await supabase
          .from('returns')
          .insert([{
            return_challan_number: challanNumber,
            client_id: clientId,
            return_date: date,
            driver_name: driverName || null
          }])
          .select()
          .single();

        if (error) throw error;
        challanId = data.id;

        // Create return line items
        const validItems = Object.entries(plateData)
          .filter(([_, data]) => data.quantity > 0 || data.borrowedStock > 0)
          .map(([plateSize, data]) => ({
            return_id: challanId,
            plate_size: plateSize,
            returned_quantity: data.quantity,
            returned_borrowed_stock: data.borrowedStock,
            damage_notes: data.notes || null,
            damaged_quantity: 0,
            lost_quantity: 0
          }));

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('return_line_items')
            .insert(validItems);

          if (itemsError) throw itemsError;
        }
      }

      // Apply stock operations
      await StockService.applyStockOperations(stockOperations);

      return { success: true, challanId };
    } catch (error) {
      console.error('Error creating challan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Update existing challan with proper stock handling
   */
  static async updateChallan(
    challanId: number,
    type: 'udhar' | 'jama',
    challanNumber: string,
    date: string,
    clientId: string,
    driverName: string,
    plateData: Record<string, { quantity: number; borrowedStock: number; notes: string }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get original challan data
      const originalChallan = await this.getChallanData(challanId, type);
      if (!originalChallan) {
        return { success: false, error: 'Original challan not found' };
      }

      // Calculate original stock operations to revert
      const originalPlateData: Record<string, { quantity: number; borrowedStock: number }> = {};
      originalChallan.items.forEach(item => {
        originalPlateData[item.plate_size] = {
          quantity: item.quantity,
          borrowedStock: item.borrowed_stock
        };
      });

      const originalStockOperations = StockService.calculateChallanStockOperations(
        originalChallan.type,
        originalPlateData
      );

      // Calculate new stock operations
      const newStockOperations = StockService.calculateChallanStockOperations(type, plateData);

      // Step 1: Revert original stock impact
      const revertOperations = StockService.revertStockOperations(originalStockOperations);
      
      // Step 2: Validate combined operations (revert + new)
      const combinedOperations = [...revertOperations, ...newStockOperations];
      const validation = await StockService.validateStockOperations(combinedOperations);
      
      if (!validation.valid) {
        return {
          success: false,
          error: `Stock validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Step 3: Apply stock operations
      await StockService.applyStockOperations(combinedOperations);

      // Step 4: Update challan record and items
      if (type === 'udhar') {
        // Update challan
        const { error: challanError } = await supabase
          .from('challans')
          .update({
            challan_number: challanNumber,
            challan_date: date,
            client_id: clientId,
            driver_name: driverName || null
          })
          .eq('id', challanId);

        if (challanError) throw challanError;

        // Delete old items
        const { error: deleteError } = await supabase
          .from('challan_items')
          .delete()
          .eq('challan_id', challanId);

        if (deleteError) throw deleteError;

        // Insert new items
        const validItems = Object.entries(plateData)
          .filter(([_, data]) => data.quantity > 0 || data.borrowedStock > 0)
          .map(([plateSize, data]) => ({
            challan_id: challanId,
            plate_size: plateSize,
            borrowed_quantity: data.quantity,
            borrowed_stock: data.borrowedStock,
            partner_stock_notes: data.notes || null
          }));

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('challan_items')
            .insert(validItems);

          if (itemsError) throw itemsError;
        }
      } else {
        // Update return
        const { error: returnError } = await supabase
          .from('returns')
          .update({
            return_challan_number: challanNumber,
            return_date: date,
            client_id: clientId,
            driver_name: driverName || null
          })
          .eq('id', challanId);

        if (returnError) throw returnError;

        // Delete old items
        const { error: deleteError } = await supabase
          .from('return_line_items')
          .delete()
          .eq('return_id', challanId);

        if (deleteError) throw deleteError;

        // Insert new items
        const validItems = Object.entries(plateData)
          .filter(([_, data]) => data.quantity > 0 || data.borrowedStock > 0)
          .map(([plateSize, data]) => ({
            return_id: challanId,
            plate_size: plateSize,
            returned_quantity: data.quantity,
            returned_borrowed_stock: data.borrowedStock,
            damage_notes: data.notes || null,
            damaged_quantity: 0,
            lost_quantity: 0
          }));

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('return_line_items')
            .insert(validItems);

          if (itemsError) throw itemsError;
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating challan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete challan with proper stock reversion
   */
  static async deleteChallan(
    challanId: number,
    type: 'udhar' | 'jama'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get original challan data
      const originalChallan = await this.getChallanData(challanId, type);
      if (!originalChallan) {
        return { success: false, error: 'Challan not found' };
      }

      // Calculate stock operations to revert
      const originalPlateData: Record<string, { quantity: number; borrowedStock: number }> = {};
      originalChallan.items.forEach(item => {
        originalPlateData[item.plate_size] = {
          quantity: item.quantity,
          borrowedStock: item.borrowed_stock
        };
      });

      const originalStockOperations = StockService.calculateChallanStockOperations(
        originalChallan.type,
        originalPlateData
      );

      // Revert stock operations
      const revertOperations = StockService.revertStockOperations(originalStockOperations);
      await StockService.applyStockOperations(revertOperations);

      // Delete challan and items
      if (type === 'udhar') {
        // Delete items first
        const { error: itemsError } = await supabase
          .from('challan_items')
          .delete()
          .eq('challan_id', challanId);

        if (itemsError) throw itemsError;

        // Delete challan
        const { error: challanError } = await supabase
          .from('challans')
          .delete()
          .eq('id', challanId);

        if (challanError) throw challanError;
      } else {
        // Delete items first
        const { error: itemsError } = await supabase
          .from('return_line_items')
          .delete()
          .eq('return_id', challanId);

        if (itemsError) throw itemsError;

        // Delete return
        const { error: returnError } = await supabase
          .from('returns')
          .delete()
          .eq('id', challanId);

        if (returnError) throw returnError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting challan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}