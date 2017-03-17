var Service;
var Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');
var util = require('util');
var round = require( 'math-round' );

module.exports = function(homebridge)
{
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerAccessory("homebridge-onkyo-avr", "OnkyoAVR", HttpStatusAccessory);
}

function HttpStatusAccessory(log, config) 
{
	this.log = log;
	var that = this;
	this.eiscp = require('eiscp');
	this.setAttempt = 0;

	// config
	this.ip_address	= config["ip_address"];
	this.name = config["name"];
	this.model = config["model"];
	this.poll_status_interval = config["poll_status_interval"] || "0";

	this.defaultInput = config["default_input"]; 
    this.defaultVolume = config['default_volume'];
    this.maxVolume = config['max_volume'] || 30;
	this.mapVolume100 = config['map_volume_100'] || false;
	
	this.state = false;
	this.m_state = false;
	this.v_state = 0;
	this.interval = parseInt( this.poll_status_interval);
	this.avrManufacturer = "Onkyo";
	this.avrSerial = "unknown";
	
	this.switchHandling = "check";
	if (this.interval > 10 && this.interval < 100000) {
		this.switchHandling = "poll";
	}
	
	this.eiscp.on('debug', this.eventDebug.bind(this));
	this.eiscp.on('error', this.eventError.bind(this));
	this.eiscp.on('connect', this.eventConnect.bind(this));
	this.eiscp.on('system-power', this.eventSystemPower.bind(this));
	this.eiscp.on('volume', this.eventVolume.bind(this));
	this.eiscp.on('close', this.eventClose.bind(this));
	this.eiscp.on('audio-muting', this.eventAudioMuting.bind(this));
	
	this.eiscp.connect(
		{host: this.ip_address, reconnect: true, model: this.model}
	);

	
	//that.log("hello - "+config["ip_address"]);
	// Status Polling
	if (this.switchHandling == "poll") {
		var powerurl = this.status_url;
		that.log("start long poller..");
	// PWR Polling	
		var statusemitter = pollingtoevent(function(done) {
			that.log("start PWR polling..");
			that.getPowerState( function( error, response) {
				//pass also the setAttempt, to force a homekit update if needed
				done(error, response, that.setAttempt);
			}, "statuspoll");
		}, {longpolling:true,interval:that.interval * 1000,longpollEventName:"statuspoll"});

		statusemitter.on("statuspoll", function(data) {
			that.state = data;
			that.log("event - PWR status poller - new state: ", that.state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(that.state, null, "statuspoll");
			}
		});
	// Audio-Muting Pollling		
		var m_statusemitter = pollingtoevent(function(done) {
			that.log("start MUTE polling..");
			that.getMuteState( function( error, response) {
				//pass also the setAttempt, to force a homekit update if needed
				done(error, response, that.setAttempt);
			}, "m_statuspoll");
		}, {longpolling:true,interval:that.interval * 1000,longpollEventName:"m_statuspoll"});

		m_statusemitter.on("m_statuspoll", function(data) {
			that.m_state = data;
			that.log("event - MUTE status poller - new m_state: ", that.m_state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.Mute).setValue(that.m_state, null, "m_statuspoll");
			}
		});	
	// Volume Pollling		
		var v_statusemitter = pollingtoevent(function(done) {
			that.log("start VOLUME polling..");
			that.getVolumeState( function( error, response) {
				//pass also the setAttempt, to force a homekit update if needed
				done(error, response, that.setAttempt);
			}, "v_statuspoll");
		}, {longpolling:true,interval:that.interval * 1000,longpollEventName:"v_statuspoll"});

		v_statusemitter.on("v_statuspoll", function(data) {
			that.v_state = data;
			that.log("event - VOLUME status poller - new v_state: ", that.v_state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.Volume).setValue(that.v_state, null, "v_statuspoll");
			}
		});		
	}
}

