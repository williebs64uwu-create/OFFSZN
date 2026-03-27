import nodemailer from 'nodemailer';
import { 
    BREVO_USER, BREVO_PASS, BREVO_HOST, BREVO_PORT, BREVO_API_KEY,
    GMAIL_USER, GMAIL_PASS, GMAIL_HOST, GMAIL_PORT
} from '../config/config.js';

/**
 * TRANSPORTERS SETUP (Nodemailer - Used for Gmail and Fallbacks)
 */

// 1. Brevo SMTP Transporter (Fallback)
const noReplyTransporter = nodemailer.createTransport({
    host: BREVO_HOST,
    port: Number(BREVO_PORT),
    secure: Number(BREVO_PORT) === 465,
    auth: {
        user: BREVO_USER,
        pass: BREVO_PASS
    }
});

// 2. Gmail Transporter (For offszn.studio@gmail.com - Personal/Interactive)
const personalTransporter = nodemailer.createTransport({
    host: GMAIL_HOST,
    port: Number(GMAIL_PORT),
    secure: Number(GMAIL_PORT) === 465,
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
    }
});

/**
 * Generic email sender with hybrid routing (API for transactional, SMTP for personal)
 * 
 * @param {Object} options 
 * @param {string} options.to - Recipient
 * @param {string} options.subject - Email Subject
 * @param {string} options.html - Email Content
 * @param {string} [options.fromName] - Custom Display Name
 * @param {string} [options.type] - 'transactional' (Brevo API) or 'personal' (Gmail SMTP)
 */
export const sendOffsznEmail = async ({ to, subject, html, fromName = 'OFFSZN', type = 'transactional' }) => {
    try {
        console.log(`[Mailer] Preparing to send ${type} email to ${to}...`);

        let transporter;
        let fromAddress;
        let finalFromName = fromName;

        // --- INTERACTIVE / PERSONAL EMAILS (GMAIL SMTP) ---
        if (type === 'personal') {
            transporter = personalTransporter;
            fromAddress = GMAIL_USER;
            if (!fromName || fromName === 'OFFSZN') finalFromName = 'OFFSZN Studio';

            const info = await transporter.sendMail({
                from: `"${finalFromName}" <${fromAddress}>`,
                to, subject, html
            });
            console.log(`[Mailer] Success (SMTP Personal): ${info.messageId}`);
            return info;
        } 

        // --- TRANSACTIONAL EMAILS (BREVO REST API) ---
        // Using API (Port 443) to avoid Render SMTP port blocking
        if (BREVO_API_KEY) {
            console.log(`[Mailer] Sending via Brevo REST API...`);
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': BREVO_API_KEY,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: fromName || "OFFSZN No-Reply", email: "no-reply@offszn.lat" },
                    to: [{ email: to }],
                    subject: subject,
                    htmlContent: html
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[Mailer] Success (Brevo API): ${data.messageId}`);
                return data;
            } else {
                const errorData = await response.text();
                throw new Error(`Brevo API Error: ${errorData}`);
            }
        } else {
            // Fallback to Brevo SMTP if API Key is missing
            console.warn(`[Mailer] BREVO_API_KEY missing, falling back to SMTP...`);
            const info = await noReplyTransporter.sendMail({
                from: `"${fromName || "OFFSZN No-Reply"}" <no-reply@offszn.lat>`,
                to, subject, html
            });
            console.log(`[Mailer] Success (Brevo SMTP Fallback): ${info.messageId}`);
            return info;
        }

    } catch (error) {
        console.error(`[Mailer] Error sending ${type} email:`, error.message);
        
        // --- EMERGENCY FALLBACK TO GMAIL SMTP ---
        if (type === 'transactional' && GMAIL_USER && GMAIL_PASS) {
            console.warn(`[Mailer] Attempting emergency fallback to Gmail SMTP...`);
            try {
                return await personalTransporter.sendMail({
                    from: `"OFFSZN Emergency" <${GMAIL_USER}>`,
                    to,
                    subject: `[RETRY] ${subject}`,
                    html
                });
            } catch (fallbackError) {
                console.error(`[Mailer] Emergency fallback failed:`, fallbackError.message);
            }
        }
        throw error;
    }
};
