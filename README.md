# homebridge-onkyo-avr
Homebridge module for Onkyo AVRs (tested on TX-NR609)

# Description

Onkyo AVR module, works in principle.
Ensure that the onkyo is controllable using for instance IOS apps like ORemote.
Next step: Check what happens if the AVR is reset or is temporary not available.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-onkyo-avr
3. Update your configuration file. See the sample below.

# Configuration

Example accessory config (needs to be added to the homebridge config.json):
 ```
"accessories": [
	{
		"accessory": "OnkyoAVR",
		"name": "My Onkyo",
		"ip_address": "10.0.1.23",
		"poll_status_interval": "60"
	}
]
 ```
