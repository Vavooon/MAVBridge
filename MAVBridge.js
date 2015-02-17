
var events = require( 'events' );
//var mavlink = require('./mavlink.js');
var util = require( 'util' );
var express = require( 'express' );
var app = express();
var server = require( 'http' ).Server( app );
var io = require( 'socket.io' )( server );
var devPort;
var openedPort = false;
var SerialPort = require( "serialport" );

server.listen( 80 );

app.get( '/', function ( req, res ) {
  res.sendFile( __dirname + '/index.html' );
});

app.use( '/assets', express.static( 'assets' ) );


var mavlink = require( 'mavlink' );


mavlink.prototype.parseChar = function(ch) {
	//If we have no data yet, look for start character
	if (this.bufferIndex == 0 && ch == this.startCharacter()) {
		this.buffer[this.bufferIndex] = ch;
		this.bufferIndex++;
		return;
	}
	
	//Determine packet length
	if (this.bufferIndex == 1) {
		this.buffer[this.bufferIndex] = ch;
		this.messageLength = ch;
		this.bufferIndex++;
		return;
	}
	
	//Receive everything else
	if (this.bufferIndex > 1 && this.bufferIndex < this.messageLength + 8) {
		this.buffer[this.bufferIndex] = ch;
		this.bufferIndex++;
	}
	
	//If we're at the end of the packet, see if it's valid
	if (this.bufferIndex == this.messageLength + 8) {
	
		if (this.version == "v1.0") {
			//Buffer for checksummable data
			var crc_buf = new Buffer(this.messageLength+6);
			this.buffer.copy(crc_buf,0,1,this.messageLength+6);
			
			//Add the message checksum on the end
			crc_buf[crc_buf.length-1] = this.messageChecksums[this.buffer[5]];
		} else {
			//Buffer for checksummable data
			var crc_buf = new Buffer(this.messageLength+5);
			this.buffer.copy(crc_buf,0,1,this.messageLength+6);
		}
		
		//Test the checksum
		if (this.calculateChecksum(crc_buf) == this.buffer.readUInt16LE(this.messageLength+6)) {
			//If checksum is good but sequence is screwed, fire off an event
			if (this.buffer[2] > 0 && this.buffer[2] - this.lastCounter != 1) {
				this.emit("sequenceError", this.buffer[2] - this.lastCounter - 1);
			}
			//update counter
			this.lastCounter = this.buffer[2];
			
			//use message object to parse headers
			var message = new mavlinkMessage(this.buffer);
			
			//if system and component ID's dont match, ignore message. Alternatively if zeros were specified we return everything.
			if ((this.sysid == 0 && this.compid == 0) || (message.system == this.sysid && message.component == this.compid)) {
				//fire an event with the message data
				this.emit("message", message);
				
				//fire additional event for specific message type
				this.emit(this.getMessageName(this.buffer[5]), message, this.decodeMessage(message));
				
				//We got a message, so reset things
				this.bufferIndex = 0;
				this.messageLength = 0;
				return message;
			}
		} else {
			//If checksum fails, fire an event with some debugging information. Message ID, Message Checksum (XML), Calculated Checksum, Received Checksum
			this.emit("checksumFail", this.buffer[5], this.messageChecksums[this.buffer[5]], this.calculateChecksum(crc_buf), this.buffer.readUInt16LE(this.messageLength+6));
		}
		//We got a message, so reset things
		this.bufferIndex = 0;
		this.messageLength = 0;
	}
};
mavlink.prototype.parse = function( buffer, callback ) {
	for (var i=0; i<buffer.length; i++) {
		var parseResult = this.parseChar(buffer[i]);
		if ( parseResult ) {
			typeof callback==='function' && callback( parseResult );
		}
	}
}


var myMAV = new mavlink( 1, 1 );


function disconnectFromPort( callback ) {
	devPort.close();
	openedPort = false;
	devPort = false;
	callback && callback();
}

io.on('connection', function (socket) {
	
	socket.on( 'connectToPort', function ( portName ) {
		connectToPort( data, socket );
		var portSink = new Sink( { type: 'com', port: portName } );
	});
	
	socket.on( 'disconnectFromPort', function (data) {
		disconnectFromPort( function () {
			io.emit( 'portState', openedPort );
		});
	});
	
	io.emit( 'portState', openedPort );
	
	
	
	
	
	SerialPort.list( function ( err, ports ) {
		socket.emit('portsList', ports );
	});
	
});



// UDP



server.on("message", function (msg, rinfo) {
  console.log("server got: " + msg + " from " +
    rinfo.address + ":" + rinfo.port);
});









function Sink ( o ) {
	
	var type = options.type;
	var name = options.name;
	
	
	this.name = name;
	
	switch( type ) {
		case 'udp':
			UdpSink.call( this, o );
		break;
		
		case 'com':
			ComSink.call( this, o );
		break;
	}
	
	
	router.registerSink( this );
}

function UdpSink( o ) {
	var dgram = require("dgram");
	var udpServer = dgram.createSocket("udp4");
}

function ComSink ( o ) {
	var port = new SerialPort.SerialPort( options.port, { baudrate: 115200 }, false );
	port.open( function (error) {
		if ( error ) {
			io.emit( 'message', { origin: 'system', data: '' + error });
		} else {
			port.on('data', function( data ) {
				var message = myMAV.parse( data );
				if ( message ) {
					router.send( mavlink.decodeMessage( message ) );
				}
			});
			openedPort = portName;
			io.emit( 'portState', openedPort );
		}
	});
	this.send = function( data ) {
		port.write( data );
	}
	
	this.destroy = function() {
		port.close();
		router.unregisterSink( this );
	}
}


util.inherits(Sink, events.EventEmitter);



function Router () {
	var sinks = {};
	this.registerSink( sink ) {
		sinks[ sink.name ] = sink;
	}
	
	this.unregisterSink( sink ) {
		sinks.splice( sinks.indexOf( sink ), 1 );
	}
	
	this.send = function ( sender, data ) {
		for ( var i in sinks ) {
			if ( i !== sender ) {
				sinks[ i ].send( data );
			}
		}
	}
}