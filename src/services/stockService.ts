import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';

type Stock = Database['public']['Tables']['stock']['Row'];

export interface StockUpdateOperation {
  plate_size: string;
  quantity_change: number; // Positive = increase stock, Negative = decrease stock
}

export class StockService {
  /**
   * Get current stock for a plate size
   */
  static async getStock(plateSize: string): Promise<Stock | null> {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .eq('plate_size', plateSize)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching stock:', error);
      return null;
    }
  }

  /**
   * Validate if stock operations are possible
   */
  static async validateStockOperations(operations: StockUpdateOperation[]): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    for (const operation of operations) {
      if (operation.quantity_change < 0) { // Decreasing stock
        const stock = await this.getStock(operation.plate_size);
        if (!stock) {
          errors.push(`Stock record not found for ${operation.plate_size}`);
          continue;
        }

        const newAvailable = stock.available_quantity + operation.quantity_change;
        if (newAvailable < 0) {
          errors.push(
            `Insufficient stock for ${operation.plate_size}. ` +
            `Available: ${stock.available_quantity}, Required: ${Math.abs(operation.quantity_change)}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Apply stock operations atomically
   */
  static async applyStockOperations(operations: StockUpdateOperation[]): Promise<void> {
    // First validate all operations
    const validation = await this.validateStockOperations(operations);
    if (!validation.valid) {
      throw new Error(`Stock validation failed: ${validation.errors.join(', ')}`);
    }

    // Apply operations one by one
    for (const operation of operations) {
      if (operation.quantity_change === 0) continue;

      const stock = await this.getStock(operation.plate_size);
      if (!stock) {
        throw new Error(`Stock record not found for ${operation.plate_size}`);
      }

      const newAvailable = stock.available_quantity + operation.quantity_change;
      const newOnRent = stock.on_rent_quantity - operation.quantity_change;

      const { error } = await supabase
        .from('stock')
        .update({
          available_quantity: Math.max(0, newAvailable),
          on_rent_quantity: Math.max(0, newOnRent),
          updated_at: new Date().toISOString()
        })
        .eq('id', stock.id);

      if (error) {
        throw new Error(`Failed to update stock for ${operation.plate_size}: ${error.message}`);
      }
    }
  }

  /**
   * Calculate stock operations for a challan
   */
  static calculateChallanStockOperations(
    challanType: 'udhar' | 'jama',
    plateData: Record<string, { quantity: number; borrowedStock: number }>
  ): StockUpdateOperation[] {
    const operations: StockUpdateOperation[] = [];

    Object.entries(plateData).forEach(([plateSize, data]) => {
      const totalQuantity = data.quantity; // Only count regular stock, not borrowed stock
      if (totalQuantity > 0) {
        // For udhar: decrease stock (negative change)
        // For jama: increase stock (positive change)
        const quantityChange = challanType === 'udhar' ? -totalQuantity : totalQuantity;
        
        operations.push({
          plate_size: plateSize,
          quantity_change: quantityChange
        });
      }
    });

    return operations;
  }

  /**
   * Revert stock operations (opposite effect)
   */
  static revertStockOperations(operations: StockUpdateOperation[]): StockUpdateOperation[] {
    return operations.map(op => ({
      ...op,
      quantity_change: -op.quantity_change
    }));
  }
}