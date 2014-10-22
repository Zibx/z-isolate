/**
 * Created by Ivan on 10/20/2014.
 */
// TODO write bormal text
var vows = require('vows'),
    assert = require('assert');

var isolate = require('../lib/isolate');
var g = '\
    varvar task = 0;\
    var exports = {\
        job1: function(c){\
            callback(c+") finished"+(++task));\
        }\
    };';
var task = new isolate({
    pool: 3,
    js: '\
    {\
        job1: function( c ){\
            callback(c,2, this.main());\
        },\
        main: function(){\
         return 7;\
        },\
        job2: function(){\
            while(true);;\
        },\
        job3: function(){\
         f()\
        }\
    };'
});var r = 0,count = 1000,t = +new Date();
for(var i = 0; i < count; i++)
task.run('job1', [i], function( err, a,b,c ){
    console.log(this._id,err,a,b,c);
    r++;
    if(r===count){
        console.log(+new Date()-t);
        process.exit();
    }
});