#!/bin/bash
set -e
PUBKEY="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDqBxLVDrX3sBd4XJGRtYy9u5mlW6oAP03yVmT+S5vH7ohNejIXSKJitCm+vHjXUkgPHKtP5YcqxBLGbVZAHETX9eVL49uj9Bme73Keqzni0TVP5COpnIsv+E2w5keRev4Lax6fBLmzsiN7uOrKPliWHLwPT1ylnCQ04e0zt3nIHkr7iyG2mn+yKxII2NZOwehfN2i+07ZF1dWjY97y46/olFH4aoOMipy4eqs1mSZJv3LkTz6DDeE8PpjhO6AQONkLgKhJNcyPCq5DTzlJ8p6U5h8Smq34tu6+JWEqIRGLg61saYR4IsmdVMDv8w2yxD5rV5WVDDlLMuWJWLO2+TLL saturn@DESKTOP-5GTQHG1"
mkdir -p /home/mit-2/.ssh
echo "$PUBKEY" > /home/mit-2/.ssh/authorized_keys
chmod 700 /home/mit-2/.ssh
chmod 600 /home/mit-2/.ssh/authorized_keys
chown -R mit-2:mit-2 /home/mit-2/.ssh
echo "SSH key updated at $(date)" >> /var/log/user-data.log
