import React from 'react';
import { format } from 'date-fns';

export interface BillLineItem {
  id: string;
  description: string;
  from_date: string;
  to_date: string;
  udhar_quantity: number;
  jama_quantity: number;
  plates_on_rent: number;
  rate_per_plate: number;
  days: number;
  amount: number;
  type: 'transaction' | 'manual';
}

export interface BillData {
  bill_number: string;
  bill_date: string;
  client: {
    id: string;
    name: string;
    site: string;
    mobile: string;
  };
  line_items: BillLineItem[];
  subtotal: number;
  grand_total: number;
  notes?: string;
}

interface BillTemplateProps {
  data: BillData;
  className?: string;
}

export function BillTemplate({ data, className = '' }: BillTemplateProps) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const calculateDays = (fromDate: string, toDate: string) => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
    return diffDays;
  };

  return (
    <div className={`bg-white p-8 max-w-[210mm] mx-auto ${className}`} style={{ fontFamily: "'Noto Sans Gujarati', sans-serif" }}>
      {/* Header */}
      <div className="text-center mb-8 border-b-4 border-blue-600 pb-6">
        <h1 className="text-4xl font-bold text-blue-900 mb-2">નીલકંઠ પ્લેટ ડેપો</h1>
        <p className="text-lg text-gray-600 mb-2">Centering Plates Rental Service</p>
        <p className="text-sm text-gray-500">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
        <div className="mt-4">
          <h2 className="text-3xl font-bold text-red-600">BILL / બિલ</h2>
        </div>
      </div>

      {/* Bill Info */}
      <div className="flex justify-between mb-6 bg-gray-50 p-4 rounded-lg border">
        <div>
          <p className="text-lg font-semibold">Bill No: <span className="text-blue-600">{data.bill_number}</span></p>
          <p className="text-sm text-gray-600 mt-1">Generated on: {formatDate(data.bill_date)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">Date: <span className="text-blue-600">{formatDate(data.bill_date)}</span></p>
          <p className="text-sm text-gray-600 mt-1">NO WERE TECH</p>
        </div>
      </div>

      {/* Client Details */}
      <div className="mb-8 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
        <h3 className="text-xl font-bold text-blue-900 mb-3">Client Information / ગ્રાહક માહિતી</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-base"><strong>Name / નામ:</strong> {data.client.name}</p>
            <p className="text-base mt-2"><strong>Client ID:</strong> {data.client.id}</p>
          </div>
          <div>
            <p className="text-base"><strong>Site / સાઇટ:</strong> {data.client.site}</p>
            <p className="text-base mt-2"><strong>Mobile / મોબાઇલ:</strong> {data.client.mobile}</p>
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Bill Details / બિલ વિગતો</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-blue-600">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="border border-blue-600 px-3 py-3 text-left text-sm font-bold">Sr No</th>
                <th className="border border-blue-600 px-3 py-3 text-left text-sm font-bold">Description</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">From Date</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">To Date</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">Udhar Qty</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">Jama Qty</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">Plates on Rent</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">Rate/Plate</th>
                <th className="border border-blue-600 px-3 py-3 text-center text-sm font-bold">Days</th>
                <th className="border border-blue-600 px-3 py-3 text-right text-sm font-bold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.line_items.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium">{index + 1}</td>
                  <td className="border border-gray-300 px-3 py-2">{item.description}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatDate(item.from_date)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatDate(item.to_date)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-red-600">
                    {item.udhar_quantity > 0 ? `+${item.udhar_quantity}` : '-'}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-green-600">
                    {item.jama_quantity > 0 ? `-${item.jama_quantity}` : '-'}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-600">
                    {item.plates_on_rent}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">₹{item.rate_per_plate.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium">{item.days}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-bold">₹{item.amount.toFixed(2)}</td>
                </tr>
              ))}
              
              {/* Totals Row */}
              <tr className="bg-blue-100 border-t-2 border-blue-600">
                <td colSpan={9} className="border border-gray-300 px-3 py-3 text-right font-bold text-lg">
                  Grand Total / કુલ રકમ:
                </td>
                <td className="border border-gray-300 px-3 py-3 text-right font-bold text-xl text-red-600">
                  ₹{data.grand_total.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes Section */}
      {data.notes && (
        <div className="mb-8 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
          <h4 className="font-bold text-gray-900 mb-2">Notes / નોંધ:</h4>
          <p className="text-gray-700">{data.notes}</p>
        </div>
      )}

      {/* Payment Methods */}
      <div className="mb-8 bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
        <h4 className="font-bold text-green-800 mb-2">Payment Methods / ચુકવણીની પદ્ધતિ:</h4>
        <p className="text-green-700">Cash | Online Transfer | Cheque | Bank Transfer</p>
        <p className="text-sm text-green-600 mt-1">રોકડ | ઓનલાઇન ટ્રાન્સફર | ચેક | બેંક ટ્રાન્સફર</p>
      </div>

      {/* Signature Section */}
      <div className="mt-12">
        <div className="flex justify-between items-end mb-8">
          <div className="text-center w-48">
            <div className="border-t-2 border-black mt-16 pt-2">
              <p className="font-medium">Client's Signature</p>
              <p className="text-sm text-gray-600">ગ્રાહકની સહી</p>
            </div>
          </div>
          <div className="text-center w-48">
            <div className="border-t-2 border-black mt-16 pt-2">
              <p className="font-medium">Authorized Signature</p>
              <p className="text-sm text-gray-600">અધિકૃત સહી</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 pt-6 border-t-2 border-blue-600">
        <div className="text-2xl font-bold text-blue-900 mb-2">આભાર! ફરી મળીએ.</div>
        <div className="text-sm text-gray-600 space-y-1">
          <p>સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436</p>
          <p className="text-xs text-gray-500">Generated: {new Date().toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  );
}