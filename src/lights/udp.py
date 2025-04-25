#!/usr/bin/env python3

import socket
import struct
import json
import time

# Multicast address and ports
MULTICAST_ADDR = "239.255.255.250"
SCAN_PORT = 4001
RESPONSE_PORT = 4002
INTERFACE = "en0"

# Scan message
SCAN_MESSAGE = json.dumps({"msg": {"cmd": "scan", "data": {"account_topic": "reserve"}}}).encode('utf-8')

# Create a single UDP socket for both sending and receiving
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)

# Set socket options
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

# Bind to the response port so the device knows where to send the response
try:
    sock.bind(('', RESPONSE_PORT))
except OSError as e:
    print(f"Error binding socket to port {RESPONSE_PORT}: {e}")
    sock.close()
    exit(1)

# Set the time-to-live for multicast packets
sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 32)

# Specify the interface for multicast (en0)
try:
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(socket.gethostbyname(socket.gethostname())))
except OSError as e:
    print(f"Error setting multicast interface: {e}")
    sock.close()
    exit(1)

# Join the multicast group
group = socket.inet_aton(MULTICAST_ADDR)
mreq = group + socket.inet_aton(socket.gethostbyname(socket.gethostname()))
try:
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
except OSError as e:
    print(f"Error joining multicast group: {e}")
    sock.close()
    exit(1)

# Send the scan request
print(f"Sending scan request to {MULTICAST_ADDR}:{SCAN_PORT} on interface {INTERFACE}")
try:
    sock.sendto(SCAN_MESSAGE, (MULTICAST_ADDR, SCAN_PORT))
except OSError as e:
    print(f"Error sending scan request: {e}")
    sock.close()
    exit(1)

# Set a timeout for receiving
sock.settimeout(5)

# Listen for responses
print(f"Listening for responses on port {RESPONSE_PORT} for 5 seconds...")
devices = []
start_time = time.time()
while time.time() - start_time < 5:
    try:
        data, addr = sock.recvfrom(1024)
        response = json.loads(data.decode('utf-8'))
        if response.get("msg", {}).get("cmd") == "scan":
            device_data = response["msg"]["data"]
            print(f"Device: {device_data['sku']} - IP: {device_data['ip']}")
            devices.append(device_data)
    except socket.timeout:
        break
    except json.JSONDecodeError:
        continue
    except OSError as e:
        print(f"Error receiving response: {e}")
        break

# Close the socket
sock.close()

if not devices:
    print("No devices found.")
