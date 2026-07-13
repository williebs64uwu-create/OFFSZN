import 'dotenv/config';
import { handlePayPalWebhook } from '../src/infrastructure/http/controllers/PayPalController.js';

// Mock Express response object
const mockRes = {
    statusCode: 200,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(data) {
        console.log(`[Response Status]: ${this.statusCode}`);
        console.log('[Response Body]:', JSON.stringify(data, null, 2));
        return this;
    }
};

// Mock Express request object with the PAYMENT.SALE.COMPLETED event payload
const mockReq = {
    body: {
        id: "WH-MOCK-EVENT-12345",
        event_type: "PAYMENT.SALE.COMPLETED",
        resource: {
            id: "7JF12778BE116424H",
            state: "completed"
        }
    }
};

console.log('🚀 Triggering handlePayPalWebhook with live Transaction ID 7JF12778BE116424H...');
handlePayPalWebhook(mockReq, mockRes)
    .then(() => {
        console.log('\n⌛ Execution complete. Waiting a few seconds for async DB operations...');
        setTimeout(() => {
            console.log('Done.');
            process.exit(0);
        }, 5000);
    })
    .catch(err => {
        console.error('❌ Hook call failed:', err);
        process.exit(1);
    });
