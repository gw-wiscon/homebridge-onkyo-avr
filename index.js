var Service;
var Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');
var util = require('util');

module.exports = function(homebridge)
{
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-onkyo-avr", "OnkyoAVR", HttpStatusAccessory);
}

/*
exports.init = function(log, config)
{
	return new HttpStatusAccessory(log, config);
}*/

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
		
	this.state = false;
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
	
	this.eiscp.connect(
		{host: this.ip_address, reconnect: true, model: this.model}
	);

	
	//that.log("hello - "+config["ip_address"]);
	// Status Polling
	if (this.switchHandling == "poll") {
		var powerurl = this.status_url;
		that.log("start long poller..");
		
		var statusemitter = pollingtoevent(function(done) {
			that.log("start polling..");
			that.getPowerState( function( error, response) {
				//pass also the setAttempt, to force a homekit update if needed
				done(error, response, that.setAttempt);
			}, "statuspoll");
		}, {longpolling:true,interval:that.interval * 1000,longpollEventName:"statuspoll"});

		statusemitter.on("statuspoll", function(data) {
			that.state = data;
			that.log("event - status poller - new state: ", that.state);
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(that.state, null, "statuspoll");
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

eventVolume: function( response)
{
	//this.log( "eventVolume: %s", response);
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
			}
			else {
				// If the AVR has just been turned on, apply the Input default
				if (this.state && this.defaultInput) {
					this.log("Attempting to set the input selector to sat");
					this.eiscp.command("input-selector="+this.defaultInput);
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
				that.switchService.getCharacteristic(Characteristic.On).setValue(powerOn, null, "statuspoll");
			}					
		}	
	}.bind(this) );
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
			
	return [informationService, this.switchService];
}
};

