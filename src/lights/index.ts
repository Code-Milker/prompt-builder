// src/cli.do.lights.ts - Local Govee lights control flow

import type { Flow } from '../types';
import {
  colors,
  promptUser,
  promptForNumber,
  selectOption,
} from '../utils';
import Bun from 'bun';
import dgram from 'node:dgram';

// Predefined colors (25 options)
const predefinedColors = [
  { name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
  { name: 'Green', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
  { name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
  { name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
  { name: 'White', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'Black', rgb: { r: 0, g: 0, b: 0 } },
  { name: 'Orange', rgb: { r: 255, g: 165, b: 0 } },
  { name: 'Purple', rgb: { r: 128, g: 0, b: 128 } },
  { name: 'Pink', rgb: { r: 255, g: 192, b: 203 } },
  { name: 'Lime', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Teal', rgb: { r: 0, g: 128, b: 128 } },
  { name: 'Navy', rgb: { r: 0, g: 0, b: 128 } },
  { name: 'Olive', rgb: { r: 128, g: 128, b: 0 } },
  { name: 'Maroon', rgb: { r: 128, g: 0, b: 0 } },
  { name: 'Gray', rgb: { r: 128, g: 128, b: 128 } },
  { name: 'Silver', rgb: { r: 192, g: 192, b: 192 } },
  { name: 'Gold', rgb: { r: 255, g: 215, b: 0 } },
  { name: 'Coral', rgb: { r: 255, g: 127, b: 80 } },
  { name: 'Salmon', rgb: { r: 250, g: 128, b: 114 } },
  { name: 'Khaki', rgb: { r: 240, g: 230, b: 140 } },
  { name: 'Lavender', rgb: { r: 230, g: 230, b: 250 } },
  { name: 'Plum', rgb: { r: 221, g: 160, b: 221 } },
  { name: 'Orchid', rgb: { r: 218, g: 112, b: 214 } },
];

// Device interface
interface LocalDevice {
  ip: string;
  device: string;
  sku: string;
}

// Scan for devices using the Python script
async function scanLocalDevices(
  timeout: number = 5000,
): Promise<LocalDevice[]> {
  try {
    // Spawn the Python script and capture its output
    const proc = Bun.spawn(['./cli.use.udp.py'], { stdout: 'pipe' });

    // Read the script's output
    const output = await new Response(proc.stdout).text();

    // Wait for the script to exit
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`Python script exited with code ${exitCode}`);
      return [];
    }

    // Parse the output (e.g., "Device: Hxxxx - IP: 192.168.1.23")
    const devices: LocalDevice[] = [];
    output.split('\n').forEach((line) => {
      const match = line.match(/Device: (\S+) - IP: (\S+)/);
      if (match) {
        devices.push({
          ip: match[2], // IP address
          device: 'unknown', // Placeholder; not provided by script
          sku: match[1], // Device SKU
        });
      }
    });

    return devices;
  } catch (err) {
    console.error('Error running Python script:', err);
    return [];
  }
}

// Send UDP command
function sendUDPCommand(ip: string, command: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const message = JSON.stringify(command);
    socket.send(message, 0, message.length, 4003, ip, (err) => {
      if (err) reject(err);
      else resolve();
      socket.close();
    });
  });
}

// Control functions
async function turnDeviceOn(ip: string) {
  await sendUDPCommand(ip, { msg: { cmd: 'turn', data: { value: 1 } } });
}

async function turnDeviceOff(ip: string) {
  await sendUDPCommand(ip, { msg: { cmd: 'turn', data: { value: 0 } } });
}

async function setDeviceBrightness(ip: string, brightness: number) {
  await sendUDPCommand(ip, {
    msg: { cmd: 'brightness', data: { value: brightness } },
  });
}

async function setDeviceColor(
  ip: string,
  color: { r: number; g: number; b: number },
) {
  await sendUDPCommand(ip, {
    msg: { cmd: 'colorwc', data: { color, colorTemInKelvin: 0 } },
  });
}

// CLI Flow
export function createLightControlFlow(): Flow {
  async function execute(): Promise<any> {
    console.log('Scanning for Govee devices on your network...');
    const devices = await scanLocalDevices();
    if (devices.length === 0) {
      console.log(
        'No devices found. Check if the LAN switch is on in the Govee Home App.',
      );
      return 'No devices';
    }

    console.log('\n**Discovered Devices** (Online):');
    devices.forEach((d, i) => console.log(`${i + 1}. ${d.sku} - ${d.ip}`));

    // Save to file
    await Bun.write('local_devices.json', JSON.stringify(devices, null, 2));
    console.log('Device list saved to local_devices.json');

    while (true) {
      console.log('\n**Options**:');
      console.log('1. Control lights');
      console.log('2. Exit');
      const choice = await promptForNumber('Pick an option: ', 1, 2);
      if (choice === 2) break;

      // Select devices
      const selected = await selectOption(
        devices,
        (d) => `${d.sku} - ${d.ip}`,
        (d, input) => `${d.sku} - ${d.ip}`, // Simplify if no highlight needed
        [],
      );

      if (selected.length === 0) {
        console.log('No devices selected.');
        continue;
      }

      console.log('\n**Actions**:');
      console.log('1. Turn on');
      console.log('2. Turn off');
      console.log('3. Set brightness');
      console.log('4. Set color');
      const action = await promptForNumber('Choose an action: ', 1, 4);

      if (action === 1) {
        for (const d of selected) {
          await turnDeviceOn(d.ip);
          console.log(`Turned on ${d.sku}`);
        }
      } else if (action === 2) {
        for (const d of selected) {
          await turnDeviceOff(d.ip);
          console.log(`Turned off ${d.sku}`);
        }
      } else if (action === 3) {
        const same =
          (
            await promptUser('Same brightness for all? (y/n): ')
          ).toLowerCase() === 'y';
        if (same) {
          const brightness = await promptForNumber(
            'Brightness (1-100): ',
            1,
            100,
          );
          for (const d of selected) {
            await setDeviceBrightness(d.ip, brightness);
            console.log(`${d.sku} brightness set to ${brightness}%`);
          }
        } else {
          for (const d of selected) {
            const brightness = await promptForNumber(
              `Brightness for ${d.sku} (1-100): `,
              1,
              100,
            );
            await setDeviceBrightness(d.ip, brightness);
            console.log(`${d.sku} brightness set to ${brightness}%`);
          }
        }
      } else if (action === 4) {
        const same =
          (await promptUser('Same color for all? (y/n): ')).toLowerCase() ===
          'y';
        if (same) {
          const colorPick = await selectOption(
            predefinedColors,
            (c) => c.name,
            (c) => c.name,
            [],
          );
          if (colorPick.length > 0) {
            const color = colorPick[0].rgb;
            for (const d of selected) {
              await setDeviceColor(d.ip, color);
              console.log(`${d.sku} set to ${colorPick[0].name}`);
            }
          }
        } else {
          for (const d of selected) {
            const colorPick = await selectOption(
              predefinedColors,
              (c) => c.name,
              (c) => c.name,
              [],
            );
            if (colorPick.length > 0) {
              await setDeviceColor(d.ip, colorPick[0].rgb);
              console.log(`${d.sku} set to ${colorPick[0].name}`);
            }
          }
        }
      }
    }
    return 'Done controlling lights.';
  }

  return {
    name: 'lights',
    description: 'Control Govee lights locally via LAN API',
    execute,
  };
}
