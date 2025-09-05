import html2canvas from 'html2canvas';
import { ComprehensiveBillData } from './comprehensiveBillingCalculator';

export const generateComprehensiveBillJPG = async (data: ComprehensiveBillData): Promise<string> => {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '794px';
  tempDiv.style.backgroundColor = 'white';
  document.body.appendChild(tempDiv);

  // Formatters
  const formatCurrency = (amt: number) => `₹${amt.toFixed(2)}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB');
  const formatDateRange = (start: string, end: string) =>
    start === end
      ? formatDate(start)
      : `${formatDate(start)} થી ${formatDate(end)}`;

  // Row calculations
  const tableRows =
    16
    - data.date_ranges.length
    - data.extra_charges.length
    - data.discounts.length
    - data.payments.length
    - (data.advance_paid > 0 ? 1 : 0);

  tempDiv.innerHTML = `
  <div style="width:794px;padding:20px 15px 15px 15px;font-family:'Noto Sans Gujarati','Shruti','Gujarati MT',Arial,sans-serif;color:#000;background:#fff;border:3px solid #000;font-size:15px;">
    <!-- Header -->
    <div style="padding-bottom:2px;border-bottom:2px solid #000;">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-size:13px;line-height:1.45;font-weight:bold;">
          પરમોત્તમભાઈ પોલરા<br>(રુપાલਟੀવાળા)
        </div>
        <div style="font-size:13px;text-align:center;font-weight:bold;">
          શ્રી ૧<br>શ્રી ગણેશાય નમ:
        </div>
        <div style="font-size:13px;text-align:right;line-height:1.45;min-width:160px;">
          સુરેશભાઈ પોલરા - ૯૩૨૮૭ ૨૮૨૨૮<br>
          હરેશભાઈ ફેમર - ૯૦૯૯૨ ૬૪૪૩૬<br>
          હરેશભાઈ પોલરા - ૯૦૯૮૯ ૬૪૪૩૬
        </div>
      </div>
    </div>
    <div style="margin-top:5px;display:flex;justify-content:space-between;align-items:center;">
      <div></div>
      <div style="text-align:center;">
        <span style="font-size:38px;font-weight:bold;background:transparent;">નિલકંઠ</span>
        <div style="font-size:22px;font-weight:bold;margin-top:3px;">પ્લેટ ડેપો</div>
      </div>
      <div style="border:2px solid #000;border-radius:8px;padding:10px;min-width:90px;text-align:center;background:#fff;">
        <div style="font-size:13px;">બિલ નંબર :</div>
        <div style="font-size:21px;font-weight:bold;">${data.bill_number}</div>
      </div>
    </div>
    <div style="text-align:left;font-size:15px;margin-top:2px;margin-bottom:5px;">
      ૧૦, અજમલધામ સોસાયટી,, સીમાડા ગામ, સુરત.
    </div>
    <!-- Customer -->
    <div style="margin-bottom:4px;display:flex;">
      <div style="flex:2;border:2px solid #000;padding:7px;">
        <div><strong>નામ:</strong> <span style="border-bottom:1.7px solid #000;margin-left:2px;">${data.client.name}</span></div>
        <div><strong>સાઇટ:</strong> <span style="border-bottom:1.7px solid #000;margin-left:2px;">${data.client.site || '-'}</span></div>
      </div>
      <div style="flex:1;border:2px solid #000;border-left:none;padding:7px;">
        <div><strong>ID:</strong> <span style="border-bottom:1.7px solid #000;margin-left:2px;">${data.client.id}</span></div>
        <div><strong>તારીખ:</strong> <span style="border-bottom:1.7px solid #000;margin-left:2px;">${formatDate(data.bill_date)}</span></div>
      </div>
    </div>
    <!-- Table -->
    <table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:16px;">
      <tr style="background:#222;color:#fff;">
        <th style="border:1.7px solid #000;padding:5px 2px;width:26%;font-size:15px;font-weight:bold;">આ. તારીખ થી જમા તારીખ</th>
        <th style="border:1.7px solid #000;padding:5px;width:14%;font-size:15px;font-weight:bold;">જમા/ઉધાર</th>
        <th style="border:1.7px solid #000;padding:5px;width:14%;font-size:15px;font-weight:bold;">સ્ટોક</th>
        <th style="border:1.7px solid #000;padding:5px;width:14%;font-size:15px;font-weight:bold;">દિવસ</th>
        <th style="border:1.7px solid #000;padding:5px;width:17%;font-size:15px;font-weight:bold;">રકમ</th>
      </tr>
      ${data.date_ranges.map(
        (range) => `
        <tr>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;font-size:15px;">${formatDateRange(range.start_date, range.end_date)}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;font-size:15px;">ભાડો</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;font-size:15px;">${range.plate_balance}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;font-size:15px;">${range.days}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:right;font-size:15px;">${formatCurrency(range.rent_amount)}</td>
        </tr>
      `
      ).join('')}
      <!-- Service Charge -->
      <tr>
        <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">સર્વિસ ચાર્જ</td>
        <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">-</td>
        <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">${data.total_plates_udhar}</td>
        <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">@${data.service_rate_per_plate}</td>
        <td style="border:1.2px solid #000;padding:9px 3px;text-align:right;">${formatCurrency(data.service_charge)}</td>
      </tr>
      <!-- Extra Charges -->
      ${data.extra_charges.map(
        (charge) => `
        <tr>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">${formatDate(charge.date)} - ${charge.note}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">વધારો</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">${charge.item_count}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">@${charge.price}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:right;">${formatCurrency(charge.total)}</td>
        </tr>
      `
      ).join('')}
      <!-- Discounts -->
      ${data.discounts.map(
        (discount) => `
        <tr>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">${formatDate(discount.date)} - ${discount.note}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">છૂટ</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">${discount.item_count}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">@${discount.price}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:right;">-${formatCurrency(discount.total)}</td>
        </tr>
      `
      ).join('')}
      <!-- Payments -->
      ${data.payments.map(
        (payment) => `
        <tr>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">${formatDate(payment.date)} - ${payment.note}</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">ચુકવણી</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">-</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">-</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:right;">-${formatCurrency(payment.payment_amount)}</td>
        </tr>
      `
      ).join('')}
      <!-- Previous Payment -->
      ${data.advance_paid > 0
        ? `
        <tr>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">અગાઉથી ચૂકવેલ</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">ચુકવણી</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">-</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:center;">-</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:right;">-${formatCurrency(data.advance_paid)}</td>
        </tr>
      `
        : ''}
      <!-- Empty Rows -->
      ${Array.from({ length: Math.max(0, tableRows) }, () => `
        <tr>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">&nbsp;</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">&nbsp;</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">&nbsp;</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">&nbsp;</td>
          <td style="border:1.2px solid #000;padding:9px 3px;text-align:left;">&nbsp;</td>
        </tr>
      `).join('')}
    </table>
    <!-- Summary/Grand Total -->
    <div style="padding:11px 7px 2px 7px;border:2px solid #000;border-top:none;border-bottom:none;font-size:15px;">
      <div style="display:flex;justify-content:flex-end;">
        <div style="font-weight:bold;">કુલ રકમ / Grand Total:</div>
        <div style="margin-left:25px;font-weight:bold;">${formatCurrency(data.total_udhar + data.service_charge + data.extra_charges_total)}</div>
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <div style="">ચુકવેલ / Paid:</div>
        <div style="margin-left:16px;">${formatCurrency(data.payments_total + data.advance_paid)}</div>
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <div style="font-weight:bold;color:#dc2626;">બાકી રકમ / Balance:</div>
        <div style="margin-left:16px;font-weight:bold;color:#dc2626;">${formatCurrency(data.final_due)}</div>
      </div>
      ${data.balance_carry_forward > 0 ? `
        <div style="display:flex;justify-content:flex-end;">
          <div style="font-weight:bold;">કેરી ફોરવર્ડ / Carry Forward:</div>
          <div style="margin-left:12px;font-weight:bold;">${formatCurrency(data.balance_carry_forward)}</div>
        </div>
      ` : ''}
    </div>
    <!-- Note -->
    <div style="border:2px solid #000;border-top:none;padding:8px 6px 2px 6px;font-size:15px;">
      <strong>નોટઃ</strong> આ બીલ મળ્યા પછી તરત જ બીલ ચુકવવાનું રહેશે.
    </div>
    <!-- Signature Section / Footer -->
    <div style="display:flex;align-items:center;border:2px solid #000;border-top:none;padding:10px 8px;">
      <div style="width:44%;border-right:2px solid #000;padding-right:10px;">
        <strong>લેનારની સહી</strong> <span style="display:inline-block;border-bottom:1.5px solid #000;width:120px;margin-left:10px;">&nbsp;</span>
      </div>
      <div style="width:36%;border-right:2px solid #000;padding-right:10px;">
        <strong>આપનારની સહી</strong> <span style="display:inline-block;border-bottom:1.5px solid #000;width:120px;margin-left:10px;">&nbsp;</span>
      </div>
      <div style="flex:1;padding-left:12px;text-align:center;">
        <div style="font-size:15px;font-weight:bold;">કોર,</div>
        <div style="font-size:16px;font-weight:bold;">નિલકંઠ પ્લેટ ડેપો</div>
      </div>
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
      backgroundColor: '#fff',
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
    URL.revokeObjectURL(dataUrl);
  } catch (error) {
    console.error('Error downloading JPG:', error);
    alert('Error downloading bill. Please try again.');
  }
};
