export const relevantInvoiceEvents = new Set([
  'invoice.created',
  'invoice.finalized',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'invoice.payment_action_required',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'invoice.updated',
  'invoice.paid',
]);
