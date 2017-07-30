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
var dateTime   = require('node-datetime');

var mongoose      = require('bluebird').promisifyAll(require('mongoose'));
var LocalStrategy = require('passport-local').Strategy;

mongoose.set('error', true);
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/slide', express.static(path.join(__dirname, 'storage')));
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
//---------------end of mongoose---------------

var port = process.env.PORT || 8080;
server.listen(port);

var online_client = [];
var room_list     = {};

var online  = 0;
var current = '#';
var dir     = path.join(__dirname, '/storage');

//---------------functions---------------
function update_slide(socket, room_dir, room_id) {
  fse.readdir(room_dir, (err, list) => {
    if (err) console.log(err);
    var data = getSlides(list, room_dir);

    socket.in(room_id).emit('update_slide', data);
  });
}

function getSlides(list, room_dir) {
  data = { list: [], mtime: [] };

  if (typeof list != 'undefined') {
    for (content of list) {
      data.list.push(content);
      data.mtime.push(fse.statSync(room_dir + '/' + content).mtime.getTime());
    }
  }

  return data;

  /*
  lobby_io.in(room_id).emit('update_slide', data);
  
  current = '#slide-0';
  */
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
      if (list.length === Object.keys(room_list).length)
        lobby_io.emit('res_available_room', list.join(''));
    }

    for (var room in room_list) {
      let data  = room_list[room];
      data.id   = room;

      ejs.renderFile(__dirname + '/views/lobby/room-list.ejs', data, function(err, str){
        list.push(str);
        checkList();
      }); 
    }
  });

  socket.on('join_room', function(data){
    socket.join(data.room);
    var room_dir = dir + '/' + data.room;

    if (room_list[data.room].admin.id == data.id) {
      ejs.renderFile(
        __dirname + '/views/room/admin-panel.ejs',
        function(err, str){
          fse.readdir(room_dir, function(err, files){
            var result = getSlides(files, room_dir);

            lobby_io.in(data.room).emit('access_granted', { html: str, slides: result });
          });
        }
      );
    } else {
      fse.readdir(room_dir, function(err, files){
        var data = getSlides(files, room_dir);

        lobby_io.in(data.room).emit('load_slides', { slides: data });
      });
    }
  });

  socket.on('create_room', function(data){
    if (!room_list.hasOwnProperty(data.id)) {
      room_list[data.id] = { 
        name: data.name,
        admin: data.admin 
      };

      var room_dir = dir + '/' + data.id;

      fse.ensureDir(room_dir, (err) => {
        rmDir(room_dir); //clear directory before used
        lobby_io.emit('room_created', data.id);
      });
    } else lobby_io.emit('room_exists', 'Room with ID : ' + data.id + ' is not available');
  });

  socket.on('disconnect', function(data){
    delete online_client[socket.key];
  });

  socket.on('chat_message', function(data){
    lobby_io.in(data.room).emit('chat_message', data.message); 
  });

  socket.on('admin_request', function(data){
    switch(data.eventName) {
      case 'mouse_toggle' : lobby_io.in(data.room).emit('mouse_toggle_update', data.content); break;
      default : lobby_io.in(data.room).emit('admin_response', data.eventName); break; 
    }
  });

  socket.on('change_current', function(data){
    if (data.hash !== '') {
      current = data.hash;
      lobby_io.in(data.room).emit('force_hash', current);
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

app.post('/admin/file-upload/:room_id', loggedIn, function(req, res){
  var host = getHost(req);
  var form = formidable.IncomingForm();
  var room_id  = req.params.room_id;
  var room_dir = dir + '/' + room_id;

  fse.ensureDir(dir, err => {
    if (err) res.send({ error: 'An error occured, please try again!' });

    fse.ensureDir(room_dir, err => {
      if (err) res.send({ error: 'An error occured, please try again!' });
      nextProcess();
    });
  });

  function nextProcess() {
    form.uploadDir = dir;
    form.keepExtensions = true;

    form.parse(req, function(err, fields, files) {
      if (err) res.send({ error: 'An error occured, please try again!' });
    });

    form.on('file', function(name, file) {
      rmDir(room_dir);

      var dt        = dateTime.create();
      var curr_date = dt.format('Y_m_d');
      var fname     = room_dir + '/' + curr_date + '.pdf';

      fse.rename(file.path, fname, function(){
        pdf2image.convertPDF(fname,{
          density : 200,
          quality : 100,
          outputFormat : room_dir + '/%d',
          outputType : 'jpg'
        }).then(function(pageList) {
          fse.readdir(room_dir, (err, list) => {
            if (err) res.send({ error: err.message });
            var data = getSlides(list, room_dir);

            lobby_io.in(room_id).emit('update_slide', data);
            
            current = '#slide-0';
            res.send({ success: 'Completed' });
          });
        });
      });
    });
  }
});

app.get('/', function(req, res){
  var host = getHost(req);
  res.render('index', { hash: current, host: host });
});

app.get('/room/:room_id', loggedIn, function(req, res){
  var host     = getHost(req);
  var room_id  = req.params.room_id;
  var found    = false;
  var user     = req.user;

  for (var room in room_list) {
    if (room == room_id) {
      found = true;
      break;
    }
  }

  if (!found) {
    return res.redirect('/lobby');
  } else {
    res.render('room', { 
      host: host, 
      user: user, 
      room_id: room_id
    });
  }
});

app.get('/lobby', loggedIn, function(req, res){
  var host = getHost(req);
  res.render('lobby/index', { host: host, user: req.user });
});

app.get('/slide/:room_id/:img', function(req, res){
  var img     = req.params.img;
  var room_id = req.params.room_id;
 
  if (!img) console.log('Error!');

  res.writeHead(200, { 'Content-Type': mime.lookup(img) });
  res.end(dir + '/' + room_id + '/' + img); // Send the file data to the browser.
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
    var data = {};

    data.id    = user.id;
    data.name  = user.username;
    data.email = user.email;

    done(err, data);
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