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

import { logger } from 'firebase-functions';
import Stripe from 'stripe';
import { InvoicePayload } from './interfaces';

export function startInvoiceCreate() {
  logger.log('🙂 Received new invoice, starting processing');
}

export function startInvoiceUpdate(eventType: string) {
  logger.log(`🙂 Received new invoice event ${eventType}, starting processing`);
}

export function incorrectPayload(payload: InvoicePayload) {
  if (!payload.items.length) {
    logger.error(
      new Error('😞[Error] Missing at least one line item in items[]')
    );
  }
  if (!payload.email && !payload.uid) {
    logger.error(
      new Error(
        '😞[Error] Missing either a customer email address or Firebase Authentication uid'
      )
    );
  }
  if (payload.email && payload.uid) {
    logger.error(
      new Error(
        '😞[Error] Only either email or uid is permitted, you specified both.'
      )
    );
  }
}

export function noEmailForUser(uid: string) {
  logger.error(
    new Error(`😞[Error] User [${uid}] is missing an email address.`)
  );
}

export function stripeError(err: Stripe.StripeCardError) {
  logger.error(
    new Error('😞[Error] Error when making a request to the Stripe API:'),
    err
  );
}

export function invoiceCreatedError(invoice?: Stripe.Invoice) {
  logger.error(
    new Error('😞[Error] Error when creating the invoice:'),
    invoice
  );
}

export function customerCreated(id: string, livemode: boolean) {
  logger.log(
    `👤 Created a new customer: https://dashboard.stripe.com${
      livemode ? '' : '/test'
    }/customers/${id}`
  );
}

export function customerRetrieved(id: string, livemode: boolean) {
  logger.log(
    `🙋 Found existing customer by email: https://dashboard.stripe.com${
      livemode ? '' : '/test'
    }/customers/${id}`
  );
}

export function invoiceCreated(id: string, livemode: boolean) {
  logger.log(
    `🧾 Created invoice: https://dashboard.stripe.com${
      livemode ? '' : '/test'
    }/invoices/${id}`
  );
}

export function invoiceSent(
  id: string,
  email: string,
  hostedInvoiceUrl: string
) {
  logger.log(`📧 Sent invoice ${id} to ${email}: ${hostedInvoiceUrl}`);
}

export function badSignature(err: Error) {
  logger.error(
    '😞[Error] Webhook signature verification failed. Is your Stripe webhook secret parameter configured correctly?',
    err
  );
}

export function malformedEvent(event: Stripe.Event) {
  let err;

  if (!event?.data?.object) {
    err = new Error('Could not find event.data.object');
  } else if (!event?.type) {
    err = new Error('Could not find event.type');
  }

  logger.error('😞[Error] Malformed event', err);
}

export function ignoreEvent(eventType: string) {
  logger.log(
    `🙈 Ignoring event "${eventType}" because it because it isn't a relevant part of the invoice lifecycle`
  );
}

export function unexpectedInvoiceAmount(
  numInvoices: number,
  invoiceId: string
) {
  logger.error(
    '😞[Error] could not find invoice',
    new Error(
      `Expected 1 invoice with ID "${invoiceId}", but found ${numInvoices}`
    )
  );
}

export function statusUpdateComplete(
  invoiceId: string,
  newStatus: string,
  eventType: string
) {
  logger.log(
    `🙂 Updated invoice "${invoiceId}" to status "${newStatus}" on event type "${eventType}"`
  );
}
