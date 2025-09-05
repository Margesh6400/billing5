import html2canvas from 'html2canvas';
import { ComprehensiveBillData } from './comprehensiveBillingCalculator';

export const generateComprehensiveBillJPG = async (data: ComprehensiveBillData): Promise<string> => {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '794px'; // A4 width in pixels at 96 DPI
  tempDiv.style.backgroundColor = 'white';
  document.body.appendChild(tempDiv);

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  // Format date for Gujarati format
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return startDate === endDate ? start : `${start} થી ${end}`;
  };

  // Calculate total transactions to show
  const totalTransactions = Math.max(16, data.ledger_entries.length);
  const emptyRows = totalTransactions - data.ledger_entries.length;

  tempDiv.innerHTML = `
    <div style="width:794px;padding:20px;font-family:'Noto Sans Gujarati','Shruti','Gujarati MT',Arial,sans-serif;color:#000;background:#ffffff;border:3px solid #000;font-size:13px;">
      <!-- Header Section -->
      <div style="border:2px solid #000;margin-bottom:15px;">
        <!-- Top Header with Contact Info -->
        <div style="display:flex;border-bottom:1px solid #000;">
          <div style="width:50%;padding:8px;border-right:1px solid #000;">
            <div style="font-size:11px;text-align:center;">
              <strong>પરમોત્તમભાઈ પોલરા</strong><br>
              (રુપાલટીવાળા)
            </div>
          </div>
          <div style="width:30%;padding:8px;border-right:1px solid #000;text-align:center;">
            <div style="font-size:11px;">
              <strong>શ્રી</strong><br>
              <strong>શ્રી ગણેશાય નમ:</strong>
            </div>
          </div>
          <div style="width:20%;padding:8px;text-align:right;">
            <div style="font-size:10px;">
              સુરેશભાઈ પોલરા - ૯૩૨૮૭ ૨૮૨૨૮<br>
              હરેશભાઈ ફેમર - ૯૦૯૯૨ ૬૪૪૩૬<br>
              હરેશભાઈ પોલરા - ૯૦૯૮૯ ૬૪૪૩૬<br>
            </div>
          </div>
        </div>

        <!-- Main Header -->
        <div style="text-align:center;padding:10px;border-bottom:1px solid #000;">
          <div style="display:flex;align-items:center;justify-content:center;gap:20px;">
            <div style="width:60px;height:60px;background:#f0f0f0;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:#666;">PB</div>
            <div style="flex:1;">
              <h1 style="font-size:36px;font-weight:bold;margin:0;text-decoration:underline;">નિલકંઠ</h1>
              <div style="font-size:24px;font-weight:bold;">પ્લેટ ડેપો</div>
            </div>
            <div style="border:2px solid #000;padding:8px;background:#f9f9f9;">
              <div style="font-size:12px;font-weight:bold;">બિલ નંબર :</div>
              <div style="font-size:16px;font-weight:bold;">${data.bill_number}</div>
            </div>
          </div>
        </div>

        <!-- Address -->
        <div style="text-align:center;padding:5px;font-size:11px;">
          ૧૦, અજમલધામ સોસાયટી,, સીમાડા ગામ, સુરત.
        </div>
      </div>

      <!-- Client Details -->
      <div style="border:2px solid #000;margin-bottom:15px;">
        <div style="display:flex;">
          <div style="width:50%;padding:10px;border-right:1px solid #000;">
            <div><strong>નામ:</strong> ${data.client.name}</div>
            <div style="margin-top:5px;"><strong>સાઇટ:</strong> ${data.client.site || '-'}</div>
          </div>
          <div style="width:25%;padding:10px;border-right:1px solid #000;">
            <div><strong>ID:</strong> ${data.client.id}</div>
            <div style="margin-top:5px;"><strong>તારીખ :</strong> ${formatDate(data.bill_date)}</div>
          </div>
          <div style="width:25%;padding:10px;">
            <div><strong>મોબાઇલ:</strong> ${data.client.mobile_number || '-'}</div>
          </div>
        </div>
      </div>

      <!-- Main Transaction Table -->
      <div style="border:2px solid #000;margin-bottom:15px;">
        <table style="width:100%;border-collapse:collapse;">
          <!-- Table Header -->
          <tr style="background:#000;color:#fff;">
            <th style="border:1px solid #000;padding:8px;width:25%;font-size:11px;font-weight:bold;">આ. તારીખ થી જમા તારીખ</th>
            <th style="border:1px solid #000;padding:8px;width:15%;font-size:11px;font-weight:bold;">જમા/ઉધાર</th>
            <th style="border:1px solid #000;padding:8px;width:12%;font-size:11px;font-weight:bold;">સ્ટોક</th>
            <th style="border:1px solid #000;padding:8px;width:12%;font-size:11px;font-weight:bold;">દિવસ</th>
            <th style="border:1px solid #000;padding:8px;width:15%;font-size:11px;font-weight:bold;">રકમ</th>
          </tr>

          <!-- Date Range Billing Rows -->
          ${data.date_ranges.map((range, index) => `
            <tr style="background:#e6f3ff;">
              <td style="border:1px solid #000;padding:6px;font-size:11px;">${formatDateRange(range.start_date, range.end_date)}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">ભાડો</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">${range.plate_balance}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">${range.days}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:right;">${formatCurrency(range.rent_amount)}</td>
            </tr>
          `).join('')}

          <!-- Service Charge Row -->
          <tr style="background:#fff2e6;">
            <td style="border:1px solid #000;padding:6px;font-size:11px;">સર્વિસ ચાર્જ</td>
            <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">-</td>
            <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">${data.total_plates_udhar}</td>
            <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">@${data.service_rate_per_plate}</td>
            <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:right;">${formatCurrency(data.service_charge)}</td>
          </tr>

          <!-- Extra Charges -->
          ${data.extra_charges.map((charge, index) => `
            <tr style="background:#ffebe6;">
              <td style="border:1px solid #000;padding:6px;font-size:11px;">${formatDate(charge.date)} - ${charge.note}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">વધારો</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">${charge.item_count}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">@${charge.price}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:right;">${formatCurrency(charge.total)}</td>
            </tr>
          `).join('')}

          <!-- Discounts -->
          ${data.discounts.map((discount, index) => `
            <tr style="background:#e6ffe6;">
              <td style="border:1px solid #000;padding:6px;font-size:11px;">${formatDate(discount.date)} - ${discount.note}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">છૂટ</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">${discount.item_count}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">@${discount.price}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:right;">-${formatCurrency(discount.total)}</td>
            </tr>
          `).join('')}

          <!-- Payments -->
          ${data.payments.map((payment, index) => `
            <tr style="background:#f0e6ff;">
              <td style="border:1px solid #000;padding:6px;font-size:11px;">${formatDate(payment.date)} - ${payment.note}</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">ચુકવણી</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">-</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">-</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:right;">-${formatCurrency(payment.payment_amount)}</td>
            </tr>
          `).join('')}

          <!-- Previous Payment if exists -->
          ${data.advance_paid > 0 ? `
            <tr style="background:#e6f0ff;">
              <td style="border:1px solid #000;padding:6px;font-size:11px;">અગાઉથી ચૂકવેલ</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">ચુકવણી</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">-</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:center;">-</td>
              <td style="border:1px solid #000;padding:6px;font-size:11px;text-align:right;">-${formatCurrency(data.advance_paid)}</td>
            </tr>
          ` : ''}

          <!-- Fill remaining empty rows to match template -->
          ${Array.from({ length: Math.max(0, 16 - data.ledger_entries.length - data.date_ranges.length - data.extra_charges.length - data.discounts.length - data.payments.length - (data.advance_paid > 0 ? 1 : 0) - 1) }, (_, index) => `
            <tr>
              <td style="border:1px solid #000;padding:10px;font-size:11px;">&nbsp;</td>
              <td style="border:1px solid #000;padding:10px;font-size:11px;">&nbsp;</td>
              <td style="border:1px solid #000;padding:10px;font-size:11px;">&nbsp;</td>
              <td style="border:1px solid #000;padding:10px;font-size:11px;">&nbsp;</td>
              <td style="border:1px solid #000;padding:10px;font-size:11px;">&nbsp;</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <!-- Bottom Note and Total -->
      <div style="border:2px solid #000;">
        <!-- Note Section -->
        <div style="padding:8px;border-bottom:1px solid #000;font-size:11px;">
          <strong>નોંધ:</strong> આ બીલ મળવા પછી તરત જ બીલ ચુકવવાનું રહેશે.
        </div>

        <!-- Total Section -->
        <div style="display:flex;">
          <div style="width:50%;padding:10px;border-right:1px solid #000;">
            <div style="font-size:11px;"><strong>લેનારની સહી</strong> ....................</div>
          </div>
          <div style="width:30%;padding:10px;border-right:1px solid #000;">
            <div style="font-size:11px;"><strong>આપનારની સહી</strong> ....................</div>
          </div>
          <div style="width:20%;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:bold;">કોર,</div>
            <div style="font-size:11px;font-weight:bold;">નિલકંઠ પ્લેટ ડેપો</div>
          </div>
        </div>

        <!-- Final Amount Box -->
        <div style="border-top:2px solid #000;background:#f0f0f0;padding:15px;text-align:center;">
          <div style="font-size:14px;font-weight:bold;margin-bottom:5px;">
            ${data.final_due > 0 ? 'બાકી રકમ / FINAL DUE' : data.balance_carry_forward > 0 ? 'બેલેન્સ કેરી ફોરવર્ડ' : 'સંપૂર્ણ ચૂકવણી / FULLY PAID'}
          </div>
          <div style="font-size:24px;font-weight:bold;color:${data.final_due > 0 ? '#dc2626' : '#059669'};">
            ${data.final_due > 0 ? formatCurrency(data.final_due) : data.balance_carry_forward > 0 ? formatCurrency(data.balance_carry_forward) : '₹0.00'}
          </div>
          ${data.final_due > 0 || data.balance_carry_forward > 0 ? `
            <div style="font-size:10px;margin-top:5px;color:#666;">
              કુલ ઉધાર: ${formatCurrency(data.total_udhar)} + સર્વિસ: ${formatCurrency(data.service_charge)}
              ${data.extra_charges_total > 0 ? ` + વધારો: ${formatCurrency(data.extra_charges_total)}` : ''}
              ${data.discounts_total > 0 ? ` - છૂટ: ${formatCurrency(data.discounts_total)}` : ''}
              ${data.payments_total > 0 ? ` - ચુકવણી: ${formatCurrency(data.payments_total)}` : ''}
              ${data.advance_paid > 0 ? ` - અગાઉ: ${formatCurrency(data.advance_paid)}` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:10px;font-size:9px;color:#666;">
        Generated on ${new Date().toLocaleString('en-IN')} | NO WERE TECH Billing System
      </div>
    </div>
  `;

  try {
    const canvas = await html2canvas(tempDiv, {
      width: 794,
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
