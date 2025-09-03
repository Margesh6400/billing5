import html2canvas from 'html2canvas';
import { BillCalculation, MatchedChallan, ExtraCharge, Discount } from './enhancedBillingCalculator';

export interface EnhancedBillData {
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
}

export const generateEnhancedBillJPG = async (data: EnhancedBillData): Promise<string> => {
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
      <div style="display:flex;justify-content:space-between;margin-bottom:25px;background:#f8fafc;padding:15px;border-radius:8px;">
        <div>
          <p style="margin:0;font-size:18px;"><strong>Bill No:</strong> ${data.bill_number}</p>
          <p style="margin:5px 0 0 0;font-size:18px;"><strong>Date:</strong> ${formatDate(data.bill_date)}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:16px;color:#666;"><strong>Total Plates:</strong> ${data.total_plates}</p>
          <p style="margin:5px 0 0 0;font-size:16px;color:#666;"><strong>Total Days:</strong> ${data.total_days}</p>
        </div>
      </div>

      <!-- Client Details -->
      <div style="margin-bottom:25px;background:#f1f5f9;padding:15px;border-radius:8px;border-left:4px solid #1e40af;">
        <h3 style="margin:0 0 10px 0;font-size:20px;color:#1e40af;">Client Information / ગ્રાહક માહિતી</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
          <div>
            <p style="margin:0;font-size:16px;"><strong>Name / નામ:</strong> ${data.client.name}</p>
            <p style="margin:5px 0 0 0;font-size:16px;"><strong>Client ID:</strong> ${data.client.id}</p>
          </div>
          <div>
            <p style="margin:0;font-size:16px;"><strong>Site / સાઇટ:</strong> ${data.client.site}</p>
            <p style="margin:5px 0 0 0;font-size:16px;"><strong>Mobile / મોબાઇલ:</strong> ${data.client.mobile}</p>
          </div>
        </div>
      </div>

      <!-- Billing Details Table -->
      <div style="margin-bottom:25px;">
        <h3 style="margin:0 0 15px 0;font-size:20px;color:#1e40af;">Billing Details / બિલિંગ વિગતો</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:2px solid #1e40af;">
          <thead>
            <tr style="background:#1e40af;color:white;">
              <th style="padding:10px;text-align:left;border:1px solid #1e40af;">Challan No</th>
              <th style="padding:10px;text-align:center;border:1px solid #1e40af;">Issue Date</th>
              <th style="padding:10px;text-align:center;border:1px solid #1e40af;">Return Date</th>
              <th style="padding:10px;text-align:left;border:1px solid #1e40af;">Plate Size</th>
              <th style="padding:10px;text-align:center;border:1px solid #1e40af;">Qty</th>
              <th style="padding:10px;text-align:center;border:1px solid #1e40af;">Days</th>
              <th style="padding:10px;text-align:center;border:1px solid #1e40af;">Rate/Day</th>
              <th style="padding:10px;text-align:right;border:1px solid #1e40af;">Amount (₹)</th>
              <th style="padding:10px;text-align:center;border:1px solid #1e40af;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedChallans).map(([challanNumber, items], groupIndex) => {
              return items.map((challan, itemIndex) => `
                <tr style="background:${groupIndex % 2 === 0 ? '#f8fafc' : 'white'};">
                  <td style="padding:8px;border:1px solid #e2e8f0;${itemIndex === 0 ? 'font-weight:bold;' : ''}">${itemIndex === 0 ? challanNumber : ''}</td>
                  <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;">${itemIndex === 0 ? formatDate(challan.issue_date) : ''}</td>
                  <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;">${formatDate(challan.return_date)}</td>
                  <td style="padding:8px;border:1px solid #e2e8f0;">${challan.plate_size}</td>
                  <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${challan.issued_quantity}</td>
                  <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;">${challan.days_used}</td>
                  <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;">${formatCurrency(challan.rate_per_day)}</td>
                  <td style="padding:8px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(challan.service_charge)}</td>
                  <td style="padding:8px;text-align:center;border:1px solid #e2e8f0;">
                    <span style="padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;${
                      challan.is_fully_returned 
                        ? 'background:#dcfce7;color:#166534;' 
                        : challan.is_partial_return 
                          ? 'background:#fef3c7;color:#92400e;'
                          : 'background:#fee2e2;color:#991b1b;'
                    }">
                      ${challan.is_fully_returned ? 'Returned' : challan.is_partial_return ? 'Partial' : 'Pending'}
                    </span>
                  </td>
                </tr>
              `).join('');
            }).join('')}
            
            <!-- Subtotal Row -->
            <tr style="background:#e0e7ff;border-top:2px solid #1e40af;">
              <td colspan="7" style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-size:16px;font-weight:bold;">Subtotal / પેટા કુલ:</td>
              <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-size:16px;font-weight:bold;">${formatCurrency(data.subtotal)}</td>
              <td style="padding:12px;border:1px solid #e2e8f0;"></td>
            </tr>

            ${data.extra_charges.map(charge => `
              <tr style="background:#fef3c7;">
                <td colspan="7" style="padding:8px;text-align:right;border:1px solid #e2e8f0;font-style:italic;">${charge.description}:</td>
                <td style="padding:8px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(charge.amount)}</td>
                <td style="padding:8px;border:1px solid #e2e8f0;"></td>
              </tr>
            `).join('')}

            ${data.discounts.map(discount => `
              <tr style="background:#dcfce7;">
                <td colspan="7" style="padding:8px;text-align:right;border:1px solid #e2e8f0;font-style:italic;">${discount.description}:</td>
                <td style="padding:8px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">-${formatCurrency(discount.amount)}</td>
                <td style="padding:8px;border:1px solid #e2e8f0;"></td>
              </tr>
            `).join('')}

            <!-- Grand Total Row -->
            <tr style="background:#1e40af;color:white;border-top:3px solid #1e40af;">
              <td colspan="7" style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">Grand Total / કુલ રકમ:</td>
              <td style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:20px;font-weight:bold;">${formatCurrency(data.grand_total)}</td>
              <td style="padding:15px;border:1px solid #1e40af;"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary Section -->
      <div style="margin-bottom:25px;background:#f0f9ff;padding:15px;border-radius:8px;border-left:4px solid #0ea5e9;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#0c4a6e;">Bill Summary / બિલ સારાંશ</h4>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;font-size:14px;">
          <div>
            <span style="color:#666;">Total Challans:</span>
            <p style="margin:2px 0 0 0;font-weight:bold;">${Object.keys(groupedChallans).length}</p>
          </div>
          <div>
            <span style="color:#666;">Total Plates:</span>
            <p style="margin:2px 0 0 0;font-weight:bold;">${data.total_plates}</p>
          </div>
          <div>
            <span style="color:#666;">Avg Days/Challan:</span>
            <p style="margin:2px 0 0 0;font-weight:bold;">${Object.keys(groupedChallans).length > 0 ? Math.round(data.total_days / Object.keys(groupedChallans).length) : 0}</p>
          </div>
          <div>
            <span style="color:#666;">Avg Rate:</span>
            <p style="margin:2px 0 0 0;font-weight:bold;">${formatCurrency(data.total_plates > 0 ? data.subtotal / data.total_plates / (data.total_days / data.matched_challans.length || 1) : 0)}</p>
          </div>
        </div>
      </div>

      <!-- Payment Methods -->
      <div style="margin-bottom:25px;background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#92400e;">Payment Methods / ચુકવણીની પદ્ધતિ:</h4>
        <p style="margin:0;font-size:14px;color:#92400e;">Cash | Online Transfer | Cheque | Bank Transfer</p>
        <p style="margin:5px 0 0 0;font-size:12px;color:#92400e;">રોકડ | ઓનલાઇન ટ્રાન્સફર | ચેક | બેંક ટ્રાન્સફર</p>
      </div>

      <!-- Terms and Conditions -->
      <div style="margin-bottom:25px;background:#f0fdf4;padding:15px;border-radius:8px;border-left:4px solid #22c55e;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#166534;">Terms & Conditions / નિયમો અને શરતો:</h4>
        <ul style="margin:0;padding-left:20px;font-size:12px;color:#166534;line-height:1.6;">
          <li>Payment due within 30 days of bill date / બિલ તારીખથી 30 દિવસમાં ચુકવણી</li>
          <li>Late payment charges may apply / મોડી ચુકવણી માટે વધારાનો ચાર્જ લાગુ પડી શકે</li>
          <li>Damaged or lost plates will be charged separately / ખરાબ અથવા ગુમ થયેલી પ્લેટ્સ અલગથી ચાર્જ કરવામાં આવશે</li>
          <li>All disputes subject to local jurisdiction / બધા વિવાદો સ્થાનિક અધિકારક્ષેત્રને આધીન</li>
        </ul>
      </div>

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;border-top:2px solid #1e40af;padding-top:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
          <div style="text-align:center;width:200px;">
            <div style="border-top:2px solid #000;margin-top:60px;padding-top:5px;font-size:14px;">Client's Signature</div>
            <div style="font-size:12px;color:#666;margin-top:2px;">ગ્રાહકની સહી</div>
          </div>
          <div style="text-align:center;width:200px;">
            <div style="border-top:2px solid #000;margin-top:60px;padding-top:5px;font-size:14px;">Authorized Signature</div>
            <div style="font-size:12px;color:#666;margin-top:2px;">અધિકૃત સહી</div>
          </div>
        </div>
        
        <div style="font-size:24px;font-weight:bold;color:#1e40af;margin-bottom:10px;">આભાર! ફરી મળીએ.</div>
        <div style="font-size:14px;color:#666;margin-bottom:5px;">
          સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436
        </div>
        <div style="font-size:12px;color:#999;margin-top:10px;">
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

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    document.body.removeChild(tempDiv);
    return dataUrl;
  } catch (error) {
    document.body.removeChild(tempDiv);
    throw error;
  }
};

export const downloadEnhancedBillJPG = (dataUrl: string, filename: string) => {
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