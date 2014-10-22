/*
 MIT. Zibx. 2014-10-22.
 Rewrited from sandbox and sandcastle.
 */
var fs = require( 'fs' );
var path = require( 'path' );
var spawn = require( 'child_process' ).spawn;
var util = require( 'util' );
var EventEmitter = require( 'events' ).EventEmitter;
var apply = function( a, b ){
    for( var i in b )
        b.hasOwnProperty( i ) && (a[i] = b[i]);
    return a;
};

function Isolate( options ){
    // message_queue is used to store messages that are meant to be sent
    // to the sandbox before the sandbox is ready to process them
    this._ready = false;
    this._tasks = [];
    this._workers = [];
    apply( this, options );
    this._freeWorkers = [];
    this.wid = 0;
}

// events
util.inherits( Isolate, EventEmitter );

Isolate.prototype = {
    initDelay: 10,
    timeout: 300,
    pool: 2,
    node: 'node',
    box: path.join( __dirname, 'box.js' ),
    useStrictMode: false,
    memoryLimitMB: 15, // magic number
    cwd: process.cwd(),
    spawnExecPath: process.execPath,
    run: function( name, data, callback ){
        this._tasks.push( {name: name, data: data, cb: callback} );
        this._tryWork();
    },
    _tryWork: function(){
        var free;

        if( this._tasks.length ){
            if( (free = this._freeWorkers.length) || this._workers.length < this.pool ){
                !free && this._spawnWorker();
                this._job( this._freeWorkers.pop(), this._tasks.shift() );
            }
        }
    },
    _spawnWorker: function(){
        var worker = spawn( this.spawnExecPath, [
            this.useStrictMode ? "--use_strict" : "--nouse_strict",
            "--max_old_space_size=" + this.memoryLimitMB.toString(),
            this.box,
            'sandbox'
        ], {cwd: this.cwd, stdio: ['pipe', 'pipe', 'pipe', 'ipc']} );
        var stdout = '',
            stdErr = '';
        worker.stdout.on( 'data', function( data ){
            stdout += data;
            if( !!data ){
                stdout += data;
            }
        } );
        worker.stderr.on( 'data', function( data ){
            if( !!data ){
                stdErr += data;
            }

        } );

        var self = this;
        worker.on( 'message', function( data ){
            if( data === '__ready__' ){
                this._ready = true;
            }else{
                clearTimeout(this.timeout);
                this.callback.apply(this,[false].concat(data));
                worker.inWork = false;
                self._freeWorkers.push( worker );
                self._tryWork();
            }
        } );

        worker.on( 'exit', function( code ){

            this.err = true;

            self._free(worker);
            this.callback(false, stdErr);
            var item, i;
            for( i = self._workers.length; i;){
                item = self._workers[--i];
                if( item === worker ){
                    self._workers.splice(i,1);
                    break;
                }
            }
            self._tryWork();


        } );
        worker._id = ++this.wid;
        this._workers.push( worker );
        this._freeWorkers.push( worker );
        worker.stdin.write( this.js );
        worker.stdin.end();
    },
    _free: function( worker ){
        worker._ready = false;
        worker.inWork = false;

    },
    _kill: function( worker ){
        worker.kill('SIGKILL');
    },
    _job: function( worker, task ){
        if( worker._ready ){
            //console.log( 'job ready to do' );
            var send = [task.name, task.data];
            worker.callback = task.cb;
            worker.timeout = setTimeout( this._kill.bind(this,worker), this.timeout);
            setImmediate( function(  ){
                worker.send( JSON.stringify( send ) );
            });


        }else
            setTimeout( this._job.bind( this, worker, task ), this.initDelay );
    }
};
module.exports = Isolate;

