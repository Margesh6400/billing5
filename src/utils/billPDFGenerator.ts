import jsPDF from 'jspdf';
import { BillData } from './billJPGGenerator';

export const generateBillPDF = async (data: BillData): Promise<void> => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Set font
    pdf.setFont('helvetica');
    
    // Header
    pdf.setFontSize(24);
    pdf.setTextColor(30, 64, 175); // Blue color
    pdf.text('નીલકંઠ પ્લેટ ડેપો', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Centering Plates Rental Service', pageWidth / 2, 30, { align: 'center' });
    
    pdf.setFontSize(20);
    pdf.setTextColor(220, 38, 38); // Red color
    pdf.text('BILL / બિલ', pageWidth / 2, 45, { align: 'center' });
    
    // Bill Info
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Bill No: ${data.bill_number}`, 20, 60);
    pdf.text(`Date: ${new Date(data.bill_date).toLocaleDateString('en-GB')}`, pageWidth - 60, 60);
    
    // Client Details
    pdf.setFontSize(14);
    pdf.setTextColor(30, 64, 175);
    pdf.text('Client Information', 20, 80);
    
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Name: ${data.client.name}`, 20, 90);
    pdf.text(`ID: ${data.client.id}`, 20, 100);
    pdf.text(`Site: ${data.client.site}`, 20, 110);
    pdf.text(`Mobile: ${data.client.mobile}`, 20, 120);
    
    // Table
    let yPosition = 140;
    
    // Table headers
    pdf.setFillColor(30, 64, 175);
    pdf.rect(20, yPosition, pageWidth - 40, 10, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.text('Sr', 25, yPosition + 7);
    pdf.text('From Date', 40, yPosition + 7);
    pdf.text('To Date', 70, yPosition + 7);
    pdf.text('Days', 100, yPosition + 7);
    pdf.text('Stock', 120, yPosition + 7);
    pdf.text('Rate', 140, yPosition + 7);
    pdf.text('Amount', 160, yPosition + 7);
    
    yPosition += 15;
    
    // Table rows
    pdf.setTextColor(0, 0, 0);
    data.billing_periods.forEach((period, index) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }
      
      const fillColor = index % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
      pdf.setFillColor(...fillColor);
      pdf.rect(20, yPosition - 5, pageWidth - 40, 10, 'F');
      
      pdf.text((index + 1).toString(), 25, yPosition);
      pdf.text(new Date(period.from_date).toLocaleDateString('en-GB'), 40, yPosition);
      pdf.text(new Date(period.to_date).toLocaleDateString('en-GB'), 70, yPosition);
      pdf.text(period.days.toString(), 100, yPosition);
      pdf.text(period.running_stock.toString(), 120, yPosition);
      pdf.text(`₹${period.daily_rate.toFixed(2)}`, 140, yPosition);
      pdf.text(`₹${period.charge.toFixed(2)}`, 160, yPosition);
      
      yPosition += 10;
    });
    
    // Total
    yPosition += 10;
    pdf.setFillColor(224, 231, 255);
    pdf.rect(20, yPosition - 5, pageWidth - 40, 10, 'F');
    pdf.setFontSize(12);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Grand Total:', 120, yPosition);
    pdf.text(`₹${data.total_amount.toFixed(2)}`, 160, yPosition);
    
    // Footer
    yPosition += 30;
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Payment Methods: Cash | Online Transfer | Cheque | Bank Transfer', 20, yPosition);
    
    yPosition += 40;
    pdf.text('Client\'s Signature', 40, yPosition);
    pdf.text('Authorized Signature', 140, yPosition);
    pdf.line(30, yPosition - 5, 80, yPosition - 5);
    pdf.line(130, yPosition - 5, 180, yPosition - 5);
    
    // Save PDF
    pdf.save(`bill-${data.bill_number}-${data.client.name.replace(/\s+/g, '-')}.pdf`);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const downloadBillPDF = async (data: BillData) => {
  try {
    await generateBillPDF(data);
  } catch (error) {
    console.error('Error downloading bill PDF:', error);
    alert('Error downloading bill PDF. Please try again.');
  }
};