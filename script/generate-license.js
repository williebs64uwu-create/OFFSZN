import { PDFDocument, rgb, StandardFonts } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
// Use the global client initialized by auth-utils.js
const supabase = window.supabaseClient;

// Safety check
if (!supabase) {
  console.warn("Generate License: Global Supabase not found (okay if running as standalone utility).");
}

export async function generarLicencia(purchaseData) {
  try {
    // console.log('🔄 Generando licencia dinámica...', purchaseData);

    const {
      productName,
      producerName,
      amount,
      buyerName,
      buyerEmail,
      purchaseDate,
      orderId,
      licenseSettings,
      productType
    } = purchaseData;

    const isDrumKit = productType === 'drumkit' || productType === 'loopkit' || productType === 'preset';

    const licenseType = (purchaseData.licenseType || 'basic').toLowerCase();
    const licenseName = isDrumKit ?
      (productType === 'loopkit' ? 'Standard Loop Kit License' :
        productType === 'preset' ? 'Standard Preset License' : 'Standard Kit License')
      : getLicenseName(licenseType);
    const price = `$${parseFloat(amount).toFixed(2)} USD`;

    // --- FALLBACK DEFAULTS (Matches admin-licencias logic) ---
    const DEFAULT_CONFIGS = {
      basic: {
        streams: "50,000",
        sales: "5,000",
        radio: "2 Estaciones",
        files: { wav: false, stems: false },
        video: "one (1) audiovisual project"
      },
      premium: {
        streams: "500,000",
        sales: "10,000",
        radio: "5 Estaciones",
        files: { wav: true, stems: false },
        video: "five (5) audiovisual projects"
      },
      unlimited: {
        streams: "UNLIMITED",
        sales: "UNLIMITED",
        radio: "UNLIMITED",
        files: { wav: true, stems: true },
        video: "UNLIMITED audiovisual projects"
      }
    };

    // 1. Process Logic: Data to Text Mapping
    const settings = licenseSettings || {};
    // Find the config block that matches the license (search by key or by .name)
    let config = settings[licenseType] || Object.values(settings).find(s => s.name?.toLowerCase().includes(licenseType)) || {};

    // Merge with defaults if specific properties are missing (using basic as the floor)
    const defaults = DEFAULT_CONFIGS[licenseType.includes('premium') ? 'premium' : (licenseType.includes('unlimited') ? 'unlimited' : 'basic')];

    // Files Delivered Logic
    const files = config.files || defaults.files;
    let filesDelivered = "a high-quality MP3 file";
    if (files.stems) {
      filesDelivered = "high-quality WAV, MP3, and individual trackout stem files";
    } else if (files.wav) {
      filesDelivered = "high-quality MP3 and WAV files";
    }

    // Limits Logic (Check both direct properties and .usage sub-object)
    const getLimit = (obj, key) => obj[key] || obj.usage?.[key] || defaults[key];
    const formatLimit = (val) => (!val || val.toString().toLowerCase().includes('unlimited') || val.toString().toLowerCase().includes('ilimitado')) ? "UNLIMITED" : val.toString();

    const salesLimit = formatLimit(getLimit(config, 'sales'));
    const streamsLimit = formatLimit(getLimit(config, 'streams'));

    const rawRadio = getLimit(config, 'radio');
    let radioLimit = "UNLIMITED";
    if (rawRadio && !rawRadio.toString().toLowerCase().includes('unlimited') && !rawRadio.toString().toLowerCase().includes('ilimitado') && !rawRadio.toString().toLowerCase().includes('no permitido')) {
      radioLimit = `up to ${rawRadio}`;
    } else if (rawRadio && rawRadio.toString().toLowerCase().includes('no permitido')) {
      radioLimit = "Not permitted";
    }

    let videoProjects = defaults.video;
    if (config.video || (config.usage && config.usage.video)) {
      videoProjects = formatLimit(config.video || config.usage.video);
      if (videoProjects !== "UNLIMITED") videoProjects = `up to ${videoProjects} projects`;
    }

    // 5. Advanced Logic (Publishing, Royalties, Credits)
    const producerPublishing = config.publishing ?? 50;
    const licenseePublishing = 100 - producerPublishing;
    const producerRoyalties = config.royalties ?? 0;
    const creditsValue = `Produced by ${producerName}`;
    const thankYou = config.thankYou || "";

    // 2. The Master Template text (Comprehensive Version)
    const template = `Non-Exclusive ${licenseName} Agreement

1. Agreement Overview and License Grant
a. This Non-Exclusive ${licenseName} Agreement ("Agreement") is entered into by and between the individual or entity purchasing this license (the "Licensee") and the producer of the instrumental music (the "Producer"). This Agreement sets forth the terms and conditions of the Licensee’s use of the instrumental music file covered by this license (referred to herein as "the Beat"), in consideration for the Licensee’s payment of ${price} for a ${licenseName}.
b. By purchasing this license, the Licensee acknowledges and agrees to the terms stated herein. This Agreement is issued solely in connection with the Licensee’s use of the Beat. The Licensee shall make full payment of the License Fee to the Producer at the time of purchase. All rights granted under this Agreement are strictly conditional upon timely payment.

2. Delivery of the Beat:
a. The Producer agrees to deliver the Beat as ${filesDelivered}, in accordance with industry standards.
b. The Producer shall use commercially reasonable efforts to deliver the Beat immediately after the License Fee has been paid via email.

3. Term:
This License shall remain valid for a period of ten (10) years from the date of purchase. Upon the tenth (10th) anniversary, this License shall automatically expire.

4. Use of the Beat:
In consideration of the License Fee, the Licensee is granted a limited, non-exclusive, non-transferable license to use the Beat for the creation of one (1) new song or instrumental work ("New Song").
a. Permitted Uses:
The License grants the Licensee a worldwide, non-exclusive license to use the Beat as incorporated in the New Song.
b. The Licensee is permitted to:
• Use the New Song for promotional purposes and non-monetized streaming.
• Perform the New Song publicly (Unlimited non-profit; For-profit concerts/festivals).
• Broadcasting rights for ${radioLimit} terrestrial or satellite stations.
• Synchronize the New Song with ${videoProjects} not exceeding five (5) minutes in length.
• Sell up to ${salesLimit} physical and/or digital units.
• The Licensee is allowed up to ${streamsLimit} monetized audio streams.

For clarity, this License does not permit the sale, distribution, or exploitation of the Beat in its original, unmodified form. Any unauthorized sale constitutes a material breach.

i. Royalties: Licensee shall not be required to account for or pay any royalties to the Producer derived from the exploitation of the New Song, with the exception of mechanical royalties and a ${producerRoyalties}% share of any net income derived from the New Song as specified in the ${producerPublishing}/${licenseePublishing} split.

Restrictions on the Use of the Beat:
I. Rights are NON-TRANSFERABLE.
II. No synchronization with audiovisual works except as expressly permitted above.
III. No right to license or sublicense "samples" of the Beat.
IV. No unlawful copying, streaming, or distribution of the Beat file itself.
V. CONTENT ID PROHIBITION: The Licensee is EXPRESSLY PROHIBITED from registering the Beat/New Song with any Content Identification System (e.g., TuneCore, CDBaby, YouTube Content ID). The Beat has already been tagged by Producer. Violation of this results in immediate revocation.
VI. The New Song is a "derivative work".

5. Ownership
The Producer remains the sole owner of the Beat.
a. Licensee does not own the master or sound recording rights in the New Song (only the lyrics/melody they added).
b. Publishing Splits:
- Licensee owns ${licenseePublishing}% of the Writer’s Share.
- Producer owns ${producerPublishing}% of the Writer’s Share.
• The Producer shall own and administer ${producerPublishing}% of the Publisher’s Share.
• Licensee must register these shares with their PRO (ASCAP/BMI/etc) identifying the Producer as a ${producerPublishing}% owner.
c. Acceptance: Licensee accepts these terms by paying the License Fee.
d. Submission of Final Song: Licensee agrees to deliver the final mixed version of the New Song to Producer for approval solely to ensure accurate crediting.

6. Mechanical License
Producer agrees to issue a mechanical license for any "Controlled Composition".
• US/Canada: 100% of minimum statutory rate.
• International: Industry-wide prevailing rate.

7. Credit
a. Licensee shall credit Producer as "${creditsValue}" on all releases.
b. Licensee shall check all proofs for accuracy.
c. Failure to credit: Licensee must use reasonable efforts to cure any mistakes immediately.

8. Licensor’s Option
a. Licensor may terminate this License within three (3) years by refunding 200% of the License Fee.
b. Upon exercise of this option, Licensee must immediately remove the New Song from all distribution channels and cease public access.

9. Breach by Licensee
a. Licensee has five (5) business days to cure any breach after notice.
b. Unauthorized use results in liability for monetary damages.
c. Producer may seek injunctive relief and legal costs.

10. Miscellaneous
a. Entire Agreement.
b. Severability.
c. Governing Law: Laws of Lima, Peru. Exclusive jurisdiction: Courts of Lima, Peru.
d. INDEPENDENT ATTORNEY: YOU ACKNOWLEDGE YOU HAVE BEEN ADVISED TO RETAIN AN INDEPENDENT ATTORNEY TO REVIEW THIS AGREEMENT.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date of purchase.`;

    // 3. PDF Generation with pdf-lib
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // --- PAGE 1: CERTIFICATE ---
    const page1 = pdfDoc.addPage([595, 842]);
    const { width, height } = page1.getSize();

    // Black Background
    page1.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0, 0, 0) });



    // --- ISSUANCE & VERIFICATION DATA ---
    const verificationHash = btoa(orderId + buyerEmail).substring(0, 16).toUpperCase();
    // Add internal metadata to the PDF document
    pdfDoc.setProducer('OFFSZN Platform');
    pdfDoc.setCreator('OFFSZN Legal Engine');
    pdfDoc.setSubject(`Verification Code: ${verificationHash}`);
    pdfDoc.setKeywords(['OFFSZN', orderId, verificationHash, 'Peru']);

    // Display verification data (top right area)
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

    page1.drawText(isDrumKit ? 'PURCHASE INVOICE' : 'LICENSE CERTIFICATE', {
      x: 50, y: height - 135, size: 16, font: font,
      color: rgb(0.8, 0.8, 0.8)
    });

    page1.drawLine({
      start: { x: 50, y: height - 150 },
      end: { x: width - 50, y: height - 150 },
      thickness: 1.5, color: rgb(0.45, 0.04, 0.72)
    });

    // Purchase Information Section
    let yPos = height - 200;
    page1.drawText('PURCHASE INFORMATION', {
      x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.5, 0.5, 0.5)
    });

    yPos -= 40;
    const info = [
      [isDrumKit ? (productType === 'loopkit' ? 'Loop Kit:' : productType === 'preset' ? 'Preset Name:' : 'Kit Name:') : 'Beat Name:', productName],
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

    // Licensee Information
    page1.drawText('LICENSEE (BUYER)', { x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    yPos -= 40;

    const buyerInfo = [
      ['Buyer Name:', buyerName],
      ['Buyer Email:', buyerEmail],
      ['Purchase Date:', new Date(purchaseDate).toLocaleDateString('en-US')],
      ['Order ID:', orderId]
    ];

    buyerInfo.forEach(([label, value]) => {
      page1.drawText(label, { x: 50, y: yPos, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
      page1.drawText(value.toString(), { x: 180, y: yPos, size: 10, font: boldFont, color: rgb(1, 1, 1) });
      yPos -= 25;
    });

    // --- FOOTER INFO (Legalweight) ---
    const footerY = 60;
    page1.drawText('OFFSZN DIGITAL SIGNATURE & VERIFICATION SYSTEM', {
      x: 50, y: footerY + 12, size: 7, font: boldFont, color: rgb(0.3, 0.3, 0.3)
    });
    page1.drawText('THIS LICENSE IS VALID GLOBALLY BUT GOVERNED BY THE LAWS OF LIMA, PERU.', {
      x: 50, y: footerY + 2, size: 7, font, color: rgb(0.3, 0.3, 0.3)
    });

    if (isDrumKit) {
      yPos -= 80;
      page1.drawText('IMPORTANT NOTICE:', { x: 50, y: yPos, size: 12, font: boldFont, color: rgb(0.45, 0.04, 0.72) });
      yPos -= 25;
      page1.drawText('This document serves as proof of purchase and grants the user the right', { x: 50, y: yPos, size: 10, font, color: rgb(0.8, 0.8, 0.8) });
      yPos -= 15;
      page1.drawText(`to use the ${productType === 'preset' ? 'presets' : 'sounds'} contained in this pack for music production.`, { x: 50, y: yPos, size: 10, font, color: rgb(0.8, 0.8, 0.8) });
      yPos -= 15;
      page1.drawText('Resale or redistribution of the raw files is strictly prohibited.', { x: 50, y: yPos, size: 10, font, color: rgb(0.8, 0.8, 0.8) });
    }

    // --- PAGE 2+: CONTRACT TEXT (Skip for Drum Kits) ---
    if (!isDrumKit) {
      let contractPage = pdfDoc.addPage([595, 842]);
      let currentY = 780;
      const margin = 50;
      const maxWidth = 500;
      const fontSize = 10;
      const lineHeight = 14;

      const lines = template.split('\n');

      for (const paragraph of lines) {
        if (paragraph.trim() === '') {
          currentY -= 10;
          continue;
        }

        // Simple Wrap Logic
        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const textWidth = font.widthOfTextAtSize(testLine, fontSize);

          if (textWidth < maxWidth) {
            currentLine = testLine;
          } else {
            // Check for page break
            if (currentY < 60) {
              contractPage = pdfDoc.addPage([595, 842]);
              currentY = 780;
            }
            contractPage.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font });
            currentY -= lineHeight;
            currentLine = word;
          }
        }

        // Draw residue
        if (currentLine) {
          if (currentY < 60) {
            contractPage = pdfDoc.addPage([595, 842]);
            currentY = 780;
          }
          contractPage.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font });
          currentY -= lineHeight;
        }

        currentY -= 5; // Paragraph spacing
      }
    }

    // Final Save and Download
    const pdfBytes = await pdfDoc.save();
    const safeName = productName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = isDrumKit ? `OFFSZN_Boleta_${productType.charAt(0).toUpperCase() + productType.slice(1)}_${safeName}.pdf` : `OFFSZN_License_${safeName}_${orderId.toString().substring(0, 8)}.pdf`;

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    // console.log('✅ Licencia generada y descargada');
    return true;

  } catch (error) {
    console.error('❌ Error en generarLicencia:', error);
    throw error;
  }
}

function getLicenseName(id) {
  const names = {
    'basic': 'Non-Exclusive Basic License',
    'premium': 'Non-Exclusive Premium License',
    'stems': 'Non-Exclusive Trackout License',
    'unlimited': 'Non-Exclusive Unlimited License',
    'exclusive': 'Exclusive Rights License'
  };
  return names[id.toLowerCase()] || id.toUpperCase();
}
