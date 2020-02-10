var dgram = require('dgram');
var xxtea = require('xxtea-node');

var key = "[to be defined]";

require('./loadConfig.js')
const pg = require('pg');



var PORT = ->YOUPORTNUMBER; // define portnumber for udp connections
var HOST = '0.0.0.0';

var server = [];
for (var i=0;i<1;i++) {
  // UDP Server
  server[i] = dgram.createSocket('udp4');

  server[i].on('listening', function () {
    var address = this.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
  }.bind(server[i]));

  server[i].on('close', function() {
    console.log('udp socket closed..'); 
  });

  server[i].on('message', function (message, remote) {
	var address = this.address();
	var msg = message.toString();
		 
	console.log('Data received from client : ' + msg);
	console.log('Data received on Port : ' + address.port);
	var cryptbuffer = msg;
	var decryptmessage = xxtea.decryptToString(cryptbuffer, key);
    console.log('Data received from client decrypted : ' + decryptmessage);
    
   
    
    // [FLOAT], [FLOAT], [FLOAT], [FLOAT], [INT8_T], [INTEGER], [INTEGER]
    // [WEIGHT1],[WEIGHT2],[TEMP],[VOLT],[SIGNALQUALITY],[BOARDID],[PAKETNR]
    var splitted = decryptmessage.split(",")
    console.log(splitted)
    var totalweight = parseFloat(splitted[0]) + parseFloat(splitted[1]);
    var scaleid = splitted[5];
    
     var answer = "OK!";
    // answer to hardware node ... send new configs
    // OK! - nothing to change -> defined ANSWER for "check" message from client
    // A - Weight calibration load cell A
    // B - Weight calibration load cell B
    // a - Tare A
    // b - Tare B
    // P - PORT
    // I - IP
    // U - BoardID
    // F - Set Sendinginterval (seconds)
    // D - Set Datalogging interval (seconds)
    // T - Set RTC (seconds Unix Epoch)
    
    
    
    if (decryptmessage.trim() === 'check' || splitted[0] == 'Hello!' ){
		var d = new Date();
		var seconds = Math.round(d.getTime() / 1000);
		answer = `T${seconds}S`;	// Set RTC time	on board to current time
	}
	if (decryptmessage.trim() === 'tared' ){
	answer = "A500";		
	}
	console.log("answering:" + answer);
    var answercrypted = xxtea.encryptToString(answer,key);
    
    this.send(answercrypted , remote.port, remote.address, function(err, bytes) {
		if (err) throw err;
		console.log(`UDP message sent to ${remote.address}:${remote.port}`);
		console.log(answercrypted);
    });
    
   
   
    // write data into DB
    
    const client = new pg.Pool();

	if (isNaN(splitted[0])) {
		text = "INSERT INTO scales_log(batteryvoltage, deviceid, signalquality) VALUES($1, $2, $3) RETURNING *"
		values = [parseFloat(splitted[3]),splitted[5],parseFloat(splitted[4])];
		// callback
		client.query(text, values, (err, res) => {
		  if (err) {
			console.log(err.stack)
		  } else {
			console.log(res.rows[0])
		  }
		})
	}
	else
	{
		// const qry = "INSERT INTO callbacks(date, type, device, data, stationId, rssi, duplicate) VALUES(now(), $1, $2, $3, $4, $5, $6) RETURNING id";
		text = "INSERT INTO callbacks(date,type,device,data,rssi) VALUES(now(), 'data/uplink', $1, $2, $3)";
		// const text = 'INSERT INTO timeseries(scaleid, w1, w2) VALUES($1,$2,$3) RETURNING *'
		values = [splitted[5],totalweight.toString(),parseFloat(splitted[2])]
		
		// callback into old table callbacks
		client.query(text, values, (err, res) => {
		  console.log(err, res)
		})
		// callback to new timeseries
		// [FLOAT],  [FLOAT],  [FLOAT], [FLOAT], [INT8_T],       [INTEGER], [INTEGER]
		// [WEIGHT1],[WEIGHT2],[TEMP],  [VOLT],  [SIGNALQUALITY],[BOARDID], [PAKETNR]
		// [0],		 [1],	   [2],	 	[3],	 [4],			 [5],	    [6]
		
		text = "INSERT INTO scales_timeseries(weight1, weight2, totalweight, temperatur, batteryvoltage,signalquality, deviceid, paketnr ) VALUES($1, $2, $3, $4, $5, $6, $7,$8)"
		values = [parseFloat(splitted[0]), parseFloat(splitted[1]), totalweight, parseFloat(splitted[2]), parseFloat(splitted[3]), parseInt(splitted[4]), splitted[5],parseInt(splitted[6])];
		
		client.query(text, values, (err, res) => {
		  console.log(err, res)
		})
	}

    
  }.bind(server[i]));

  server[i].bind(PORT + i, HOST); 
}






