import html2canvas from 'html2canvas';

export interface BillData {
  bill_number: string;
  client: {
    id: string;
    name: string;
    site: string;
    mobile: string;
  };
  bill_date: string;
  period_start: string;
  period_end: string;
  billing_periods: Array<{
    from_date: string;
    to_date: string;
    days: number;
    running_stock: number;
    daily_rate: number;
    charge: number;
  }>;
  total_udhar_quantity: number;
  service_charge: number;
  period_charges: number;
  total_amount: number;
  previous_payments: number;
  net_due: number;
  daily_rate: number;
  service_rate: number;
  manual_items?: Array<{
    description: string;
    amount: number;
  }>;
}

export const generateBillJPG = async (data: BillData): Promise<string> => {
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

  // Calculate days between dates (inclusive)
  const calculateDays = (fromDate: string, toDate: string) => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };
  tempDiv.innerHTML = `
    <div style="width:1200px;padding:40px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#ffffff;border:2px solid #1e40af;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #1e40af;padding-bottom:20px;">
        <h1 style="font-size:42px;font-weight:bold;color:#1e40af;margin:0;">નીલકંઠ પ્લેટ ડેપો</h1>
        <p style="font-size:18px;color:#666;margin:5px 0;">Centering Plates Rental Service</p>
        <p style="font-size:14px;color:#888;margin:5px 0;">સેન્ટરિંગ પ્લેટ્સ ભાડા સેવા</p>
        <h2 style="font-size:32px;font-weight:bold;color:#dc2626;margin:15px 0;">BILL / બિલ</h2>
      </div>

      <!-- Bill Info -->
      <div style="display:flex;justify-content:space-between;margin-bottom:25px;background:#f8fafc;padding:15px;border-radius:8px;">
        <div>
          <p style="margin:0;font-size:18px;"><strong>Bill No:</strong> ${data.bill_number}</p>
          <p style="margin:5px 0 0 0;font-size:18px;"><strong>Date:</strong> ${formatDate(data.bill_date)}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:18px;"><strong>Period:</strong> ${formatDate(data.period_start)} to ${formatDate(data.period_end)}</p>
          <p style="margin:5px 0 0 0;font-size:16px;color:#666;">Daily Rate: ${formatCurrency(data.daily_rate)}</p>
        </div>
      </div>

      <!-- Client Details -->
      <div style="margin-bottom:25px;background:#f1f5f9;padding:15px;border-radius:8px;border-left:4px solid #1e40af;">
        <h3 style="margin:0 0 10px 0;font-size:20px;color:#1e40af;">Client Information</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
          <div>
            <p style="margin:0;font-size:16px;"><strong>Name:</strong> ${data.client.name}</p>
            <p style="margin:5px 0 0 0;font-size:16px;"><strong>ID:</strong> ${data.client.id}</p>
          </div>
          <div>
            <p style="margin:0;font-size:16px;"><strong>Site:</strong> ${data.client.site}</p>
            <p style="margin:5px 0 0 0;font-size:16px;"><strong>Mobile:</strong> ${data.client.mobile}</p>
          </div>
        </div>
      </div>

      <!-- Billing Periods Table -->
      <div style="margin-bottom:25px;">
        <h3 style="margin:0 0 15px 0;font-size:20px;color:#1e40af;">Billing Periods</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;border:2px solid #1e40af;">
          <thead>
            <tr style="background:#1e40af;color:white;">
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">Sr No</th>
              <th style="padding:12px;text-align:left;border:1px solid #1e40af;">Description</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">From Date</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">To Date</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">Udhar Qty</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">Jama Qty</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">Plates on Rent</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">Rate/Plate</th>
              <th style="padding:12px;text-align:center;border:1px solid #1e40af;">Days</th>
              <th style="padding:12px;text-align:right;border:1px solid #1e40af;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${data.billing_periods.map((period, index) => `
              <tr style="background:${index % 2 === 0 ? '#f8fafc' : 'white'};">
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${index + 1}</td>
                <td style="padding:10px;text-align:left;border:1px solid #e2e8f0;">Rental Period ${index + 1}</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${formatDate(period.from_date)}</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${formatDate(period.to_date)}</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;color:#dc2626;font-weight:bold;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;color:#059669;font-weight:bold;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;color:#2563eb;font-weight:bold;">${period.running_stock}</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${formatCurrency(period.daily_rate)}</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${period.days}</td>
                <td style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(period.charge)}</td>
              </tr>
            `).join('')}
            ${data.manual_items ? data.manual_items.map((item, index) => `
              <tr style="background:#fef3c7;">
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">${data.billing_periods.length + index + 1}</td>
                <td style="padding:10px;text-align:left;border:1px solid #e2e8f0;font-style:italic;">${item.description}</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:center;border:1px solid #e2e8f0;">-</td>
                <td style="padding:10px;text-align:right;border:1px solid #e2e8f0;font-weight:bold;">${formatCurrency(item.amount)}</td>
              </tr>
            `).join('') : ''}
            ${data.billing_periods.length === 0 ? `
              <tr>
                <td colspan="10" style="padding:20px;text-align:center;color:#666;border:1px solid #e2e8f0;">No billing periods in this range</td>
              </tr>
            ` : ''}
            <!-- Grand Total Row -->
            <tr style="background:#e0e7ff;border-top:3px solid #1e40af;">
              <td colspan="9" style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;">Grand Total / કુલ રકમ:</td>
              <td style="padding:15px;text-align:right;border:1px solid #e2e8f0;font-size:20px;font-weight:bold;color:#dc2626;">${formatCurrency(data.total_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>


      <!-- Payment Methods -->
      <div style="margin-bottom:25px;background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;">
        <h4 style="margin:0 0 10px 0;font-size:16px;color:#92400e;">Payment Methods:</h4>
        <p style="margin:0;font-size:14px;color:#92400e;">Cash | Online Transfer | Cheque | Bank Transfer</p>
        <p style="margin:5px 0 0 0;font-size:12px;color:#92400e;">રોકડ | ઓનલાઇન ટ્રાન્સફર | ચેક | બેંક ટ્રાન્સફર</p>
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
        <div style="font-size:14px;color:#666;">
          સુરેશભાઈ પોલરા: +91 93287 28228 | હરેશભાઈ પોલરા: +91 90992 64436
        </div>
        <div style="font-size:12px;color:#999;margin-top:10px;">
          Generated: ${new Date().toLocaleString('en-IN')}
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

export const downloadBillJPG = (dataUrl: string, filename: string) => {
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
    console.error('Error downloading bill JPG:', error);
    alert('Error downloading bill. Please try again.');
  }
};