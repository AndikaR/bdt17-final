let mongoose    = require('./global').mongoose;
let app         = require('./global').app;
let path        = require('./global').path;
let ejs         = require('./global').ejs;
let express     = require('./global').express;
let bodyParser  = require('./global').bodyParser;
let validator   = require('./global').validator;
let cookie      = require('./global').cookie;
let session     = require('./global').session;
let passport    = require('./global').passport;
let flash       = require('./global').flash;

let $middleware = {};

$middleware.init = () => {
  mongoose.set('error', true);
  app.set('views', path.join(__dirname, '../', 'views'));
  app.engine('ejs', ejs.renderFile);
  app.set('view engine', 'ejs');

  //static files
  app.use(express.static(path.join(__dirname, '../','public')));

  app.use('/slide', express.static(path.join(__dirname, '../', 'storage')));
  app.use('/room',  express.static(path.join(__dirname, '../', '/public')));
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

  //Custom middleware
  app.use(function(req, res, next){
    res.locals.success = req.flash('success');
    res.locals.error   = req.flash('error');
    res.locals.old     = req.flash('old');
    next();
  });
};

module.exports = $middleware;