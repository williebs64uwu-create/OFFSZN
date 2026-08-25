import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generateExclusiveLicensePdf() {
  const purchaseData = {
    productName: 'detroit type beat',
    producerName: 'Willie Inspired',
    amount: 40.00,
    buyerName: 'La K',
    buyerEmail: 'la.k.official@offszn.client',
    orderId: 'EXCL-' + Math.floor(100000 + Math.random() * 900000)
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
  const boldObliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  // Authenticity Code
  const verificationHash = Buffer.from(`${orderId}:${buyerName}:${productName}:40USD`).toString('base64').substring(0, 18).toUpperCase();
  
  pdfDoc.setTitle(`OFFSZN Exclusive License - ${productName} (${buyerName})`);
  pdfDoc.setAuthor('Willie Inspired / OFFSZN');
  pdfDoc.setProducer('OFFSZN Platform Legal Engine v4.2');
  pdfDoc.setCreator('OFFSZN Exclusive Rights Automation');
  pdfDoc.setSubject(`Exclusive Rights Music License Agreement - Order ${orderId}`);
  pdfDoc.setKeywords(['OFFSZN', 'Exclusive License', 'Willie Inspired', 'La K', 'Detroit Type Beat', verificationHash]);

  // =========================================================================
  // PAGE 1: LUXURY OBSIDIAN CERTIFICATE (A4)
  // =========================================================================
  const page1 = pdfDoc.addPage([595, 842]);
  const { width, height } = page1.getSize();

  // Background
  page1.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.035, 0.035, 0.045) // Deep obsidian black
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
    size: 9.5,
    font: boldFont,
    color: rgb(0.72, 0.38, 1)
  });

  page1.drawText('CERTIFIED EXCLUSIVE MASTER LICENSE & OWNERSHIP TRANSFER', {
    x: 45,
    y: height - 55,
    size: 7,
    font,
    color: rgb(0.55, 0.55, 0.6)
  });

  // Top Right Verification Data
  const rightX = width - 215;
  page1.drawText('AUTHENTICITY CODE', {
    x: rightX,
    y: height - 42,
    size: 7,
    font: boldFont,
    color: rgb(0.55, 0.55, 0.6)
  });
  page1.drawText(verificationHash, {
    x: rightX,
    y: height - 53,
    size: 8.5,
    font: boldFont,
    color: rgb(0.2, 0.85, 0.55) // Cyber emerald
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
    start: { x: 45, y: height - 78 },
    end: { x: width - 45, y: height - 78 },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.26)
  });

  // Main Big Title
  page1.drawText('EXCLUSIVE RIGHTS', {
    x: 45,
    y: height - 114,
    size: 24,
    font: boldFont,
    color: rgb(0.98, 0.98, 1)
  });
  page1.drawText('MASTER LICENSE CERTIFICATE • UNLIMITED COMMERCIAL EXPLOITATION', {
    x: 45,
    y: height - 130,
    size: 8.5,
    font: boldFont,
    color: rgb(0.72, 0.38, 1)
  });

  // Summary box (Card)
  const cardY = height - 330;
  page1.drawRectangle({
    x: 45,
    y: cardY,
    width: width - 90,
    height: 180,
    color: rgb(0.075, 0.075, 0.095),
    borderColor: rgb(0.28, 0.2, 0.38),
    borderWidth: 1
  });

  // Card Header
  page1.drawRectangle({
    x: 45,
    y: cardY + 152,
    width: width - 90,
    height: 28,
    color: rgb(0.13, 0.09, 0.2)
  });
  page1.drawText('TRANSACTION & ASSET SPECIFICATIONS', {
    x: 60,
    y: cardY + 162,
    size: 8.5,
    font: boldFont,
    color: rgb(0.88, 0.78, 1)
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
      color: rgb(0.62, 0.62, 0.68)
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

  // Rights Matrix Grid (The 6 "TODO ILIMITADO" pillars)
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
    { title: 'Market Exclusivity', value: '100% EXCLUSIVE', sub: 'Beat permanently retired. Never sold/leased again.' }
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
      borderColor: rgb(0.22, 0.17, 0.3),
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
      color: rgb(0.68, 0.68, 0.74)
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
      color: rgb(0.48, 0.48, 0.54)
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
    borderColor: rgb(0.42, 0.22, 0.62),
    borderWidth: 1
  });

  page1.drawText('MANDATORY PRODUCTION CREDIT & PUBLISHING SPLIT', {
    x: 60,
    y: noticeY + 47,
    size: 8.5,
    font: boldFont,
    color: rgb(0.92, 0.82, 1)
  });

  page1.drawText('• Mandatory Credit: The Licensee agrees to credit the Producer as "Prod. Willie Inspired" or "Produced by Willie Inspired".', {
    x: 60,
    y: noticeY + 33,
    size: 7.5,
    font,
    color: rgb(0.82, 0.82, 0.88)
  });

  page1.drawText('• Publishing Split: 50% Writer\'s Share to Producer (Willie Inspired) / 50% Writer\'s Share to Licensee (La K).', {
    x: 60,
    y: noticeY + 21,
    size: 7.5,
    font,
    color: rgb(0.82, 0.82, 0.88)
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
    color: rgb(0.38, 0.38, 0.44)
  });
  page1.drawText('Governed under international copyright standards and the commercial laws of Lima, Peru. Valid worldwide in perpetuity.', {
    x: 45,
    y: 28,
    size: 6.5,
    font,
    color: rgb(0.32, 0.32, 0.38)
  });

  // =========================================================================
  // PAGE 2: COMPLETE LEGAL CONTRACT & SIGNATURES (Studio Clean Theme)
  // =========================================================================
  const page2 = pdfDoc.addPage([595, 842]);
  const leftMargin = 45;
  const contentWidth = width - 90;

  // Header of Page 2
  page2.drawText('EXCLUSIVE RIGHTS LICENSE AGREEMENT', {
    x: leftMargin,
    y: height - 36,
    size: 10,
    font: boldFont,
    color: rgb(0.3, 0.15, 0.5)
  });
  page2.drawText(`ASSET: "${productName.toUpperCase()}" • PRODUCER: ${producerName.toUpperCase()} • ARTIST: ${buyerName.toUpperCase()}`, {
    x: leftMargin,
    y: height - 48,
    size: 7,
    font,
    color: rgb(0.45, 0.45, 0.5)
  });
  page2.drawText('PAGE 2 OF 2 • MASTER CONTRACT', {
    x: width - leftMargin - 150,
    y: height - 36,
    size: 7,
    font: boldFont,
    color: rgb(0.45, 0.45, 0.5)
  });
  page2.drawLine({
    start: { x: leftMargin, y: height - 54 },
    end: { x: width - leftMargin, y: height - 54 },
    thickness: 0.8,
    color: rgb(0.8, 0.8, 0.85)
  });

  const contractClauses = [
    {
      title: '1. PARTIES & EXCLUSIVE GRANT OF RIGHTS',
      text: `This Exclusive License Agreement is legally entered into and effective as of ${formattedDateEn}, by and between Willie Inspired / OFFSZN ("Producer" or "Licensor") and La K ("Licensee" or "Artist"). In consideration of the agreed fee of $40.00 USD (Forty US Dollars) received in full, Producer unconditionally transfers and grants to Licensee the exclusive, perpetual, irrevocable, and worldwide right to use the original musical composition "${productName}" (the "Beat") to record, produce, master, release, and commercially exploit a new derivative master sound recording ("Master Song").`
    },
    {
      title: '2. CATALOG RETIREMENT & ABSOLUTE EXCLUSIVITY',
      text: `Producer guarantees that upon execution of this Agreement, the Beat is immediately and permanently retired from all sales platforms, online stores, OFFSZN portal, and public lease catalogs. Producer shall NOT sell, lease, transfer, or license the Beat to any other third party in the future. Any non-exclusive licenses issued prior to this exclusive purchase remain valid solely until their specific stream or term limits expire, and no renewals or new licenses shall ever be granted.`
    },
    {
      title: '3. UNLIMITED COMMERCIAL EXPLOITATION (TODO ILIMITADO)',
      text: `Licensee is granted fully UNRESTRICTED and UNLIMITED rights across all territories in perpetuity: (a) Unlimited Audio Streams across all digital service providers (Spotify, Apple Music, YouTube Music, Tidal, Amazon Music, Deezer, etc.); (b) Unlimited Physical & Digital Distribution (Vinyls, CDs, Cassettes, digital downloads) with 0% mechanical royalties owed to Producer; (c) Unlimited Live Performances & Tours (Licensee retains 100% of all concert revenues and booking fees); (d) Unlimited Radio & TV Broadcasting worldwide; (e) Unlimited Synchronization Rights (official music videos, YouTube monetization, TV, cinema, trailers, video games, commercials, TikTok/Reels); (f) Master Revenue: Licensee retains 100% of all Master Recording royalties and distributor earnings.`
    },
    {
      title: '4. MASTER DELIVERABLES & MULTI-TRACK STEMS',
      text: `Producer agrees to deliver to Licensee the complete master asset package consisting of: (i) Master 24-bit Lossless WAV file, (ii) High-Definition 320kbps MP3 file, and (iii) Full Individual Trackout STEMS (separated multi-tracks: Kick, 808, Snare, Hi-Hats, Melodies, Percussions, FX) allowing full professional mixing and mastering flexibility.`
    },
    {
      title: '5. OWNERSHIP, PUBLISHING SPLITS (50/50) & PRODUCER CREDIT',
      text: `(a) Master Rights: Licensee owns and controls 100% of the Master Sound Recording containing Licensee\'s new vocal performance. (b) Publishing Splits: 50% of the Writer\'s Share to Licensee (for lyrics/vocal melodies) and 50% of the Writer\'s Share to Producer (Willie Inspired, for musical composition), registered with standard Performing Rights Organizations (ASCAP, BMI, SGAE, APDAYC). (c) Mandatory Production Credit: Licensee agrees to credit Producer as "Prod. Willie Inspired" or "Produced by Willie Inspired" on all releases, streaming metadata, YouTube descriptions, and physical liner notes.`
    },
    {
      title: '6. CONTENT ID & MONETIZATION CLEARANCE',
      text: `Licensee is fully authorized to monetize the Master Song across YouTube, TikTok, Facebook, and Instagram. Licensee may register the final derivative Master Song with digital distributors (DistroKid, TuneCore, etc.) and Content ID as an exclusive artist release.`
    },
    {
      title: '7. GOVERNING LAW & JURISDICTION',
      text: `This Agreement is governed by international intellectual property standards and the commercial laws of Lima, Peru. Both parties agree that digital execution and settlement shall carry full legal validity equivalent to handwritten signatures.`
    }
  ];

  let currentY = height - 70;
  for (const clause of contractClauses) {
    // Header banner
    page2.drawRectangle({
      x: leftMargin,
      y: currentY - 13,
      width: contentWidth,
      height: 16,
      color: rgb(0.95, 0.94, 0.98)
    });
    page2.drawRectangle({
      x: leftMargin,
      y: currentY - 13,
      width: 3,
      height: 16,
      color: rgb(0.5, 0.15, 0.8)
    });
    page2.drawText(clause.title, {
      x: leftMargin + 8,
      y: currentY - 9,
      size: 7.8,
      font: boldFont,
      color: rgb(0.25, 0.1, 0.4)
    });

    currentY -= 23;

    // Body text wrapping
    const words = clause.text.split(' ');
    let currentLine = '';
    const fontSize = 7.4;
    const lineHeight = 10.2;

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
    size: 8.5,
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

  const sigBoxY = currentY - 90;
  const sigBoxWidth = (contentWidth - 16) / 2;

  // Producer Signature Box
  page2.drawRectangle({
    x: leftMargin,
    y: sigBoxY,
    width: sigBoxWidth,
    height: 82,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1
  });
  page2.drawText('PRODUCER / LICENSOR (OFFSZN):', {
    x: leftMargin + 10,
    y: sigBoxY + 67,
    size: 7,
    font: boldFont,
    color: rgb(0.45, 0.2, 0.7)
  });
  page2.drawText('Willie Inspired', {
    x: leftMargin + 10,
    y: sigBoxY + 48,
    size: 13,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  page2.drawText('(Digital Certified Signature: Willie Inspired)', {
    x: leftMargin + 10,
    y: sigBoxY + 36,
    size: 6.2,
    font: obliqueFont,
    color: rgb(0.2, 0.6, 0.35)
  });
  page2.drawText(`Date: ${formattedDateEn} • Lima, Peru`, {
    x: leftMargin + 10,
    y: sigBoxY + 23,
    size: 6.5,
    font,
    color: rgb(0.4, 0.4, 0.45)
  });
  page2.drawText('Status: VERIFIED LICENSOR / EXCLUSIVE RIGHTS ISSUED', {
    x: leftMargin + 10,
    y: sigBoxY + 11,
    size: 5.8,
    font: boldFont,
    color: rgb(0.1, 0.65, 0.35)
  });

  // Licensee Signature Box
  const sig2X = leftMargin + sigBoxWidth + 16;
  page2.drawRectangle({
    x: sig2X,
    y: sigBoxY,
    width: sigBoxWidth,
    height: 82,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1
  });
  page2.drawText('LICENSEE / BUYER (ARTIST):', {
    x: sig2X + 10,
    y: sigBoxY + 67,
    size: 7,
    font: boldFont,
    color: rgb(0.45, 0.2, 0.7)
  });
  page2.drawText('La K', {
    x: sig2X + 10,
    y: sigBoxY + 48,
    size: 13,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  page2.drawText('(Accepted via License Settlement - $40.00 USD)', {
    x: sig2X + 10,
    y: sigBoxY + 36,
    size: 6.2,
    font: obliqueFont,
    color: rgb(0.2, 0.6, 0.35)
  });
  page2.drawText(`Date: ${formattedDateEn} • Order ID: #${orderId}`, {
    x: sig2X + 10,
    y: sigBoxY + 23,
    size: 6.5,
    font,
    color: rgb(0.4, 0.4, 0.45)
  });
  page2.drawText('Status: FULL EXCLUSIVE LICENSEE / UNLIMITED EXPLOITATION', {
    x: sig2X + 10,
    y: sigBoxY + 11,
    size: 5.8,
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
  console.log('✅ Final Master License PDF generated at:', outputPath);
  console.log('Total pages:', pdfDoc.getPageCount());
  console.log('Final Y coordinate on Page 2:', sigBoxY);
}

generateExclusiveLicensePdf().catch(console.error);
