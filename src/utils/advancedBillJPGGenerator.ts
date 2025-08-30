import html2canvas from 'html2canvas';
import { BillCalculation, MatchedChallan, ExtraCharge, Discount } from './advancedBillingCalculator';

export interface AdvancedBillData {
  bill_number: string;
  client: {
    id: string;
    name: string;
    site: string;
    mobile: string;
  };
  bill_date: string;
  matched_challans: MatchedChallan[];
  subtotal: number;
  extra_charges: ExtraCharge[];
  discounts: Discount[];
  grand_total: number;
  total_plates: number;
  total_days: number;
  total_challans: number;
}

export const generateAdvancedBillJPG = async (data: AdvancedBillData): Promise<string> => {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '1200px';
  tempDiv.style.backgroundColor = 'white';
  document.body.appendChild(tempDiv);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Group challans by challan number for better display
  const groupedChallans = data.matched_challans.reduce((acc, challan) => {
    const key = challan.issue_challan_number;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(challan);
    return acc;
  }, {} as Record<string, MatchedChallan[]>);

  tempDiv.innerHTML = `
    <div style="width:1200px;padding:40px;font-family:'Noto Sans Gujarati','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#ffffff;border:2px solid #1e40af;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #1e40af;padding-bottom:20px;">
        <h1 style="font-size:42px;font-weight:bold;color:#1e40af;margin:0;">નીલકંઠ પ્લેટ ડેપો</h1>
        <p style="font-size:18px;color:#666;margin:5px 0;">Centering Plates Rental Service</p>
        <p style="font-size:14px;color:#888;margin:5px 0;">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
        <h2 style="font-size:32px;font-weight:bold;color:#dc2626;margin:15px 0;">INVOICE / બિલ</h2>
      </div>

      <!-- Bill Info -->
      <div style="display:flex;justify-content:space-between;margin-bottom:25px;background:#f8fafc;padding:15px;border-radius:8px;border:2px solid #e2e8f0;">
        <div>
          <p style="margin:0;font-size:18px;font-weight:bold;"><strong>Bill No:</strong> <span style="color:#1e40af;">${data.bill_number}</span></p>
          <p style="margin:5px 0 0 0;font-size:18px;font-weight:bold;"><strong>Date:</strong> <span style="color:#1e40af;">${formatDate(data.bill_date)}</span></p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:16px;color:#666;"><strong>Total Challans:</strong> ${data.total_challans}</p>
          <p style="margin:5px 0 0 0;font-size:16px;color:#666;"><strong>Total Plates:</strong> ${data.total_plates}</p>
          <p style="margin:5px 0 0 0;font-size:16px;color:#666;"><strong>Total Days:</strong> ${data.total_days}</p>
        </div>
      </div>

      <!-- Client Details -->
      <div style="margin-bottom:25px;background:#f1f5f9;padding:20px;border-radius:8px;border-left:4px solid #1e40af;">
        <h3 style="margin:0 0 15px 0;font-size:20px;color:#1e40af;font-weight:bold;">Client Information / ગ્રાહક માહિતી</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <p style="margin:0;font-size:16px;"><strong>Name / નામ:</strong> ${data.client.name}</p>
            <p style="margin:8px 0 0 0;font-size:16px;"><strong>Client ID:</strong> ${data.client.id}</p>
          </div>
          <div>
            <p style="margin:0;font-size:16px;"><strong>Site / સાઇટ:</strong> ${data.client.site}</p>
            <p style="margin:8px 0 0 0;font-size:16px;"><strong>Mobile / મોબાઇલ:</strong> ${data.client.mobile}</p>
          </div>
        </div>
      </div>

      <!-- Billing Details Table -->
      <div style="margin-bottom:25px;">
        <h3 style="margin:0 0 15px 0;font-size:20px;color:#1e40af;font-weight:bold;">Billing Details / બિલિંગ વિગતો</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:2px solid #1e40af;">
          <thead>
            <tr style="background:#1e40af;color:white;">
              <th style="padding:12px;text-align:left;border:1px solid #1e40af;font-weight:bold;">Challan No</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;font-weight:bold;">Issue Date</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;font-weight:bold;">Return Date</th>
              <th style="padding:12px;text-align:left;border:1px solid #1e40af;font-weight:bold;">Plate Size</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;font-weight:bold;">Qty</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;font-weight:bold;">Days</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;font-weight:bold;">Rate/Day</th>
              <th style="padding:12px;text-align:right;border:1px solid #1e40af;font-weight:bold;">Amount (₹)</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;font-weight:bold;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedChallans).map(([challanNumber, items], groupIndex) => {
              return items.map((challan, itemIndex) => `
                <tr style="background:${groupIndex % 2 === 0 ? '#f8fafc' : 'white'};">
                  <td style="padding:10px;border:1px solid #e2e8f0;${itemIndex === 0 ? 'font-weight:bold;' : ''}">${itemIndex === 0 ? challanNumber : ''}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${itemIndex === 0 ? formatDate(challan.issue_date) : ''}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${formatDate(challan.return_date)}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;font-weight:500;">${challan.plate_size}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:#2563eb;">${challan.issued_quantity}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;font-weight:500;">${challan.days_used}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${formatCurrency(challan.rate_per_day)}</td>
                  <td style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626;">${formatCurrency(challan.service_charge)}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">
                    <span style="padding:4px 8px;border-radius:6px;font-size:11px;font-weight:bold;${
                      challan.is_fully_returned 
                        ? 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;' 
                        : challan.is_partial_return 
                          ? 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;'
                          : 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;'
                    }">
                      ${challan.is_fully_returned ? 'Returned' : challan.is_partial_return ? 'Partial' : 'Pending'}
                    </span>
                  </td>
                </tr>
              `).join('');
            }).join('')}
            
            <!-- Subtotal Row -->
            <tr style="background:#e0e7ff;border-top:2px solid #1e40af;">
              <td colspan="7" style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-size:16px;font-weight:bold;">Subtotal / પેટા કુલ:</td>
              <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-size:16px;font-weight:bold;color:#dc2626;">${formatCurrency(data.subtotal)}</td>
              <td style="padding:15px;border:1px solid #e2e8f0;"></td>
            </tr>

            ${data.extra_charges.map(charge => `
              <tr style="background:#fef3c7;">
                <td colspan="7" style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-style:italic;color:#92400e;">${charge.description}:</td>
                <td style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#92400e;">${formatCurrency(charge.amount)}</td>
                <td style="padding:10px;border:1px solid #e2e8f0;"></td>
              </tr>
            `).join('')}

            ${data.discounts.map(discount => `
              <tr style="background:#dcfce7;">
                <td colspan="7" style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-style:italic;color:#059669;">${discount.description}:</td>
                <td style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">-${formatCurrency(discount.amount)}</td>
                <td style="padding:10px;border:1px solid #e2e8f0;"></td>
              </tr>
            `).join('')}

            <!-- Grand Total Row -->
            <tr style="background:#1e40af;color:white;border-top:3px solid #1e40af;">
              <td colspan="7" style="padding:18px;text-align:right;border:1px solid #1e40af;font-size:20px;font-weight:bold;">Grand Total / કુલ રકમ:</td>
              <td style="padding:18px;text-align:right;border:1px solid #1e40af;font-size:22px;font-weight:bold;">${formatCurrency(data.grand_total)}</td>
              <td style="padding:18px;border:1px solid #1e40af;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary Section -->
      <div style="margin-bottom:25px;background:#f0f9ff;padding:20px;border-radius:8px;border-left:4px solid #0ea5e9;">
        <h4 style="margin:0 0 15px 0;font-size:18px;color:#0c4a6e;font-weight:bold;">Bill Summary / બિલ સારાંશ</h4>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;font-size:14px;">
          <div style="text-align:center;padding:10px;background:white;border-radius:6px;border:1px solid #e0e7ff;">
            <span style="color:#666;font-weight:500;">Total Challans:</span>
            <p style="margin:5px 0 0 0;font-weight:bold;font-size:18px;color:#1e40af;">${data.total_challans}</p>
          </div>
          <div style="text-align:center;padding:10px;background:white;border-radius:6px;border:1px solid #e0e7ff;">
            <span style="color:#666;font-weight:500;">Total Plates:</span>
            <p style="margin:5px 0 0 0;font-weight:bold;font-size:18px;color:#1e40af;">${data.total_plates}</p>
          </div>
          <div style="text-align:center;padding:10px;background:white;border-radius:6px;border:1px solid #e0e7ff;">
            <span style="color:#666;font-weight:500;">Avg Days/Challan:</span>
            <p style="margin:5px 0 0 0;font-weight:bold;font-size:18px;color:#1e40af;">${data.total_challans > 0 ? Math.round(data.total_days / data.total_challans) : 0}</p>
          </div>
          <div style="text-align:center;padding:10px;background:white;border-radius:6px;border:1px solid #e0e7ff;">
            <span style="color:#666;font-weight:500;">Avg Rate:</span>
            <p style="margin:5px 0 0 0;font-weight:bold;font-size:18px;color:#1e40af;">${data.total_plates > 0 && data.total_days > 0 ? formatCurrency(data.subtotal / data.total_plates / (data.total_days / data.matched_challans.length || 1)) : formatCurrency(0)}</p>
          </div>
        </div>
      </div>

      <!-- Payment Methods -->
      <div style="margin-bottom:25px;background:#fef3c7;padding:20px;border-radius:8px;border-left:4px solid #f59e0b;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#92400e;font-weight:bold;">Payment Methods / ચુકવણીની પદ્ધતિ:</h4>
        <p style="margin:0;font-size:14px;color:#92400e;font-weight:500;">Cash | Online Transfer | Cheque | Bank Transfer</p>
        <p style="margin:5px 0 0 0;font-size:12px;color:#92400e;">રોકડ | ઓનલાઇન ટ્રાન્સફર | ચેક | બેંક ટ્રાન્સફર</p>
      </div>

      <!-- Terms and Conditions -->
      <div style="margin-bottom:25px;background:#f0fdf4;padding:20px;border-radius:8px;border-left:4px solid #22c55e;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#166534;font-weight:bold;">Terms & Conditions / નિયમો અને શરતો:</h4>
        <ul style="margin:0;padding-left:20px;font-size:12px;color:#166534;line-height:1.8;">
          <li>Payment due within 30 days of bill date / બિલ તારીખથી 30 દિવસમાં ચુકવણી</li>
          <li>Late payment charges may apply / મોડી ચુકવણી માટે વધારાનો ચાર્જ લાગુ પડી શકે</li>
          <li>Damaged or lost plates will be charged separately / ખરાબ અથવા ગુમ થયેલી પ્લેટ્સ અલગથી ચાર્જ કરવામાં આવશે</li>
          <li>All disputes subject to local jurisdiction / બધા વિવાદો સ્થાનિક અધિકારક્ષેત્રને આધીન</li>
        </ul>
      </div>

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;border-top:2px solid #1e40af;padding-top:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:40px;">
          <div style="text-align:center;width:250px;">
            <div style="border-top:2px solid #000;margin-top:80px;padding-top:8px;font-size:16px;font-weight:500;">Client's Signature</div>
            <div style="font-size:14px;color:#666;margin-top:5px;">ગ્રાહકની સહી</div>
          </div>
          <div style="text-align:center;width:250px;">
            <div style="border-top:2px solid #000;margin-top:80px;padding-top:8px;font-size:16px;font-weight:500;">Authorized Signature</div>
            <div style="font-size:14px;color:#666;margin-top:5px;">અધિકૃત સહી</div>
          </div>
        </div>
        
        <div style="font-size:28px;font-weight:bold;color:#1e40af;margin-bottom:15px;">આભાર! ફરી મળીએ.</div>
        <div style="font-size:16px;color:#666;margin-bottom:8px;font-weight:500;">
          સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436
        </div>
        <div style="font-size:12px;color:#999;margin-top:15px;">
          Generated: ${new Date().toLocaleString('en-IN')} | NO WERE TECH Billing System
        </div>
      </div>
    </div>
  `;

  try {
    const canvas = await html2canvas(tempDiv, {
      width: 1200,
      height: tempDiv.scrollHeight,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      removeContainer: true,
      logging: false
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    document.body.removeChild(tempDiv);
    return dataUrl;
  } catch (error) {
    document.body.removeChild(tempDiv);
    throw error;
  }
};

export const downloadAdvancedBillJPG = (dataUrl: string, filename: string) => {
  try {
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = dataUrl;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the data URL to free memory
    URL.revokeObjectURL(dataUrl);
  } catch (error) {
    console.error('Error downloading JPG:', error);
    alert('Error downloading bill. Please try again.');
  }
};