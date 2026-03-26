import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_PORT } from '../config/config.js';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    
    if (!EMAIL_USER || !EMAIL_PASS) {
        console.warn('[Mailer] Missing EMAIL_USER or EMAIL_PASS environment variables.');
        return null;
    }
    
    transporter = nodemailer.createTransport({
        host: SMTP_HOST || 'smtp.gmail.com',
        port: SMTP_PORT || 587,
        secure: SMTP_PORT == 465,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        },
        // Add timeouts to prevent hangs if SMTP server is slow
        connectionTimeout: 10000, // 10s
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
    return transporter;
}

/**
 * Sends an email using Nodemailer with the generic "no-reply" alias.
 */
export const sendOffsznEmail = async ({ to, subject, html, fromName = 'OFFSZN' }) => {
    try {
        const mailer = getTransporter();
        if (!mailer) throw new Error('Transporter not configured');

        // We attempt to send from the official no-reply address.
        // If the SMTP provider (like Gmail) is strict, it may rewrite the FROM address to the 
        // authenticated account, but we'll also include it as Reply-To to guide users.
        const mailOptions = {
            from: `"${fromName}" <${EMAIL_USER}>`,
            replyTo: 'no-reply@offszn.lat',
            to,
            subject,
            html
        };

        const info = await mailer.sendMail(mailOptions);
        console.log(`[Mailer] Success: Email sent to ${to} (${info.messageId}) from no-reply@offszn.lat`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('[Mailer] Failed to send email:', err);
        return { success: false, error: err.message };
    }
};
