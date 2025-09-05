import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  ArrowRightCircle,
  Calculator, 
  Download, 
  Search, 
  User, 
  Calendar, 
  DollarSign,
  Settings,
  Loader2,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  Lock,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Users,
  Target,
  Percent,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  ComprehensiveBillingCalculator, 
  ComprehensiveBillData, 
  BillingRates,
  ExtraCharge,
  Discount,
  Payment
} from '../utils/comprehensiveBillingCalculator';
import { 
  generateComprehensiveBillJPG, 
  downloadComprehensiveBillJPG 
} from '../utils/comprehensiveBillJPGGenerator';

type Client = Database['public']['Tables']['clients']['Row'];

export function ComprehensiveBillManagement() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Billing parameters
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [advancePaid, setAdvancePaid] = useState(0);
  
  // Billing rates with dynamic service rate per plate
  const [rates, setRates] = useState<BillingRates>({
    daily_rent_rate: 1.00,
    service_charge_percentage: 10.0
  });
  
  // NEW: Dynamic service rate per plate
  const [serviceRatePerPlate, setServiceRatePerPlate] = useState(10.0); // ₹10 per plate default
  
  // Override fields
  const [overrideServiceCharge, setOverrideServiceCharge] = useState<number | undefined>(undefined);
  const [overrideTotalPlates, setOverrideTotalPlates] = useState<number | undefined>(undefined);
  
  // NEW: Account closure option
  const [accountClosure, setAccountClosure] = useState<'close' | 'continue'>('continue');
  
  // Dynamic sections
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Calculation results
  const [billData, setBillData] = useState<ComprehensiveBillData | null>(null);
  const [billNumber, setBillNumber] = useState('');

  const calculator = new ComprehensiveBillingCalculator(rates);

  useEffect(() => {
    fetchClients();
    generateBillNumber();
  }, []);

    // Recalculate when service rate per plate changes
  useEffect(() => {
    if (billData && selectedClient) {
      handleCalculateBill();
    }
  }, [serviceRatePerPlate]);

  // Separate effect for total plates override to prevent infinite loop
  useEffect(() => {
    if (billData && overrideTotalPlates !== undefined) {
      // Recalculate service charge with new total plates
      const newServiceCharge = overrideTotalPlates * serviceRatePerPlate;
      setBillData(prev => prev ? {
        ...prev,
        service_charge: newServiceCharge,
        grand_total: prev.total_udhar + newServiceCharge + prev.extra_charges_total,
        final_due: Math.max(0, prev.total_udhar + newServiceCharge + prev.extra_charges_total - prev.discounts_total - prev.advance_paid - prev.payments_total),
        balance_carry_forward: Math.max(0, -(prev.total_udhar + newServiceCharge + prev.extra_charges_total - prev.discounts_total - prev.advance_paid - prev.payments_total))
      } : null);
    }
  }, [overrideTotalPlates, serviceRatePerPlate, billData?.total_udhar, billData?.extra_charges_total, billData?.discounts_total, billData?.advance_paid, billData?.payments_total]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('id');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBillNumber = async () => {
    try {
      const nextBillNumber = await calculator.generateNextBillNumber();
      setBillNumber(nextBillNumber);
    } catch (error) {
      console.error('Error generating bill number:', error);
      setBillNumber(`BILL-${Date.now().toString().slice(-4)}`);
    }
  };

  const handleCalculateBill = async () => {
    if (!selectedClient) {
      alert('કૃપા કરીને ગ્રાહક પસંદ કરો.');
      return;
    }

    setCalculating(true);
    try {
      const { challans, returns } = await calculator.fetchClientLedgerData(
        selectedClient.id,
        startDate || undefined,
        endDate || billDate
      );

      const calculatedBill = calculator.calculateComprehensiveBilling(
        selectedClient,
        challans,
        returns,
        billDate,
        rates,
        advancePaid,
        extraCharges,
        discounts,
        payments,
        overrideTotalPlates, // Total plates override
        overrideServiceCharge,
        serviceRatePerPlate,
        accountClosure
      );

      calculatedBill.bill_number = billNumber;
      setBillData(calculatedBill);
    } catch (error) {
      console.error('Error calculating bill:', error);
      alert('બિલ ગણતરી કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateBill = async () => {
    if (!billData) return;

    setGenerating(true);
    try {
      // Save bill data to Supabase first
      const { data: savedBill, error: billError } = await supabase
        .from('bills')
        .insert([{
          bill_number: billData.bill_number,
          client_id: billData.client.id,
          billing_period_start: billData.date_ranges[0]?.start_date || billData.bill_date,
          billing_period_end: billData.bill_date,
          total_udhar_quantity: overrideTotalPlates !== undefined ? overrideTotalPlates : billData.total_plates_udhar,
          service_charge: billData.service_charge,
          period_charges: billData.total_udhar,
          total_amount: billData.grand_total,
          previous_payments: billData.advance_paid,
          net_due: billData.final_due,
          payment_status: billData.final_due > 0 ? 'pending' : 'paid',
          daily_rate: billData.rates.daily_rent_rate,
          service_rate: serviceRatePerPlate,
          extra_charges_total: billData.extra_charges_total,
          discounts_total: billData.discounts_total,
          payments_total: billData.payments_total,
          advance_paid: billData.advance_paid,
          final_due: billData.final_due,
          balance_carry_forward: billData.balance_carry_forward,
          account_closure: accountClosure
        }])
        .select()
        .single();

      if (billError) {
        console.error('Error saving bill to database:', billError);
        alert('બિલ ડેટાબેઝમાં સેવ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
        return;
      }

      // Save bill line items
      const lineItems = [];
      
      // Add rent line items
      billData.date_ranges.forEach(range => {
        lineItems.push({
          bill_id: savedBill.id,
          item_type: 'rent',
          description: `Rent for ${range.plate_balance} plates for ${range.days} days`,
          quantity: range.plate_balance * range.days,
          rate: billData.rates.daily_rent_rate,
          amount: range.rent_amount,
          item_date: range.start_date
        });
      });

      // Add service charge
      lineItems.push({
        bill_id: savedBill.id,
        item_type: 'service_charge',
        description: `Service charge for ${overrideTotalPlates !== undefined ? overrideTotalPlates : billData.total_plates_udhar} plates`,
        quantity: overrideTotalPlates !== undefined ? overrideTotalPlates : billData.total_plates_udhar,
        rate: serviceRatePerPlate,
        amount: billData.service_charge
      });

      // Add extra charges
      billData.extra_charges.forEach(charge => {
        lineItems.push({
          bill_id: savedBill.id,
          item_type: 'extra_charge',
          description: charge.note,
          quantity: charge.item_count,
          rate: charge.price,
          amount: charge.total,
          item_date: charge.date
        });
      });

      // Add discounts
      billData.discounts.forEach(discount => {
        lineItems.push({
          bill_id: savedBill.id,
          item_type: 'discount',
          description: discount.note,
          quantity: discount.item_count,
          rate: -discount.price,
          amount: -discount.total,
          item_date: discount.date
        });
      });

      // Add payments
      billData.payments.forEach(payment => {
        lineItems.push({
          bill_id: savedBill.id,
          item_type: 'payment',
          description: payment.note,
          quantity: 1,
          rate: payment.payment_amount,
          amount: payment.payment_amount,
          item_date: payment.date
        });
      });

      // Save line items
      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('bill_line_items')
          .insert(lineItems);

        if (lineItemsError) {
          console.error('Error saving bill line items:', lineItemsError);
          // Continue with JPG generation even if line items fail
        }
      }

      const jpgDataUrl = await generateComprehensiveBillJPG(billData);
      downloadComprehensiveBillJPG(jpgDataUrl, `comprehensive-bill-${billData.client.id}-${billData.bill_date}`);
      
      // Reset form after successful generation
      setSelectedClient(null);
      setBillData(null);
      setAdvancePaid(0);
      setExtraCharges([]);
      setDiscounts([]);
      setPayments([]);
      setOverrideServiceCharge(undefined);
      setOverrideTotalPlates(undefined);
      setAccountClosure('continue');
      await generateBillNumber();
      
      alert(`બિલ સફળતાપૂર્વક જનરેટ અને ડાઉનલોડ થયું!\nBill Number: ${billData.bill_number}\nDatabase ID: ${savedBill.id}`);
    } catch (error) {
      console.error('Error generating bill:', error);
      alert('બિલ જનરેટ કરવામાં ભૂલ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setGenerating(false);
    }
  };

  const updateRate = (field: keyof BillingRates, value: number) => {
    setRates(prev => ({ ...prev, [field]: value }));
  };
  
  // Extra Charges functions
  const addExtraCharge = () => {
    setExtraCharges(prev => [...prev, {
      note: '',
      date: new Date().toISOString().split('T')[0],
      item_count: 1,
      price: 0,
      total: 0
    }]);
  };
  
  const updateExtraCharge = (index: number, field: keyof ExtraCharge, value: string | number) => {
    setExtraCharges(prev => prev.map((charge, i) => {
      if (i === index) {
        const updated = { ...charge, [field]: value };
        if (field === 'item_count' || field === 'price') {
          updated.total = updated.item_count * updated.price;
        }
        return updated;
      }
      return charge;
    }));
  };
  
  const removeExtraCharge = (index: number) => {
    setExtraCharges(prev => prev.filter((_, i) => i !== index));
  };
  
  // Discounts functions
  const addDiscount = () => {
    setDiscounts(prev => [...prev, {
      note: '',
      date: new Date().toISOString().split('T')[0],
      item_count: 1,
      price: 0,
      total: 0
    }]);
  };
  
  const updateDiscount = (index: number, field: keyof Discount, value: string | number) => {
    setDiscounts(prev => prev.map((discount, i) => {
      if (i === index) {
        const updated = { ...discount, [field]: value };
        if (field === 'item_count' || field === 'price') {
          updated.total = updated.item_count * updated.price;
        }
        return updated;
      }
      return discount;
    }));
  };
  
  const removeDiscount = (index: number) => {
    setDiscounts(prev => prev.filter((_, i) => i !== index));
  };
  
  // Payments functions
  const addPayment = () => {
    setPayments(prev => [...prev, {
      note: '',
      date: new Date().toISOString().split('T')[0],
      payment_amount: 0
    }]);
  };
  
  const updatePayment = (index: number, field: keyof Payment, value: string | number) => {
    setPayments(prev => prev.map((payment, i) => {
      if (i === index) {
        return { ...payment, [field]: value };
      }
      return payment;
    }));
  };
  
  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.site || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show access denied for non-admin users
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-gray-500 to-gray-600">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="mb-1 text-base font-bold text-gray-900">પ્રવેશ નકારવામાં આવ્યો</h1>
            <p className="text-xs text-gray-600">તમને આ પેજ જોવાની પરવાનગી નથી</p>
          </div>
          
          <div className="p-6 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-200 to-gray-300">
              <Lock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-700">View-Only Access</h3>
            <p className="mb-3 text-sm text-gray-500">
              તમારી પાસે માત્ર જોવાની પરવાનગી છે. બિલ બનાવવા માટે Admin સાથે સંપર્ક કરો.
            </p>
            <p className="text-xs text-blue-600">
              Admin: nilkanthplatdepo@gmail.com
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
        <div className="p-4 space-y-4">
          <div className="pt-2 text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-600 animate-spin" />
            <p className="text-sm text-gray-600">લોડ થઈ રહ્યું છે...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 mb-2 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <h1 className="mb-1 text-base font-bold text-gray-900">બિલિંગ</h1>
        </div>

        {/* Client Selection */}
        <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <User className="w-4 h-4" />
              ગ્રાહક પસંદ કરો
            </h2>
          </div>
          
          <div className="p-3 space-y-3">
            {!selectedClient ? (
              <>
                <div className="relative">
                  <Search className="absolute w-4 h-4 text-blue-400 transform -translate-y-1/2 left-3 top-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-2 pl-10 pr-3 text-sm transition-all duration-200 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="ગ્રાહકો શોધો..."
                  />
                </div>

                <div className="space-y-2 overflow-y-auto max-h-60">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="w-full p-3 text-left transition-all bg-white border border-blue-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{client.name}</div>
                          <div className="text-xs text-blue-600">ID: {client.id} | {client.site}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="p-3 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{selectedClient.name}</h3>
                      <div className="text-xs text-blue-600">
                        ID: {selectedClient.id} | {selectedClient.site}
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  ગ્રાહક બદલો
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Billing Parameters */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-blue-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Settings className="w-4 h-4" />
                બિલિંગ પેરામીટર
              </h2>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    બિલ નંબર
                  </label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    placeholder="B-0001"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    બિલ તારીખ
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  અગાઉથી ચૂકવેલ રકમ (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              <button
                onClick={handleCalculateBill}
                disabled={calculating}
                className="flex items-center justify-center w-full gap-2 py-2 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
              >
                {calculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ગણતરી કરી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    બિલ ગણતરી કરો
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Billing Rates Configuration */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border-2 border-purple-100 shadow-lg rounded-xl">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-500">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Settings className="w-4 h-4" />
                બિલિંગ દરો અને એડિટ વિકલ્પો
              </h3>
            </div>
            
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    દૈનિક ભાડો (પ્લેટ/દિવસ)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={rates.daily_rent_rate}
                    onChange={(e) => updateRate('daily_rent_rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    સર્વિસ ચાર્જ (પ્રતિ પ્લેટ)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={serviceRatePerPlate}
                    onChange={(e) => setServiceRatePerPlate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-500"
                  />
                </div>
                
                {/* Total Plates Override Section */}
                {billData && (
                  <div className="p-3 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <label className="block mb-2 text-sm font-medium text-blue-700">
                      કુલ ઉધાર પ્લેટ્સ એડિટ કરો:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={overrideTotalPlates !== undefined ? overrideTotalPlates : billData.total_plates_udhar}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setOverrideTotalPlates(value);
                        }}
                        className="flex-1 px-3 py-2 text-sm font-bold text-center border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                        placeholder="કુલ પ્લેટ્સ"
                      />
                      <button
                        onClick={() => setOverrideTotalPlates(undefined)}
                        className="px-3 py-2 text-xs font-medium text-white transition-colors bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        રીસેટ
                      </button>
                    </div>
                    <div className="p-2 mt-2 text-xs text-blue-600 bg-blue-100 rounded">
                      <div className="flex justify-between">
                        <span>મૂળ કુલ ઉધાર પ્લેટ્સ:</span>
                        <span className="font-bold">{billData.total_plates_udhar}</span>
                      </div>
                      {overrideTotalPlates !== undefined && (
                        <div className="flex justify-between mt-1 text-orange-600">
                          <span>એડિટેડ કુલ પ્લેટ્સ:</span>
                          <span className="font-bold">{overrideTotalPlates}</span>
                        </div>
                      )}
                      <div className="flex justify-between mt-1 text-purple-600">
                        <span>સર્વિસ ચાર્જ:</span>
                        <span className="font-bold">₹{((overrideTotalPlates !== undefined ? overrideTotalPlates : billData.total_plates_udhar) * serviceRatePerPlate).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Extra Charges Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border border-orange-100 rounded-lg shadow-sm">
            <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Plus className="w-3.5 h-3.5" />
                વધારાના ચાર્જ
              </h3>
            </div>
            
            <div className="p-2 space-y-2">
              {extraCharges.map((charge, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="નોંધ"
                      value={charge.note}
                      onChange={(e) => updateExtraCharge(index, 'note', e.target.value)}
                      className="w-32 px-1.5 py-0.5 border border-orange-200 rounded bg-white"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      placeholder="સંખ્યા"
                      min="1"
                      value={charge.item_count}
                      onChange={(e) => updateExtraCharge(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="w-14 px-1.5 py-0.5 border border-orange-200 rounded bg-white"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      placeholder="કિંમત"
                      step="1"
                      min="0"
                      value={charge.price}
                      onChange={(e) => updateExtraCharge(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-16 px-1.5 py-0.5 border border-orange-200 rounded bg-white"
                    />
                    <span className="font-medium text-orange-600">= ₹{charge.total}</span>
                  </div>
                  <button
                    onClick={() => removeExtraCharge(index)}
                    className="p-0.5 text-red-500 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={addExtraCharge}
                className="w-full py-1.5 text-xs font-medium text-orange-600 border border-orange-200 rounded hover:bg-orange-50"
              >
                + વધારાનો ચાર્જ ઉમેરો
              </button>
            </div>
          </div>
        )}

        {/* Discounts Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border border-green-100 rounded-lg shadow-sm">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
                <TrendingUp className="w-3.5 h-3.5" />
                ડિસ્કાઉન્ટ
              </h3>
            </div>
            
            <div className="p-2 space-y-2">
              {discounts.map((discount, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="નોંધ"
                      value={discount.note}
                      onChange={(e) => updateDiscount(index, 'note', e.target.value)}
                      className="w-32 px-1.5 py-0.5 border border-green-200 rounded bg-white"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      placeholder="સંખ્યા"
                      min="1"
                      value={discount.item_count}
                      onChange={(e) => updateDiscount(index, 'item_count', parseInt(e.target.value) || 1)}
                      className="w-14 px-1.5 py-0.5 border border-green-200 rounded bg-white"
                    />
                    <span className="text-gray-400">×</span>
                    <input
                      type="number"
                      placeholder="કિંમત"
                      step="1"
                      min="0"
                      value={discount.price}
                      onChange={(e) => updateDiscount(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-16 px-1.5 py-0.5 border border-green-200 rounded bg-white"
                    />
                    <span className="font-medium text-green-600">= ₹{discount.total}</span>
                  </div>
                  <button
                    onClick={() => removeDiscount(index)}
                    className="p-0.5 text-red-500 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={addDiscount}
                className="w-full py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded hover:bg-green-50"
              >
                + ડિસ્કાઉન્ટ ઉમેરો
              </button>
            </div>
          </div>
        )}

        {/* Payments Section */}
        {selectedClient && (
          <div className="overflow-hidden bg-white border border-purple-100 rounded-lg shadow-sm">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-500">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Calculator className="w-3.5 h-3.5" />
                ચુકવણી
              </h3>
            </div>
            
            <div className="p-2 space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="date"
                      value={payment.date}
                      onChange={(e) => updatePayment(index, 'date', e.target.value)}
                      className="w-28 px-1.5 py-0.5 border border-purple-200 rounded bg-white"
                    />
                    <input
                      type="text"
                      placeholder="નોંધ"
                      value={payment.note}
                      onChange={(e) => updatePayment(index, 'note', e.target.value)}
                      className="w-32 px-1.5 py-0.5 border border-purple-200 rounded bg-white"
                    />
                    <span className="text-gray-400">:</span>
                    <input
                      type="number"
                      placeholder="રકમ"
                      step="1"
                      min="0"
                      value={payment.payment_amount}
                      onChange={(e) => updatePayment(index, 'payment_amount', parseFloat(e.target.value) || 0)}
                      className="w-24 px-1.5 py-0.5 border border-purple-200 rounded bg-white"
                    />
                    <span className="font-medium text-purple-600">₹</span>
                  </div>
                  <button
                    onClick={() => removePayment(index)}
                    className="p-0.5 text-red-500 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={addPayment}
                className="w-full py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded hover:bg-purple-50"
              >
                + ચુકવણી ઉમેરો
              </button>
            </div>
          </div>
        )}

        {/* Bill Preview */}
        {billData && (
          <div className="overflow-hidden bg-white border border-green-100 rounded-lg shadow-sm">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
                <TrendingUp className="w-3.5 h-3.5" />
                બિલ પ્રીવ્યૂ
              </h3>
            </div>
            
            <div className="p-2 space-y-2">
              {/* Ledger Entries Table */}
              <div className="mb-4">
                <h4 className="flex items-center gap-2 mb-2 text-sm font-bold text-purple-800">
                  <Package className="w-4 h-4" />
                  વ્યવહાર ખાતાવહી
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded">
                    <thead>
                      <tr className="text-white bg-gradient-to-r from-purple-500 to-violet-500">
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-center">Udhar</th>
                        <th className="px-2 py-1 text-center">Jama</th>
                        <th className="px-2 py-1 text-left">Challan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billData.ledger_entries.map((entry, index) => (
                        <tr key={index} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${
                          entry.entry_type === 'udhar' ? 'border-l-2 border-red-300' : 'border-l-2 border-green-300'
                        }`}>
                          <td className="px-2 py-1 font-medium">
                            {new Date(entry.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-2 py-1 font-bold text-center text-red-600">
                            {entry.udhar > 0 ? entry.udhar : '-'}
                          </td>
                          <td className="px-2 py-1 font-bold text-center text-green-600">
                            {entry.jama > 0 ? entry.jama : '-'}
                          </td>
                          <td className="px-2 py-1 text-xs text-gray-500">
                            #{entry.challan_number}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Date Range Billing Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead>
                    <tr className="text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                      <th className="px-2 py-1 text-left">તારીખ શ્રેણી</th>
                      <th className="px-2 py-1 text-center">પ્લેટ્સ</th>
                      <th className="px-2 py-1 text-center">દિવસ</th>
                      <th className="px-2 py-1 text-center">ભાડો</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billData.date_ranges.map((range, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-2 py-1 font-medium">
                          {range.start_date === range.end_date 
                            ? new Date(range.start_date).toLocaleDateString('en-GB')
                            : `${new Date(range.start_date).toLocaleDateString('en-GB')} – ${new Date(range.end_date).toLocaleDateString('en-GB')}`
                          }
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-blue-600">
                          {range.plate_balance}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-green-600">
                          {range.days}
                        </td>
                        <td className="px-2 py-1 font-bold text-center text-purple-600">
                          ₹{range.rent_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Extra Charges Display */}
              {billData.extra_charges.length > 0 && (
                <div className="p-3 border border-orange-200 rounded bg-orange-50">
                  <h4 className="mb-2 text-sm font-bold text-orange-800">વધારાના ચાર્જ:</h4>
                  <div className="space-y-1">
                    {billData.extra_charges.map((charge, index) => (
                      <div key={index} className="text-xs text-orange-700">
                        [{new Date(charge.date).toLocaleDateString('en-GB')}] {charge.note} {charge.item_count} × ₹{charge.price.toFixed(2)} = ₹{charge.total.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 text-sm font-bold text-orange-800 border-t border-orange-300">
                    કુલ વધારાના ચાર્જ: ₹{billData.extra_charges_total.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Discounts Display */}
              {billData.discounts.length > 0 && (
                <div className="p-3 border border-green-200 rounded bg-green-50">
                  <h4 className="mb-2 text-sm font-bold text-green-800">ડિસ્કાઉન્ટ:</h4>
                  <div className="space-y-1">
                    {billData.discounts.map((discount, index) => (
                      <div key={index} className="text-xs text-green-700">
                        [{new Date(discount.date).toLocaleDateString('en-GB')}] {discount.note} {discount.item_count} × ₹{discount.price.toFixed(2)} = ₹{discount.total.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 text-sm font-bold text-green-800 border-t border-green-300">
                    કુલ ડિસ્કાઉન્ટ: ₹{billData.discounts_total.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Payments Display */}
              {billData.payments.length > 0 && (
                <div className="p-3 border border-purple-200 rounded bg-purple-50">
                  <h4 className="mb-2 text-sm font-bold text-purple-800">ચુકવણી:</h4>
                  <div className="space-y-1">
                    {billData.payments.map((payment, index) => (
                      <div key={index} className="text-xs text-purple-700">
                        [{new Date(payment.date).toLocaleDateString('en-GB')}] {payment.note} : ₹{payment.payment_amount.toFixed(2)}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 text-sm font-bold text-purple-800 border-t border-purple-300">
                    કુલ ચુકવણી: ₹{billData.payments_total.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Final Calculation Summary */}
              <div className="p-3 border border-gray-200 rounded bg-gray-50">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>કુલ ઉધાર:</span>
                    <span className="font-bold">₹{billData.total_udhar.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>સેવા ચાર્જ ({overrideTotalPlates !== undefined ? overrideTotalPlates : billData.total_plates_udhar} પ્લેટ × ₹{billData.service_rate_per_plate}):</span>
                    <span className="font-bold">₹{billData.service_charge.toFixed(2)}</span>
                  </div>
                  {billData.extra_charges_total > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>વધારાના ચાર્જ:</span>
                      <span className="font-bold">+₹{billData.extra_charges_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.discounts_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>ડિસ્કાઉન્ટ:</span>
                      <span className="font-bold">-₹{billData.discounts_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.payments_total > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>ચુકવણી:</span>
                      <span className="font-bold">-₹{billData.payments_total.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.advance_paid > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>અગાઉથી ચૂકવેલ:</span>
                      <span className="font-bold">-₹{billData.advance_paid.toFixed(2)}</span>
                    </div>
                  )}
                  <hr className="border-gray-300" />
                  <div className={`flex justify-between text-xl font-bold ${
                    billData.final_due > 0 ? 'text-red-600' : 
                    billData.balance_carry_forward > 0 ? 'text-green-600' : 'text-green-600'
                  }`}>
                    <span>
                      {billData.final_due > 0 ? 'FINAL DUE:' : 
                       billData.balance_carry_forward > 0 ? 'બેલેન્સ કેરી ફોરવર્ડ:' : 'FULLY PAID:'}
                    </span>
                    <span>
                      ₹{billData.final_due > 0 ? billData.final_due.toFixed(2) : 
                        billData.balance_carry_forward > 0 ? billData.balance_carry_forward.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Closure Option */}
              <div className="overflow-hidden bg-white border-2 border-indigo-100 shadow-lg rounded-xl">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-blue-500">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Target className="w-4 h-4" />
                    એકાઉન્ટ વિકલ્પો
                  </h3>
                </div>
                
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAccountClosure('close')}
                      className={`flex flex-col items-center p-3 transition-all duration-200 border-2 rounded-lg ${
                        accountClosure === 'close'
                          ? 'border-red-500 bg-red-50 shadow-md'
                          : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500">
                        <Lock className="w-5 h-5 text-white" />
                      </div>
                      <span className={`text-sm font-bold ${
                        accountClosure === 'close' ? 'text-red-700' : 'text-gray-700'
                      }`}>એકાઉન્ટ બંધ કરો</span>
                      <span className="text-xs text-gray-500">બેલેન્સ રીસેટ કરો</span>
                    </button>

                    <button
                      onClick={() => setAccountClosure('continue')}
                      className={`flex flex-col items-center p-3 transition-all duration-200 border-2 rounded-lg ${
                        accountClosure === 'continue'
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500">
                        <ArrowRightCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className={`text-sm font-bold ${
                        accountClosure === 'continue' ? 'text-green-700' : 'text-gray-700'
                      }`}>એકાઉન્ટ ચાલુ રાખો</span>
                      <span className="text-xs text-gray-500">બેલેન્સ આગળ લઈ જાઓ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Generate Bill Button */}
              <button
                onClick={handleGenerateBill}
                disabled={generating}
                className="flex items-center justify-center w-full gap-2 py-3 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:scale-105 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    બિલ બનાવી રહ્યા છીએ...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    બિલ જનરેટ કરો
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the component with the name expected by App.tsx
export const MobileBillingPage = ComprehensiveBillManagement;