HttpStatusAccessory.prototype = {

eventDebug: function( response)
{
	//this.log( "eventDebug: %s", response);
},

eventError: function( response)
{
	this.log( "eventError: %s", response);
},

eventConnect: function( response)
{
	this.log( "eventConnect: %s", response);
},

eventSystemPower: function( response)
{
	//this.log( "eventSystemPower: %s", response);
	this.state = (response == "on");
	this.log("eventSystemPower - message: %s, new state %s", response, this.state);
	//Communicate status
	if (this.switchService ) {
		this.switchService.getCharacteristic(Characteristic.On).setValue(this.state, null, "statuspoll");
	}		
},

eventAudioMuting: function( response)
{
	this.m_state = (response == "on");
	this.log("eventAudioMuting - message: %s, new m_state %s", response, this.m_state);
	//Communicate status
	if (this.switchService ) {
		this.switchService.getCharacteristic(Characteristic.Mute).setValue(this.m_state, null, "m_statuspoll");
	}	
},
eventVolume: function( response)
{
	if (this.mapVolume100) {
        var volumeMultiplier = this.maxVolume/100;
        var newVolume = response / volumeMultiplier;
		this.v_state = round(newVolume); 
		this.log("eventVolume - message: %s, new v_state %s PERCENT", response, this.v_state);
	} else {		
		this.v_state = response; 
		this.log("eventVolume - message: %s, new v_state %s ACTUAL", response, this.v_state);
	}
	//Communicate status
	if (this.switchService ) {
		this.switchService.getCharacteristic(Characteristic.Volume).setValue(this.v_state, null, "v_statuspoll");
	}
},

eventClose: function( response)
{
	this.log( "eventClose: %s", response);
},

setPowerState: function(powerOn, callback, context) {
	var that = this;
//if context is statuspoll, then we need to ensure that we do not set the actual value
	if (context && context == "statuspoll") {
		this.log( "setPowerState - polling mode, ignore, state: %s", this.state);
		callback(null, this.state);
	    return;
	}
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }

	this.setAttempt = this.setAttempt+1;
		
	//do the callback immediately, to free homekit
	//have the event later on execute changes
	that.state = powerOn;
	callback( null, that.state);
    if (powerOn) {
		this.log("setPowerState - actual mode, power state: %s, switching to ON", that.state);
		this.eiscp.command("system-power=on", function(error, response) {
			//that.log( "PWR ON: %s - %s -- current state: %s", error, response, that.state);
			if (error) {
				that.state = false;
				that.log( "setPowerState - PWR ON: ERROR - current state: %s", that.state);
				if (that.switchService ) {
					that.switchService.getCharacteristic(Characteristic.On).setValue(powerOn, null, "statuspoll");
				}					
			} else {
				// If the AVR has just been turned on, apply the default volume
					this.log("Attempting to set the default volume to "+this.defaultVolume);
					if (powerOn && this.defaultVolume) {
						that.log("Setting default volume to "+this.defaultVolume);
						this.eiscp.command("volume:"+this.defaultVolume, function(error, response) {
							if (error) {
								that.log( "Error while setting default volume: %s", error);
							}
						});
					}
				// If the AVR has just been turned on, apply the Input default 
					this.log("Attempting to set the default input selector to "+this.defaultInput);
					if (powerOn && this.defaultInput) {
						that.log("Setting default input selector to "+this.defaultInput);
						this.eiscp.command("input-selector="+this.defaultInput, function(error, response) {
							if (error) {
								that.log( "Error while setting default input: %s", error);
							}
						});			
					}
			}
		}.bind(this) );
	} else {
		this.log("setPowerState - actual mode, power state: %s, switching to OFF", that.state);
		this.eiscp.command("system-power=standby", function(error, response) {
			//that.log( "PWR OFF: %s - %s -- current state: %s", error, response, that.state);
			if (error) {
				that.state = false;
				that.log( "setPowerState - PWR OFF: ERROR - current state: %s", that.state);
				if (that.switchService ) {
					that.switchService.getCharacteristic(Characteristic.On).setValue(that.state, null, "statuspoll");
				}					
			}
		}.bind(this) );		
    }
},
  
getPowerState: function(callback, context) {
	var that = this;
	//if context is statuspoll, then we need to request the actual value
	if (!context || context != "statuspoll") {
		if (this.switchHandling == "poll") {
			this.log("getPowerState - polling mode, return state: ", this.state);
			callback(null, this.state);
			return;
		}
	}
	
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }
	
	//do the callback immediately, to free homekit
	//have the event later on execute changes
	callback(null, this.state);
    this.log("getPowerState - actual mode, return state: ", this.state);
	this.eiscp.command("system-power=query", function( error, data) {
		if (error) {
			that.state = false;
			that.log( "getPowerState - PWR QRY: ERROR - current state: %s", that.state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(that.state, null, "statuspoll");
			}					
		}	
	}.bind(this) );
},

getVolumeState: function(callback, context) {
	var that = this;
	//if context is m_statuspoll, then we need to request the actual value
	if (!context || context != "v_statuspoll") {
		if (this.switchHandling == "poll") {
			this.log("getVolumeState - polling mode, return v_state: ", this.v_state);
			callback(null, this.v_state);
			return;
		}
	}
	
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }
	
	//do the callback immediately, to free homekit
	//have the event later on execute changes
	callback(null, this.v_state);
    this.log("getVolumeState - actual mode, return v_state: ", this.v_state);
	this.eiscp.command("volume=query", function( error, data) {
		if (error) {
			that.v_state = 0;
			that.log( "getVolumeState - VOLUME QRY: ERROR - current v_state: %s", that.v_state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.Volume).setValue(that.v_state, null, "v_statuspoll");
			}					
		}	
	}.bind(this) );
},

