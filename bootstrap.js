let $middleware = require('./app/middleware');
let $database   = require('./app/database');
let $routes     = require('./app/routes');
let $socket     = require('./app/helper/socket');
let server      = require('./app/global').server;

$middleware.init();
$database.connect();
$routes.init();
$socket.init();

let port = process.env.PORT || 8082;
server.listen(port);
