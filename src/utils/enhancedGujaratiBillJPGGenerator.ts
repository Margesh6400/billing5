import html2canvas from 'html2canvas';
import { EnhancedGujaratiBillData } from './enhancedGujaratiBillingCalculator';

export const generateEnhancedGujaratiBillJPG = async (data: EnhancedGujaratiBillData): Promise<string> => {
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

  // Format date in Gujarati style
  const formatGujaratiDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Separate extra charges and discounts
  const extraCharges = data.extra_items.filter(item => item.price > 0);
  const discounts = data.extra_items.filter(item => item.price < 0);

  tempDiv.innerHTML = `
    <div style="width:1200px;padding:40px;font-family:'Noto Sans Gujarati','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#ffffff;border:3px solid #1e40af;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #1e40af;padding-bottom:20px;">
        <h1 style="font-size:48px;font-weight:bold;color:#1e40af;margin:0;">નીલકંઠ પ્લેટ ડેપો</h1>
        <p style="font-size:18px;color:#888;margin:8px 0;">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
        <div style="margin-top:15px;padding:10px;background:#e0e7ff;border-radius:8px;">
          <h2 style="margin:0;font-size:24px;color:#1e40af;font-weight:bold;">ભાડા બિલ / RENT BILL</h2>
        </div>
      </div>

      <!-- Client Details -->
      <div style="margin-bottom:25px;background:#f1f5f9;padding:20px;border-radius:8px;border-left:4px solid #1e40af;">
        <h3 style="margin:0 0 15px 0;font-size:22px;color:#1e40af;font-weight:bold;">ગ્રાહકની માહિતી / Client Information</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <p style="margin:0;font-size:18px;"><strong>ગ્રાહકનું નામ:</strong> ${data.client.name}</p>
            <p style="margin:8px 0 0 0;font-size:16px;"><strong>ગ્રાહક ID:</strong> ${data.client.id}</p>
          </div>
          <div>
            <p style="margin:0;font-size:18px;"><strong>સાઇટ:</strong> ${data.client.site || '-'}</p>
            <p style="margin:8px 0 0 0;font-size:16px;"><strong>મોબાઇલ:</strong> ${data.client.mobile_number || '-'}</p>
          </div>
        </div>
        <div style="margin-top:15px;padding:10px;background:#e0e7ff;border-radius:6px;">
          <p style="margin:0;font-size:16px;"><strong>બિલ નંબર:</strong> ${data.bill_number} | <strong>બિલ તારીખ:</strong> ${formatGujaratiDate(data.bill_date)}</p>
        </div>
      </div>

      <!-- Ledger Table -->
      <div style="margin-bottom:30px;">
        <div style="border:2px solid #1e40af;border-radius:8px;overflow:hidden;">
          <div style="background:#1e40af;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">ખાતાવહી / TRANSACTION LEDGER</h3>
          </div>
          
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:12px;text-align:left;border:1px solid #e5e7eb;font-weight:bold;">તારીખ / Date</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">પ્લેટ્સ</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">ઉધાર / Udhar</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">જમા / Jama</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">બાકી પ્લેટ્સ</th>
                <th style="padding:12px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;">દિવસ / Days</th>
                <th style="padding:12px;text-align:right;border:1px solid #e5e7eb;font-weight:bold;">ભાડું / Rent</th>
                <th style="padding:12px;text-align:left;border:1px solid #e5e7eb;font-weight:bold;">ચલણ નં.</th>
              </tr>
            </thead>
            <tbody>
              ${data.ledger_entries.map((entry, index) => `
                <tr style="background:${index % 2 === 0 ? '#f9fafb' : 'white'};${
                  entry.entry_type === 'udhar' ? 'border-left:3px solid #dc2626;' : 'border-left:3px solid #059669;'
                }">
                  <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;">${formatGujaratiDate(entry.date)}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">${entry.plates_before}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:${entry.udhar > 0 ? '#dc2626' : '#9ca3af'};">${entry.udhar > 0 ? entry.udhar : '-'}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:${entry.jama > 0 ? '#059669' : '#9ca3af'};">${entry.jama > 0 ? entry.jama : '-'}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:#1e40af;">${entry.balance_after}</td>
                  <td style="padding:10px;text-align:center;border:1px solid #e5e7eb;font-weight:bold;color:#7c3aed;">${entry.days}</td>
                  <td style="padding:10px;text-align:right;border:1px solid #e5e7eb;font-weight:bold;color:#dc2626;">${formatCurrency(entry.rent_amount)}</td>
                  <td style="padding:10px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">#${entry.challan_number}</td>
                </tr>
              `).join('')}
              
              <!-- Subtotal Rent Row -->
              <tr style="background:#e0e7ff;border-top:3px solid #1e40af;">
                <td colspan="6" style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;">કુલ ભાડું / Subtotal Rent:</td>
                <td style="padding:15px;text-align:right;border:1px solid #1e40af;font-size:18px;font-weight:bold;color:#dc2626;">${formatCurrency(data.total_rent)}</td>
                <td style="padding:15px;border:1px solid #1e40af;"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Core Charges Breakdown -->
      <div style="margin-bottom:30px;">
        <div style="border:2px solid #059669;border-radius:8px;overflow:hidden;">
          <!-- Charges Header -->
          <div style="background:#059669;color:white;padding:15px;text-align:center;">
            <h3 style="margin:0;font-size:20px;font-weight:bold;">મૂળ ચાર્જ / CORE CHARGES</h3>
          </div>
          
          <!-- Charges Table -->
          <table style="width:100%;border-collapse:collapse;font-size:16px;">
            <tbody>
              <tr style="background:#f0fdf4;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">સર્વિસ ચાર્જ / Service Charge (${data.total_plates_issued} × ₹${data.rates.service_charge_rate}):</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${formatCurrency(data.service_charge)}</td>
              </tr>
              <tr style="background:white;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">મજૂરી ચાર્જ / Worker/Handling Charge:</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">${formatCurrency(data.worker_charge)}</td>
              </tr>
              ${data.lost_plates_count > 0 ? `
                <tr style="background:#fef2f2;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;color:#dc2626;">ગુમ પ્લેટ દંડ / Lost Plates Penalty (${data.lost_plates_count} × ₹${data.rates.lost_plate_penalty}):</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626;">${formatCurrency(data.lost_plate_penalty)}</td>
                </tr>
              ` : ''}
              
              <!-- Core Total Row -->
              <tr style="background:#dcfce7;border-top:2px solid #059669;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;">મૂળ કુલ / Core Total:</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;color:#059669;">${formatCurrency(data.core_total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- NEW: Extra Charges & Discounts Section -->
      ${(extraCharges.length > 0 || discounts.length > 0) ? `
        <div style="margin-bottom:30px;">
          <div style="border:2px solid #f59e0b;border-radius:8px;overflow:hidden;">
            <div style="background:#f59e0b;color:white;padding:15px;text-align:center;">
              <h3 style="margin:0;font-size:20px;font-weight:bold;">વધારાના ચાર્જ / ડિસ્કાઉન્ટ્સ</h3>
            </div>
            
            <table style="width:100%;border-collapse:collapse;font-size:16px;">
              <thead>
                <tr style="background:#fef3c7;">
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">વર્ણન / Description</th>
                  <th style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">સંખ્યા / Count</th>
                  <th style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">દર / Price</th>
                  <th style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">કુલ / Total</th>
                </tr>
              </thead>
              <tbody>
                ${extraCharges.map((item, index) => `
                  <tr style="background:${index % 2 === 0 ? '#fef3c7' : '#fffbeb'};">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${item.note}</td>
                    <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${item.item_count}</td>
                    <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(item.price)}</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626;">${formatCurrency(item.total)}</td>
                  </tr>
                `).join('')}
                
                ${discounts.map((item, index) => `
                  <tr style="background:${index % 2 === 0 ? '#dcfce7' : '#f0fdf4'};">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${item.note}</td>
                    <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${item.item_count}</td>
                    <td style="padding:12px;text-align:center;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(item.price)}</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">-${formatCurrency(Math.abs(item.total))}</td>
                  </tr>
                `).join('')}
                
                <!-- Extra Items Subtotal -->
                <tr style="background:#f59e0b;color:white;border-top:2px solid #f59e0b;">
                  <td colspan="3" style="padding:15px;text-align:right;border:1px solid #f59e0b;font-size:16px;font-weight:bold;">કુલ વધારાના ચાર્જ - ડિસ્કાઉન્ટ:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #f59e0b;font-size:16px;font-weight:bold;">${formatCurrency(data.extra_charges_total - data.discounts_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- NEW: Payments Section -->
      ${data.payments.length > 0 ? `
        <div style="margin-bottom:30px;">
          <div style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;">
            <div style="background:#7c3aed;color:white;padding:15px;text-align:center;">
              <h3 style="margin:0;font-size:20px;font-weight:bold;">ચુકવણી / PAYMENTS</h3>
            </div>
            
            <table style="width:100%;border-collapse:collapse;font-size:16px;">
              <thead>
                <tr style="background:#f3e8ff;">
                  <th style="padding:12px;text-align:left;border:1px solid #e2e8f0;font-weight:bold;">વર્ણન / Description</th>
                  <th style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">રકમ / Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.advance_paid > 0 ? `
                  <tr style="background:#f3e8ff;">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">અગાઉથી ચૂકવેલ / Advance Paid:</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#7c3aed;">${formatCurrency(data.advance_paid)}</td>
                  </tr>
                ` : ''}
                
                ${data.payments.map((payment, index) => `
                  <tr style="background:${index % 2 === 0 ? '#f3e8ff' : 'white'};">
                    <td style="padding:12px;border:1px solid #e2e8f0;font-weight:600;">${payment.note}:</td>
                    <td style="padding:12px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#7c3aed;">${formatCurrency(payment.payment_amount)}</td>
                  </tr>
                `).join('')}
                
                <!-- Total Payments Row -->
                <tr style="background:#7c3aed;color:white;border-top:2px solid #7c3aed;">
                  <td style="padding:15px;border:1px solid #7c3aed;font-size:16px;font-weight:bold;">કુલ ચુકવણી / Total Payments:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #7c3aed;font-size:16px;font-weight:bold;">${formatCurrency(data.advance_paid + data.total_payments)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : (data.advance_paid > 0 ? `
        <div style="margin-bottom:30px;">
          <div style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;">
            <div style="background:#7c3aed;color:white;padding:15px;text-align:center;">
              <h3 style="margin:0;font-size:20px;font-weight:bold;">ચુકવણી / PAYMENTS</h3>
            </div>
            
            <table style="width:100%;border-collapse:collapse;font-size:16px;">
              <tbody>
                <tr style="background:#f3e8ff;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">અગાઉથી ચૂકવેલ / Advance Paid:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#7c3aed;">${formatCurrency(data.advance_paid)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : '')}

      <!-- Final Calculation -->
      <div style="margin-bottom:30px;">
        <div style="border:3px solid #${data.final_due > 0 ? 'dc2626' : '059669'};border-radius:8px;overflow:hidden;">
          <div style="background:#${data.final_due > 0 ? 'dc2626' : '059669'};color:white;padding:20px;text-align:center;">
            <h3 style="margin:0;font-size:24px;font-weight:bold;">અંતિમ ગણતરી / FINAL CALCULATION</h3>
          </div>
          
          <table style="width:100%;border-collapse:collapse;font-size:18px;">
            <tbody>
              <tr style="background:#f8fafc;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">મૂળ કુલ / Core Total:</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(data.core_total)}</td>
              </tr>
              
              ${data.extra_charges_total > 0 ? `
                <tr style="background:#fef3c7;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">વધારાના ચાર્જ / Extra Charges:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#dc2626;">+${formatCurrency(data.extra_charges_total)}</td>
                </tr>
              ` : ''}
              
              ${data.discounts_total > 0 ? `
                <tr style="background:#dcfce7;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">ડિસ્કાઉન્ટ / Discounts:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#059669;">-${formatCurrency(data.discounts_total)}</td>
                </tr>
              ` : ''}
              
              <tr style="background:#e0e7ff;border-top:2px solid #1e40af;">
                <td style="padding:15px;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;">ગોઠવેલ કુલ / Adjusted Total:</td>
                <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;">${formatCurrency(data.adjusted_total)}</td>
              </tr>
              
              ${(data.advance_paid + data.total_payments) > 0 ? `
                <tr style="background:#f3e8ff;">
                  <td style="padding:15px;border:1px solid #e2e8f0;font-weight:600;">કુલ ચૂકવણી / Total Payments:</td>
                  <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;color:#7c3aed;">-${formatCurrency(data.advance_paid + data.total_payments)}</td>
                </tr>
              ` : ''}
              
              <!-- Final Due Row -->
              <tr style="background:#${data.final_due > 0 ? 'dc2626' : '059669'};color:white;border-top:3px solid #${data.final_due > 0 ? 'dc2626' : '059669'};">
                <td style="padding:25px;border:1px solid #${data.final_due > 0 ? 'dc2626' : '059669'};font-size:24px;font-weight:bold;">
                  ${data.final_due > 0 ? 'અંતિમ બાકી / FINAL DUE:' : 'સંપૂર્ણ ચૂકવણી / FULLY PAID:'}
                </td>
                <td style="padding:25px;text-align:right;border:1px solid #${data.final_due > 0 ? 'dc2626' : '059669'};font-size:28px;font-weight:bold;">
                  ${data.final_due > 0 ? formatCurrency(data.final_due) : '₹0.00'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Billing Rules Explanation -->
      <div style="margin-bottom:20px;background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#92400e;font-weight:bold;">બિલિંગ નિયમો / Billing Rules:</h4>
        <ul style="margin:0;padding-left:20px;font-size:14px;color:#92400e;">
          <li>ઉધાર (Udhar): Same day effective / તે જ દિવસે અસરકારક</li>
          <li>જમા (Jama): Next day effective / આગલા દિવસે અસરકારક</li>
          <li>Rate: ₹${data.rates.daily_rent_rate}/plate/day</li>
          <li>First issue date = Day 1 / પ્રથમ ઉધાર તારીખ = દિવસ 1</li>
          <li>Final Due = (Core + Extra - Discounts) - (Advance + Payments)</li>
        </ul>
      </div>

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;border-top:3px solid #1e40af;padding-top:25px;">
        <div style="font-size:28px;font-weight:bold;color:#1e40af;margin-bottom:15px;">આભાર! ફરી મળીએ.</div>
        <div style="font-size:16px;color:#666;margin-bottom:8px;">
          સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436
        </div>
        <div style="font-size:14px;color:#999;margin-top:15px;">
          Generated: ${new Date().toLocaleString('en-IN')} | NO WERE TECH Enhanced Gujarati Billing System
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

export const downloadEnhancedGujaratiBillJPG = (dataUrl: string, filename: string) => {
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