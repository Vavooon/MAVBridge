$( function() {
	c = console.log.bind( console );
	
	var socket = io();
	$( '#connect-form' ).on('submit', function(){
		//$('#m').val('');
		if ($( "#connect-button" ).prop('value') == 'Connect' ) {
			
			socket.emit( 'connectToPort', $( '#ports-list' ).val() );
		}
		else {
			socket.emit( 'disconnectFromPort' );
		}
		return false;
	});

	socket.on('message', function (data) {
		consoleAddMessage(data);
	});
	
	socket.on( 'portState', function( state ) {
		if ( state ) {
			$( "#connect-button" ).prop('value',  "Disconnect" );
			$( "#connect-button" ).addClass( 'btn-danger' );
			$( "#connect-button" ).removeClass( 'btn-primary' );
			$( "#ports-list" ).select( state );
			$( "#ports-list" ).prop('disabled', 'disabled');
		}
		else {
			$( "#connect-button" ).addClass( 'btn-primary' );
			$( "#connect-button" ).removeClass( 'btn-danger' );
			$( "#connect-button" ).prop('value',  "Connect" );
			$( "#ports-list" ).prop('disabled', '');
		}
	});

	function portsListSetState( state ) {
		var form = $( '#connect-form' )[ 0 ];
		form.classList[ state === 'normal' ? 'remove' : 'add' ]( 'invisible' );
	}

	var itemCounter = 0;

	var bufferLength = 100;

	function consoleScroll() {
		var console = $( '#left-row' )[ 0 ];
		console.scrollTop = console.scrollHeight;
	}
	function consoleCleanMessages() {
		var $console = $( '#console' );
		if ( $console.children().length > bufferLength ) {
			$( 'div', $console ).get( 0 ).remove();
		}
	}

	function consoleAddMessage ( message ) {
		var $console = $( '#console' );
		var messageEl = document.createElement( 'div' );
		switch ( typeof message.data ) {
			case 'object':
				itemCounter++;
				var properties='';
				for (var i in message.data ) {
					properties += i+ ':' + message.data[ i ] + '<br>';
				}
				var $item = $( '<div class="panel panel-default"><div class="panel-heading" role="tab" id="headingOne"> '+ 
						'<h5 class="panel-title"><a data-toggle="collapse" data-parent="#accordion" href="#item-' + 
						itemCounter +
						'" aria-expanded="true" aria-controls="item-' + itemCounter +
						'"> '+ message.name + 
						'  </a></h5></div><div id="item-' + 
						itemCounter +
						'" class="panel-collapse collapse" role="tabpanel" aria-labelledby="headingOne"> '+ 
						'<div class="panel-body"> '+ 
						properties + 
						'</div></div></div> ' );
				$console.append( $item );
			break;
			case 'string':
				$console.append( '<div>' + message.data + '</div>' );
			break;
		}
		consoleCleanMessages();
		consoleScroll();
	}

	socket.on('portsList', function (data) {
		var portsSelect = $( '#ports-list' );
		for ( var i = 0; i < data.length; i++ ) {
			portsSelect.append( '<option>' + data[ i ].comName + '</option>' );
		}
		portsListSetState( 'normal' );
	});
});