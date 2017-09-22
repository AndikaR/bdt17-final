let mongoose   = require('./global').mongoose;
let loadSchema = require('./schema/_loader');
let $database  = {};

let conn = mongoose.createConnection(
  'mongodb://heroku_4fzm9pht:m5m5rosbjh401nanhtgb1bi2jh@ds117913.mlab.com:17913/heroku_4fzm9pht', //heroku
  //'mongodb://localhost/online_presentation', //localhost 
  { useMongoClient: true }
);

loadSchema();

$database.connect = () => {
  conn.on('error', function (err) { console.log('Database not connected: ' + err); });
  conn.once('open', function (callback) { console.log('Database connected!'); });
};

$database.model = (modelName) => {
  return conn.model(modelName);
};

module.exports = $database;