var Service;
var Characteristic;
var request = require("request");
var onkyo_lib = require("./lib/onkyo");

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
		
	this.state = false;
	this.avrManufacturer = "Onkyo";
	this.avrSerial = "unknown";
	this.avrModel = "unknown";
	
	this.onkyo = onkyo_lib.init({ip: this.ip_address });
	this.onkyo.Connect();
}

HttpStatusAccessory.prototype = {

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
			if (error) {
				that.log('Set power ON function failed: %s', error.message);
			}
			callback(error, response);
		}.bind(this));
	} else {
		this.log("Setting power state to OFF");
		this.onkyo.PwrOff( function(error, response) {
			if (error) {
				that.log('Set power OFF function failed: %s', error.message);
			}
			callback(error, response);
		}.bind(this));
    }
},
  
getPowerState: function(callback) {
    if (!this.status_url) {
    	    this.log.warn("Ignoring request; No status url defined.");
	    callback(new Error("No status url defined."));
	    return;
    }
    
    this.log("Getting power state");
	var that = this;

    this.onkyo.PwrState( function(error, response) {
		if (error) {
			that.log('Get power state failed: %s', error.message);
		}
		callback(error, response);
    }.bind(this));
},

identify: function(callback) {
    this.log("Identify requested!");
    callback(); // success
},

getServices: function() {

    // you can OPTIONALLY create an information service if you wish to override
    // the default values for things like serial number, model, etc.
    var informationService = new Service.AccessoryInformation();
	var that = this;

	//console.log( "--"+this.name);
    informationService
    .setCharacteristic(Characteristic.Manufacturer, this.avrManufacturer)
    .setCharacteristic(Characteristic.Model, this.avrModel)
    .setCharacteristic(Characteristic.SerialNumber, this.avrSerial);

	this.switchService = new Service.Switch(this.name);

	this.switchService
		this.switchService
		.getCharacteristic(Characteristic.On)
		.on('get', function(callback) {callback(null, that.state)})
		.on('set', this.setPowerState.bind(this));

	return [informationService, this.switchService];

}
};