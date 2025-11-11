import { PDFDocument, rgb, StandardFonts } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function generarLicencia(purchaseData) {
  try {
    console.log('🔄 Generando licencia PDF...', purchaseData);

    const {
      productName,
      producerName,
      licenseType,
      amount,
      buyerName,
      buyerEmail,
      purchaseDate,
      orderId
    } = purchaseData;

    // Mapear tipos de licencia a archivos PDF
    const licenseFiles = {
      'basic': 'basic-license.pdf',
      'premium': 'premium-license.pdf',
      'stems': 'trackout-license.pdf',
      'exclusive': 'trackout-license.pdf'
    };

    const pdfFile = licenseFiles[licenseType] || 'basic-license.pdf';
    console.log('📄 Descargando PDF base:', pdfFile);

    // Descargar PDF base desde Supabase Storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('licenses')
      .download(pdfFile);

    if (downloadError) throw downloadError;

    console.log('✅ PDF base descargado');

    // Cargar PDF base
    const arrayBuffer = await pdfData.arrayBuffer();
    const basePdf = await PDFDocument.load(arrayBuffer);

    // Crear nuevo PDF con portada
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Crear página de portada
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    // Fondo negro
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0) });

    // Logo
    page.drawText('OFFSZN', {
      x: 50, y: height - 80, size: 48, font: boldFont,
      color: rgb(0.45, 0.04, 0.72)
    });

    page.drawText('LICENSE CERTIFICATE', {
      x: 50, y: height - 120, size: 18, font: font,
      color: rgb(0.8, 0.8, 0.8)
    });

    // Línea
    page.drawLine({
      start: { x: 50, y: height - 140 },
      end: { x: width - 50, y: height - 140 },
      thickness: 2, color: rgb(0.45, 0.04, 0.72)
    });

    let yPos = height - 200;

    // Información de compra
    page.drawText('PURCHASE INFORMATION', {
      x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.5, 0.5, 0.5)
    });

    yPos -= 40;

    const info = [
      ['Beat Name:', productName],
      ['Producer:', producerName],
      ['License Type:', getLicenseName(licenseType)],
      ['Amount Paid:', `$${parseFloat(amount).toFixed(2)} USD`]
    ];

    info.forEach(([label, value]) => {
      page.drawText(label, { x: 50, y: yPos, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
      page.drawText(value, { x: 180, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) });
      yPos -= 25;
    });

    yPos -= 20;
    page.drawLine({
      start: { x: 50, y: yPos },
      end: { x: width - 50, y: yPos },
      thickness: 1, color: rgb(0.3, 0.3, 0.3)
    });

    yPos -= 40;

    // Información del comprador
    page.drawText('LICENSEE (BUYER)', {
      x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.5, 0.5, 0.5)
    });

    yPos -= 40;

    const buyerInfo = [
      ['Full Name:', buyerName],
      ['Email:', buyerEmail],
      ['Purchase Date:', new Date(purchaseDate).toLocaleDateString('en-US')],
      ['Order ID:', orderId]
    ];

    buyerInfo.forEach(([label, value]) => {
      page.drawText(label, { x: 50, y: yPos, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
      const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;
      page.drawText(displayValue, { x: 180, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) });
      yPos -= 25;
    });

    // Footer
    page.drawText('© 2025 OFFSZN. All rights reserved.', {
      x: 50, y: 40, size: 8, font, color: rgb(0.5, 0.5, 0.5)
    });

    console.log('✅ Portada creada');

    // Copiar páginas del PDF base
    const copiedPages = await pdfDoc.copyPages(basePdf, basePdf.getPageIndices());
    copiedPages.forEach(p => pdfDoc.addPage(p));

    console.log('✅ PDF completo ensamblado');

    // Guardar y descargar
    const pdfBytes = await pdfDoc.save();
    const safeProductName = productName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = `OFFSZN_License_${safeProductName}_${orderId.substring(0, 8)}.pdf`;

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log('✅ Licencia descargada:', fileName);
    return true;

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

function getLicenseName(licenseId) {
  const names = {
    'basic': 'Non-Exclusive Basic License',
    'premium': 'Non-Exclusive Premium License',
    'stems': 'Non-Exclusive Trackout License',
    'exclusive': 'Exclusive Rights License'
  };
  return names[licenseId] || licenseId;
}
