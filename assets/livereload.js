var ws;
function socket() {
  ws = new WebSocket("ws://127.0.0.1:8080");
  ws.onmessage = function ( e ) {
		console.log( e );
    var data = JSON.parse(e.data);
		console.log( data ); 
    if ( data[0] === 'refresh' ) {
      location.reload();
    }
  };
}
setInterval(function () {
  if ( ws ) {
    if ( ws.readyState !== 1 ) {
      socket();
    }
  } else {
    socket();
  }
}, 1000);