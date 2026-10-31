// Cobro por Yape: el servidor fija el monto; precios o productos inventados por el navegador se rechazan. Sin red.
//   node --test --experimental-test-module-mocks tests/yape-charge.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const chain = () => {
    const q = { select: () => q, insert: () => q, update: () => q, eq: () => q, in: () => q, maybeSingle: async () => ({ data: null }), single: async () => ({ data: { id: 1 }, error: null }), then: (res) => Promise.resolve({ data: [], error: null }).then(res) };
    return q;
};
mock.module('../src/infrastructure/database/connection.js', { namedExports: { supabase: { from: () => chain() } } });
mock.module('../src/shared/utils/mailer.js', { namedExports: { sendOffsznEmail: async () => {} } });
mock.module('../src/infrastructure/services/MetaCapiService.js', { defaultExport: { sendEvent: async () => {} } });
mock.module('../src/infrastructure/http/controllers/PluginLicensingController.js', { namedExports: { generatePluginLicense: async ({ pluginName }) => ({ serialKey: `${pluginName}-KEY` }) } });
mock.module('../src/infrastructure/services/starSubscriptionService.js', { namedExports: { getStarCouponPercent: async (code) => (String(code).toUpperCase() === 'STAR' ? 10 : 0) } });

const ledger = [];
mock.module('../src/infrastructure/services/financeService.js', { namedExports: { recordMercadoPago: async (payment, ctx) => { ledger.push({ payment, ctx }); return { ok: true }; } } });

const { chargeYape, quoteYape } = await import('../src/infrastructure/http/controllers/YapeController.js');
const { resolveYapePrice, penFor, rateFromEnv } = await import('../src/shared/store/yapePricing.js');

process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-test';
process.env.YAPE_EXCHANGE_RATE_PEN = '3.8'; // la variable de Vercel: soles = dólares × variable (redondeado al sol)
let mpBodies = [];
globalThis.fetch = async (url, opts) => {
    mpBodies.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ id: 777, status: 'approved', status_detail: 'accredited' }) };
};

const run = async (body) => {
    mpBodies = [];
    let status = 200, payload;
    const res = { status(c) { status = c; return this; }, json(p) { payload = p; return this; } };
    await chargeYape({ body: { token: 'tok', email: 'cliente@correo.com', phoneNumber: '999888777', ...body }, headers: {}, ip: '1.1.1.1' }, res);
    return { status, payload, charged: mpBodies[0]?.transaction_amount };
};

test('precios válidos: soles = dólares × variable de Vercel (Cassette tiene S/ 25 fijos)', async () => {
    assert.equal((await run({ productId: 899, customPrice: 17 })).charged, 65);
    assert.equal((await run({ productId: 899, customPrice: 25 })).charged, 95);
    assert.equal((await run({ productId: 5001, customPrice: 9 })).charged, 34);
    assert.equal((await run({ productId: 902, customPrice: 5 })).charged, 19);
    assert.equal((await run({ productId: 5002, customPrice: 8 })).charged, 25);
    assert.equal((await run({ productId: 903, customPrice: 15 })).charged, 57);
});

