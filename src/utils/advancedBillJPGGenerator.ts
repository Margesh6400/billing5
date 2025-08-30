import html2canvas from 'html2canvas';
import { AdvancedBillData, BillAdjustment } from './advancedBillingCalculator';

export const generateAdvancedBillJPG = async (
  data: AdvancedBillData,
  adjustments: BillAdjustment[] = []
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

  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return startDate === endDate ? start : `${start} - ${end}`;
  };

  tempDiv.innerHTML = `
    <div style="width:1200px;padding:40px;font-family:'Noto Sans Gujarati','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#ffffff;border:3px solid #1e40af;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #1e40af;padding-bottom:20px;">
        <h1 style="font-size:48px;font-weight:bold;color:#1e40af;margin:0;">નીલકંઠ પ્લેટ ડેપો</h1>
        <p style="font-size:20px;color:#666;margin:8px 0;">Centering Plates Rental Service</p>
        <p style="font-size:16px;color:#888;margin:8px 0;">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
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


      <!-- Date Range Billing Table -->
      <div style="margin-bottom:30px;">
        <h3 style="margin:0 0 20px 0;font-size:24px;color:#1e40af;font-weight:bold;">Date Range Billing / તારીખ શ્રેણી બિલિંગ</h3>
        <table style="width:100%;border-collapse:collapse;font-size:16px;border:2px solid #1e40af;">
          <thead>
            <tr style="background:#1e40af;color:white;">
              <th style="padding:15px;text-align:left;border:1px solid #1e40af;">Date Range / તારીખ શ્રેણી</th>
              <th style="padding:15px;text-align:center;border:1px solid #1e40af;">Plate Balance / પ્લેટ બેલેન્સ</th>
              <th style="padding:15px;text-align:center;border:1px solid #1e40af;">Days / દિવસ</th>
              <th style="padding:15px;text-align:right;border:1px solid #1e40af;">Amount / રકમ (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${data.date_ranges.map((range, index) => `
              <tr style="background:${index % 2 === 0 ? '#f8fafc' : 'white'};">
                <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${formatDateRange(range.start_date, range.end_date)}</td>
                <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:#1e40af;">${range.plate_balance}</td>
                <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${range.days}</td>
                <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#1e40af;">${formatCurrency(range.amount)}</td>
              </tr>
            `).join('')}
            
            <!-- Subtotal Row -->
            <tr style="background:#e0e7ff;border-top:3px solid #1e40af;">
              <td colspan="4" style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">Subtotal / પેટા કુલ:</td>
              <td style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">${formatCurrency(data.subtotal)}</td>
            </tr>

            ${adjustments.map(adjustment => `
              <tr style="background:${adjustment.type === 'charge' ? '#fef3c7' : '#dcfce7'};">
                <td colspan="4" style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-style:italic;color:${adjustment.type === 'charge' ? '#92400e' : '#059669'};">${adjustment.description}:</td>
                <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:${adjustment.type === 'charge' ? '#92400e' : '#059669'};">${adjustment.type === 'charge' ? '+' : '-'}${formatCurrency(Math.abs(adjustment.amount))}</td>
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