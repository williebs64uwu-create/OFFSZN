import nodemailer from 'nodemailer';
import { 
    BREVO_USER, BREVO_PASS, BREVO_HOST, BREVO_PORT,
    GMAIL_USER, GMAIL_PASS, GMAIL_HOST, GMAIL_PORT
} from '../config/config.js';

/**
 * TRANSPORTERS SETUP
 */

// 1. Brevo Transporter (For no-reply@offszn.lat - Transactional)
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
 * Generic email sender with hybrid routing
 * 
 * @param {Object} options 
 * @param {string} options.to - Recipient
 * @param {string} options.subject - Email Subject
 * @param {string} options.html - Email Content
 * @param {string} [options.fromName] - Custom Display Name
 * @param {string} [options.type] - 'transactional' (Brevo) or 'personal' (Gmail)
 */
export const sendOffsznEmail = async ({ to, subject, html, fromName = 'OFFSZN', type = 'transactional' }) => {
    try {
        console.log(`[Mailer] Preparing to send ${type} email to ${to}...`);

        let transporter;
        let fromAddress;
        let finalFromName = fromName;

        if (type === 'personal') {
            // Route through Gmail (offszn.studio@gmail.com)
            transporter = personalTransporter;
            fromAddress = GMAIL_USER;
            if (!fromName || fromName === 'OFFSZN') finalFromName = 'OFFSZN Studio';
        } else {
            // Default: Route through Brevo (no-reply@offszn.lat)
            transporter = noReplyTransporter;
            fromAddress = 'no-reply@offszn.lat';
            if (!fromName || fromName === 'OFFSZN') finalFromName = 'OFFSZN No-Reply';
        }

        const mailOptions = {
            from: `"${finalFromName}" <${fromAddress}>`,
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Success (${type}): ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[Mailer] Error sending ${type} email:`, error.message);
        // Fallback attempt: if Brevo fails, try Gmail as emergency backup
        if (type === 'transactional' && GMAIL_USER && GMAIL_PASS) {
            console.warn(`[Mailer] Attempting emergency fallback to Gmail...`);
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
