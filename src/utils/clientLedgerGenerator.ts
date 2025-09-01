// utils/clientLedgerGenerator.ts
import html2canvas from 'html2canvas';

export interface ClientLedgerData {
  client: {
    id: string;
    name: string;
    site: string;
    mobile: string;
  };
  plate_balances: Array<{
    plate_size: string;
    total_borrowed: number;
    total_returned: number;
    outstanding: number;
  }>;
  total_outstanding: number;
  transactions: Array<{
    type: 'udhar' | 'jama';
    id: number;
    number: string;
    date: string;
    client_id: string;
    items: Array<{
      plate_size: string;
      quantity: number;
      borrowed_stock?: number;
      returned_borrowed_stock?: number;
      notes?: string;
    }>;
    driver_name?: string;
  }>;
  generated_date: string;
}

const PLATE_SIZES = [
  '2 X 3', '21 X 3', '18 X 3', '15 X 3', '12 X 3',
  '9 X 3', 'પતરા', '2 X 2', '2 ફુટ'
];

export const generateClientLedgerJPG = async (data: ClientLedgerData): Promise<string> => {
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  document.body.appendChild(tempDiv);

  const getBorrowedStockBalance = (plateSize: string) => {
    const borrowed = data.transactions.filter(t => t.type === 'udhar').reduce((sum, t) => {
      const item = t.items.find(i => i.plate_size === plateSize);
      return sum + (item?.borrowed_stock || 0);
    }, 0);

    const returned = data.transactions.filter(t => t.type === 'jama').reduce((sum, t) => {
      const item = t.items.find(i => i.plate_size === plateSize);
      return sum + (item?.returned_borrowed_stock || 0);
    }, 0);

    return borrowed - returned;
  };

  const getTransactionTotalWithBorrowed = (transaction: typeof data.transactions[0]) => {
    const regularTotal = transaction.items.reduce((sum, item) => sum + item.quantity, 0);
    if (transaction.type === 'udhar') {
      const borrowedStockTotal = transaction.items.reduce((sum, item) => sum + (item.borrowed_stock || 0), 0);
      return regularTotal + borrowedStockTotal;
    }
    if (transaction.type === 'jama') {
      const returnedBorrowedStockTotal = transaction.items.reduce((sum, item) => sum + (item.returned_borrowed_stock || 0), 0);
      return regularTotal + returnedBorrowedStockTotal;
    }
    return regularTotal;
  };

  const formatPlateDisplay = (transaction: typeof data.transactions[0], plateSize: string) => {
    const item = transaction.items.find(i => i.plate_size === plateSize);
    if (!item) return '';
    const quantity = item.quantity || 0;
    let borrowedStock = 0;

    if (transaction.type === 'udhar') {
      borrowedStock = item.borrowed_stock || 0;
    } else if (transaction.type === 'jama') {
      borrowedStock = item.returned_borrowed_stock || 0;
    }

    if (quantity === 0 && borrowedStock === 0) return '';
    const prefix = transaction.type === 'udhar' ? '+' : '-';
    const notes = item.notes || '';

    let display = '';
    if (quantity > 0) display += `${prefix}${quantity}`;
    if (borrowedStock > 0) display += `<sup style="color:#dc2626; font-weight:bold;">${prefix}${borrowedStock}</sup>`;
    if (notes) display += `<sup style="color:#888;"> (${notes})</sup>`;
    return display;
  };

  const getAccurateGrandTotal = () => {
    const regularOutstanding = data.plate_balances.reduce((sum, balance) => sum + Math.abs(balance.outstanding), 0);
    const netBorrowedStock = data.transactions.reduce((sum, t) => {
      if (t.type === 'udhar') {
        return sum + t.items.reduce((subSum, item) => subSum + (item.borrowed_stock || 0), 0);
      } else {
        return sum - t.items.reduce((subSum, item) => subSum + (item.returned_borrowed_stock || 0), 0);
      }
    }, 0);
    return regularOutstanding + netBorrowedStock;
  };

  const clientInitial = data.client.name.charAt(0).toUpperCase();

  tempDiv.innerHTML = `
    <div style="width:1200px;padding:30px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#222;background:#f9f9f9;">
      <h1 style="text-align:center;font-size:36px;margin-bottom:25px;">નીલકંઠ પ્લેટ ડેપો</h1>
      <h2 style="text-align:center;font-weight:600;color:#444;margin-bottom:40px;">ગ્રાહક ખાતાવહી</h2>

      <div style="display:flex;align-items:center;gap:25px;margin-bottom:25px;">
        <div>
          <p style="margin:0;font-size:20px;font-weight:700;">${data.client.name}</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#555;">ગ્રાહક ID: ${data.client.id}</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#555;">સાઇટ: ${data.client.site || '-'}</p>
          <p style="margin:4px 0 0 0;font-size:14px;color:#555;">મોબાઇલ નંબર: ${data.client.mobile || '-'}</p>
        </div>
      </div>

      <div style="margin-bottom:30px;font-size:20px;font-weight:700;color:#444;text-align:center;">
        કુલ બાકી: ${getAccurateGrandTotal()} પ્લેટ
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#3b82f6;color:white;">
            <th style="padding:10px;text-align:left;">નંબર</th>
            <th style="padding:10px;text-align:center;">તારીખ</th>
            <th style="padding:10px;text-align:center;">કુલ</th>
            ${PLATE_SIZES.map(size => `<th style="padding:10px;text-align:center;">${size}</th>`).join('')}
            <th style="padding:10px;text-align:center;">ડ્રાઈવર</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:#e0e7ff;font-weight:700;">
            <td style="padding:12px;">ચાલુ નંગ</td>
            <td style="padding:12px;text-align:center;">-</td>
            <td style="padding:12px;text-align:center;">${getAccurateGrandTotal()}</td>
            ${PLATE_SIZES.map(size => {
              const bal = data.plate_balances.find(b => b.plate_size === size)?.outstanding || 0;
              const borBal = getBorrowedStockBalance(size);
              const totalBal = bal + borBal;
              return `<td style="padding:12px;text-align:center;">${totalBal !== 0 ? totalBal : '-'}</td>`;
            }).join('')}
            <td style="padding:12px;text-align:center;">-</td>
          </tr>
          ${data.transactions.length === 0
            ? `<tr><td colspan="${PLATE_SIZES.length+3}" style="text-align:center;padding:40px;color:#777;">કોઈ પ્રવૃત્તિ રેકોર્ડ નથી</td></tr>`
            : data.transactions.map((transaction) => {
              const d = new Date(transaction.date);
              const dateStr = `${('0'+d.getDate()).slice(-2)}/${('0'+(d.getMonth()+1)).slice(-2)}/${d.getFullYear().toString().slice(-2)}`;
              const total = getTransactionTotalWithBorrowed(transaction);
              return `
                <tr style="background:${transaction.type==='udhar' ? '#fff7e8' : '#e6ffed'};">
                  <td style="padding:12px;">#${transaction.number}</td>
                  <td style="text-align:center;padding:12px;">${dateStr}</td>
                  <td style="text-align:center;padding:12px;">${total}</td>
                  ${PLATE_SIZES.map(size => {
                    const disp = formatPlateDisplay(transaction,size);
                    return `<td style="text-align:center;padding:12px;">${disp || '-'}</td>`;
                  }).join('')}
                  <td style="text-align:center;padding:12px;color:#555;">${transaction.driver_name || '-'}</td>
                </tr>
              `;
            }).join('')}
        </tbody>
      </table>

      <div style="margin-top:40px;font-size:13px;color:#666;text-align:center;">
        સુરેશભાઈ પોલારા: +91 93287 28228
      </div>
      <div style="margin-top:3px;font-size:13px;color:#666;text-align:center;">
        હરેશભાઈ પોલારા: +91 90992 64436
      </div>
      <div style="margin-top:20px;font-size:11px;color:#999;text-align:center;">
        Created: ${new Date(data.generated_date).toLocaleString('gu-IN')}
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    document.body.removeChild(tempDiv);
    return dataUrl;
  } catch (e) {
    document.body.removeChild(tempDiv);
    throw e;
  }
};

export const downloadClientLedgerJPG = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Simple design, NO premium label, and adds a fake support mobile number at the bottom.
