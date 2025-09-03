import html2canvas from 'html2canvas';
import { ComprehensiveBillData } from './comprehensiveBillingCalculator';

export const generateComprehensiveBillJPG = async (data: ComprehensiveBillData): Promise<string> => {
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
    return startDate === endDate ? start : `${start} – ${end}`;
  };

  tempDiv.innerHTML = `
    <div style="width:1200px;padding:40px;font-family:'Noto Sans Gujarati','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#ffffff;border:3px solid #1e40af;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #1e40af;padding-bottom:20px;">
        <h1 style="font-size:48px;font-weight:bold;color:#1e40af;margin:0;">નીલકંઠ પ્લેટ ડેપો</h1>
        <p style="font-size:16px;color:#888;margin:8px 0;">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
       </div>

      <!-- Client Details -->
      <div style="margin-bottom:25px;background:#f1f5f9;padding:20px;border-radius:8px;border-left:4px solid #1e40af;">
        <h3 style="margin:0 0 15px 0;font-size:22px;color:#1e40af;font-weight:bold;">Client Information / ગ્રાહક માહિતી</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <p style="margin:0;font-size:18px;"><strong>નામ:</strong> ${data.client.name}</p>
            <p style="margin:8px 0 0 0;font-size:16px;"><strong>Client ID:</strong> ${data.client.id}</p>
          </div>
          <div>
            <p style="margin:0;font-size:18px;"><strong>સાઇટ:</strong> ${data.client.site || '-'}</p>
            <p style="margin:8px 0 0 0;font-size:16px;"><strong>મોબાઇલ:</strong> ${data.client.mobile_number || '-'}</p>
          </div>
        </div>
        <div style="margin-top:15px;padding:10px;background:#e0e7ff;border-radius:6px;">
          <p style="margin:0;font-size:16px;"><strong>Bill No:</strong> ${data.bill_number} | <strong>Bill Date:</strong> ${formatDate(data.bill_date)}</p>
        </div>
      </div>

      <!-- Date Range Billing Table (Handwritten Format) -->
      <div style="margin-bottom:30px;">
        <div style="border:2px solid #1e40af;border-radius:8px;overflow:hidden;">
          <!-- Table Header -->
          <div style="background:#1e40af;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">RENT CALCULATION / ભાડા ગણતરી</h3>
          </div>
          
          <!-- Billing Table -->
          <table style="width:100%;border-collapse:collapse;font-size:16px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:15px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Date Range / તારીખ શ્રેણી</th>
                <th style="padding:15px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">Plates / પ્લેટ્સ</th>
                <th style="padding:15px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">Days / દિવસ</th>
                <th style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">Rent / ભાડો (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${data.date_ranges.map((range, index) => `
                <tr style="background:${index % 2 === 0 ? '#f8fafc' : 'white'};">
                  <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${formatDateRange(range.start_date, range.end_date)}</td>
                  <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:#1e40af;">${range.plate_balance}</td>
                  <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${range.days}</td>
                  <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626;">${formatCurrency(range.rent_amount)}</td>
                </tr>
              `).join('')}
              
              <!-- Subtotal Rent Row -->
              <tr style="background:#e0e7ff;border-top:3px solid #1e40af;">
                <td colspan="3" style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">Subtotal Rent / પેટા કુલ ભાડો:</td>
                <td style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;color:#dc2626;">${formatCurrency(data.total_rent)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Charges Breakdown -->
      <div style="margin-bottom:30px;">
        <div style="border:2px solid #059669;border-radius:8px;overflow:hidden;">
          <!-- Charges Header -->
          <div style="background:#059669;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">CHARGES BREAKDOWN / ચાર્જ વિભાજન</h3>
          </div>
          
          <!-- Charges Table -->
          <table style="width:100%;border-collapse:collapse;font-size:16px;">
            <tbody>
              <tr style="background:#f0fdf4;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">Service Charge (${data.total_plates_issued} × ₹${data.rates.service_charge_rate}):</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${formatCurrency(data.service_charge)}</td>
              </tr>
              <tr style="background:white;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">Worker/Handling Charge / કામદાર ચાર્જ:</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${formatCurrency(data.worker_charge)}</td>
              </tr>
              ${data.lost_plates_count > 0 ? `
                <tr style="background:#fef2f2;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#dc2626;">Lost Plates Penalty (${data.lost_plates_count} × ₹${data.rates.lost_plate_penalty}) / ગુમ પ્લેટ દંડ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626;">${formatCurrency(data.lost_plate_penalty)}</td>
                </tr>
              ` : ''}
              
              <!-- Grand Total Row -->
              <tr style="background:#1e40af;color:white;border-top:3px solid #1e40af;">
                <td style="padding:20px;border:1px solid #1e40af;font-size:20px;font-weight:bold;">Grand Total / કુલ રકમ:</td>
                <td style="padding:20px;text-align:right;border:1px solid #1e40af;font-size:22px;font-weight:bold;">${formatCurrency(data.grand_total)}</td>
              </tr>
              
              ${data.advance_paid > 0 ? `
                <tr style="background:#dcfce7;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#059669;">Advance Paid / અગાઉથી ચૂકવેલ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">-${formatCurrency(data.advance_paid)}</td>
                </tr>
              ` : ''}
              
              <!-- Final Due Row -->
              <tr style="background:#${data.final_due > 0 ? 'dc2626' : '059669'};color:white;border-top:3px solid #${data.final_due > 0 ? 'dc2626' : '059669'};">
                <td style="padding:25px;border:1px solid #${data.final_due > 0 ? 'dc2626' : '059669'};font-size:24px;font-weight:bold;">
                  ${data.final_due > 0 ? 'FINAL DUE / અંતિમ બાકી:' : 'FULLY PAID / સંપૂર્ણ ચૂકવણી:'}
                </td>
                <td style="padding:25px;text-align:right;border:1px solid #${data.final_due > 0 ? 'dc2626' : '059669'};font-size:28px;font-weight:bold;">
                  ${data.final_due > 0 ? formatCurrency(data.final_due) : '₹0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;border-top:3px solid #1e40af;padding-top:25px;">
        <div style="font-size:28px;font-weight:bold;color:#1e40af;margin-bottom:15px;">આભાર! ફરી મળીએ.</div>
        <div style="font-size:16px;color:#666;margin-bottom:8px;">
          સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436
        </div>
        <div style="font-size:14px;color:#999;margin-top:15px;">
        Generated: ${new Date().toLocaleString('en-IN')} | NO WERE TECH Comprehensive Billing System
        </div>
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

export const downloadComprehensiveBillJPG = (dataUrl: string, filename: string) => {
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