test('precio en soles inventado por el navegador: se ignora y se cobra dólares × variable', async () => {
    const r = await run({ productId: 899, customPrice: 17, customPricePEN: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.charged, 65);
});

test('precio en dólares inventado o fuera de lo que ese plugin puede costar: se rechaza y no se cobra nada', async () => {
    for (const body of [
        { productId: 899, customPrice: 0.5, customPricePEN: 1 },
        { productId: 899, customPrice: 0 },
        { productId: 899, customPrice: 'gratis' },
        { productId: 899 },                       // sin precio
        { productId: 5002, customPrice: 5 },      // Cassette solo cuesta 8
        { productId: 903, customPrice: 5 },       // Coca-Cola solo 10 o 15
        { productId: 900, customPrice: 10 },      // Easy Master: 5, 17 o 25
        { productId: 902, customPrice: 25 }
    ]) {
        const r = await run(body);
        assert.equal(r.status, 400, JSON.stringify(body));
        assert.equal(r.charged, undefined, `no debe llegar a Mercado Pago: ${JSON.stringify(body)}`);
    }
});

test('productos desconocidos (antes recibían la licencia de Easy Mix) se rechazan', async () => {
    for (const productId of [123, 99999, 'cualquier-cosa']) {
        const r = await run({ productId, customPrice: 10 });
        assert.equal(r.status, 400);
        assert.equal(r.charged, undefined);
    }
});

test('promo 2x1: solo 17 o 25 y solo desde sus productos', async () => {
    assert.equal((await run({ productId: 899, customPrice: 17, isPromo2x1: true })).charged, 65);
    assert.equal((await run({ productId: 'promo-2x1', customPrice: 25 })).charged, 95);
    assert.equal((await run({ productId: 899, customPrice: 5, isPromo2x1: true })).status, 400);
    assert.equal((await run({ productId: 905, customPrice: 17, isPromo2x1: true })).status, 400); // no se activa la promo en otro producto
});

test('STAR CHAIN sigue con precio del servidor (49 US$ → S/ 185; cupón -10%)', async () => {
    assert.equal((await run({ productId: 5003, customPrice: 1, customPricePEN: 1 })).charged, 185);
    assert.equal((await run({ productId: 5003, customPrice: 1, couponCode: 'star' })).charged, 166.5);
});

test('precio dinámico: al cambiar la variable de Vercel cambia lo que se cobra, sin tocar páginas', async () => {
    process.env.YAPE_EXCHANGE_RATE_PEN = '4';
    assert.equal((await run({ productId: 899, customPrice: 17 })).charged, 68);
    assert.equal((await run({ productId: 5002, customPrice: 8 })).charged, 25); // fijo: no sigue la variable
    delete process.env.YAPE_EXCHANGE_RATE_PEN;                                   // sin variable: 3.30
    assert.equal(rateFromEnv(), 3.3);
    assert.equal((await run({ productId: 899, customPrice: 17 })).charged, 56);
    process.env.YAPE_EXCHANGE_RATE_PEN = '3.8';
    assert.equal(penFor(10, 3.8), 38);
    assert.equal(resolveYapePrice({ productId: 899, customPrice: 20, rate: 3.8 }).pen, 76);
});

test('cotización: el modal recibe del servidor los mismos soles que luego se cobran', async () => {
    const quote = async (query) => {
        let status = 200, payload;
        await quoteYape({ query }, { status(c) { status = c; return this; }, json(p) { payload = p; return this; } });
        return { status, payload };
    };
    const a = await quote({ productId: '899', price: '17' });
    assert.deepEqual([a.status, a.payload.usd, a.payload.pen], [200, 17, 65]);
    assert.equal((await run({ productId: 899, customPrice: 17 })).charged, a.payload.pen);
    assert.equal((await quote({ productId: '5002', price: '8' })).payload.pen, 25);
    assert.equal((await quote({ productId: '899', price: '1' })).status, 400);
    assert.equal((await quote({ productId: '5003', price: '1', coupon: 'star' })).payload.pen, 166.5);
});

test('libro de finanzas: cada cobro de Yape aprobado se anota con su producto y correo; los rechazados no', async () => {
    ledger.length = 0;
    await run({ productId: 899, customPrice: 17 });
    assert.equal(ledger.length, 1);
    assert.deepEqual([ledger[0].ctx.product, ledger[0].ctx.productId, ledger[0].ctx.email, String(ledger[0].payment.id)], ['Easy Mix', 899, 'cliente@correo.com', '777']);
    await run({ productId: 899, customPrice: 1 });   // precio inventado: se rechaza antes de cobrar
    assert.equal(ledger.length, 1);
});
