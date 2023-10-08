import * as admin from 'firebase-admin';
import { Query, DocumentData } from '@google-cloud/firestore';
import { UserRecord } from 'firebase-functions/v1/auth';

export async function repeat(
  fn: { (): Promise<any>; (): any },
  until: { ($: any): any; (arg0: any): any },
  retriesLeft = 5,
  interval = 1000
) {
  const result = await fn();

  if (!until(result)) {
    if (retriesLeft) {
      await new Promise((r) => setTimeout(r, interval));
      return repeat(fn, until, retriesLeft - 1, interval);
    }
    throw new Error('Max repeats count reached');
  }

  return result;
}

export const waitForDocumentToExistWithField = (
  document: DocumentData,
  field: string | number,
  timeout: number = 10_000
): Promise<DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Timeout waiting for firestore document to exist with field ${field}`
        )
      );
    }, timeout);
    const unsubscribe = document.onSnapshot(async (snapshot: DocumentData) => {
      if (snapshot.exists && snapshot.data()[field]) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(snapshot);
        }
      }
    });
  });
};

export const waitForDocumentUpdate = (
  document: DocumentData,
  field: string | number,
  value: any,
  timeout: number = 10_000
): Promise<FirebaseFirestore.DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Timeout waiting for firestore document to update with ${field}`
        )
      );
    }, timeout);
    const unsubscribe = document.onSnapshot(async (snapshot: DocumentData) => {
      if (snapshot.exists && snapshot.data()[field] === value) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(snapshot);
        }
      }
    });
  });
};

export const waitForDocumentToExistInCollection = (
  query: Query,
  field: string | number,
  value: any,
  timeout: number = 20_000
): Promise<DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Timeout waiting for firestore document to exist with field ${field} in collection`
        )
      );
    }, timeout);

    const unsubscribe = query.onSnapshot(async (snapshot) => {
      const docs = snapshot.docChanges();

      const record: DocumentData = docs.filter(
        ($) => $.doc.data()[field] === value
      )[0];

      if (record) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(record);
        }
      }
    });
  });
};

export const createFirebaseUser = async (): Promise<UserRecord> => {
  const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
  return admin.auth().createUser({ email });
};
