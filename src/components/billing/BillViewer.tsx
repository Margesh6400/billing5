import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/supabase';
import { generateBillJPG, downloadBillJPG } from '../../utils/billJPGGenerator';
import { 
  Download, 
  Eye, 
  Calendar,
  User,
  DollarSign,
  Package,
  Loader2,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

type Bill = Database['public']['Tables']['bills']['Row'] & {
  clients: Database['public']['Tables']['clients']['Row'];
};

interface BillViewerProps {
  bill: Bill;
  onBack: () => void;
}

export function BillViewer({ bill, onBack }: BillViewerProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const jpgDataUrl = await generateBillJPG({
        bill_number: bill.bill_number,
        client: {
          id: bill.clients.id,
          name: bill.clients.name,
          site: bill.clients.site || '',
          mobile: bill.clients.mobile_number || ''
        },
        bill_date: bill.generated_at.split('T')[0],
        period_start: bill.billing_period_start,
        period_end: bill.billing_period_end,
        billing_periods: [], // Would need to fetch from bill_periods table
        total_udhar_quantity: bill.total_udhar_quantity || 0,
        service_charge: bill.service_charge || 0,
        period_charges: bill.period_charges || 0,
        total_amount: bill.total_amount || 0,
        previous_payments: bill.previous_payments || 0,
        net_due: bill.net_due || 0,
        daily_rate: bill.daily_rate || 1,
        service_rate: bill.service_rate || 0
      });

      downloadBillJPG(jpgDataUrl, `bill-${bill.bill_number}-${bill.clients.name.replace(/\s+/g, '-')}`);
    } catch (error) {
      console.error('Error downloading bill:', error);
      alert('Error downloading bill. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4" />;
      case 'partial': return <DollarSign className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">બિલ {bill.bill_number}</h2>
              <p className="text-sm text-gray-600">
                {bill.clients.name} | Period: {format(new Date(bill.billing_period_start), 'dd/MM/yyyy')} - {format(new Date(bill.billing_period_end), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            JPG ડાઉનલોડ કરો
          </button>
        </div>

        {/* Bill Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">ગ્રાહક</p>
                <p className="text-lg font-bold text-gray-900">{bill.clients.name}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">પીરિયડ</p>
                <p className="text-lg font-bold text-gray-900">
                  {differenceInDays(new Date(bill.billing_period_end), new Date(bill.billing_period_start)) + 1} દિવસ
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">કુલ ઉધાર</p>
                <p className="text-lg font-bold text-gray-900">{bill.total_udhar_quantity || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">કુલ રકમ</p>
                <p className="text-lg font-bold text-gray-900">₹{(bill.total_amount || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bill Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">બિલ વિગતો</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">બિલ નંબર</label>
                  <p className="text-gray-900 font-semibold">{bill.bill_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">બિલ તારીખ</label>
                  <p className="text-gray-900 font-semibold">{format(new Date(bill.generated_at), 'dd/MM/yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-500" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">દૈનિક દર</label>
                  <p className="text-gray-900 font-semibold">₹{(bill.daily_rate || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${getStatusColor(bill.payment_status).replace('text-', 'bg-').replace('bg-', 'bg-')}`}>
                  {getStatusIcon(bill.payment_status)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ચુકવણીની સ્થિતિ</label>
                  <p className="text-gray-900 font-semibold">
                    {bill.payment_status === 'paid' ? 'ચૂકવેલ' : 
                     bill.payment_status === 'pending' ? 'બાકી' :
                     bill.payment_status === 'overdue' ? 'મુદત વીતી' : 'આંશિક'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-500" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">કુલ રકમ</label>
                  <p className="text-gray-900 font-semibold">₹{(bill.total_amount || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-500" />
                <div>
                  <label className="block text-sm font-medium text-gray-700">બાકી રકમ</label>
                  <p className="text-gray-900 font-semibold">₹{(bill.net_due || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}