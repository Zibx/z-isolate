var util = require( 'util' );
var vm = require( 'vm' );

var code = '';
var stdin = process.openStdin();
var result;

stdin.on( 'data', function( data ){
    code += data;
} );
stdin.on( 'end', run );

function getSafeRunner(){

    var global = this,
        slice = [].slice;
    // Keep it outside of strict mode
    function UserScript( str ){

        str = 'g='+str;
        // We want a global scoped function that has implicit returns.
        str = 'var g; eval(' + JSON.stringify( str + '' ) + ');' +
        'for(var i in g)this[i] = g[i];return g;';

        return Function( str );
    }

    // place with a closure that is not exposed thanks to strict mode
    return function run( comm, src ){
        // stop argument / caller attacks
        "use strict";
        var send = function send( event ){
            "use strict";
            comm.send( event, JSON.stringify( slice.call( arguments, 1 ) ) );
        };

        global.callback = send.bind( global, 'message' );

        global.onmessage = function( msg ){
            var tokens = JSON.parse(msg);
            global[tokens[0]].apply(global, tokens[1]);
        };
        UserScript( src ).call(global);


        send( 'end', '' );
        return global;
        /*for( var i in global )
            global[i] = global[i];*/


    }
};

// Run code
function run(){

    var context = vm.createContext();


    var safeRunner = vm.runInContext( '(' + getSafeRunner.toString() + ')()', context );


        safeRunner( {
            send: function( event, value ){
                "use strict";
                switch( event ){
                    case 'stdout':
                        console.push( JSON.parse( value )[0] );
                        break;
                    case 'end':
                        result = JSON.parse( value )[0];
                        break;
                    case 'message':
                        process.send( JSON.parse( value ) );
                        break;
                    default:
                        throw new Error( 'Unknown event type' );
                }
            },
            exit: function(){
                processExit();
            }
        }, code );


    process.on('message', processMessageListener.bind(null, context));
    process.send( '__ready__' );

    //process.send( "22'" );

};

function processMessageListener( context, message ){
    vm.runInContext('if (typeof onmessage === "function") { onmessage('+ JSON.stringify(String(message)) + '); }', context);
    //checkIfProcessFinished(context);
};

function processExit(){
    process.removeListener( 'message', processMessageListener );

    process.stdout.on( 'finish', function(){
        process.exit( 0 );
    } );

    process.stdout.end( JSON.stringify( {result: util.inspect( result ), console: console} ) );
};
