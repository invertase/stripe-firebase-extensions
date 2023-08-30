import * as admin from 'firebase-admin';
import { Query, DocumentData } from '@google-cloud/firestore';
import { UserRecord } from 'firebase-functions/v1/auth';
import { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';

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
  timeout: number = 300000 // 5 minutes
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
  query: admin.firestore.CollectionReference<admin.firestore.DocumentData>,
  field: string,
  value: any,
  timeout: number = 300000 // 5 minutes
): Promise<DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;

    let unsubscribe: () => void; // Declare unsubscribe here

    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Timeout waiting for firestore document to exist with field ${field} and value ${value} in collection`
        )
      );
      if (unsubscribe) {
        unsubscribe(); // Unsubscribe when timed out
      }
    }, timeout);

    unsubscribe = query.onSnapshot((snapshot) => {
      try {
        /** Find the first record that matches the field and value */
        const record: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> =
          snapshot.docs.find(($) => $.data()[field] === value);

        /** Check and return if exists */
        if (record && record.exists) {
          console.log('Found record >>>>>>', record.data());
          unsubscribe();
          if (!timedOut) {
            clearTimeout(timer);
            resolve(record);
          }
        }
      } catch (error) {
        if (unsubscribe) {
          unsubscribe(); // Unsubscribe on error
        }
        console.log('Error during onSnapshot:', error);
        reject(error);
      }
    });
  });
};

export const createFirebaseUser = async (): Promise<UserRecord> => {
  const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
  return admin.auth().createUser({ email });
};
