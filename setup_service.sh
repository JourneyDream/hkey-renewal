#!/bin/bash

# Configuration
SERVICE_NAME="cert-monitor"
PROJECT_DIR=$(pwd)
NODE_PATH=$(which node)
USER=$(whoami)

echo "--- Starting Service Setup for $SERVICE_NAME ---"

# 1. Install dependencies
echo "Installing npm dependencies..."
npm install

# 2. Create systemd service file
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

echo "Generating service file at $SERVICE_FILE..."

cat <<EOF > $SERVICE_NAME.service
[Unit]
Description=Certificate Monitor Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$NODE_PATH index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

# 3. Move service file to system directory
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo to install the service file."
  echo "Or copy the generated $(pwd)/$SERVICE_NAME.service to /etc/systemd/system/ manually."
  exit 1
fi

mv $SERVICE_NAME.service $SERVICE_FILE

# 4. Reload and start service
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling $SERVICE_NAME service..."
systemctl enable $SERVICE_NAME

echo "Starting $SERVICE_NAME service..."
systemctl start $SERVICE_NAME

echo "--- Setup Complete ---"
echo "Check status: systemctl status $SERVICE_NAME"
echo "Check logs: journalctl -u $SERVICE_NAME -f"
