import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import jwt from 'jsonwebtoken';
import { LICENSE_PANEL_KEY, JWT_SECRET } from '../../../shared/config/config.js';

const PANEL_KEY = LICENSE_PANEL_KEY || 'gian2030upc';
const SIGNING_SECRET = JWT_SECRET || 'offszn_secure_panel_key_2026';

export async function authLicensePanel(req, res) {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Clave requerida' });
    }

    if (key.trim() !== PANEL_KEY.trim()) {
      return res.status(401).json({ success: false, error: 'Clave incorrecta' });
    }

    const token = jwt.sign(
      { role: 'license_panel_admin', timestamp: Date.now() },
      SIGNING_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Autenticación exitosa',
      token
    });
  } catch (error) {
    console.error('Error in authLicensePanel:', error);
    return res.status(500).json({ success: false, error: 'Error del servidor' });
  }
}

export async function verifyLicensePanelToken(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token || req.headers['x-panel-key'];

    if (!token) {
      return res.status(401).json({ valid: false });
    }

    // Direct key check fallback
    if (token === PANEL_KEY) {
      return res.status(200).json({ valid: true });
    }

    jwt.verify(token, SIGNING_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ valid: false });
      }
      return res.status(200).json({ valid: true, decoded });
    });
  } catch (error) {
    return res.status(401).json({ valid: false });
  }
}

export function licensePanelAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token || req.headers['x-panel-key'];

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Proporcione clave o token.' });
  }

  if (token === PANEL_KEY) {
    return next();
  }

  jwt.verify(token, SIGNING_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
    req.panelUser = decoded;
    next();
  });
}

