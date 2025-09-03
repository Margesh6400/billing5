import html2canvas from 'html2canvas';
import { SimpleBillData, ExtraCharge, Discount } from './simpleBillingCalculator';

export const generateSimpleBillJPG = async (
  data: SimpleBillData,
  extraCharges: ExtraCharge[] = [],
  discounts: Discount[] = []
): Promise<string> => {
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

  tempDiv.innerHTML = `
    <div style="width:1200px;padding:40px;font-family:'Noto Sans Gujarati','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#ffffff;border:3px solid #1e40af;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #1e40af;padding-bottom:20px;">
        <h1 style="font-size:48px;font-weight:bold;color:#1e40af;margin:0;">નીલકંઠ પ્લેટ ડેપો</h1>
        <p style="font-size:20px;color:#666;margin:8px 0;">Centering Plates Rental Service</p>
        <p style="font-size:16px;color:#888;margin:8px 0;">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
        <h2 style="font-size:36px;font-weight:bold;color:#dc2626;margin:20px 0;background:#fee2e2;padding:10px;border-radius:8px;">BILL / બિલ</h2>
      </div>

      <!-- Bill Info and Client Details -->
      <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
        <div style="background:#f8fafc;padding:20px;border-radius:8px;border-left:4px solid #1e40af;flex:1;margin-right:20px;">
          <h3 style="margin:0 0 15px 0;font-size:22px;color:#1e40af;font-weight:bold;">Bill Information</h3>
          <p style="margin:0;font-size:18px;"><strong>Bill No:</strong> ${data.bill_number}</p>
          <p style="margin:8px 0 0 0;font-size:18px;"><strong>Bill Date:</strong> ${formatDate(data.bill_date)}</p>
          <p style="margin:8px 0 0 0;font-size:16px;color:#666;"><strong>Rate/Day:</strong> ${formatCurrency(data.rate_per_day)}</p>
        </div>
        
        <div style="background:#f1f5f9;padding:20px;border-radius:8px;border-left:4px solid #059669;flex:1;">
          <h3 style="margin:0 0 15px 0;font-size:22px;color:#059669;font-weight:bold;">Client Details / ગ્રાહક વિગતો</h3>
          <p style="margin:0;font-size:18px;"><strong>Name / નામ:</strong> ${data.client.name}</p>
          <p style="margin:8px 0 0 0;font-size:16px;"><strong>Client ID:</strong> ${data.client.id}</p>
          <p style="margin:8px 0 0 0;font-size:16px;"><strong>Site / સાઇટ:</strong> ${data.client.site || '-'}</p>
          <p style="margin:8px 0 0 0;font-size:16px;"><strong>Mobile / મોબાઇલ:</strong> ${data.client.mobile_number || '-'}</p>
        </div>
      </div>

      <!-- Summary Stats -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:30px;">
        <div style="background:#dbeafe;padding:15px;border-radius:8px;text-align:center;border:2px solid #3b82f6;">
          <div style="font-size:28px;font-weight:bold;color:#1e40af;">${data.total_days}</div>
          <div style="font-size:14px;color:#1e40af;font-weight:600;">Total Billing Days</div>
        </div>
        <div style="background:#dcfce7;padding:15px;border-radius:8px;text-align:center;border:2px solid #22c55e;">
          <div style="font-size:28px;font-weight:bold;color:#059669;">${Math.round(data.total_plates / (data.daily_balances.filter(d => d.days_count > 0).length || 1))}</div>
          <div style="font-size:14px;color:#059669;font-weight:600;">Avg Plates/Day</div>
        </div>
        <div style="background:#fef3c7;padding:15px;border-radius:8px;text-align:center;border:2px solid #f59e0b;">
          <div style="font-size:28px;font-weight:bold;color:#d97706;">${formatCurrency(data.rate_per_day)}</div>
          <div style="font-size:14px;color:#d97706;font-weight:600;">Rate per Plate/Day</div>
        </div>
      </div>

      <!-- Daily Billing Table -->
      <div style="margin-bottom:30px;">
        <h3 style="margin:0 0 20px 0;font-size:24px;color:#1e40af;font-weight:bold;">Daily Billing Details / દૈનિક બિલિંગ વિગતો</h3>
        <table style="width:100%;border-collapse:collapse;font-size:16px;border:2px solid #1e40af;">
          <thead>
            <tr style="background:#1e40af;color:white;">
              <th style="padding:15px;text-align:left;border:1px solid #1e40af;">Date / તારીખ</th>
              <th style="padding:15px;text-align:center;border:1px solid #1e40af;">Plate Balance / પ્લેટ બેલેન્સ</th>
              <th style="padding:15px;text-align:center;border:1px solid #1e40af;">Days Count / દિવસ ગણતરી</th>
              <th style="padding:15px;text-align:center;border:1px solid #1e40af;">Rate/Day / દર/દિવસ</th>
              <th style="padding:15px;text-align:right;border:1px solid #1e40af;">Amount / રકમ (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${data.daily_balances.map((day, index) => `
              <tr style="background:${index % 2 === 0 ? '#f8fafc' : 'white'};">
                <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${formatDate(day.date)}</td>
                <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:#1e40af;">${day.plate_balance}</td>
                <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:${day.days_count === 0 ? '#6b7280' : '#059669'};">${day.days_count}</td>
                <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;">${formatCurrency(day.rate_per_day)}</td>
                <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:${day.amount === 0 ? '#6b7280' : '#1e40af'};">${formatCurrency(day.amount)}</td>
              </tr>
            `).join('')}
            
            <!-- Subtotal Row -->
            <tr style="background:#e0e7ff;border-top:3px solid #1e40af;">
              <td colspan="4" style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">Subtotal / પેટા કુલ:</td>
              <td style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">${formatCurrency(data.subtotal)}</td>
            </tr>

            ${extraCharges.map(charge => `
              <tr style="background:#fef3c7;">
                <td colspan="4" style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-style:italic;color:#92400e;">${charge.description}:</td>
                <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#92400e;">${formatCurrency(charge.amount)}</td>
              </tr>
            `).join('')}

            ${discounts.map(discount => `
              <tr style="background:#dcfce7;">
                <td colspan="4" style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-style:italic;color:#059669;">${discount.description}:</td>
                <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">-${formatCurrency(discount.amount)}</td>
              </tr>
            `).join('')}

            <!-- Grand Total Row -->
            <tr style="background:#1e40af;color:white;border-top:3px solid #1e40af;">
              <td colspan="4" style="padding:20px;text-align:right;border:1px solid #1e40af;font-size:22px;font-weight:bold;">Grand Total / કુલ રકમ:</td>
              <td style="padding:20px;text-align:right;border:1px solid #1e40af;font-size:24px;font-weight:bold;">${formatCurrency(data.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Billing Formula Explanation -->
      <div style="margin-bottom:30px;background:#f0f9ff;padding:20px;border-radius:8px;border-left:4px solid #0ea5e9;">
        <h4 style="margin:0 0 15px 0;font-size:18px;color:#0c4a6e;font-weight:bold;">Billing Formula / બિલિંગ ફોર્મ્યુલા:</h4>
        <div style="font-size:16px;color:#0c4a6e;line-height:1.6;">
          <p style="margin:0 0 8px 0;"><strong>Rule:</strong> Every new date = +1 billing day (first date free)</p>
          <p style="margin:0 0 8px 0;"><strong>Formula:</strong> Amount = Plate Balance × Days Count × Rate/Day</p>
          <p style="margin:0 0 8px 0;"><strong>Total Days:</strong> ${data.total_days} (from ${data.daily_balances.length} unique dates)</p>
          <p style="margin:0;"><strong>Average Daily Usage:</strong> ${Math.round(data.total_plates / (data.daily_balances.filter(d => d.days_count > 0).length || 1))} plates</p>
        </div>
      </div>

      <!-- Payment Methods -->
      <div style="margin-bottom:30px;background:#fef3c7;padding:20px;border-radius:8px;border-left:4px solid #f59e0b;">
        <h4 style="margin:0 0 15px 0;font-size:18px;color:#92400e;font-weight:bold;">Payment Methods / ચુકવણીની પદ્ધતિ:</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;font-size:16px;color:#92400e;">
          <div>• Cash / રોકડ</div>
          <div>• Online Transfer / ઓનલાઇન ટ્રાન્સફર</div>
          <div>• Cheque / ચેક</div>
          <div>• Bank Transfer / બેંક ટ્રાન્સફર</div>
        </div>
      </div>

      <!-- Terms and Conditions -->
      <div style="margin-bottom:30px;background:#f0fdf4;padding:20px;border-radius:8px;border-left:4px solid #22c55e;">
        <h4 style="margin:0 0 15px 0;font-size:18px;color:#166534;font-weight:bold;">Terms & Conditions / નિયમો અને શરતો:</h4>
        <ul style="margin:0;padding-left:25px;font-size:14px;color:#166534;line-height:1.8;">
          <li>Payment due within 30 days of bill date / બિલ તારીખથી 30 દિવસમાં ચુકવણી</li>
          <li>Late payment charges may apply / મોડી ચુકવણી માટે વધારાનો ચાર્જ લાગુ પડી શકે</li>
          <li>Damaged or lost plates charged separately / ખરાબ અથવા ગુમ થયેલી પ્લેટ્સ અલગથી ચાર્જ</li>
          <li>All disputes subject to local jurisdiction / બધા વિવાદો સ્થાનિક અધિકારક્ષેત્રને આધીન</li>
        </ul>
      </div>

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;border-top:3px solid #1e40af;padding-top:25px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:40px;">
          <div style="text-align:center;width:250px;">
            <div style="border-top:2px solid #000;margin-top:80px;padding-top:8px;font-size:16px;font-weight:600;">Client's Signature</div>
            <div style="font-size:14px;color:#666;margin-top:5px;">ગ્રાહકની સહી</div>
          </div>
          <div style="text-align:center;width:250px;">
            <div style="border-top:2px solid #000;margin-top:80px;padding-top:8px;font-size:16px;font-weight:600;">Authorized Signature</div>
            <div style="font-size:14px;color:#666;margin-top:5px;">અધિકૃત સહી</div>
          </div>
        </div>
        
        <div style="font-size:28px;font-weight:bold;color:#1e40af;margin-bottom:15px;">આભાર! ફરી મળીએ.</div>
        <div style="font-size:16px;color:#666;margin-bottom:8px;">
          સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436
        </div>
        <div style="font-size:14px;color:#999;margin-top:15px;">
          Generated: ${new Date().toLocaleString('en-IN')} | NO WERE TECH Simple Billing System
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

export const downloadSimpleBillJPG = (dataUrl: string, filename: string) => {
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