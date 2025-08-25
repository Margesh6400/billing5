import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Client = Database['public']['Tables']['clients']['Row'];
type Stock = Database['public']['Tables']['stock']['Row'];
type Challan = Database['public']['Tables']['challans']['Row'];
type ChallanItem = Database['public']['Tables']['challan_items']['Row'];
type Return = Database['public']['Tables']['returns']['Row'];
type ReturnItem = Database['public']['Tables']['return_line_items']['Row'];

export interface ChallanTransaction {
  id: number;
  type: 'udhar' | 'jama';
  number: string;
  date: string;
  client_id: string;
  client_name: string;
  driver_name?: string;
  items: Array<{
    plate_size: string;
    quantity: number;
    borrowed_stock?: number;
    notes?: string;
  }>;
  total_quantity: number;
}

export interface StockUpdate {
  plate_size: string;
  quantity_change: number; // positive = increase stock, negative = decrease stock
}

export function useChallanManagement() {
  const [loading, setLoading] = useState(false);

  // Calculate stock updates for a challan
  const calculateStockUpdates = useCallback((
    items: Array<{ plate_size: string; quantity: number; borrowed_stock?: number }>,
    type: 'udhar' | 'jama'
  ): StockUpdate[] => {
    const updates: StockUpdate[] = [];
    
    items.forEach(item => {
      const regularQuantity = item.quantity || 0;
      // Only count regular stock, not borrowed stock for stock updates
      if (regularQuantity > 0) {
        updates.push({
          plate_size: item.plate_size,
          quantity_change: type === 'udhar' ? -regularQuantity : regularQuantity
        });
      }
    });
    
    return updates;
  }, []);

  // Apply stock updates to database
  const applyStockUpdates = useCallback(async (updates: StockUpdate[]): Promise<void> => {
    for (const update of updates) {
      const { data: stockItem, error: fetchError } = await supabase
        .from('stock')
        .select('*')
        .eq('plate_size', update.plate_size)
        .single();

      if (fetchError) {
        console.error(`Error fetching stock for ${update.plate_size}:`, fetchError);
        continue;
      }

      const newAvailableQuantity = stockItem.available_quantity + update.quantity_change;
      const newOnRentQuantity = stockItem.on_rent_quantity - update.quantity_change;

      // Prevent negative stock
      if (newAvailableQuantity < 0) {
        throw new Error(`Insufficient stock for ${update.plate_size}. Available: ${stockItem.available_quantity}, Required: ${Math.abs(update.quantity_change)}`);
      }

      const { error: updateError } = await supabase
        .from('stock')
        .update({
          available_quantity: Math.max(0, newAvailableQuantity),
          on_rent_quantity: Math.max(0, newOnRentQuantity),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockItem.id);

      if (updateError) {
        throw new Error(`Error updating stock for ${update.plate_size}: ${updateError.message}`);
      }
    }
  }, []);

  // Fetch all transactions for display
  const fetchTransactions = useCallback(async (): Promise<ChallanTransaction[]> => {
    try {
      const [challansResponse, returnsResponse] = await Promise.all([
        supabase
          .from('challans')
          .select(`
            *,
            challan_items (*),
            clients (name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('returns')
          .select(`
            *,
            return_line_items (*),
            clients (name)
          `)
          .order('created_at', { ascending: false })
      ]);

      if (challansResponse.error) throw challansResponse.error;
      if (returnsResponse.error) throw returnsResponse.error;

      const udharTransactions: ChallanTransaction[] = (challansResponse.data || []).map(challan => ({
        id: challan.id,
        type: 'udhar',
        number: challan.challan_number,
        date: challan.challan_date,
        client_id: challan.client_id,
        client_name: challan.clients?.name || 'Unknown',
        driver_name: challan.driver_name || undefined,
        items: challan.challan_items.map((item: ChallanItem) => ({
          plate_size: item.plate_size,
          quantity: item.borrowed_quantity,
          borrowed_stock: item.borrowed_stock || 0,
          notes: item.partner_stock_notes || ''
        })),
        total_quantity: challan.challan_items.reduce((sum: number, item: ChallanItem) => 
          sum + item.borrowed_quantity + (item.borrowed_stock || 0), 0)
      }));

      const jamaTransactions: ChallanTransaction[] = (returnsResponse.data || []).map(returnRecord => ({
        id: returnRecord.id,
        type: 'jama',
        number: returnRecord.return_challan_number,
        date: returnRecord.return_date,
        client_id: returnRecord.client_id,
        client_name: returnRecord.clients?.name || 'Unknown',
        driver_name: returnRecord.driver_name || undefined,
        items: returnRecord.return_line_items.map((item: ReturnItem) => ({
          plate_size: item.plate_size,
          quantity: item.returned_quantity,
          borrowed_stock: item.returned_borrowed_stock || 0,
          notes: item.damage_notes || ''
        })),
        total_quantity: returnRecord.return_line_items.reduce((sum: number, item: ReturnItem) => 
          sum + item.returned_quantity + (item.returned_borrowed_stock || 0), 0)
      }));

      // Combine and sort by date
      const allTransactions = [...udharTransactions, ...jamaTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return allTransactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }, []);

  // Edit a challan/return
  const editTransaction = useCallback(async (
    transactionId: number,
    type: 'udhar' | 'jama',
    updatedData: {
      number: string;
      date: string;
      driver_name?: string;
      items: Array<{
        plate_size: string;
        quantity: number;
        borrowed_stock?: number;
        notes?: string;
      }>;
    }
  ): Promise<void> => {
    setLoading(true);
    
    try {
      // Step 1: Get original transaction data to revert stock changes
      let originalItems: Array<{ plate_size: string; quantity: number; borrowed_stock?: number }> = [];
      
      if (type === 'udhar') {
        const { data: originalChallan, error } = await supabase
          .from('challans')
          .select('*, challan_items (*)')
          .eq('id', transactionId)
          .single();
        
        if (error) throw error;
        
        originalItems = originalChallan.challan_items.map((item: ChallanItem) => ({
          plate_size: item.plate_size,
          quantity: item.borrowed_quantity,
          borrowed_stock: item.borrowed_stock || 0
        }));
      } else {
        const { data: originalReturn, error } = await supabase
          .from('returns')
          .select('*, return_line_items (*)')
          .eq('id', transactionId)
          .single();
        
        if (error) throw error;
        
        originalItems = originalReturn.return_line_items.map((item: ReturnItem) => ({
          plate_size: item.plate_size,
          quantity: item.returned_quantity,
          borrowed_stock: item.returned_borrowed_stock || 0
        }));
      }

      // Step 2: Revert original stock changes
      const revertUpdates = calculateStockUpdates(originalItems, type === 'udhar' ? 'jama' : 'udhar');
      await applyStockUpdates(revertUpdates);

      // Step 3: Apply new stock changes
      const newUpdates = calculateStockUpdates(updatedData.items, type);
      await applyStockUpdates(newUpdates);

      // Step 4: Update the transaction in database
      if (type === 'udhar') {
        // Update challan
        const { error: challanError } = await supabase
          .from('challans')
          .update({
            challan_number: updatedData.number,
            challan_date: updatedData.date,
            driver_name: updatedData.driver_name || null
          })
          .eq('id', transactionId);

        if (challanError) throw challanError;

        // Delete old items
        const { error: deleteError } = await supabase
          .from('challan_items')
          .delete()
          .eq('challan_id', transactionId);

        if (deleteError) throw deleteError;

        // Insert new items
        const newItems = updatedData.items
          .filter(item => item.quantity > 0 || (item.borrowed_stock && item.borrowed_stock > 0))
          .map(item => ({
            challan_id: transactionId,
            plate_size: item.plate_size,
            borrowed_quantity: item.quantity,
            borrowed_stock: item.borrowed_stock || 0,
            partner_stock_notes: item.notes || null
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('challan_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      } else {
        // Update return
        const { error: returnError } = await supabase
          .from('returns')
          .update({
            return_challan_number: updatedData.number,
            return_date: updatedData.date,
            driver_name: updatedData.driver_name || null
          })
          .eq('id', transactionId);

        if (returnError) throw returnError;

        // Delete old items
        const { error: deleteError } = await supabase
          .from('return_line_items')
          .delete()
          .eq('return_id', transactionId);

        if (deleteError) throw deleteError;

        // Insert new items
        const newItems = updatedData.items
          .filter(item => item.quantity > 0 || (item.borrowed_stock && item.borrowed_stock > 0))
          .map(item => ({
            return_id: transactionId,
            plate_size: item.plate_size,
            returned_quantity: item.quantity,
            returned_borrowed_stock: item.borrowed_stock || 0,
            damage_notes: item.notes || null,
            damaged_quantity: 0,
            lost_quantity: 0
          }));

        if (newItems.length > 0) {
          const { error: insertError } = await supabase
            .from('return_line_items')
            .insert(newItems);

          if (insertError) throw insertError;
        }
      }
    } catch (error) {
      console.error('Error editing transaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [calculateStockUpdates, applyStockUpdates]);

  // Delete a challan/return
  const deleteTransaction = useCallback(async (
    transactionId: number,
    type: 'udhar' | 'jama'
  ): Promise<void> => {
    setLoading(true);
    
    try {
      // Step 1: Get transaction data to revert stock changes
      let itemsToRevert: Array<{ plate_size: string; quantity: number; borrowed_stock?: number }> = [];
      
      if (type === 'udhar') {
        const { data: challan, error } = await supabase
          .from('challans')
          .select('*, challan_items (*)')
          .eq('id', transactionId)
          .single();
        
        if (error) throw error;
        
        itemsToRevert = challan.challan_items.map((item: ChallanItem) => ({
          plate_size: item.plate_size,
          quantity: item.borrowed_quantity,
          borrowed_stock: item.borrowed_stock || 0
        }));
      } else {
        const { data: returnRecord, error } = await supabase
          .from('returns')
          .select('*, return_line_items (*)')
          .eq('id', transactionId)
          .single();
        
        if (error) throw error;
        
        itemsToRevert = returnRecord.return_line_items.map((item: ReturnItem) => ({
          plate_size: item.plate_size,
          quantity: item.returned_quantity,
          borrowed_stock: item.returned_borrowed_stock || 0
        }));
      }

      // Step 2: Revert stock changes
      const revertUpdates = calculateStockUpdates(itemsToRevert, type === 'udhar' ? 'jama' : 'udhar');
      await applyStockUpdates(revertUpdates);

      // Step 3: Delete the transaction
      if (type === 'udhar') {
        // Delete challan items first (foreign key constraint)
        const { error: itemsError } = await supabase
          .from('challan_items')
          .delete()
          .eq('challan_id', transactionId);

        if (itemsError) throw itemsError;

        // Delete challan
        const { error: challanError } = await supabase
          .from('challans')
          .delete()
          .eq('id', transactionId);

        if (challanError) throw challanError;
      } else {
        // Delete return items first (foreign key constraint)
        const { error: itemsError } = await supabase
          .from('return_line_items')
          .delete()
          .eq('return_id', transactionId);

        if (itemsError) throw itemsError;

        // Delete return
        const { error: returnError } = await supabase
          .from('returns')
          .delete()
          .eq('id', transactionId);

        if (returnError) throw returnError;
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [calculateStockUpdates, applyStockUpdates]);

  return {
    loading,
    fetchTransactions,
    editTransaction,
    deleteTransaction
  };
}