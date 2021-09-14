import { StripePayments } from "./init";

export function checkStripePayments(
  payments: StripePayments,
  message?: string
): void {
  if (!(payments instanceof StripePayments)) {
    throw new Error(
      message ?? "payments must be an instance of StripePayments."
    );
  }
}

export function checkNonEmptyString(arg: string, message?: string): void {
  if (typeof arg !== "string" || arg === "") {
    throw new Error(message ?? "arg must be a non-empty string.");
  }
}
