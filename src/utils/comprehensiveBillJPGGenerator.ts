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
        <div style="margin-top:15px;font-size:24px;font-weight:bold;color:#059669;">COMPREHENSIVE BILL / કમ્પ્રીહેન્સિવ બિલ</div>
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

      <!-- Ledger Entries Table -->
      <div style="margin-bottom:30px;">
        <div style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;">
          <div style="background:#7c3aed;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">TRANSACTION LEDGER / વ્યવહાર ખાતાવહી</h3>
            <p style="margin:5px 0 0 0;font-size:12px;opacity:0.9;">જમા આગલા દિવસથી અસરકારક / Jama effective from next day</p>
          </div>
          
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:12px;text-align:left;border:1px solid #e5e7eb;font-weight:bold;">Date / તારીખ</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">પ્લેટ્સ</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">Udhar / ઉધાર</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">Jama / જમા</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">Balance / બેલેન્સ</th>
                <th style="padding:12px;text-align:left;border:1px solid #e5e7eb;font-weight:bold;">Challan No.</th>
              </tr>
            </thead>
            <tbody>
              ${data.ledger_entries.map((entry, index) => `
                <tr style="background:${index % 2 === 0 ? '#f9fafb' : 'white'};">
                  <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;">${formatDate(entry.date)}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">${entry.plates_before}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:${entry.udhar > 0 ? '#dc2626' : '#9ca3af'};">${entry.udhar > 0 ? entry.udhar : '-'}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:${entry.jama > 0 ? '#059669' : '#9ca3af'};">${entry.jama > 0 ? entry.jama : '-'}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:#1e40af;">${entry.balance_after}</td>
                  <td style="padding:10px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">#${entry.challan_number}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Date Range Billing Table -->
      <div style="margin-bottom:30px;">
        <div style="border:2px solid #1e40af;border-radius:8px;overflow:hidden;">
          <div style="background:#1e40af;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">RENT CALCULATION / ભાડા ગણતરી</h3>
            <p style="margin:5px 0 0 0;font-size:12px;opacity:0.9;">Effective Date Based Billing / અસરકારક તારીખ આધારિત બિલિંગ</p>
          </div>
          
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
            </tbody>
          </table>
        </div>
      </div>

      <!-- Total Udhar Section -->
      <div style="margin-bottom:20px;">
        <div style="border:2px solid #1e40af;border-radius:8px;overflow:hidden;">
          <div style="background:#1e40af;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:24px;font-weight:bold;">કુલ ઉધાર: ${formatCurrency(data.total_udhar)}</h3>
          </div>
        </div>
      </div>

      <!-- Service Charge Section -->
      <div style="margin-bottom:20px;">
        <div style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;">
          <div style="background:#7c3aed;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">સેવા ચાર્જ (${data.service_charge_percentage}%): ${formatCurrency(data.service_charge)}</h3>
          </div>
        </div>
      </div>

      <!-- Extra Charges Section -->
      ${data.extra_charges.length > 0 ? `
        <div style="margin-bottom:30px;">
          <div style="border:2px solid #f59e0b;border-radius:8px;overflow:hidden;">
            <div style="background:#f59e0b;color:white;padding:15px;text-align:center;">
              <h3 style="margin:0;font-size:20px;font-weight:bold;">વધારાના ચાર્જ / EXTRA CHARGES</h3>
            </div>
            
            <table style="width:100%;border-collapse:collapse;font-size:16px;">
              <thead>
                <tr style="background:#fef3c7;">
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Date</th>
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Note</th>
                  <th style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">Calculation</th>
                  <th style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.extra_charges.map((charge, index) => `
                  <tr style="background:${index % 2 === 0 ? '#fef3c7' : 'white'};">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${formatDate(charge.date)}</td>
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${charge.note}</td>
                    <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${charge.item_count} × ₹${charge.price.toFixed(2)}</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#f59e0b;">${formatCurrency(charge.total)}</td>
                  </tr>
                `).join('')}
                
                <tr style="background:#f59e0b;color:white;border-top:3px solid #f59e0b;">
                  <td colspan="3" style="padding:15px;border:1px solid #f59e0b;font-size:18px;font-weight:bold;">કુલ વધારાના ચાર્જ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #f59e0b;font-size:18px;font-weight:bold;">${formatCurrency(data.extra_charges_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Discounts Section -->
      ${data.discounts.length > 0 ? `
        <div style="margin-bottom:30px;">
          <div style="border:2px solid #10b981;border-radius:8px;overflow:hidden;">
            <div style="background:#10b981;color:white;padding:15px;text-align:center;">
              <h3 style="margin:0;font-size:20px;font-weight:bold;">ડિસ્કાઉન્ટ / DISCOUNTS</h3>
            </div>
            
            <table style="width:100%;border-collapse:collapse;font-size:16px;">
              <thead>
                <tr style="background:#d1fae5;">
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Date</th>
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Note</th>
                  <th style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">Calculation</th>
                  <th style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.discounts.map((discount, index) => `
                  <tr style="background:${index % 2 === 0 ? '#d1fae5' : 'white'};">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${formatDate(discount.date)}</td>
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${discount.note}</td>
                    <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${discount.item_count} × ₹${discount.price.toFixed(2)}</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#10b981;">${formatCurrency(discount.total)}</td>
                  </tr>
                `).join('')}
                
                <tr style="background:#10b981;color:white;border-top:3px solid #10b981;">
                  <td colspan="3" style="padding:15px;border:1px solid #10b981;font-size:18px;font-weight:bold;">કુલ ડિસ્કાઉન્ટ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #10b981;font-size:18px;font-weight:bold;">-${formatCurrency(data.discounts_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Payments Section -->
      ${data.payments.length > 0 ? `
        <div style="margin-bottom:30px;">
          <div style="border:2px solid #8b5cf6;border-radius:8px;overflow:hidden;">
            <div style="background:#8b5cf6;color:white;padding:15px;text-align:center;">
              <h3 style="margin:0;font-size:20px;font-weight:bold;">ચુકવણી / PAYMENTS</h3>
            </div>
            
            <table style="width:100%;border-collapse:collapse;font-size:16px;">
              <thead>
                <tr style="background:#ede9fe;">
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Date</th>
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">Note</th>
                  <th style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.payments.map((payment, index) => `
                  <tr style="background:${index % 2 === 0 ? '#ede9fe' : 'white'};">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${formatDate(payment.date)}</td>
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${payment.note}</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#8b5cf6;">${formatCurrency(payment.payment_amount)}</td>
                  </tr>
                `).join('')}
                
                <tr style="background:#8b5cf6;color:white;border-top:3px solid #8b5cf6;">
                  <td colspan="2" style="padding:15px;border:1px solid #8b5cf6;font-size:18px;font-weight:bold;">કુલ ચુકવણી:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #8b5cf6;font-size:18px;font-weight:bold;">-${formatCurrency(data.payments_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Final Calculation -->
      <div style="margin-bottom:30px;">
        <div style="border:3px solid #059669;border-radius:8px;overflow:hidden;">
          <div style="background:#059669;color:white;padding:20px;text-align:center;">
            <h3 style="margin:0;font-size:24px;font-weight:bold;">FINAL CALCULATION / અંતિમ ગણતરી</h3>
          </div>
          
          <table style="width:100%;border-collapse:collapse;font-size:18px;">
            <tbody>
              <tr style="background:#f0fdf4;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">કુલ ઉધાર:</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${formatCurrency(data.total_udhar)}</td>
              </tr>
              <tr style="background:#f3f4f6;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">સેવા ચાર્જ (${data.total_plates_udhar} પ્લેટ × ₹${data.service_rate_per_plate}):</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#7c3aed;">${formatCurrency(data.service_charge)}</td>
              </tr>
              
              ${data.extra_charges_total > 0 ? `
                <tr style="background:#fef3c7;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#f59e0b;">વધારાના ચાર્જ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#f59e0b;">+${formatCurrency(data.extra_charges_total)}</td>
                </tr>
              ` : ''}
              
              ${data.discounts_total > 0 ? `
                <tr style="background:#d1fae5;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#10b981;">ડિસ્કાઉન્ટ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#10b981;">-${formatCurrency(data.discounts_total)}</td>
                </tr>
              ` : ''}
              
              ${data.payments_total > 0 ? `
                <tr style="background:#ede9fe;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#8b5cf6;">ચુકવણી:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#8b5cf6;">-${formatCurrency(data.payments_total)}</td>
                </tr>
              ` : ''}
              
              ${data.advance_paid > 0 ? `
                <tr style="background:#e0e7ff;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#1e40af;">અગાઉથી ચૂકવેલ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#1e40af;">-${formatCurrency(data.advance_paid)}</td>
                </tr>
              ` : ''}
              
              <!-- Final Due Row -->
              <tr style="background:#${data.final_due > 0 ? 'dc2626' : data.balance_carry_forward > 0 ? '10b981' : '059669'};color:white;border-top:3px solid #${data.final_due > 0 ? 'dc2626' : data.balance_carry_forward > 0 ? '10b981' : '059669'};">
                <td style="padding:25px;border:1px solid #${data.final_due > 0 ? 'dc2626' : '059669'};font-size:28px;font-weight:bold;">
                  ${data.final_due > 0 ? 'FINAL DUE / અંતિમ બાકી:' : data.balance_carry_forward > 0 ? 'બેલેન્સ કેરી ફોરવર્ડ:' : 'FULLY PAID / સંપૂર્ણ ચૂકવણી:'}
                </td>
                <td style="padding:25px;text-align:right;border:1px solid #${data.final_due > 0 ? 'dc2626' : data.balance_carry_forward > 0 ? '10b981' : '059669'};font-size:32px;font-weight:bold;">
                  ${data.final_due > 0 ? formatCurrency(data.final_due) : data.balance_carry_forward > 0 ? formatCurrency(data.balance_carry_forward) : '₹0.00'}
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
          Generated: ${new Date().toLocaleString('en-IN')} | NO WERE TECH Dynamic Billing System
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