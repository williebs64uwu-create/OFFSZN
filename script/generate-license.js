import { PDFDocument, rgb, StandardFonts } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// GENERAR LICENCIA PDF PERSONALIZADA
// ============================================
export async function generarLicencia(purchaseData) {
  try {
    console.log('🔄 Generando licencia...', purchaseData);

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

    // 1. Determinar qué PDF base usar según tipo de licencia
    const licenseFiles = {
      'basic': 'basic-license.pdf',
      'premium': 'premium-license.pdf',
      'stems': 'trackout-license.pdf',
      'exclusive': 'trackout-license.pdf' // Usar trackout como base
    };

    const pdfFile = licenseFiles[licenseType] || 'basic-license.pdf';
    console.log('📄 Usando archivo base:', pdfFile);

    // 2. Descargar PDF base desde Supabase Storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('licenses')
      .download(pdfFile);

    if (downloadError) {
      console.error('❌ Error descargando PDF:', downloadError);
      throw downloadError;
    }

    console.log('✅ PDF base descargado');

    // 3. Convertir a ArrayBuffer y cargar PDF
    const arrayBuffer = await pdfData.arrayBuffer();
    const basePdf = await PDFDocument.load(arrayBuffer);

    // 4. Crear nuevo PDF con página de portada
    const pdfDoc = await PDFDocument.create();
    
    // Cargar fuentes
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 5. Crear página de portada personalizada (CERTIFICADO)
    const coverPage = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = coverPage.getSize();

    // Fondo negro
    coverPage.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: height,
      color: rgb(0, 0, 0),
    });

    // Logo OFFSZN
    coverPage.drawText('OFFSZN', {
      x: 50,
      y: height - 80,
      size: 48,
      font: boldFont,
      color: rgb(0.45, 0.04, 0.72), // Morado
    });

    coverPage.drawText('LICENSE CERTIFICATE', {
      x: 50,
      y: height - 120,
      size: 18,
      font: font,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Línea separadora
    coverPage.drawLine({
      start: { x: 50, y: height - 140 },
      end: { x: width - 50, y: height - 140 },
      thickness: 2,
      color: rgb(0.45, 0.04, 0.72),
    });

    // INFORMACIÓN DE LA COMPRA
    let yPos = height - 200;

    coverPage.drawText('PURCHASE INFORMATION', {
      x: 50,
      y: yPos,
      size: 12,
      font: boldFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPos -= 40;

    const purchaseInfo = [
      ['Beat Name:', productName],
      ['Producer:', producerName || 'Willie Inspired'],
      ['License Type:', getLicenseName(licenseType)],
      ['Amount Paid:', `$${parseFloat(amount).toFixed(2)} USD`],
    ];

    purchaseInfo.forEach(([label, value]) => {
      coverPage.drawText(label, {
        x: 50,
        y: yPos,
        size: 10,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
      });

      coverPage.drawText(value, {
        x: 180,
        y: yPos,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      yPos -= 25;
    });

    // Línea separadora
    yPos -= 20;
    coverPage.drawLine({
      start: { x: 50, y: yPos },
      end: { x: width - 50, y: yPos },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });

    // LICENCIATARIO (COMPRADOR)
    yPos -= 40;

    coverPage.drawText('LICENSEE (BUYER)', {
      x: 50,
      y: yPos,
      size: 12,
      font: boldFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPos -= 40;

    const licenseeInfo = [
      ['Full Name:', buyerName],
      ['Email:', buyerEmail],
      ['Purchase Date:', new Date(purchaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })],
      ['Order ID:', orderId],
    ];

    licenseeInfo.forEach(([label, value]) => {
      coverPage.drawText(label, {
        x: 50,
        y: yPos,
        size: 10,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
      });

      // Truncar texto largo (como emails)
      const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;

      coverPage.drawText(displayValue, {
        x: 180,
        y: yPos,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      yPos -= 25;
    });

    // NOTA IMPORTANTE
    yPos -= 30;
    coverPage.drawText('IMPORTANT:', {
      x: 50,
      y: yPos,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    yPos -= 20;
    const noteLines = [
      'This certificate accompanies the full license agreement.',
      'Please read the complete terms and conditions on the following pages.',
      'Keep this document for your records.'
    ];

    noteLines.forEach(line => {
      coverPage.drawText(line, {
        x: 50,
        y: yPos,
        size: 9,
        font: font,
        color: rgb(0.7, 0.7, 0.7),
      });
      yPos -= 18;
    });

    // Footer
    coverPage.drawText('This is a legally binding agreement. By purchasing this license, you agree to all terms.', {
      x: 50,
      y: 60,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    coverPage.drawText('© 2025 OFFSZN. All rights reserved. | Lima, Peru', {
      x: 50,
      y: 45,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    console.log('✅ Página de portada creada');

    // 6. Copiar todas las páginas del PDF base al final
    const copiedPages = await pdfDoc.copyPages(basePdf, basePdf.getPageIndices());
    copiedPages.forEach((page) => {
      pdfDoc.addPage(page);
    });

    console.log('✅ Páginas del contrato copiadas');

    // 7. Guardar PDF final
    const pdfBytes = await pdfDoc.save();

    // 8. Crear nombre de archivo seguro
    const safeProductName = productName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = `OFFSZN_License_${safeProductName}_${orderId.substring(0, 8)}.pdf`;

    // 9. Descargar PDF
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log('✅ Licencia generada y descargada:', fileName);
    return true;

  } catch (error) {
    console.error('❌ Error generando licencia:', error);
    throw error;
  }
}

// ============================================
// OBTENER NOMBRE LEGIBLE DE LICENCIA
// ============================================
function getLicenseName(licenseId) {
  const names = {
    'basic': 'Non-Exclusive Basic License',
    'premium': 'Non-Exclusive Premium License',
    'stems': 'Non-Exclusive Trackout License',
    'exclusive': 'Exclusive Rights License'
  };
  return names[licenseId] || licenseId;
}
