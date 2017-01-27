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
		"model" : "TX-NR609",
		"poll_status_interval": "900",
		"default_input": "sat"
	}
]
 ```
 
 `default_input` is optional. If it not supplied, the previous input will be persisted. If a valid option is supplied, a request to set the input to the specified source will be made when the unit is turned on. The valid options depend on the unit. As a rule of thumb try to use the values as they are printed on the remote. 
 Examples of values:
 - VCR
 - SAT
 - DVD
 
