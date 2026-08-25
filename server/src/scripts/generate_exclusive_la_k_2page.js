import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function testLayouts() {
  const purchaseData = {
    productName: 'detroit type beat',
    producerName: 'Willie Inspired',
    amount: 40.00,
    buyerName: 'La K',
    buyerEmail: 'la.k.artist@offszn.client',
    purchaseDate: new Date().toISOString(),
    orderId: 'EXCL-784920',
    productType: 'beat',
    licenseType: 'Exclusive Rights License'
  };

  const {
    productName,
    producerName,
    amount,
    buyerName,
    orderId
  } = purchaseData;

  const priceFormatted = `$${parseFloat(amount).toFixed(2)} USD`;
  const formattedDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedDateEn = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const verificationHash = Buffer.from(`${orderId}:${buyerName}:${productName}:40USD`).toString('base64').substring(0, 18).toUpperCase();
  pdfDoc.setTitle(`OFFSZN Exclusive License - ${productName} (${buyerName})`);
  pdfDoc.setAuthor('Willie Inspired / OFFSZN');
  pdfDoc.setProducer('OFFSZN Platform Legal Engine v4.0');
  pdfDoc.setCreator('OFFSZN Exclusive Rights Automation');
  pdfDoc.setSubject(`Exclusive Music License Agreement - Order ${orderId}`);
  pdfDoc.setKeywords(['OFFSZN', 'Exclusive License', 'Willie Inspired', 'La K', 'Detroit Type Beat', verificationHash]);

  // ==========================================
  // PAGE 1: LUXURY OBSIDIAN CERTIFICATE (A4)
  // ==========================================
  const page1 = pdfDoc.addPage([595, 842]);
  const { width, height } = page1.getSize();

  // Background
  page1.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.04, 0.04, 0.05)
  });

  // Top Neon Purple Accent Bar
  page1.drawRectangle({
    x: 0,
    y: height - 6,
    width,
    height: 6,
    color: rgb(0.55, 0.15, 0.95)
  });

  // Top Header / Verification Badge
  page1.drawText('OFFSZN ENTERTAINMENT / LEGAL ENGINE', {
    x: 45,
    y: height - 42,
    size: 9,
    font: boldFont,
    color: rgb(0.7, 0.35, 1)
  });

  page1.drawText('OFFICIAL EXCLUSIVE MASTER LICENSE CERTIFICATE', {
    x: 45,
    y: height - 55,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.55)
  });

  // Top Right Info
  const rightX = width - 210;
  page1.drawText('AUTHENTICITY CODE', {
    x: rightX,
    y: height - 42,
    size: 7,
    font: boldFont,
    color: rgb(0.5, 0.5, 0.55)
  });
  page1.drawText(verificationHash, {
    x: rightX,
    y: height - 53,
    size: 8,
    font: boldFont,
    color: rgb(0.2, 0.85, 0.55)
  });
  page1.drawText(`ORDER: #${orderId} • LIMA, PERU`, {
    x: rightX,
    y: height - 64,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.55)
  });

  // Divider Line
  page1.drawLine({
    start: { x: 45, y: height - 80 },
    end: { x: width - 45, y: height - 80 },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.25)
  });

  // Main Big Title
  page1.drawText('EXCLUSIVE RIGHTS', {
    x: 45,
    y: height - 114,
    size: 24,
    font: boldFont,
    color: rgb(0.98, 0.98, 1)
  });
  page1.drawText('CERTIFICATE OF FULL MASTER OWNERSHIP & UNLIMITED EXPLOITATION', {
    x: 45,
    y: height - 130,
    size: 8.5,
    font: boldFont,
    color: rgb(0.7, 0.35, 1)
  });

  // Summary box (Card)
  const cardY = height - 330;
  page1.drawRectangle({
    x: 45,
    y: cardY,
    width: width - 90,
    height: 180,
    color: rgb(0.08, 0.08, 0.1),
    borderColor: rgb(0.25, 0.18, 0.35),
    borderWidth: 1
  });

  // Card Header
  page1.drawRectangle({
    x: 45,
    y: cardY + 152,
    width: width - 90,
    height: 28,
    color: rgb(0.12, 0.09, 0.18)
  });
  page1.drawText('TRANSACTION & ASSET SPECIFICATIONS', {
    x: 60,
    y: cardY + 162,
    size: 8.5,
    font: boldFont,
    color: rgb(0.85, 0.75, 1)
  });

  // Details items
  const details = [
    ['Instrumental Title (Beat):', `"${productName}"`],
    ['Producer / Licensor:', producerName],
    ['Licensee / Buyer (Artist):', buyerName],
    ['License Category:', 'FULL EXCLUSIVE RIGHTS (TODO ILIMITADO / UNLIMITED)'],
    ['Agreed Fee Paid:', `${priceFormatted} (Paid in Full - Single Settlement)`],
    ['Delivery Package:', 'Master WAV (24-bit), MP3 (320kbps) & Trackout STEMS (Multi-tracks)'],
    ['Date of Execution:', `${formattedDateEn} (${formattedDate})`]
  ];

  let currentDetailY = cardY + 132;
  details.forEach(([label, val], idx) => {
    page1.drawText(label, {
      x: 60,
      y: currentDetailY,
      size: 8.5,
      font,
      color: rgb(0.6, 0.6, 0.65)
    });
    page1.drawText(val, {
      x: 210,
      y: currentDetailY,
      size: 8.5,
      font: boldFont,
      color: idx === 3 ? rgb(0.3, 0.9, 0.6) : (idx === 0 || idx === 2 ? rgb(1, 1, 1) : rgb(0.9, 0.9, 0.95))
    });
    currentDetailY -= 19;
  });

  // Rights Matrix Grid
  const matrixY = height - 525;
  page1.drawText('EXCLUSIVITY & UNLIMITED RIGHTS BREAKDOWN', {
    x: 45,
    y: matrixY + 15,
    size: 10.5,
    font: boldFont,
    color: rgb(0.95, 0.95, 0.98)
  });

  const matrixItems = [
    { title: 'Audio Streams', value: 'UNLIMITED (ILIMITADO)', sub: 'Spotify, Apple Music, YouTube Music, Tidal, Amazon, etc.' },
    { title: 'Sales & Physical Units', value: 'UNLIMITED (ILIMITADO)', sub: 'Digital downloads, Vinyls, CDs, Cassettes, USBs' },
    { title: 'Public Performances', value: 'UNLIMITED (ILIMITADO)', sub: 'For-profit concerts, festivals, tours & live artist income' },
    { title: 'Radio & TV Broadcasting', value: 'UNLIMITED (ILIMITADO)', sub: 'Global terrestrial, satellite & internet stations' },
    { title: 'Sync & Video Projects', value: 'UNLIMITED (ILIMITADO)', sub: 'Official music videos, TV sync, cinema, gaming, ads' },
    { title: 'Market Exclusivity', value: '100% EXCLUSIVE', sub: 'Beat retired from catalog. Never sold/leased again.' }
  ];

  const colWidth = (width - 90 - 15) / 2;
  const colHeight = 48;

  matrixItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const boxX = 45 + col * (colWidth + 15);
    const boxY = matrixY - 42 - row * (colHeight + 10);

    // Box background
    page1.drawRectangle({
      x: boxX,
      y: boxY,
      width: colWidth,
      height: colHeight,
      color: rgb(0.07, 0.07, 0.09),
      borderColor: rgb(0.2, 0.16, 0.28),
      borderWidth: 1
    });

    // Left accent tag
    page1.drawRectangle({
      x: boxX,
      y: boxY,
      width: 3,
      height: colHeight,
      color: rgb(0.55, 0.15, 0.95)
    });

    page1.drawText(item.title.toUpperCase(), {
      x: boxX + 12,
      y: boxY + 32,
      size: 7,
      font: boldFont,
      color: rgb(0.65, 0.65, 0.7)
    });

    page1.drawText(item.value, {
      x: boxX + 12,
      y: boxY + 19,
      size: 8.5,
      font: boldFont,
      color: rgb(0.2, 0.9, 0.6)
    });

    page1.drawText(item.sub, {
      x: boxX + 12,
      y: boxY + 8,
      size: 6.5,
      font,
      color: rgb(0.45, 0.45, 0.5)
    });
  });

  // Credit Guarantee & Important Notice Banner
  const noticeY = 125;
  page1.drawRectangle({
    x: 45,
    y: noticeY,
    width: width - 90,
    height: 65,
    color: rgb(0.1, 0.07, 0.14),
    borderColor: rgb(0.4, 0.2, 0.6),
    borderWidth: 1
  });

  page1.drawText('MANDATORY PRODUCTION CREDIT & PUBLISHING SPLIT', {
    x: 60,
    y: noticeY + 47,
    size: 8.5,
    font: boldFont,
    color: rgb(0.9, 0.8, 1)
  });

  page1.drawText('• Mandatory Credit: The Licensee agrees to credit the Producer as "Prod. Willie Inspired" or "Produced by Willie Inspired".', {
    x: 60,
    y: noticeY + 33,
    size: 7.5,
    font,
    color: rgb(0.8, 0.8, 0.85)
  });

  page1.drawText('• Publishing Split: 50% Writer\'s Share to Producer (Willie Inspired) / 50% Writer\'s Share to Licensee (La K).', {
    x: 60,
    y: noticeY + 21,
    size: 7.5,
    font,
    color: rgb(0.8, 0.8, 0.85)
  });

  page1.drawText('• Master & Distribution: Licensee retains 100% of Master Recording revenues and unlimited commercial exploitation.', {
    x: 60,
    y: noticeY + 9,
    size: 7.5,
    font,
    color: rgb(0.2, 0.9, 0.6)
  });

  // Footer Certificate
  page1.drawText('OFFSZN LEGAL ENGINE • DIGITAL SEAL OF AUTHENTICITY • PERPETUAL WORLDWIDE EXCLUSIVE LICENSE', {
    x: 45,
    y: 40,
    size: 6.5,
    font: boldFont,
    color: rgb(0.35, 0.35, 0.4)
  });
  page1.drawText('Governed under international copyright standards and the laws of Lima, Peru. Valid worldwide in perpetuity.', {
    x: 45,
    y: 28,
    size: 6.5,
    font,
    color: rgb(0.3, 0.3, 0.35)
  });

  // ==========================================
  // PAGE 2: COMPLETE LEGAL CONTRACT & SIGNATURES (Studio White Legal Theme)
  // Let's fit all comprehensive legal terms and signature blocks cleanly into Page 2!
  // ==========================================
  const page2 = pdfDoc.addPage([595, 842]);
  const leftMargin = 40;
  const contentWidth = width - 80;

  // Header of Page 2
  page2.drawText('EXCLUSIVE RIGHTS LICENSE AGREEMENT', {
    x: leftMargin,
    y: height - 32,
    size: 9,
    font: boldFont,
    color: rgb(0.3, 0.15, 0.5)
  });
  page2.drawText(`ASSET: "${productName.toUpperCase()}" • PRODUCER: ${producerName.toUpperCase()} • ARTIST: ${buyerName.toUpperCase()}`, {
    x: leftMargin,
    y: height - 43,
    size: 6.8,
    font,
    color: rgb(0.45, 0.45, 0.5)
  });
  page2.drawText('PAGE 2 OF 2 (LEGAL TERMS & SIGNATURES)', {
    x: width - leftMargin - 160,
    y: height - 32,
    size: 6.8,
    font: boldFont,
    color: rgb(0.45, 0.45, 0.5)
  });
  page2.drawLine({
    start: { x: leftMargin, y: height - 48 },
    end: { x: width - leftMargin, y: height - 48 },
    thickness: 0.8,
    color: rgb(0.8, 0.8, 0.85)
  });

  // Two-column or compact single-column layout for clauses
  const contractClauses = [
    {
      title: '1. PARTIES & EXCLUSIVE GRANT OF RIGHTS',
      text: `This Exclusive License Agreement is entered into on ${formattedDateEn}, by and between Willie Inspired ("Producer") and La K ("Licensee"). In consideration of $40.00 USD received in full, Producer grants Licensee the exclusive, perpetual, and worldwide right to use the instrumental "${productName}" (the "Beat") to record, produce, release, and distribute a derivative master sound recording ("Master Song").`
    },
    {
      title: '2. CATALOG RETIREMENT & ABSOLUTE EXCLUSIVITY',
      text: `Producer guarantees the Beat is permanently retired from all sales platforms, stores, and catalogs upon execution. Producer shall never sell, lease, or license the Beat to any third party in the future. Prior non-exclusive leases issued before this agreement remain valid until expiration, but no renewals or new leases shall ever be granted.`
    },
    {
      title: '3. UNLIMITED RIGHTS & EXPLOITATION (TODO ILIMITADO)',
      text: `Licensee is granted fully UNLIMITED rights in perpetuity: (a) Unlimited Audio Streams across all DSPs (Spotify, Apple Music, YouTube Music, etc.); (b) Unlimited Physical & Digital Sales (CDs, Vinyl, downloads) with 0% mechanical fees owed to Producer; (c) Unlimited Live Performances & Tour Income (100% retained by Licensee); (d) Unlimited Radio & TV Broadcasting worldwide; (e) Unlimited Sync & Video Projects (music videos, TV, films, commercials, gaming); (f) 100% retention of Master Recording royalties and digital distributor payouts.`
    },
    {
      title: '4. DELIVERABLES & MULTI-TRACK STEMS',
      text: `Producer delivers the complete master package: 24-bit lossless WAV, 320kbps MP3, and full individual Trackout STEMS (separated multi-tracks) allowing comprehensive mixing, vocal integration, and professional mastering.`
    },
    {
      title: '5. OWNERSHIP, PUBLISHING SPLITS & CREDITS',
      text: `(a) Master Rights: Licensee owns 100% of the Master Recording containing their vocals. (b) Publishing / Writer's Share: 50% to Licensee (lyrics/vocal melodies) and 50% to Producer (Willie Inspired, for musical composition), registered with PROs (ASCAP/BMI/SGAE/APDAYC). (c) Mandatory Credit: Licensee shall credit Producer as "Prod. Willie Inspired" or "Produced by Willie Inspired" on all releases, streaming metadata, and liner notes.`
    },
    {
      title: '6. CONTENT ID & MONETIZATION CLEARANCE',
      text: `Licensee is authorized to monetize the Master Song across YouTube, TikTok, Facebook, and Instagram. Licensee may register the final derivative Master Song with digital distributors and Content ID as an exclusive artist release containing custom vocals.`
    },
    {
      title: '7. GOVERNING LAW & JURISDICTION',
      text: `This Agreement is governed by international copyright law and the commercial laws of Lima, Peru. Both parties agree that digital execution constitutes a binding legal agreement.`
    }
  ];

  let currentY = height - 60;
  for (const clause of contractClauses) {
    // Header banner
    page2.drawRectangle({
      x: leftMargin,
      y: currentY - 11,
      width: contentWidth,
      height: 14,
      color: rgb(0.95, 0.94, 0.98)
    });
    page2.drawRectangle({
      x: leftMargin,
      y: currentY - 11,
      width: 2.5,
      height: 14,
      color: rgb(0.5, 0.15, 0.8)
    });
    page2.drawText(clause.title, {
      x: leftMargin + 6,
      y: currentY - 7.5,
      size: 7.2,
      font: boldFont,
      color: rgb(0.25, 0.1, 0.4)
    });

    currentY -= 20;

    // Body text wrapping
    const words = clause.text.split(' ');
    let currentLine = '';
    const fontSize = 6.8;
    const lineHeight = 9.2;

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (textWidth < contentWidth - 4) {
        currentLine = testLine;
      } else {
        page2.drawText(currentLine, {
          x: leftMargin + 2,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.18, 0.18, 0.22)
        });
        currentY -= lineHeight;
        currentLine = word;
      }
    }

    if (currentLine) {
      page2.drawText(currentLine, {
        x: leftMargin + 2,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0.18, 0.18, 0.22)
      });
      currentY -= lineHeight;
    }

    currentY -= 4;
  }

  // SIGNATURE BLOCK
  currentY -= 6;
  page2.drawText('LEGAL EXECUTION & DIGITAL SIGNATURE OF PARTIES', {
    x: leftMargin,
    y: currentY,
    size: 7.8,
    font: boldFont,
    color: rgb(0.15, 0.15, 0.25)
  });
  currentY -= 6;
  page2.drawLine({
    start: { x: leftMargin, y: currentY },
    end: { x: width - leftMargin, y: currentY },
    thickness: 0.8,
    color: rgb(0.4, 0.2, 0.6)
  });

  const sigBoxY = currentY - 85;
  const sigBoxWidth = (contentWidth - 16) / 2;

  // Producer Signature Box
  page2.drawRectangle({
    x: leftMargin,
    y: sigBoxY,
    width: sigBoxWidth,
    height: 78,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1
  });
  page2.drawText('PRODUCER / LICENSOR (OFFSZN):', {
    x: leftMargin + 8,
    y: sigBoxY + 64,
    size: 6.8,
    font: boldFont,
    color: rgb(0.45, 0.2, 0.7)
  });
  page2.drawText('Willie Inspired', {
    x: leftMargin + 8,
    y: sigBoxY + 46,
    size: 12,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  page2.drawText('(Digital Certified Signature: Willie Inspired)', {
    x: leftMargin + 8,
    y: sigBoxY + 34,
    size: 5.8,
    font: obliqueFont,
    color: rgb(0.2, 0.6, 0.35)
  });
  page2.drawText(`Date: ${formattedDateEn} • Lima, Peru`, {
    x: leftMargin + 8,
    y: sigBoxY + 22,
    size: 6.2,
    font,
    color: rgb(0.4, 0.4, 0.45)
  });
  page2.drawText('Status: VERIFIED LICENSOR / EXCLUSIVE RIGHTS TRANSFERRED', {
    x: leftMargin + 8,
    y: sigBoxY + 10,
    size: 5.5,
    font: boldFont,
    color: rgb(0.1, 0.65, 0.35)
  });

  // Licensee Signature Box
  const sig2X = leftMargin + sigBoxWidth + 16;
  page2.drawRectangle({
    x: sig2X,
    y: sigBoxY,
    width: sigBoxWidth,
    height: 78,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1
  });
  page2.drawText('LICENSEE / BUYER (ARTIST):', {
    x: sig2X + 8,
    y: sigBoxY + 64,
    size: 6.8,
    font: boldFont,
    color: rgb(0.45, 0.2, 0.7)
  });
  page2.drawText('La K', {
    x: sig2X + 8,
    y: sigBoxY + 46,
    size: 12,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  page2.drawText('(Accepted via License Settlement - $40.00 USD)', {
    x: sig2X + 8,
    y: sigBoxY + 34,
    size: 5.8,
    font: obliqueFont,
    color: rgb(0.2, 0.6, 0.35)
  });
  page2.drawText(`Date: ${formattedDateEn} • Order ID: #${orderId}`, {
    x: sig2X + 8,
    y: sigBoxY + 22,
    size: 6.2,
    font,
    color: rgb(0.4, 0.4, 0.45)
  });
  page2.drawText('Status: FULL EXCLUSIVE LICENSEE / UNLIMITED EXPLOITATION', {
    x: sig2X + 8,
    y: sigBoxY + 10,
    size: 5.5,
    font: boldFont,
    color: rgb(0.1, 0.65, 0.35)
  });

  // Footer of Page 2
  page2.drawLine({
    start: { x: leftMargin, y: 35 },
    end: { x: width - leftMargin, y: 35 },
    thickness: 0.8,
    color: rgb(0.8, 0.8, 0.85)
  });
  page2.drawText(`OFFSZN DIGITAL LEGAL ENGINE • CONTRACT HASH: ${verificationHash} • VALID GLOBALLY`, {
    x: leftMargin,
    y: 24,
    size: 6,
    font: boldFont,
    color: rgb(0.5, 0.5, 0.55)
  });
  page2.drawText('END OF AGREEMENT', {
    x: width - leftMargin - 75,
    y: 24,
    size: 6,
    font: boldFont,
    color: rgb(0.5, 0.5, 0.55)
  });

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.resolve('..', 'OFFSZN_Licencia_Exclusiva_detroit_type_beat_La_K.pdf');
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  console.log('✅ Generated 2-page Master License PDF at:', outputPath);
  console.log('Total pages:', pdfDoc.getPageCount());
  console.log('Remaining Y space on page 2:', sigBoxY);
}

testLayouts().catch(console.error);