export async function generateLicensePdfEndpoint(req, res) {
  try {
    const {
      productName = 'Beat Instrumental',
      producerName = 'Willie Inspired',
      amount = 35.00,
      buyerName = 'Cliente',
      buyerEmail = 'cliente@offszn.com',
      purchaseDate = new Date().toISOString(),
      orderId = Math.floor(1000 + Math.random() * 9000),
      licenseType = 'exclusive',
      customFiles,
      producerPublishing = 50,
      licenseePublishing = 50,
      creditsText
    } = req.body;

    const isExclusive = licenseType.toLowerCase().includes('exclusiv') || licenseType.toLowerCase() === 'exclusive';
    const isUnlimited = licenseType.toLowerCase().includes('unlimited') || licenseType.toLowerCase().includes('stems');
    const isPremium = licenseType.toLowerCase().includes('premium') || licenseType.toLowerCase().includes('wav');

    let licenseName = 'Exclusive Rights License';
    if (!isExclusive) {
      if (isUnlimited) licenseName = 'Non-Exclusive Unlimited License';
      else if (isPremium) licenseName = 'Non-Exclusive Premium License';
      else licenseName = 'Non-Exclusive Basic License';
    }

    const price = `$${parseFloat(amount || 0).toFixed(2)} USD`;
    
    let filesDelivered = customFiles || 'high-quality MP3 and WAV files';
    if (isExclusive || isUnlimited) {
      if (!customFiles) filesDelivered = 'high-quality MP3, WAV and individual Trackout STEM files';
    } else if (licenseType.toLowerCase() === 'basic') {
      if (!customFiles) filesDelivered = 'high-quality MP3 file';
    }

    const salesLimit = isExclusive || isUnlimited ? 'UNLIMITED' : (isPremium ? '10,000' : '5,000');
    const streamsLimit = isExclusive || isUnlimited ? 'UNLIMITED' : (isPremium ? '500,000' : '50,000');
    const radioLimit = isExclusive || isUnlimited ? 'UNLIMITED' : (isPremium ? '5' : '2');
    const videoProjects = isExclusive || isUnlimited ? 'UNLIMITED audiovisual projects' : (isPremium ? '5 audiovisual projects' : '1 audiovisual project');
    const creditsValue = creditsText || `Produced by ${producerName}`;

    const template = `${licenseName} Agreement

1. Agreement Overview and License Grant
a. This ${licenseName} Agreement ("Agreement") is entered into by and between the individual or entity purchasing this license (the "Licensee") and the producer of the instrumental music (the "Producer"). This Agreement sets forth the terms and conditions of the Licensee's use of the instrumental music file covered by this license (referred to herein as "the Beat"), in consideration for the Licensee's payment of ${price} for an ${licenseName}.
b. By purchasing this license, the Licensee acknowledges and agrees to the terms stated herein. This Agreement is issued solely in connection with the Licensee's use of the Beat. The Licensee shall make full payment of the License Fee to the Producer at the time of purchase. All rights granted under this Agreement are strictly conditional upon timely payment.

2. Delivery of the Beat:
a. The Producer agrees to deliver the Beat as ${filesDelivered}, in accordance with industry standards.
b. The Producer shall use commercially reasonable efforts to deliver the Beat immediately after the License Fee has been paid via email / download portal.

3. Term & Exclusivity:
This License is ${isExclusive ? 'EXCLUSIVE and perpetual. The Producer shall not license or sell this Beat to any other third party following this transaction.' : 'Non-Exclusive and valid for ten (10) years worldwide.'}

4. Use of the Beat:
In consideration of the License Fee, the Licensee is granted an ${isExclusive ? 'exclusive' : 'non-exclusive'} license to use the Beat for the creation of commercial and non-commercial musical works.
a. Permitted Uses:
The License grants the Licensee a worldwide, ${isExclusive ? 'exclusive' : 'non-exclusive'} license to use the Beat.
b. The Licensee is permitted to:
- Use the song for commercial distribution and ${isExclusive || isUnlimited ? 'unlimited streaming' : 'streaming'} across all digital platforms (Spotify, Apple Music, YouTube, etc.).
- Perform the song publicly (${isExclusive || isUnlimited ? 'Unlimited non-profit and for-profit concerts/festivals' : 'Non-profit and commercial live performances'}).
- Broadcasting rights for ${radioLimit} terrestrial or satellite stations.
- Synchronize the song with ${videoProjects}.
- Sell up to ${salesLimit} physical and/or digital units.
- Up to ${streamsLimit} monetized audio streams.

5. Ownership & Publishing
The musical composition (melody/lyrics created by Licensee) belongs to Licensee.
a. Publishing Splits:
- Licensee owns ${licenseePublishing}% of the Writer's Share.
- Producer owns ${producerPublishing}% of the Writer's Share.
- Producer shall own and administer ${producerPublishing}% of the Publisher's Share.
b. Credit: Licensee shall credit Producer as "${creditsValue}" on all releases.

6. Governing Law:
This Agreement is governed by the laws of Lima, Peru.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date of purchase.`;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Page 1: Certificate (Exact OFFSZN Template)
    const page1 = pdfDoc.addPage([595, 842]);
    const { width, height } = page1.getSize();

    // Black background
    page1.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0) });

    const safeHashString = `${orderId}:${buyerEmail}`.replace(/[^\x00-\x7F]/g, "");
    const verificationHash = Buffer.from(safeHashString).toString('base64').substring(0, 16).toUpperCase();

    pdfDoc.setProducer('OFFSZN Platform');
    pdfDoc.setCreator('OFFSZN Legal Engine');
    pdfDoc.setSubject(`Verification Code: ${verificationHash}`);
    pdfDoc.setKeywords(['OFFSZN', String(orderId), verificationHash, 'Peru']);

    const topInfoY = height - 60;
    const rightInfoX = width - 230;

    page1.drawText(`OFFSZN AUTHENTICITY CHECK`, {
      x: rightInfoX, y: topInfoY, size: 7, font: boldFont, color: rgb(0.4, 0.4, 0.4)
    });
    page1.drawText(`CODE: ${verificationHash}`, {
      x: rightInfoX, y: topInfoY - 10, size: 7, font, color: rgb(0.4, 0.4, 0.4)
    });
    page1.drawText(`ISSUED: LIMA, PERU`, {
      x: rightInfoX, y: topInfoY - 20, size: 7, font, color: rgb(0.4, 0.4, 0.4)
    });

    page1.drawText('LICENSE CERTIFICATE', {
      x: 50, y: height - 135, size: 16, font: font,
      color: rgb(0.8, 0.8, 0.8)
    });

    page1.drawLine({
      start: { x: 50, y: height - 150 },
      end: { x: width - 50, y: height - 150 },
      thickness: 1.5, color: rgb(0.45, 0.04, 0.72)
    });

    let yPos = height - 200;
    page1.drawText('PURCHASE INFORMATION', {
      x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.5, 0.5, 0.5)
    });

    yPos -= 40;
    const info = [
      ['Beat Name:', productName],
      ['Producer:', producerName],
      ['License Type:', licenseName],
      ['Price Paid:', price]
    ];

    info.forEach(([label, value]) => {
      page1.drawText(label, { x: 50, y: yPos, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
      page1.drawText(value, { x: 180, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) });
      yPos -= 25;
    });

    yPos -= 20;
    page1.drawLine({ start: { x: 50, y: yPos }, end: { x: width - 50, y: yPos }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
    yPos -= 40;

    page1.drawText('LICENSEE (BUYER)', { x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 40;

    const formattedPurchaseDate = purchaseDate.includes('/') 
      ? purchaseDate 
      : new Date(purchaseDate).toLocaleDateString('en-US');

    const buyerInfo = [
      ['Buyer Name:', buyerName],
      ['Buyer Email:', buyerEmail],
      ['Purchase Date:', formattedPurchaseDate],
      ['Order ID:', String(orderId)]
    ];

    buyerInfo.forEach(([label, value]) => {
      page1.drawText(label, { x: 50, y: yPos, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
      page1.drawText(String(value), { x: 180, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) });
      yPos -= 25;
    });

    const footerY = 60;
    page1.drawText('OFFSZN DIGITAL SIGNATURE & VERIFICATION SYSTEM', {
      x: 50, y: footerY + 12, size: 7, font: boldFont, color: rgb(0.3, 0.3, 0.3)
    });
    page1.drawText('THIS LICENSE IS VALID GLOBALLY BUT GOVERNED BY THE LAWS OF LIMA, PERU.', {
      x: 50, y: footerY + 2, size: 7, font, color: rgb(0.3, 0.3, 0.3)
    });

    // Page 2: Contract
    let contractPage = pdfDoc.addPage([595, 842]);
    let currentY = 780;
    const margin = 50;
    const maxWidth = 495;
    const fontSize = 9.5;
    const lineHeight = 13.5;

    const lines = template.split('\n');

    for (const paragraph of lines) {
      if (paragraph.trim() === '') {
        currentY -= 8;
        continue;
      }

      const isHeader = paragraph.startsWith('Exclusive Rights') || paragraph.startsWith('Non-Exclusive') || /^\d+\./.test(paragraph.trim()) || paragraph.startsWith('IN WITNESS');
      const lineFont = isHeader ? boldFont : font;

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = lineFont.widthOfTextAtSize(testLine, fontSize);

        if (textWidth < maxWidth) {
          currentLine = testLine;
        } else {
          if (currentY < 50) {
            contractPage = pdfDoc.addPage([595, 842]);
            currentY = 780;
          }
          contractPage.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font: lineFont, color: rgb(0, 0, 0) });
          currentY -= lineHeight;
          currentLine = word;
        }
      }

      if (currentLine) {
        if (currentY < 50) {
          contractPage = pdfDoc.addPage([595, 842]);
          currentY = 780;
        }
        contractPage.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font: lineFont, color: rgb(0, 0, 0) });
        currentY -= lineHeight;
      }

      currentY -= 3;
    }

    const pdfBytes = await pdfDoc.save();
    const safeName = productName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = `OFFSZN_License_${safeName}_Order${orderId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBytes.length);

    return res.end(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error generating license PDF in endpoint:', error);
    return res.status(500).json({ error: 'Error al generar la licencia' });
  }
}
