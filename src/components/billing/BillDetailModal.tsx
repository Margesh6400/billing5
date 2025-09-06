import React from 'react';
import { Database } from '../../lib/supabase';
import { X, Download, Copy, Calendar, User, DollarSign, Package, FileText } from 'lucide-react';

type Client = Database['public']['Tables']['clients']['Row'];
type Bill = Database['public']['Tables']['bills']['Row'];
type BillLineItem = Database['public']['Tables']['bill_line_items']['Row'];

interface BillWithClient extends Bill {
  client: Client;
  bill_line_items: BillLineItem[];
}

interface BillDetailModalProps {
  bill: BillWithClient;
  onClose: () => void;
  onDownload: () => void;
  onRegenerate?: () => void;
}

export function BillDetailModal({ bill, onClose, onDownload, onRegenerate }: BillDetailModalProps) {
  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB');

  // Group line items by type
  const rentItems = bill.bill_line_items.filter(item => item.item_type === 'rent');
  const serviceChargeItems = bill.bill_line_items.filter(item => item.item_type === 'service_charge');
  const extraChargeItems = bill.bill_line_items.filter(item => item.item_type === 'extra_charge');
  const discountItems = bill.bill_line_items.filter(item => item.item_type === 'discount');
  const paymentItems = bill.bill_line_items.filter(item => item.item_type === 'payment');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 text-white bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h2 className="text-lg font-bold">બિલ વિગતો</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 transition-colors rounded-lg hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Bill Header Info */}
          <div className="p-4 border-2 border-blue-100 rounded-lg bg-blue-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-bold text-blue-900">{bill.bill_number}</h3>
                <p className="text-sm text-blue-700">બિલ નંબર</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-900">{formatDate(bill.billing_period_end)}</p>
                <p className="text-sm text-blue-700">બિલ તારીખ</p>
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-900">
              <User className="w-4 h-4 text-blue-600" />
              ગ્રાહક માહિતી
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">{bill.client.name}</p>
                <p className="text-gray-600">ID: {bill.client.id}</p>
              </div>
              <div>
                <p className="text-gray-600">{bill.client.site}</p>
                <p className="text-gray-600">{bill.client.mobile_number}</p>
              </div>
            </div>
          </div>

          {/* Billing Period */}
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-900">
              <Calendar className="w-4 h-4 text-green-600" />
              બિલિંગ પીરિયડ
            </h4>
            <div className="text-sm">
              <p className="text-gray-600">
                {formatDate(bill.billing_period_start)} થી {formatDate(bill.billing_period_end)}
              </p>
            </div>
          </div>

          {/* Rent Details */}
          {rentItems.length > 0 && (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-900">
                <Package className="w-4 h-4 text-purple-600" />
                ભાડા વિગતો
              </h4>
              <div className="space-y-2">
                {rentItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.description}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Charge */}
          {serviceChargeItems.length > 0 && (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-900">
                <DollarSign className="w-4 h-4 text-blue-600" />
                સર્વિસ ચાર્જ
              </h4>
              <div className="space-y-2">
                {serviceChargeItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.description}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra Charges */}
          {extraChargeItems.length > 0 && (
            <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-orange-900">
                <DollarSign className="w-4 h-4 text-orange-600" />
                વધારાના ચાર્જ
              </h4>
              <div className="space-y-2">
                {extraChargeItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-orange-700">{item.description}</span>
                    <span className="font-medium text-orange-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discounts */}
          {discountItems.length > 0 && (
            <div className="p-4 border border-green-200 rounded-lg bg-green-50">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-green-900">
                <DollarSign className="w-4 h-4 text-green-600" />
                ડિસ્કાઉન્ટ
              </h4>
              <div className="space-y-2">
                {discountItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-green-700">{item.description}</span>
                    <span className="font-medium text-green-900">{formatCurrency(Math.abs(item.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments */}
          {paymentItems.length > 0 && (
            <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
              <h4 className="flex items-center gap-2 mb-3 text-sm font-bold text-purple-900">
                <DollarSign className="w-4 h-4 text-purple-600" />
                ચુકવણી
              </h4>
              <div className="space-y-2">
                {paymentItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-purple-700">{item.description}</span>
                    <span className="font-medium text-purple-900">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Summary */}
          <div className="p-4 border-2 border-gray-300 rounded-lg bg-gray-100">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">કુલ રકમ:</span>
                <span className="font-bold">{formatCurrency(bill.total_amount)}</span>
              </div>
              {bill.advance_paid > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>અગાઉથી ચૂકવેલ:</span>
                  <span className="font-medium">-{formatCurrency(bill.advance_paid)}</span>
                </div>
              )}
              {bill.payments_total > 0 && (
                <div className="flex justify-between text-purple-600">
                  <span>ચુકવણી:</span>
                  <span className="font-medium">-{formatCurrency(bill.payments_total)}</span>
                </div>
              )}
              <hr className="border-gray-300" />
              <div className={`flex justify-between text-lg font-bold ${
                bill.final_due > 0 ? 'text-red-600' : 
                bill.balance_carry_forward > 0 ? 'text-green-600' : 'text-green-600'
              }`}>
                <span>
                  {bill.final_due > 0 ? 'અંતિમ બાકી:' : 
                   bill.balance_carry_forward > 0 ? 'બેલેન્સ કેરી ફોરવર્ડ:' : 'સંપૂર્ણ ચૂકવેલ:'}
                </span>
                <span>
                  {formatCurrency(bill.final_due > 0 ? bill.final_due : 
                    bill.balance_carry_forward > 0 ? bill.balance_carry_forward : 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onDownload}
              className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:scale-105"
            >
              <Download className="w-4 h-4" />
              JPG ડાઉનલોડ કરો
            </button>
            
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-medium text-white transition-all duration-200 transform rounded-lg shadow-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 hover:shadow-xl hover:scale-105"
              >
                <Copy className="w-4 h-4" />
                ફરીથી બનાવો
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}