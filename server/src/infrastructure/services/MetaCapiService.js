import crypto from 'crypto';
import {
    META_PIXEL_ID,
    META_CAPI_ACCESS_TOKEN,
    META_GRAPH_API_VERSION,
    META_TEST_EVENT_CODE
} from '../../shared/config/config.js';

// In-memory set for event idempotency (prevents duplicate sends within 1 hour)
const processedEvents = new Map();

// Clean up old entries every 30 minutes
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [eventId, timestamp] of processedEvents.entries()) {
        if (now - timestamp > 60 * 60 * 1000) {
            processedEvents.delete(eventId);
        }
    }
}, 30 * 60 * 1000);
if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
}

/**
 * Normalizes and hashes strings with SHA-256 according to Meta specification.
 */
function hashField(value) {
    if (!value || typeof value !== 'string') return undefined;
    const clean = value.trim().toLowerCase();
    if (!clean) return undefined;
    return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Normalizes phone numbers (digits only) and hashes with SHA-256.
 */
function hashPhone(phone) {
    if (!phone || typeof phone !== 'string') return undefined;
    const digitsOnly = phone.replace(/[^\d]/g, '');
    if (!digitsOnly) return undefined;
    return crypto.createHash('sha256').update(digitsOnly).digest('hex');
}

/**
 * Meta Conversions API (CAPI) Service
 */
class MetaCapiService {
    /**
     * Sends a server-side event to Meta Graph API
     * 
     * @param {Object} params
     * @param {string} params.eventName - e.g. 'Purchase', 'InitiateCheckout', 'ViewContent'
     * @param {string} params.eventId - Unique ID for deduplication with browser Pixel
     * @param {string} [params.eventSourceUrl] - URL where event occurred
     * @param {Object} [params.userData] - User identification data (email, ip, userAgent, fbp, fbc, etc.)
     * @param {Object} [params.customData] - E-commerce data (currency, value, contents, content_ids, order_id, etc.)
     * @param {string} [params.actionSource] - 'website' (default), 'app', 'system_generated'
     * @returns {Promise<Object>}
     */
    static async sendEvent({
        eventName,
        eventId,
        eventSourceUrl = 'https://offszn.lat',
        userData = {},
        customData = {},
        actionSource = 'website'
    }) {
        try {
            const pixelId = (META_PIXEL_ID || '').trim();
            const accessToken = (META_CAPI_ACCESS_TOKEN || '').trim();
            const graphVersion = (META_GRAPH_API_VERSION || 'v21.0').trim();

            if (!pixelId || !accessToken) {
                // Meta CAPI is not configured, silently skip or log debug
                return { skipped: true, reason: 'META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not configured' };
            }

            // Idempotency check for Purchase / critical events
            if (eventId) {
                if (processedEvents.has(eventId)) {
                    console.log(`[MetaCapi] Idempotency: Event ${eventId} already processed, skipping duplicate.`);
                    return { skipped: true, reason: 'duplicate_event_id', eventId };
                }
                processedEvents.set(eventId, Date.now());
            }

            // Prepare normalized User Data
            const normalizedUserData = {};

            // 1. Email (Hashed)
            if (userData.email) {
                normalizedUserData.em = [hashField(userData.email)];
            } else if (userData.em) {
                normalizedUserData.em = Array.isArray(userData.em) ? userData.em : [userData.em];
            }

            // 2. Phone (Hashed)
            if (userData.phone) {
                normalizedUserData.ph = [hashPhone(userData.phone)];
            } else if (userData.ph) {
                normalizedUserData.ph = Array.isArray(userData.ph) ? userData.ph : [userData.ph];
            }

            // 3. First / Last Name (Hashed)
            if (userData.firstName) normalizedUserData.fn = [hashField(userData.firstName)];
            if (userData.lastName) normalizedUserData.ln = [hashField(userData.lastName)];

            // 4. External ID (Hashed)
            if (userData.externalId) {
                normalizedUserData.external_id = [hashField(String(userData.externalId))];
            }

            // 5. Unhashed Client Info (IP, User-Agent, _fbp, _fbc)
            if (userData.clientIp) normalizedUserData.client_ip_address = userData.clientIp;
            if (userData.clientUserAgent) normalizedUserData.client_user_agent = userData.clientUserAgent;
            if (userData.fbp) normalizedUserData.fbp = userData.fbp;
            if (userData.fbc) normalizedUserData.fbc = userData.fbc;

            // Construct single event payload
            const eventPayload = {
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                event_source_url: eventSourceUrl,
                action_source: actionSource,
                user_data: normalizedUserData,
                custom_data: customData
            };

            const requestBody = {
                data: [eventPayload]
            };

            // Include Test Event Code if provided in environment
            if (META_TEST_EVENT_CODE) {
                requestBody.test_event_code = META_TEST_EVENT_CODE;
            }

            const url = `https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${accessToken}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error(`[MetaCapi] Error sending ${eventName}:`, result.error?.message || result);
                return { success: false, error: result.error };
            }

            console.log(`[MetaCapi] ✅ Event '${eventName}' sent successfully (ID: ${eventId || 'auto'}) | Events Received: ${result.events_received || 1}`);
            return { success: true, result };

        } catch (err) {
            console.error(`[MetaCapi] Network / Exception sending event:`, err.message);
            return { success: false, error: err.message };
        }
    }
}

export default MetaCapiService;
