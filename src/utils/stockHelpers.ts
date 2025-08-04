import { supabase } from '../lib/supabase';

/**
 * Updates borrowed stock quantities in the stock table
 * This function aggregates borrowed stock across all challans
 */
export async function updateBorrowedStock(plateSize: string, borrowedQuantity: number) {
  try {
    const { error } = await supabase.rpc('increment_borrowed_stock', {
      p_plate_size: plateSize,
      p_increment: borrowedQuantity
    });

    if (error) {
      // Fallback to manual update if RPC doesn't exist
      const { error: updateError } = await supabase
        .from('stock')
        .update({
          borrowed_stock: supabase.sql`borrowed_stock + ${borrowedQuantity}`
        })
        .eq('plate_size', plateSize);

      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error('Error updating borrowed stock:', error);
    throw error;
  }
}

/**
 * Recalculates borrowed stock for a specific plate size
 * This function aggregates all borrowed_stock values from challan_items
 */
export async function recalculateBorrowedStock(plateSize: string) {
  try {
    // Get total borrowed stock from all challan_items for this plate size
    const { data: challanItems, error: challanError } = await supabase
      .from('challan_items')
      .select('borrowed_stock')
      .eq('plate_size', plateSize);

    if (challanError) throw challanError;

    const totalBorrowed = challanItems?.reduce((sum, item) => sum + (item.borrowed_stock || 0), 0) || 0;

    // Update the stock table with the calculated total
    const { error: updateError } = await supabase
      .from('stock')
      .update({ borrowed_stock: totalBorrowed })
      .eq('plate_size', plateSize);

    if (updateError) throw updateError;

    return totalBorrowed;
  } catch (error) {
    console.error('Error recalculating borrowed stock:', error);
    throw error;
  }
}

/**
 * Recalculates borrowed stock for all plate sizes
 * Useful for data consistency checks
 */
export async function recalculateAllBorrowedStock() {
  try {
    // Get all unique plate sizes from stock table
    const { data: stockItems, error: stockError } = await supabase
      .from('stock')
      .select('plate_size');

    if (stockError) throw stockError;

    const results = [];
    for (const stockItem of stockItems || []) {
      const total = await recalculateBorrowedStock(stockItem.plate_size);
      results.push({ plate_size: stockItem.plate_size, borrowed_stock: total });
    }

    return results;
  } catch (error) {
    console.error('Error recalculating all borrowed stock:', error);
    throw error;
  }
}