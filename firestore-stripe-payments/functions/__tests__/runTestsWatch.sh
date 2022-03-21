#!/bin/bash
if ! [ -x "$(command -v firebase)" ]; then
  echo "❌ Firebase tools CLI is missing."
  exit 1
fi

until curl --output /dev/null --silent --fail http://localhost:9099; do
  echo "Waiting for Firestore emulator to come online..."
  sleep 2
done

jest --watch
echo "Firestore emulator is online!" 