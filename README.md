# homebridge-onkyo-avr
Homebridge module for Onkyo AVRs (tested on TX-NR609 and TX-8050)

# Description

Onkyo AVR module, works in principle.

Ensure that the onkyo is controllable using for instance IOS apps like OnkyoRemote3.

Next step: Check what happens if the AVR is reset or is temporary not available.

For Troubleshooting look in the homebridge-onkyo-avr/node_modules/eiscp/examples directory and see if you can run 3.js. "node 3.js". It should output all available commands.

Updated version 0.3 includes support for volume, mute, and has options for setting default_input.

Siri Control for Volume and Mute - Use an app like EVE and create scenes for Mute On and Mute Off, and various Volume(s). 
For example, I created a scene for "Onkyo Low" and "Onkyo Loud", which show up in the Home App now.  

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
		"default_input": "net",
		"default_volume": "10",
		"max_volume": "35",
		"map_volume_100": true
	}
]
 ```
###Config Explanation:

Field           			| Description
----------------------------|------------
**accessory**   			| (required) Must always be "OnkyoAVR". 
**name**        			| (required) The name you want to use for control the Onkyo accessories.
**ip_address**  			| (required) The internal ip address of your Onkyo.
**model**					| (required) Must remain "TX-NR609" (Something to explore in the future for alternative models.)
**poll_status_interval**  	| (Optional) Poll Status Interval. Defaults to 0 or no polling.
**default_input**  			| (Optional) A valid source input. Default will use last known input.
**default_volume**  		| (optional) Initial reciever volume upon powerup. This is the true volume number, not a percentage. Ignored if powerup from device knob or external app (like OnkyoRemote3).
**max_volume**  			| (optional) Reciever volume max setting. This is a true volume number, not a percentage, and intended so there is not accidental setting of volume to 80. Ignored by external apps (like OnkyoRemote3). Defaults to 30. 
**map_volume_100**  		| (optional) Defaults to False. will remap the volume percentages that appear in the Home app so that the configured max_volume will appear as 100% in the Home app. For example, if the max_volume is 30, then setting the volume slider to 50% would set the receiver's actual volume to 15. Adjusting the stereo volume knob to 35 will appear as 100% in the Home app. This option could confuse some users to it defaults to off false, but it does give the user finer volume control especially when sliding volume up and down in the Home app.

