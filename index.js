const util = require('util');
var app = require('express')();
const fs = require('fs');
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var mongoose = require('mongoose');

var mongoDB = 'mongodb://localhost:27017/aryzon';
mongoose.connect(mongoDB);
var db = mongoose.connection;
var Schema = mongoose.Schema;
var cc = mongoose.model('codes', new Schema({},{ "strict": false }));

app.use(bodyParser.raw({limit: '100mb'}));
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true }));

function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

function generateRandomCode() {
    var CHARS = 10;
    var cod = "";

    for ( var q = 0; q < CHARS+1; q++ ) {
      if ( q == CHARS/2 ) {
        cod += "-";
        continue;
      }
      if ( Math.random() > 0.5 ) {              
          cod += String.fromCharCode( randomIntFromInterval(65,90) );
      } else {
          cod += String.fromCharCode( randomIntFromInterval(48,57) );
      }
    }

    return cod;
}

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/generate/:quantity', function(req, res) {

  var codeGenerated = 0;

  while ( codeGenerated < req.params.quantity ) {
    var newcode = generateRandomCode();
    cc.findOne({ code : newcode }, function (err, entry) {
      if (err) {
        handleError(err);
      } else {
        if ( entry ) {
          //res.send('code in there already: ' + newcode );        
        } else {
          var codeentry = new cc( {code : newcode, downloaded : false, used: false, used_case: "", date_downloaded: -1, date_used: -1} );
          codeentry.save();
        }
      }
    });
    codeGenerated++;
  }

  res.send('Codes Generated: ' + codeGenerated);

});

app.get('/reset', function(req, res){
  db.collection('codes').updateMany({}, { $set: { "downloaded" : false, "use_case" : "", "date_downloaded" : -1 }}, function (err, entry) {
    if (err) {
      handleError(err);
    } else {
      res.send('All codes reset' );
    }
  });   
});

async function ctoArray( cursor ) {
  var ret = await cursor.toArray();
  return ret;
}

app.get('/download/:name/:quantity', function(req, res){
  var tn = Date.now();
  var updatedIndex = 0;
  var codes = "";
  // var cursor = db.collection('codes').findAndModify( { query : { "downloaded" : false }, 
  //                                                      update: { $set : { "downloaded" : true, "use_case" : req.params.name, "date_downloaded" : tn } } }
  //                                                  ).limit(parseInt(req.params.quantity));

  var quantity = parseInt(req.params.quantity);
  var name = req.params.name;

  db.collection('codes').find( { "downloaded" : false } ).limit(quantity).forEach(function (elem) { 
      elem.downloaded = true; 
      elem.use_case = name;
      elem.date_downloaded = tn;
      updatedIndex++;
      db.collection('codes').save(elem); 
      codes += elem.code + "\n";
      if ( updatedIndex == quantity ) {
        var filename = name +  '_promocodes.txt';
        fs.writeFile(filename, codes, function(err) {
          if (err) {
            res.send('Something when wrong');
          } else {
            res.download(filename);
          }
        })
      }
    }.bind(updatedIndex).bind(codes).bind(quantity).bind(name)
  );

  //res.send('downlaoded' );
  // var cursor = db.collection('codes').find().limit(parseInt(req.params.quantity));
  // var elems = ctoArray(cursor);

  // for ( var c = 0; c < elems.length; c++ ) {
  //   codeconc += "aaa";
  // }

  //res.send('Downloaded codes: ' + codeconc);
  //util.inspect(elems)

  console.log('Downloaded codes data: ${req.params.name}, ${req.params.quantity}');
  //res.sendFile(__dirname + '/index.html');  
});

app.get('/register_used/:code', function(req, res){
  var tn = Date.now();
  var code = req.params.code;
  db.collection('codes').findOneAndUpdate( { "code" : code, "used" : false }, 
                                           { $set : { "used" : true, "date_used" : tn } },
                                           ( err, doc ) => {  
                                             let result = (err || doc == null ) ? "error" : "ok";
                                             if ( doc && doc.value == null ) result = "error";
                                             res.send( { "result": result } ); 
                                           });
});

app.get('/list/:use_case', function(req, res){
  var use_case = req.params.use_case;
  var query = db.collection('codes').find( { "use_case" : use_case }, ( err, doc ) => {  
      if (err || doc == null ) {
        res.send( { "result": "error" } ); 
      } else {        
        res.json( util.inspect(doc) );
        // let out = "";
        // console.log(doc);
        // doc.forEach( myDoc => { out += "user: " + myDoc.code; } )
        // res.send( "{}" + out );
      }
    });
});

app.get('/use/:code', function(req, res){
  var code = req.params.code;
  db.collection('codes').findOne( { "downloaded" : true, "code" : code, "used" : false }, ( err, doc ) => {  
      let result = (err || doc == null ) ? "error" : "ok";
      res.send( { "result": result } ); 
    });
});

var port = process.env.PORT || 3000;
http.listen(port, function(){
  console.log('listening on *:' + port);
});
