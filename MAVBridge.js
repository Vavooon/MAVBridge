var c = console.log.bind( console );


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

var mavlinkMessage = function(buffer) {
	//Reported length
	this.length = buffer[1];
	
	//Sequence number
	this.sequence = buffer[2];
	
	//System ID
	this.system = buffer[3];
	
	//Component ID
	this.component = buffer[4];
	
	//Message ID
	this.id = buffer[5];
	
	//Message payload buffer
	this.payload = new Buffer(this.length);
	buffer.copy(this.payload,0,6,6+this.length);
	
	//Checksum
	this.checksum = buffer.readUInt16LE(this.length+6);
	
	//Whole message as a buffer
	this.buffer = new Buffer(this.length + 8);
	buffer.copy(this.buffer,0,0,8+this.length);
}

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
				//c( message );
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


var myMAV = new mavlink();


function disconnectFromPort( callback ) {
	devPort.close();
	openedPort = false;
	devPort = false;
	callback && callback();
}

io.on('connection', function (socket) {
	var portSink;
	socket.on( 'connectToPort', function ( portName ) {
		//connectToPort( portName, socket );
		portSink = new Sink( { type: 'com', port: portName } );
		io.emit( 'portState', !!portSink );
	});
	
	socket.on( 'disconnectFromPort', function (data) {
		portSink.destroy();
		portSink = false;
		io.emit( 'portState', !!portSink );
	});
	
	io.emit( 'portState', !!portSink );
	
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
	
	var type = o.type;
	var id = o.type+ '-' + o.port;
	switch( type ) {
		case 'udp':
			UdpSink.call( this, o );
		break;
		
		case 'com':
			ComSink.call( this, o );
		break;
	}
	
	this.getId = function() {
		return id;
	}
	
	router.registerSink( this );
}

function UdpSink( o ) {
	var self = this;
	var dgram = require("dgram");
	var udpServer = dgram.createSocket("udp4");
	var port = o.port;
	var host = o.host;
	
	this.send = function( data ) {
		udpServer.send( data, 0, data.length, port, host );
	}
	
	udpServer.on( 'message', function( data ) {
		self.emit( 'data', data );
	});
	udpServer.bind( 14555 );
}

function ComSink ( o ) {
	var port = new SerialPort.SerialPort( o.port, { baudrate: 115200 }, false );
	var self = this;
	port.open( function (error) {
		if ( error ) {
			io.emit( 'message', { origin: 'system', data: '' + error });
		} else {
			port.on('data', (function( data ) {
				this.emit( 'data', data );
			}).bind( self ));
			openedPort = o.port;
			io.emit( 'portState', openedPort );
		}
	});
	this.send = function( data ) {
		port.write( data );
	}
	
	this.destroy = function() {
		port.close();
		router.unregisterSink( self );
	}
}


util.inherits(Sink, events.EventEmitter);



function Router () {
	var sinks = {};
	
	function readData( data ) {
		router.send( this.getId(), data );
		myMAV.parse( data, function( message ) {
			if ( message ) {
				io.emit( 'message', { origin: 'device', name: myMAV.getMessageName( message.id ), data: myMAV.decodeMessage( message ) });
			}
		} );
	}
	
	this.registerSink = function( sink ) {
		sinks[ sink.getId() ] = sink;
		sink.on( 'data', readData );
	}
	
	this.unregisterSink = function( sink ) {
		delete sinks[ sink.getId() ];
		sink.removeListener( 'data', readData );
	}
	
	this.send = function ( sender, data ) {
		for ( var i in sinks ) {
			if ( i !== sender ) {
				sinks[ i ].send( data );
			}
		}
	}
}



var router = new Router;


var udpSink = new Sink( { type: 'udp', host: 'localhost', port: 14550 } );
