'use strict';
var mysql = require('mysql');
var twilio = require('twilio');
var accountSid = '****'; 
var authToken = '****';   
var client = new twilio.RestClient(accountSid, authToken);

exports.handler = function (event, context) {

    var callStatus = event.params.querystring.CallStatus;

    if(callStatus == undefined){//if no calls have been made previously
        //get lowest and highest ids from twilio_schema.calls_table and begin calling
        queryCallsTable(event, null,function(rows){
            makecall(rows[0].min_id,rows[0].max_id, rows[0].phone_number);
            console.log('minimum and maximum',rows[0].min_id,rows[0].max_id);
        });
    }
    else{
        console.log('id: ', event.params.querystring.currentID, 'callback status: ', callStatus);

        var currentID= event.params.querystring.currentID;
        var maxID = event.params.querystring.maxID;
        //Gets call data from twilio API and inserts it into the database.
        finalCallsTableUpdate(event, currentID);
        //check if all numbers have been called, and call next callID if they have not all been called
        if(currentID < maxID){
            currentID++;
            console.log('id after increment', currentID);
            queryCallsTable(event, currentID,function(rows){
                makecall(currentID,maxID, rows[0].phone_number);
            });     
        }
        else{
            console.log('All calls made');
        }
    
    }
}


//gets data for calling/texting first number in a huntList
function queryCallsTable(event, currentId, cb){
    var connection = mysql.createConnection({
        host     : '****',
        user     : '****',
        password : '****',
        port: '****',
        database : 'twilio_schema'
    });

    connection.connect(function(err, results) {
        if (err) {
            console.log("ERROR: " + err.message);
            throw err;
        }
        console.log("connected.");
    });
    var sqlQuery = 'SELECT id, phone_number,twilio_sid FROM twilio_schema.calls_table WHERE id =' + currentId
    //different MySQL query if no callshave been made yet
    if(event.params.querystring.CallStatus == undefined){
        sqlQuery = 'SELECT min(id) AS min_id, max(id) AS max_id, phone_number FROM twilio_schema.calls_table'
    }
    connection.query(
        sqlQuery
        , function(err, rows) {
        cb(rows);
        connection.end();
    });
}


function makecall(currentID, maxID, phoneNumber) {
console.log('Calling', phoneNumber, 'with id', currentID);

    // console.log('testing syntax in make call ---',twimlUrl);//twiml url logged at this point, doesn't appear to contain any query string, but call is being made alright

    var callbackUrl = encodeURI('https://gq0pzkubhk.execute-api.eu-west-1.amazonaws.com/test/caller?currentID='+currentID+ '&maxID='+maxID+'&twimlUrl='+twimlUrl);//temp callback url to test callbacks
    
    // console.log("twimlUrl at time of making call with id: ", currentID, "and twimlUrl", twimlUrl);

    client.makeCall({
        to: phoneNumber, 
        from: '**your twilio phone number**', 
        url: twimlUrl,
        statusCallback:  callbackUrl, 
        statusCallbackMethod: "GET",
        statusCallbackEvent: ["completed"],
        method: "GET"
    }, function(err, call) {
        if(err){
            console.log('Call Error',err);
        }else{
            console.log('Twilio Accepted the call');
            //update twilio_schema.calls_table with twilio sid at this point

            var makeCallConnection = mysql.createConnection({
            host     : '****',
            user     : '****',
            password : '****',
            port: '****',
            database : 'twilio_schema' 
            });

            makeCallConnection.connect(function(err, results) {
                if (err) {
                  console.log("ERROR: " + err.message);
                  throw err;
                }
                console.log("connected.");
            });

            makeCallConnection.query(
                'UPDATE `twilio_schema`.`calls_table`'+
                ' SET '+
                '`twilio_sid` = \''+ call.sid+'\','+
                ' WHERE `id` ='+ currentID 

                , function(err, rows) {
                    if (err) {
                        console.log("ERROR: " + err.message);
                        throw err;
                    }
                    else{
                        console.log('updated table for currentID', currentID,' and call sid', call.sid);
                    }
                    makeCallConnection.end();
            });
        }
    });
}

//final pull and update 
function finalCallsTableUpdate(event, currentID){

    queryCallsTable(event, null, currentID, function(rows){
        var twilioSID = rows[0].twilio_sid;

        client.calls(twilioSID).get(function(err, call) {

            var twilioDataUpdateConnection = mysql.createConnection({
                host     : '****',
                user     : '****',
                password : '****',
                port: '****',
                database : 'twilio_schema' 
            });

            twilioDataUpdateConnection.connect(function(err, results) {
                if (err) {
                  console.log("ERROR: " + err.message);
                  throw err;
                }
                console.log("connected.");
            });

            twilioDataUpdateConnection.query(
                'UPDATE `twilio_schema`.`calls_table`'+
                ' SET '+
                '`call_status` = \''+ call.status+'\','+
                '`call_start_time` = STR_TO_DATE(\''+ String(call.startTime).slice(4,-15) + '\',\'%b %e %Y %H:%i:%s\'),'+ 
                '`call_end_time` = STR_TO_DATE(\''+ String(call.startTime).slice(4,-15) + '\',\'%b %e %Y %H:%i:%s\'),'+
                '`call_duration` = \'' + call.duration + '\''+
                ' WHERE `id` ='+ currentID 

                , function(err, rows) {
                    if (err) {
                        console.log("ERROR: " + err.message);
                        throw err;
                    }
                    else{
                        console.log('End of sequence update for id: ', currentID,' for call that started at: ', call.startTime);
                    }
                    twilioDataUpdateConnection.end();
            });
        });
    });
}