setVolumeState: function(volumeLvl, callback, context) {
	var that = this;
//if context is m_statuspoll, then we need to ensure that we do not set the actual value
	if (context && context == "v_statuspoll") {
		this.log( "setVolumeState - polling mode, ignore, v_state: %s", this.v_state);
		callback(null, this.v_state);
	    return;
	}
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }

	this.setAttempt = this.setAttempt+1;
	
	//Are we mapping volume to 100%?
	if (this.mapVolume100) {
        var volumeMultiplier = this.maxVolume/100;
        var newVolume = volumeMultiplier * volumeLvl;		
		this.v_state = round(newVolume); 
		this.log("setVolumeState - actual mode, PERCENT, volume v_state: %s", that.v_state);
	} else if (volumeLvl > this.maxVolume) {		
	//Determin if maxVolume threshold breached, if so set to max.
		this.log("setVolumeState - VOLUME LEVEL of: %s exceeds maxVolume: %s. Resetting to max.", volumeLvl, this.maxVolume);
		that.v_state = this.maxVolume;
	} else {
	// Must be using actual volume number
		this.log("setVolumeState - actual mode, ACTUAL volume v_state: %s", that.v_state);
		that.v_state = volumeLvl;
	}
	
	//do the callback immediately, to free homekit
	//have the event later on execute changes
	callback( null, that.v_state);

	this.eiscp.command("volume:" + that.v_state, function(error, response) {
	//that.log( "VOLUME : %s - %s -- current v_state: %s", error, response, that.v_state);
		if (error) {
			that.v_state = 0;
			that.log( "setVolumeState - VOLUME : ERROR - current v_state: %s", that.v_state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.Volume).setValue(that.v_state, null, "v_statuspoll");
			}					
		}
	}.bind(this) );
},

getMuteState: function(callback, context) {
	var that = this;
	//if context is m_statuspoll, then we need to request the actual value
	if (!context || context != "m_statuspoll") {
		if (this.switchHandling == "poll") {
			this.log("getMuteState - polling mode, return m_state: ", this.m_state);
			callback(null, this.m_state);
			return;
		}
	}
	
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }
	
	//do the callback immediately, to free homekit
	//have the event later on execute changes
	callback(null, this.m_state);
    this.log("getMuteState - actual mode, return m_state: ", this.m_state);
	this.eiscp.command("audio-muting=query", function( error, data) {
		if (error) {
			that.m_state = false;
			that.log( "getMuteState - MUTE QRY: ERROR - current m_state: %s", that.m_state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.Mute).setValue(that.m_state, null, "m_statuspoll");
			}					
		}	
	}.bind(this) );
},

setMuteState: function(muteOn, callback, context) {
	var that = this;
//if context is m_statuspoll, then we need to ensure that we do not set the actual value
	if (context && context == "m_statuspoll") {
		this.log( "setMuteState - polling mode, ignore, m_state: %s", this.m_state);
		callback(null, this.m_state);
	    return;
	}
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }

	this.setAttempt = this.setAttempt+1;
		
	//do the callback immediately, to free homekit
	//have the event later on execute changes
	that.m_state = muteOn;
	callback( null, that.m_state);
    if (that.m_state) {
		this.log("setMuteState - actual mode, mute m_state: %s, switching to ON", that.m_state);
		this.eiscp.command("audio-muting=on", function(error, response) {
			if (error) {
				that.m_state = false;
				that.log( "setMuteState - MUTE ON: ERROR - current m_state: %s", that.m_state);
				if (that.switchService ) {
					that.switchService.getCharacteristic(Characteristic.Mute).setValue(that.m_state, null, "m_statuspoll");
				}					
			}
		}.bind(this) );
	} else {
		this.log("setMuteState - actual mode, mute m_state: %s, switching to OFF", that.m_state);
		this.eiscp.command("audio-muting=off", function(error, response) {
			if (error) {
				that.m_state = false;
				that.log( "setMuteState - MUTE OFF: ERROR - current m_state: %s", that.m_state);
				if (that.switchService ) {
					that.switchService.getCharacteristic(Characteristic.Mute).setValue(that.m_state, null, "m_statuspoll");
				}					
			}			
		}.bind(this) );		
    }
},
identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
},

getServices: function() {
	var that = this;

	var informationService = new Service.AccessoryInformation();
    informationService
    .setCharacteristic(Characteristic.Manufacturer, this.avrManufacturer)
    .setCharacteristic(Characteristic.Model, this.model)
    .setCharacteristic(Characteristic.SerialNumber, this.avrSerial);

	this.switchService = new Service.Switch(this.name);

	this.switchService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));

	this.switchService.addCharacteristic(Characteristic.Volume)
		.on('get', this.getVolumeState.bind(this))
		.on('set', this.setVolumeState.bind(this));	

	this.switchService.addCharacteristic(Characteristic.Mute)
		.on('get', this.getMuteState.bind(this))
		.on('set', this.setMuteState.bind(this));	

		
	return [informationService, this.switchService];
}
};