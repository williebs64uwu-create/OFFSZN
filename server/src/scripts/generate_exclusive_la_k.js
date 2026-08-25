import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generateExclusiveLicensePdf() {
  const purchaseData = {
    productName: 'detroit type beat',
    producerName: 'Willie Inspired',
    amount: 40.00,
    buyerName: 'La K',
    buyerEmail: 'lak.music.official@offszn.client',
    purchaseDate: new Date().toISOString(),
    orderId: 'EXCL-' + Math.floor(100000 + Math.random() * 900000),
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

  // Metadata
  const verificationHash = Buffer.from(`${orderId}:${buyerName}:${productName}:40USD`).toString('base64').substring(0, 18).toUpperCase();
  pdfDoc.setTitle(`OFFSZN Exclusive License - ${productName} (${buyerName})`);
  pdfDoc.setAuthor('Willie Inspired / OFFSZN');
  pdfDoc.setProducer('OFFSZN Platform Legal Engine v4.0');
  pdfDoc.setCreator('OFFSZN Exclusive Rights Automation');
  pdfDoc.setSubject(`Exclusive Music License Agreement - Order ${orderId}`);
  pdfDoc.setKeywords(['OFFSZN', 'Exclusive License', 'Willie Inspired', 'La K', 'Detroit Type Beat', verificationHash]);

  // ==========================================
  // PAGE 1: CERTIFICATE OF EXCLUSIVE OWNERSHIP (Dark Luxury OFFSZN Style)
  // ==========================================
  const page1 = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page1.getSize();

  // Background
  page1.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.04, 0.04, 0.05) // Sleek obsidian
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
    y: height - 45,
    size: 9,
    font: boldFont,
    color: rgb(0.7, 0.35, 1)
  });

  page1.drawText('CERTIFIED EXCLUSIVE MASTER LICENSE', {
    x: 45,
    y: height - 58,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.55)
  });

  // Top Right Info
  const rightX = width - 210;
  page1.drawText('AUTHENTICITY CODE', {
    x: rightX,
    y: height - 45,
    size: 7,
    font: boldFont,
    color: rgb(0.5, 0.5, 0.55)
  });
  page1.drawText(verificationHash, {
    x: rightX,
    y: height - 56,
    size: 8,
    font: boldFont,
    color: rgb(0.2, 0.85, 0.55)
  });
  page1.drawText(`ORDER: #${orderId}`, {
    x: rightX,
    y: height - 67,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.55)
  });

  // Divider Line
  page1.drawLine({
    start: { x: 45, y: height - 85 },
    end: { x: width - 45, y: height - 85 },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.25)
  });

  // Main Big Title
  page1.drawText('EXCLUSIVE RIGHTS', {
    x: 45,
    y: height - 120,
    size: 24,
    font: boldFont,
    color: rgb(0.98, 0.98, 1)
  });
  page1.drawText('LICENSE CERTIFICATE & TRANSFER OF MASTER RIGHTS', {
    x: 45,
    y: height - 136,
    size: 9,
    font: boldFont,
    color: rgb(0.7, 0.35, 1)
  });

  // Summary box (Card)
  const cardY = height - 340;
  page1.drawRectangle({
    x: 45,
    y: cardY,
    width: width - 90,
    height: 185,
    color: rgb(0.08, 0.08, 0.1),
    borderColor: rgb(0.25, 0.18, 0.35),
    borderWidth: 1
  });

  // Card Header
  page1.drawRectangle({
    x: 45,
    y: cardY + 155,
    width: width - 90,
    height: 30,
    color: rgb(0.12, 0.09, 0.18)
  });
  page1.drawText('TRANSACTION & ASSET SPECIFICATIONS', {
    x: 60,
    y: cardY + 166,
    size: 9,
    font: boldFont,
    color: rgb(0.85, 0.75, 1)
  });

  // Details items
  const details = [
    ['Instrumental Title (Beat):', `"${productName}"`],
    ['Producer / Licensor:', producerName],
    ['Licensee / Buyer (Artist):', buyerName],
    ['License Category:', 'FULL EXCLUSIVE RIGHTS (ILIMITADO / UNLIMITED)'],
    ['Agreed Fee Paid:', `${priceFormatted} (Paid in Full - Single Settlement)`],
    ['Delivery Package:', 'Master WAV (24-bit), MP3 (320kbps) & Individual Trackout STEMS'],
    ['Date of Execution:', `${formattedDateEn} (${formattedDate})`]
  ];

  let currentDetailY = cardY + 135;
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

  // Rights Matrix Grid (The "TODO ILIMITADO" highlights)
  const matrixY = height - 540;
  page1.drawText('EXCLUSIVITY & UNLIMITED RIGHTS BREAKDOWN', {
    x: 45,
    y: matrixY + 15,
    size: 11,
    font: boldFont,
    color: rgb(0.95, 0.95, 0.98)
  });

  const matrixItems = [
    { title: 'Audio Streams', value: 'UNLIMITED (ILIMITADO)', sub: 'Spotify, Apple Music, YouTube Music, Deezer, etc.' },
    { title: 'Sales & Physical Units', value: 'UNLIMITED (ILIMITADO)', sub: 'Digital downloads, Vinyls, CDs, Cassettes, USBs' },
    { title: 'Public Performances', value: 'UNLIMITED (ILIMITADO)', sub: 'For-profit concerts, festivals, tours, venues & live income' },
    { title: 'Radio & TV Broadcasting', value: 'UNLIMITED (ILIMITADO)', sub: 'Global terrestrial, digital, satellite & internet stations' },
    { title: 'Sync & Video Projects', value: 'UNLIMITED (ILIMITADO)', sub: 'Official music videos, TV sync, cinema, gaming, commercials' },
    { title: 'Market Exclusivity', value: '100% EXCLUSIVE', sub: 'Beat is permanently retired. Never to be leased/sold again.' }
  ];

  const colWidth = (width - 90 - 15) / 2;
  const colHeight = 50;

  matrixItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const boxX = 45 + col * (colWidth + 15);
    const boxY = matrixY - 45 - row * (colHeight + 10);

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

    // Item Title
    page1.drawText(item.title.toUpperCase(), {
      x: boxX + 12,
      y: boxY + 34,
      size: 7,
      font: boldFont,
      color: rgb(0.65, 0.65, 0.7)
    });

    // Item Value
    page1.drawText(item.value, {
      x: boxX + 12,
      y: boxY + 20,
      size: 9,
      font: boldFont,
      color: rgb(0.2, 0.9, 0.6)
    });

    // Item Subtext
    page1.drawText(item.sub, {
      x: boxX + 12,
      y: boxY + 8,
      size: 6.5,
      font,
      color: rgb(0.45, 0.45, 0.5)
    });
  });

  // Credit Guarantee & Important Notice Banner
  const noticeY = 120;
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
    y: noticeY + 32,
    size: 7.5,
    font,
    color: rgb(0.8, 0.8, 0.85)
  });

  page1.drawText('• Publishing Split: 50% Writer\'s Share to Producer (Willie Inspired) / 50% Writer\'s Share to Licensee (La K).', {
    x: 60,
    y: noticeY + 20,
    size: 7.5,
    font,
    color: rgb(0.8, 0.8, 0.85)
  });

  page1.drawText('• Master & Distribution: Licensee retains 100% of Master Recording revenues and unlimited commercial distribution.', {
    x: 60,
    y: noticeY + 8,
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
  // PAGE 2 & 3: COMPLETE LEGAL CONTRACT (Light Professional Studio Print)
  // ==========================================
  
  const contractClauses = [
    {
      title: '1. AGREEMENT OVERVIEW & EXCLUSIVE GRANT OF RIGHTS',
      paragraphs: [
        `This Exclusive Rights License Agreement ("Agreement") is legally entered into and effective as of ${formattedDateEn}, by and between Willie Inspired / OFFSZN ("Producer" or "Licensor"), and La K ("Licensee" or "Artist").`,
        `WHEREAS, Licensor is the sole and exclusive composer and author of the original musical work/instrumental titled "${productName}" (the "Beat"); and WHEREAS, Licensee desires to acquire FULL EXCLUSIVE, UNLIMITED, AND PERPETUAL worldwide rights to incorporate the Beat into a new vocal recording and derivative master recording ("Master Song").`,
        `IN CONSIDERATION of the timely payment of $40.00 USD (Forty US Dollars) ("License Fee"), receipt and sufficiency of which is hereby acknowledged, Producer unconditionally transfers and grants to Licensee the exclusive, perpetual, irrevocable, and worldwide license to utilize, exploit, and monetize the Beat subject to the terms herein.`
      ]
    },
    {
      title: '2. ABSOLUTE EXCLUSIVITY & TERMINATION OF THIRD-PARTY SALES',
      paragraphs: [
        `a. Exclusivity Guarantee: Producer guarantees that following the execution of this Agreement, the Beat shall be immediately and permanently retired from the Producer\'s catalog, online stores, Beatstars, OFFSZN portal, and public lease listings. Producer shall NOT sell, lease, transfer, or license the Beat to any other third party henceforth.`,
        `b. Existing Non-Exclusive Leases: In accordance with standard global music industry practices, any non-exclusive leases issued prior to this purchase remain active until their respective stream limits or expiration periods lapse; however, no new leases or renewals shall ever be granted.`
      ]
    },
    {
      title: '3. UNLIMITED COMMERCIAL EXPLOITATION (TODO ILIMITADO)',
      paragraphs: [
        `Licensee is granted UNRESTRICTED and UNLIMITED commercial and non-commercial rights across all territories and in perpetuity:`,
        `• Unlimited Streaming: Licensee may generate an UNLIMITED number of audio streams across all digital service providers (DSPs), including Spotify, Apple Music, Amazon Music, Tidal, Deezer, YouTube Music, Pandora, and all emerging streaming technologies.`,
        `• Unlimited Physical & Digital Distribution: Licensee may manufacture, distribute, and sell an UNLIMITED number of physical copies (CDs, Vinyl, Cassettes, Flash drives) and digital downloads worldwide without paying any ongoing mechanical royalties to Producer.`,
        `• Unlimited Public Performance & Tour Income: Licensee may perform the Master Song live at unlimited public concerts, festivals, nightclubs, broadcasted events, and arena tours worldwide, retaining 100% of all live performance revenues and artist booking fees.`,
        `• Unlimited Radio & Satellite Broadcasting: Licensee has full rights to broadcast the Master Song across unlimited terrestrial (FM/AM), satellite (SiriusXM), and internet radio stations worldwide.`,
        `• Unlimited Synchronization (Sync Rights): Licensee may synchronize the Master Song with unlimited audiovisual productions, including official music videos, YouTube videos, TikTok/Reels content, film, television broadcasts, video games, trailers, and commercial advertisements.`,
        `• Master Revenue Retention: Licensee retains ONE HUNDRED PERCENT (100%) of all Master Recording royalties, digital distribution payouts (DistroKid, TuneCore, CD Baby, etc.), and sync master fees.`
      ]
    },
    {
      title: '4. DELIVERABLES & MASTER AUDIO STEMS',
      paragraphs: [
        `Producer shall deliver to Licensee the complete, pristine master asset package consisting of: (i) Master Uncompressed 24-bit WAV file, (ii) High-Definition 320kbps MP3 file, and (iii) Full Individual Trackout STEMS (separated audio multi-tracks: Kick, 808, Snare, Hi-Hats, Melodies, Percussions, FX, etc.) allowing full professional mixdown and mastering flexibility.`
      ]
    },
    {
      title: '5. OWNERSHIP, PUBLISHING SPLITS & CREDITS',
      paragraphs: [
        `a. Master Recording: Licensee owns and controls the Master Recording containing Licensee\'s new vocal performance, lyrics, and arrangement created using the Beat.`,
        `b. Publishing & Composition Splits (50/50 Standard): In harmony with universal PRO standards (ASCAP, BMI, SESAC, SGAE, APDAYC):`,
        `   - Writer\'s Share: 50% to Licensee (La K) for lyrics/vocal melodies | 50% to Producer (Willie Inspired) for musical composition.`,
        `   - Publisher\'s Share: 50% to Licensee / 50% to Producer (or Producer\'s publishing administrator).`,
        `c. Mandatory Production Credit: Licensee agrees to credit Producer as "Prod. Willie Inspired" or "Produced by Willie Inspired" across all official platforms, metadata, streaming liner notes, YouTube titles/descriptions, and physical credits.`
      ]
    },
    {
      title: '6. CONTENT ID & MONETIZATION CLEARANCE',
      paragraphs: [
        `Licensee is fully authorized to monetize the Master Song on YouTube, Facebook, Instagram, and TikTok. Licensee may register the derivative Master Song with digital distributors and YouTube Content ID as an exclusive artist release containing the customized vocals.`
      ]
    },
    {
      title: '7. WARRANTIES, INDEMNIFICATION & GOVERNING LAW',
      paragraphs: [
        `a. Producer Warranty: Producer warrants that the Beat is an original musical composition created by Willie Inspired and does not infringe upon any third-party copyrights.`,
        `b. Governing Law: This Agreement shall be governed by and interpreted under international intellectual property conventions and the commercial laws of Lima, Peru. Both parties agree that digital acceptance and execution shall carry full legal validity equivalent to original handwritten signatures.`
      ]
    }
  ];

  let currentPage = pdfDoc.addPage([595, 842]);
  let cursorY = height - 50;
  const leftMargin = 45;
  const contentWidth = width - 90;

  function drawContractHeader(page, pageNum) {
    page.drawText('EXCLUSIVE RIGHTS LICENSE AGREEMENT • CONTRACT TERMS', {
      x: leftMargin,
      y: height - 35,
      size: 8,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.45)
    });
    page.drawText(`ASSET: "${productName.toUpperCase()}" • ARTIST: ${buyerName.toUpperCase()}`, {
      x: leftMargin,
      y: height - 46,
      size: 7,
      font,
      color: rgb(0.55, 0.55, 0.6)
    });
    page.drawText(`PAGE ${pageNum}`, {
      x: width - leftMargin - 45,
      y: height - 35,
      size: 7.5,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.45)
    });
    page.drawLine({
      start: { x: leftMargin, y: height - 52 },
      end: { x: width - leftMargin, y: height - 52 },
      thickness: 0.8,
      color: rgb(0.8, 0.8, 0.85)
    });
  }

  function drawContractFooter(page) {
    page.drawLine({
      start: { x: leftMargin, y: 45 },
      end: { x: width - leftMargin, y: 45 },
      thickness: 0.8,
      color: rgb(0.8, 0.8, 0.85)
    });
    page.drawText(`OFFSZN LEGAL ENGINE • ORDER ${orderId} • AUTH: ${verificationHash}`, {
      x: leftMargin,
      y: 32,
      size: 6.5,
      font: boldFont,
      color: rgb(0.5, 0.5, 0.55)
    });
    page.drawText('INITIALS: LICENSOR [ W.I. ]  /  LICENSEE [ L.K. ]', {
      x: width - leftMargin - 180,
      y: 32,
      size: 6.5,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.45)
    });
  }

  let pageNumber = 2;
  drawContractHeader(currentPage, pageNumber);
  drawContractFooter(currentPage);
  cursorY = height - 70;

  for (const section of contractClauses) {
    if (cursorY < 90) {
      currentPage = pdfDoc.addPage([595, 842]);
      pageNumber++;
      drawContractHeader(currentPage, pageNumber);
      drawContractFooter(currentPage);
      cursorY = height - 70;
    }

    // Section Header Box
    currentPage.drawRectangle({
      x: leftMargin,
      y: cursorY - 14,
      width: contentWidth,
      height: 18,
      color: rgb(0.94, 0.93, 0.97)
    });
    currentPage.drawRectangle({
      x: leftMargin,
      y: cursorY - 14,
      width: 3,
      height: 18,
      color: rgb(0.45, 0.1, 0.75)
    });
    currentPage.drawText(section.title, {
      x: leftMargin + 8,
      y: cursorY - 9,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.1, 0.35)
    });

    cursorY -= 22;

    for (const paragraph of section.paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';
      const isBullet = paragraph.startsWith('•') || paragraph.startsWith('   -');
      const textFont = font;
      const fontSize = 7.5;
      const lineHeight = 10.5;

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = textFont.widthOfTextAtSize(testLine, fontSize);

        if (textWidth < contentWidth - (isBullet ? 8 : 0)) {
          currentLine = testLine;
        } else {
          if (cursorY < 55) {
            currentPage = pdfDoc.addPage([595, 842]);
            pageNumber++;
            drawContractHeader(currentPage, pageNumber);
            drawContractFooter(currentPage);
            cursorY = height - 70;
          }
          currentPage.drawText(currentLine, {
            x: leftMargin + (isBullet ? 6 : 0),
            y: cursorY,
            size: fontSize,
            font: textFont,
            color: rgb(0.15, 0.15, 0.18)
          });
          cursorY -= lineHeight;
          currentLine = word;
        }
      }

      if (currentLine) {
        if (cursorY < 55) {
          currentPage = pdfDoc.addPage([595, 842]);
          pageNumber++;
          drawContractHeader(currentPage, pageNumber);
          drawContractFooter(currentPage);
          cursorY = height - 70;
        }
        currentPage.drawText(currentLine, {
          x: leftMargin + (isBullet ? 6 : 0),
          y: cursorY,
          size: fontSize,
          font: textFont,
          color: rgb(0.15, 0.15, 0.18)
        });
        cursorY -= lineHeight;
      }

      cursorY -= 3;
    }

    cursorY -= 5;
  }

  // SIGNATURE BLOCK SECTION
  if (cursorY < 145) {
    currentPage = pdfDoc.addPage([595, 842]);
    pageNumber++;
    drawContractHeader(currentPage, pageNumber);
    drawContractFooter(currentPage);
    cursorY = height - 70;
  }

  cursorY -= 8;
  currentPage.drawText('SIGNATURES & EXECUTION OF PARTIES', {
    x: leftMargin,
    y: cursorY,
    size: 8.5,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  cursorY -= 10;
  currentPage.drawLine({
    start: { x: leftMargin, y: cursorY },
    end: { x: width - leftMargin, y: cursorY },
    thickness: 1,
    color: rgb(0.3, 0.15, 0.5)
  });

  const sigBoxY = cursorY - 100;
  const sigBoxWidth = (contentWidth - 20) / 2;

  // Producer Signature Box
  currentPage.drawRectangle({
    x: leftMargin,
    y: sigBoxY,
    width: sigBoxWidth,
    height: 90,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1
  });
  currentPage.drawText('PRODUCER / LICENSOR (OFFSZN):', {
    x: leftMargin + 10,
    y: sigBoxY + 74,
    size: 7.5,
    font: boldFont,
    color: rgb(0.4, 0.2, 0.6)
  });
  currentPage.drawText('Willie Inspired', {
    x: leftMargin + 10,
    y: sigBoxY + 54,
    size: 13,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  currentPage.drawText('(Digital Certified Signature: Willie Inspired)', {
    x: leftMargin + 10,
    y: sigBoxY + 41,
    size: 6.5,
    font: obliqueFont,
    color: rgb(0.2, 0.6, 0.35)
  });
  currentPage.drawText(`Date: ${formattedDateEn}`, {
    x: leftMargin + 10,
    y: sigBoxY + 26,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.45)
  });
  currentPage.drawText('Status: VERIFIED LICENSOR / FULL RIGHTS ISSUED', {
    x: leftMargin + 10,
    y: sigBoxY + 12,
    size: 6,
    font: boldFont,
    color: rgb(0.1, 0.65, 0.35)
  });

  // Licensee Signature Box
  const sig2X = leftMargin + sigBoxWidth + 20;
  currentPage.drawRectangle({
    x: sig2X,
    y: sigBoxY,
    width: sigBoxWidth,
    height: 90,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.85, 0.85, 0.9),
    borderWidth: 1
  });
  currentPage.drawText('LICENSEE / BUYER (ARTIST):', {
    x: sig2X + 10,
    y: sigBoxY + 74,
    size: 7.5,
    font: boldFont,
    color: rgb(0.4, 0.2, 0.6)
  });
  currentPage.drawText('La K', {
    x: sig2X + 10,
    y: sigBoxY + 54,
    size: 13,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2)
  });
  currentPage.drawText('(Accepted via License Settlement - $40.00 USD)', {
    x: sig2X + 10,
    y: sigBoxY + 41,
    size: 6.5,
    font: obliqueFont,
    color: rgb(0.2, 0.6, 0.35)
  });
  currentPage.drawText(`Date: ${formattedDateEn}`, {
    x: sig2X + 10,
    y: sigBoxY + 26,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.45)
  });
  currentPage.drawText('Status: FULL EXCLUSIVE LICENSEE / UNLIMITED RIGHTS', {
    x: sig2X + 10,
    y: sigBoxY + 12,
    size: 6,
    font: boldFont,
    color: rgb(0.1, 0.65, 0.35)
  });

  const pdfBytes = await pdfDoc.save();
  
  // Save to workspace root
  const outputPath = path.resolve('..', 'OFFSZN_Licencia_Exclusiva_detroit_type_beat_La_K.pdf');
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  console.log('✅ PDF generated successfully at:', outputPath);
  console.log('Total pages:', pdfDoc.getPageCount());
}

generateExclusiveLicensePdf().catch(console.error);
