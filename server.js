var express    = require('express');
var session    = require('express-session');
var validator  = require('express-validator');
var mailer     = require('express-mailer');
var path       = require('path');
var app        = express();
var server     = require('http').Server(app);
var io         = require('socket.io')(server);
var ejs        = require('ejs');
var cookie	   = require('cookie-parser');
var formidable = require('formidable');
var fse        = require('fs-extra');
var flash      = require('connect-flash');
var pdf2image  = require('pdf2image');
var mime       = require('mime');
var passport   = require('passport');
var bodyParser = require('body-parser');
var bcrypt     = require('bcrypt');

var mongoose      = require('bluebird').promisifyAll(require('mongoose'));
var LocalStrategy = require('passport-local').Strategy;

mongoose.set('error', true);
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/slide', express.static(path.join(__dirname, 'storage/slides')));
app.use('/room',  express.static(path.join(__dirname, '/public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(validator({
  customValidators: {
    isArray: function(value) {
      return Array.isArray(value);
    },
    gte: function(value, num) {
      return value >= num;
    },
    isEqual: function(value, param) {
      return value === param;
    }
 }
}));
app.use(cookie());
app.use(session({ 
  secret: 'randomfacts',
  cookie: { maxAge: 600000 },
  rolling: true,
  resave: true, 
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//---------------mongoose---------------
mongoose.model('members', new mongoose.Schema({
  username: String,
  password: String,
  email: String
}, {
  collection: 'members'
}));

var conn = mongoose.createConnection(
  'mongodb://localhost/online_presentation', 
  { useMongoClient: true }
);

var memberModel = conn.model('members');

conn.on('error', function (err) { console.log('Database not connected: ' + err); });
conn.once('open', function (callback) { console.log('Database connected!'); });

/*
memberModel.findOne({ 'username': 'admin' }, 'username password', function (err, user) {
  if (err) return handleError(err);
  console.log('%s %s', user.username, user.password);
});
*/
//---------------end of mongoose---------------

var port = process.env.PORT || 8080;
server.listen(port);

var online_client = [];
var room_list     = [];

var online  = 0;
var current = '#';
var dir     = path.join(__dirname, '/storage');

//---------------functions---------------
function update_slide(socket) {
  fse.readdir(dir + '/slides', (err, list) => {
    if (err) console.log(err);
    data = { list: [], mtime: [] };

    for (content of list) {
      data.list.push(content);
      data.mtime.push(fse.statSync(dir + '/slides/' + content).mtime.getTime());
    }

    socket.emit('update_slide', data);
  });
}

function rmDir(dirPath, removeSelf = false) {
  try { var files = fse.readdirSync(dirPath); }
  catch(e) { return; }
  
  if (files.length) {
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fse.statSync(filePath).isFile())
        fse.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
  }
    
  if (removeSelf) fse.rmdirSync(dirPath);
}

function loggedIn(req, res, next) {
  if (req.user) next();
  else res.redirect('/gateway');
}

function getHost(req) {
  return req.protocol + '://' + req.headers.host;
}

function CustomException(message) {
  this.message = message;
  this.name = 'CustomException';
}

//---------------end of functions---------------
var admin_io  = io.of('/admin');
var client_io = io.of('/client');
var lobby_io  = io.of('/lobby');

lobby_io.on('connection', function(socket){
  socket.key = socket.conn.remoteAddress;
  online_client[socket.key] = socket;

  socket.on('req_available_room', function(){
    var list = [];

    function checkList() {
      if (list.length === room_list.length) handleSuccess();
    }

    function handleSuccess() {
      lobby_io.emit('res_available_room', list.join(''));
    }

    for (room of room_list) {
      var html = ejs.renderFile(__dirname + '/views/lobby/room-list.ejs', room, function(err, str){
        list.push(str);
        checkList();
      }); 
    }
  });

  socket.on('join_room', function(room){
    socket.join(room);
  });

  socket.on('create_room', function(data){
    if (!room_list.hasOwnProperty(data.id)) {
      room_list.push({ id: data.id, name: data.name });
      
      lobby_io.emit('room_created', data.id);
    } else lobby_io.emit('room_exists', 'Room with ID : ' + data.id + ' is not available');
  });

  socket.on('disconnect', function(data){
    delete online_client[socket.key];
  });
});

admin_io.on('connection', function(socket){
  socket.on('mouse_position', function(data) {
    client_io.emit('mouse_position_update', data);
  });

  socket.on('admin_request', function(data){
    switch(data.eventName) {
      case 'mouse_toggle' : client_io.emit('mouse_toggle_update', data.content); break;
      default : client_io.emit('admin_response', data.eventName); break; 
    }
  });
});

client_io.on('connection', function(socket){
  socket.key = socket.conn.remoteAddress;
  online_client[socket.key] = socket;
  /*
  client_io.clients((error, clients) => {
    if (error) throw error;
    console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
  });
  */

  ++online;
  client_io.emit('online_counter', Object.keys(online_client).length);
  update_slide(client_io);

  socket.on('illegal_hash', function(){    
    client_io.emit('force_hash', current);
  });

  socket.on('disconnect', function(data){
    delete online_client[socket.key];

    --online;
    if (Object.keys(online_client).length > 1)
      client_io.emit('online_counter', Object.keys(online_client).length);
    else {
      current = '#';
      client_io.emit('force_hash', current);
    }
  });

  socket.on('chat_message', function(msg){ client_io.emit('chat_message', msg); });
  socket.on('change_username', function(msg){ client_io.emit('change_username', msg); });

  socket.on('change_current', function(data){
    if (data.hash !== '') {
      current = data.hash;
      client_io.emit('force_hash', current);
    }
  });
});

console.log('Your presentation is running on http://localhost:' + port);

//Middleware
app.use(function(req, res, next){
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  res.locals.old     = req.flash('old');
  next();
});

//Routes
app.get('/admin', function(req, res){
  var host = getHost(req);
  res.render('admin', { host: host });
});

app.post('/admin/file-upload', loggedIn, function(req, res){
  var host = getHost(req);
  var form = formidable.IncomingForm();

  fse.ensureDir(dir, err => {
    if (err) req.flash('error', 'An error occured, please try again!');

    fse.ensureDir(dir + '/slides', err => {
      if (err) req.flash('error', 'An error occured, please try again!');
    });
  });

  form.uploadDir = dir;
  form.keepExtensions = true;

  form.parse(req, function(err, fields, files) {
    if (err) req.flash('error', 'An error occured, please try again!');
  });

  form.on('file', function(name, file) {
    rmDir(dir + '/slides');

    pdf2image.convertPDF(file.path,{
      density : 200,
      quality : 100,
      outputFormat : '%p/slides/%d',
      outputType : 'jpg'
    }).then(function(pageList) {
      update_slide(io.sockets);
      current = '#';
    });
  });

  form.on('end', function(){
    req.flash('success', 'Completed');
  });

  res.redirect(301, '/admin');
});

app.get('/', function(req, res){
  var host = getHost(req);
  res.render('index', { hash: current, host: host });
});

app.get('/room/:room_id', loggedIn, function(req, res){
  var host    = getHost(req);
  var room_id = req.params.room_id;
  var found   = false;

  for (var i = 0; i < room_list.length; i++) {
    if (room_list[i].id == room_id) {
      found = true;
      break;
    }
  }

  if (!found) {
    return res.redirect('/lobby');
  } else {
    res.render('room', { host: host, user: req.user, room_id: room_id });
  }
});

app.get('/lobby', loggedIn, function(req, res){
  var host = getHost(req);
  res.render('lobby/index', { host: host, user: req.user });
});

app.get('/slide/:img', function(req, res){
  var img = req.params.img; 
  if (!img) console.log('Error!');

  res.writeHead(200, { 'Content-Type': mime.lookup(img) });
  res.end(dir + '/slides/' + img); // Send the file data to the browser.
});

app.get('/gateway', function(req, res) {
  res.render('auth/gateway');
});

app.post('/login', function(req, res, next) {
  passport.authenticate('local', function (error, user, info){
    // A error also means, an unsuccessful login attempt
    var handler = function(errors) {
      req.flash('old', { 'login': req.body.email });

      for (var error of errors) req.flash('error', error);

      return res.redirect(301, '/gateway');
    };

    if (error) handler(error);
    if (!user) handler(['Email or password does not match!']);
    else {
      req.logIn(user, function(err) {
        if (err) { return next(err); }
        
        return res.redirect(301, '/lobby');
      });
    }
  })(req, res, next);
});

app.post('/register', function(req, res) {
  req.assert('name', 'required').notEmpty();
  req.assert('email', 'required').notEmpty();
  req.assert('email', 'valid email required').isEmail();
  req.assert('password', 'required').notEmpty();
  req.assert('password', '3 to 20 characters required').len(3, 20);
  req.assert('password', 'and repassword must be same').isEqual(req.body.repassword);
  req.assert('repassword', 'required').notEmpty();
  req.assert('repassword', '3 to 20 characters required').len(3, 20);

  req.getValidationResult().then(function(vr) {
    var handler = function(errors) {
      req.flash('old', {
        'name'  : req.body.name,
        'email' : req.body.email
      });

      for (var error of errors) req.flash('error', error);

      res.redirect(301, '/gateway');
    };

    try {
      if (!vr.isEmpty()) throw vr.array();

      memberModel
      .findAsync({ 'email': req.body.email })
      .then(function(member){
        if (member.length) throw new CustomException(['Member already registered']);
        
        var hash = bcrypt.hashSync(req.body.password, 10);

        var newMember = new memberModel({
          username : req.body.name,
          password : hash,
          email    : req.body.email
        });

        newMember.saveAsync();
        res.redirect('/admin');
      }).catch(function(e){
        handler(e.message);
      });
    } catch(e) {
      var errors = [];

      e.forEach(function(element) {
        errors.push(element.param + ' ' + element.msg);
      }, this);

      handler(errors);
    }
  });
});

app.get('/forgot-password', function(req, res) {
  res.render('auth/forgot-password');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/gateway');
});

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(user, done) {
  memberModel.findById(user, function(err, user) {
    done(err, user);
  });
});

passport.use('local', new LocalStrategy({
  usernameField     : 'email',
  passwordField     : 'password',
  passReqToCallback : true
}, function(req, username, password, done) {
  memberModel.findOne({ 
    'email': username 
  },function (err, user) {
    if (err) return done(err);
    if (!user) return done(null, false);
    else {
      bcrypt.compare(password, user.password, function(err, res) {
        if (!res) return done(null, false);
        else return done(null, user);
      });
    }
  });
}));

//proc file web: node index.js