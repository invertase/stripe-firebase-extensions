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

export interface InvoicePayload {
  email?: string;
  uid?: string;
  items: [OrderItem];
  daysUntilDue?: number;
  default_tax_rates?: string[];
  transfer_data?: {
    destination: string;
    amount?: number;
  };
}

export interface OrderItem {
  amount: number;
  currency: string;
  quantity?: number;
  description: string;
  tax_rates?: string[];
}
