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

# Check TEST_ENV variable and use appropriate tunneling solution
if [[ "$TEST_ENV" == "local" ]]; then
  echo "TEST_ENV is set to local. Using ngrok for tunneling..."
  
  # Start ngrok in the background
  ngrok http $PORT > /dev/null 2>&1 &
  
  # Store the ngrok process ID
  NGROK_PID=$!
  
  echo "Started ngrok with PID: $NGROK_PID"
  
  # Give ngrok a moment to start up and establish the tunnel
  echo "Waiting for ngrok tunnel to be established..."
  sleep 5
  
  # Get the public URL from ngrok API
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o "https://[a-zA-Z0-9.-]*\.ngrok-free\.app")
  
  if [ -z "$NGROK_URL" ]; then
    echo "Failed to get ngrok URL. Make sure ngrok is properly authenticated."
    echo "Run 'ngrok authtoken YOUR_TOKEN' if you haven't set up ngrok yet."
    kill $NGROK_PID
    exit 1
  fi
  
  echo "Ngrok tunnel established at: $NGROK_URL"
  
  # Set the webhook URL for tests
  export WEBHOOK_URL="${NGROK_URL}/demo-project/us-central1/ext-firestore-stripe-payments-p8n2-handleWebhookEvents"
  echo "Webhook URL set to: $WEBHOOK_URL"
else
  # Only run cloudflared if not in local test environment
  echo "Installing and starting cloudflared..."
  sudo cloudflared service install $CLOUDFLARE_SECRET

  # Introduce a delay to ensure cloudflared is properly initialized
  echo "Waiting for cloudflared to initialize..."
  sleep 60  # 1 minute delay
fi

# Step 2: Run tests
cd ../functions
jest --coverage

# Clean up ngrok if it was started
if [[ "$TEST_ENV" == "local" && -n "$NGROK_PID" ]]; then
  echo "Stopping ngrok with PID: $NGROK_PID"
  kill $NGROK_PID
fi