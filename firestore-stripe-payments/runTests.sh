#!/bin/bash

# Wait for Firebase emulator to be fully initialized
HOST="localhost"
PORT=5001
counter=0
max_attempts=30

echo "Waiting for Firebase emulator to be ready..."

while [[ $counter -lt $max_attempts ]]; do
  nc -z $HOST $PORT
  result=$?
  if [[ $result -eq 0 ]]; then
    echo "Firebase emulator on $HOST:$PORT is up!"
    break
  fi
  echo "Waiting for Firebase emulator on $HOST:$PORT... Attempt $((counter+1))/$max_attempts"
  sleep 1
  ((counter++))
done

if [[ $counter -eq $max_attempts ]]; then
  echo "Firebase emulator on $HOST:$PORT did not start within $max_attempts attempts."
  exit 1
fi

# Once Firebase emulator is confirmed running, install and start cloudflared
echo "Installing and starting cloudflared..."
sudo cloudflared service install $CLOUDFLARE_SECRET

# Introduce a delay to ensure cloudflared is properly initialized
echo "Waiting for cloudflared to initialize..."
sleep 60  # 1 minute delay. Adjust this value if needed.

# Step 2: Run tests
cd ../functions
jest --coverage