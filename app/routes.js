let app      = require('./global').app;
let passport = require('./global').passport;
let fn       = require('./helper/functions.js');

//controllers
let auth   = require('./controller/auth.js');
let admin  = require('./controller/admin.js');
let user   = require('./controller/user.js');
let cpass  = require('./controller/passport.js');
let assets = require('./controller/assets.js');

let $routes = {};

$routes.init = () => {
  //admin
  //app.get('/admin', admin.index);
  app.post('/admin/file-upload/:room_id', fn.loggedIn, admin.fileUpload);
  
  //user
  app.get('/', fn.loggedIn, user.index);
  app.get('/room/:room_id', fn.loggedIn, user.room);
  app.all('/lobby', fn.loggedIn, user.lobby);
  app.get('/slide/:room_id/:img', fn.loggedIn, user.slide);
  
  //auth
  app.get('/gateway', fn.checkLogged, auth.gateway);
  app.post('/login', fn.checkLogged, auth.login);
  app.post('/register', fn.checkLogged, auth.register);
  //app.get('/forgot-password', fn.checkLogged, auth.forgotPassword);
  app.get('/delete-account', fn.checkLogged, auth.deleteAccountView);
  app.post('/delete-account', fn.checkLogged, auth.deleteAccount);
  app.get('/logout', fn.loggedIn, auth.logout);

  //passport
  passport.serializeUser(cpass.serialize);
  passport.deserializeUser(cpass.deserialize);
  passport.use('local', cpass.LocalStrategy);
};

module.exports = $routes;