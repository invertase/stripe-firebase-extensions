"use strict";
/*
 * Copyright 2020 Stripe, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInvoice = exports.sendInvoice = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const stripe_1 = __importDefault(require("stripe"));
const logs = __importStar(require("./logs"));
const config_1 = __importDefault(require("./config"));
const stripe = new stripe_1.default(config_1.default.stripeSecretKey, {
    apiVersion: '2020-03-02',
    // Register extension as a Stripe plugin
    // https://stripe.com/docs/building-plugins#setappinfo
    appInfo: {
        name: 'Firebase firestore-stripe-invoices',
        version: '0.1.6',
    },
});
admin.initializeApp();
/* Creates a new invoice using Stripe */
const createInvoice = async function ({ customer, orderItems, daysUntilDue, idempotencyKey, default_tax_rates = [], transfer_data, }) {
    try {
        // Create an invoice item for each item in the document
        const itemPromises = orderItems.map((item, index) => {
            var _a, _b;
            return stripe.invoiceItems.create({
                customer: customer.id,
                unit_amount: item.amount,
                currency: item.currency,
                quantity: (_a = item.quantity) !== null && _a !== void 0 ? _a : 1,
                description: item.description,
                tax_rates: (_b = item.tax_rates) !== null && _b !== void 0 ? _b : [],
            }, { idempotencyKey: `invoiceItems-create-${idempotencyKey}-${index}` });
        });
        // Create the individual invoice items for this customer from the items in payload
        const items = await Promise.all(itemPromises);
        const invoiceCreateParams = {
            customer: customer.id,
            collection_method: 'send_invoice',
            days_until_due: daysUntilDue,
            auto_advance: true,
            default_tax_rates,
        };
        if (transfer_data)
            invoiceCreateParams.transfer_data = transfer_data;
        const invoice = await stripe.invoices.create(invoiceCreateParams, { idempotencyKey: `invoices-create-${idempotencyKey}` });
        logs.invoiceCreated(invoice.id, invoice.livemode);
        return invoice;
    }
    catch (e) {
        logs.stripeError(e);
        return null;
    }
};
/* Emails an invoice to a customer when a new document is created */
exports.sendInvoice = functions.handler.firestore.document.onCreate(async (snap, context) => {
    try {
        const payload = snap.data();
        const daysUntilDue = payload.daysUntilDue || config_1.default.daysUntilDue;
        if ((payload.email && payload.uid) ||
            !(payload.email || payload.uid) ||
            !payload.items.length) {
            logs.incorrectPayload(payload);
            return;
        }
        // Background functions fire "at least once"
        // https://firebase.google.com/docs/functions/locations#background_functions
        //
        // This event ID will be the same for the same Cloud Firestore write
        // Use this as an idempotency key when calling the Stripe API
        const eventId = context.eventId;
        logs.startInvoiceCreate();
        let email;
        if (payload.uid) {
            // Look up the Firebase Authentication UserRecord to get the email
            const user = await admin.auth().getUser(payload.uid);
            email = user.email;
        }
        else {
            // Use the email provided in the payload
            email = payload.email;
        }
        if (!email) {
            logs.noEmailForUser(payload.uid);
            return;
        }
        // Check to see if there's a Stripe customer associated with the email address
        let customers = await stripe.customers.list({ email });
        let customer;
        if (customers.data.length) {
            // Use the existing customer
            customer = customers.data.find((cus) => cus.currency === payload.items[0].currency);
            if (customer)
                logs.customerRetrieved(customer.id, customer.livemode);
        }
        if (!customer) {
            // Create new Stripe customer with this email
            customer = await stripe.customers.create({
                email,
                metadata: {
                    createdBy: 'Created by the Firebase Extension: Send Invoices using Stripe',
                },
            }, { idempotencyKey: `customers-create-${eventId}` });
            logs.customerCreated(customer.id, customer.livemode);
        }
        const invoice = await createInvoice({
            customer,
            orderItems: payload.items,
            daysUntilDue,
            idempotencyKey: eventId,
            default_tax_rates: payload.default_tax_rates,
            transfer_data: payload.transfer_data,
        });
        if (invoice) {
            // Email the invoice to the customer
            const finalizedInvoice = await stripe.invoices.sendInvoice(invoice.id, { idempotencyKey: `invoices-sendInvoice-${eventId}` });
            if (finalizedInvoice.status === 'open') {
                // Successfully emailed the invoice
                logs.invoiceSent(finalizedInvoice.id, email, finalizedInvoice.hosted_invoice_url);
            }
            else {
                logs.invoiceCreatedError(finalizedInvoice);
            }
            // Write the Stripe Invoice ID back to the document in Cloud Firestore
            // so that we can find it in the webhook.
            await snap.ref.update({
                stripeInvoiceId: finalizedInvoice.id,
                stripeInvoiceUrl: finalizedInvoice.hosted_invoice_url,
                stripeInvoiceRecord: `https://dashboard.stripe.com${invoice.livemode ? '' : '/test'}/invoices/${finalizedInvoice.id}`,
            });
        }
        else {
            logs.invoiceCreatedError();
        }
    }
    catch (e) {
        logs.stripeError(e);
    }
    return;
});
const relevantInvoiceEvents = new Set([
    'invoice.created',
    'invoice.finalized',
    'invoice.payment_failed',
    'invoice.payment_succeeded',
    'invoice.payment_action_required',
    'invoice.voided',
    'invoice.marked_uncollectible',
]);
/* A Stripe webhook that updates each invoice's status in Cloud Firestore */
exports.updateInvoice = functions.handler.https.onRequest(async (req, resp) => {
    let event;
    // Instead of getting the `Stripe.Event`
    // object directly from `req.body`,
    // use the Stripe webhooks API to make sure
    // this webhook call came from a trusted source
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], config_1.default.stripeWebhookSecret);
    }
    catch (err) {
        logs.badSignature(err);
        resp.status(401).send('Webhook Error: Invalid Secret');
        return;
    }
    let invoice;
    let eventType;
    try {
        invoice = event.data.object;
        eventType = event.type;
    }
    catch (err) {
        logs.malformedEvent(event);
        resp.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    if (!relevantInvoiceEvents.has(eventType)) {
        logs.ignoreEvent(eventType);
        // Return a response to Stripe to acknowledge receipt of the event
        resp.json({ received: true });
        return;
    }
    logs.startInvoiceUpdate(eventType);
    let invoicesInFirestore = await admin
        .firestore()
        .collection(config_1.default.invoicesCollectionPath)
        .where('stripeInvoiceId', '==', invoice.id)
        .get();
    if (invoicesInFirestore.size !== 1) {
        logs.unexpectedInvoiceAmount(invoicesInFirestore.size, invoice.id);
        resp.status(500).send(`Invoice not found.`);
        return;
    }
    // Keep a special status for `payment_failed`
    // because otherwise the invoice would still be marked `open`
    const invoiceStatus = eventType === 'invoice.payment_failed'
        ? 'payment_failed'
        : invoice.status;
    const doc = invoicesInFirestore.docs[0];
    await doc.ref.update({
        stripeInvoiceStatus: invoiceStatus,
        lastStripeEvent: eventType,
    });
    logs.statusUpdateComplete(invoice.id, invoiceStatus, eventType);
    // Return a response to Stripe to acknowledge receipt of the event
    resp.json({ received: true });
});
//# sourceMappingURL=index.js.map