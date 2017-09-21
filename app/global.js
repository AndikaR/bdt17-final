let $global = {};

$global.express    = require('express');
$global.session    = require('express-session');
$global.validator  = require('express-validator');
$global.mailer     = require('express-mailer');
$global.path       = require('path');
$global.app        = $global.express();
$global.server     = require('http').Server($global.app);
$global.io         = require('socket.io')($global.server);
$global.ejs        = require('ejs');
$global.cookie	   = require('cookie-parser');
$global.formidable = require('formidable');
$global.fse        = require('fs-extra');
$global.flash      = require('connect-flash');
$global.pdf2image  = require('pdf2image');
$global.mime       = require('mime');
$global.passport   = require('passport');
$global.bodyParser = require('body-parser');
$global.bcrypt     = require('bcrypt');
$global.dateTime   = require('node-datetime');
$global.jdenticon  = require('jdenticon');

$global.mongoose      = require('bluebird').promisifyAll(require('mongoose'));
$global.LocalStrategy = require('passport-local').Strategy;

module.exports = $global;

