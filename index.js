var Service;
var Characteristic;
var request = require("request");
var onkyo_lib = require("./lib/onkyo");
var pollingtoevent = require('polling-to-event');

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
	
	// config
	this.ip_address	= config["ip_address"];
	this.name = config["name"];
	this.poll_status_interval = config["poll_status_interval"] || "0";
		
	this.state = false;
	this.interval = parseInt( this.poll_status_interval);
	this.avrManufacturer = "Onkyo";
	this.avrSerial = "unknown";
	this.avrModel = "unknown";
	
	this.onkyo = onkyo_lib.init({ip: this.ip_address });
	this.onkyo.Connect();
	
	this.switchHandling = "check";
	if (this.interval > 10 && this.interval < 100000) {
		this.switchHandling = "poll";
	}
	
	// Status Polling
	if (this.switchHandling == "poll") {
		var powerurl = this.status_url;
		
		var statusemitter = pollingtoevent(function(done) {
			that.log("Polling switch level..");
			
			that.onkyo.PwrState( function(error, response) {
				done(null, response);
			});			
		}, {longpolling:true,interval:that.interval * 1000,longpollEventName:"statuspoll"});

		statusemitter.on("statuspoll", function(data) {
			var ret = that.parseResponse( null, data);
			that.log("State data changed message received: ", ret);
			/*Causes a switch off - we only want to inform homekit, 
			but this is doing more
			if (that.switchService ) {
				that.switchService.getCharacteristic(Characteristic.On).setValue(that.state);
			}*/
		});
	}
}

HttpStatusAccessory.prototype = {

parseResponse: function( error, response)
{
	if (error) {
		this.log("Error detected: "+JSON.stringify( error));
		this.state = false;
	} else {
		this.log("Message: "+JSON.stringify( response));
		var PWR = response.PWR;
		if (response.PWR !== null && response.PWR !== undefined) {
			this.state = response.PWR;
			this.log("State data changed message received: ", this.state); 
		} else {
			this.log.warn("State data changed message, but content could not be parsed.");
			this.log.warn("Message received: "+JSON.stringify( response));
		}
	}
	
	return this.state;
},

setPowerState: function(powerOn, callback) {
	var that = this;

    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }

    if (powerOn) {
		this.log("Setting power state to ON");
		this.onkyo.PwrOn( function(error, response) {
			var ret = that.parseResponse(error, response);
			callback(error, ret);
		}.bind(this));
	} else {
		this.log("Setting power state to OFF");
		this.onkyo.PwrOff( function(error, response) {
			var ret = that.parseResponse(error, response);
			callback(error, ret);
		}.bind(this));
    }
},
  
getPowerState: function(callback) {
	if (this.switchHandling == "poll") {
		this.log("getPowerState - polling mode, return state: ", this.state);
		callback(null, this.state);
		return;
	}
	
    if (!this.ip_address) {
    	this.log.warn("Ignoring request; No ip_address defined.");
	    callback(new Error("No ip_address defined."));
	    return;
    }
	
    this.log("Getting power state");
	var that = this;

    this.onkyo.PwrState( function(error, response) {
		that.log("getPowerState - callback");
		var ret = that.parseResponse( null, response);
		callback(error, ret);
    }.bind(this));
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
    .setCharacteristic(Characteristic.Model, this.avrModel)
    .setCharacteristic(Characteristic.SerialNumber, this.avrSerial);

	this.switchService = new Service.Switch(this.name);

	this.switchService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));
			
	return [informationService, this.switchService];
}
};
