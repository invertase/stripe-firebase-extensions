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
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusUpdateComplete = exports.unexpectedInvoiceAmount = exports.ignoreEvent = exports.malformedEvent = exports.badSignature = exports.invoiceSent = exports.invoiceCreated = exports.customerRetrieved = exports.customerCreated = exports.invoiceCreatedError = exports.stripeError = exports.noEmailForUser = exports.incorrectPayload = exports.startInvoiceUpdate = exports.startInvoiceCreate = void 0;
const firebase_functions_1 = require("firebase-functions");
function startInvoiceCreate() {
    firebase_functions_1.logger.log('🙂 Received new invoice, starting processing');
}
exports.startInvoiceCreate = startInvoiceCreate;
function startInvoiceUpdate(eventType) {
    firebase_functions_1.logger.log(`🙂 Received new invoice event ${eventType}, starting processing`);
}
exports.startInvoiceUpdate = startInvoiceUpdate;
function incorrectPayload(payload) {
    if (!payload.items.length) {
        firebase_functions_1.logger.error(new Error('😞[Error] Missing at least one line item in items[]'));
    }
    if (!payload.email && !payload.uid) {
        firebase_functions_1.logger.error(new Error('😞[Error] Missing either a customer email address or Firebase Authentication uid'));
    }
    if (payload.email && payload.uid) {
        firebase_functions_1.logger.error(new Error('😞[Error] Only either email or uid is permitted, you specified both.'));
    }
}
exports.incorrectPayload = incorrectPayload;
function noEmailForUser(uid) {
    firebase_functions_1.logger.error(new Error(`😞[Error] User [${uid}] is missing an email address.`));
}
exports.noEmailForUser = noEmailForUser;
function stripeError(err) {
    firebase_functions_1.logger.error(new Error('😞[Error] Error when making a request to the Stripe API:'), err);
}
exports.stripeError = stripeError;
function invoiceCreatedError(invoice) {
    firebase_functions_1.logger.error(new Error('😞[Error] Error when creating the invoice:'), invoice);
}
exports.invoiceCreatedError = invoiceCreatedError;
function customerCreated(id, livemode) {
    firebase_functions_1.logger.log(`👤 Created a new customer: https://dashboard.stripe.com${livemode ? '' : '/test'}/customers/${id}`);
}
exports.customerCreated = customerCreated;
function customerRetrieved(id, livemode) {
    firebase_functions_1.logger.log(`🙋 Found existing customer by email: https://dashboard.stripe.com${livemode ? '' : '/test'}/customers/${id}`);
}
exports.customerRetrieved = customerRetrieved;
function invoiceCreated(id, livemode) {
    firebase_functions_1.logger.log(`🧾 Created invoice: https://dashboard.stripe.com${livemode ? '' : '/test'}/invoices/${id}`);
}
exports.invoiceCreated = invoiceCreated;
function invoiceSent(id, email, hostedInvoiceUrl) {
    firebase_functions_1.logger.log(`📧 Sent invoice ${id} to ${email}: ${hostedInvoiceUrl}`);
}
exports.invoiceSent = invoiceSent;
function badSignature(err) {
    firebase_functions_1.logger.error('😞[Error] Webhook signature verification failed. Is your Stripe webhook secret parameter configured correctly?', err);
}
exports.badSignature = badSignature;
function malformedEvent(event) {
    var _a;
    let err;
    if (!((_a = event === null || event === void 0 ? void 0 : event.data) === null || _a === void 0 ? void 0 : _a.object)) {
        err = new Error('Could not find event.data.object');
    }
    else if (!(event === null || event === void 0 ? void 0 : event.type)) {
        err = new Error('Could not find event.type');
    }
    firebase_functions_1.logger.error('😞[Error] Malformed event', err);
}
exports.malformedEvent = malformedEvent;
function ignoreEvent(eventType) {
    firebase_functions_1.logger.log(`🙈 Ignoring event "${eventType}" because it because it isn't a relevant part of the invoice lifecycle`);
}
exports.ignoreEvent = ignoreEvent;
function unexpectedInvoiceAmount(numInvoices, invoiceId) {
    firebase_functions_1.logger.error('😞[Error] could not find invoice', new Error(`Expected 1 invoice with ID "${invoiceId}", but found ${numInvoices}`));
}
exports.unexpectedInvoiceAmount = unexpectedInvoiceAmount;
function statusUpdateComplete(invoiceId, newStatus, eventType) {
    firebase_functions_1.logger.log(`🙂 Updated invoice "${invoiceId}" to status "${newStatus}" on event type "${eventType}"`);
}
exports.statusUpdateComplete = statusUpdateComplete;
//# sourceMappingURL=logs.js.map