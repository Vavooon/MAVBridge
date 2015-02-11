

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var devPort;
var openedPort = false;
	var SerialPort = require("serialport");

server.listen(80);

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.use('/assets', express.static('assets'));


var mavlink = require('mavlink');
var myMAV = new mavlink(1,1);


function connectToPort( portName, socket ) {
	devPort = new SerialPort.SerialPort( portName, {
		baudrate: 115200
	}, false); // this is the openImmediately flag [default is true] 
	
	devPort.open(function (error) {
		if ( error ) {
			socket.emit( 'message', { origin: 'system', data: '' + error });
		} else {
			devPort.on('data', function(data) {
				myMAV.parse(data);
			});
			openedPort = portName;
			socket.emit( 'portState', openedPort );
			/*
			devPort.write("ls\n", function(err, results) {
				console.log('err ' + err);
				console.log('results ' + results);
			});*/
		}
	});

	//listen for messages
	
}

function disconnectFromPort( callback ) {
	devPort.close();
	openedPort = false;
	devPort = false;
	callback && callback();
}

myMAV.on( "ready", function() {
	io.on('connection', function (socket) {
		socket.on('connectToPort', function (data) {
			connectToPort( data, socket );
		});
		
		socket.on('disconnectFromPort', function (data) {
			disconnectFromPort( function () {
				socket.emit( 'portState', openedPort );
			});
		});
		
		socket.emit( 'portState', openedPort );
		console.log( devPort );
		if ( devPort ) {
			devPort.on('data', function(data) {
				myMAV.parse(data);
			});
		}
		
		myMAV.on("message", function( rawMessage ) {
		socket.emit('message', { origin: 'device', title: myMAV.getMessageName( rawMessage.id ), data: myMAV.decodeMessage( rawMessage ) });
	});
		
		SerialPort.list( function ( err, ports ) {
			socket.emit('portsList', ports );
		});
		
	});
	
});
