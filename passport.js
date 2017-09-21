module.exports = {
  passport: null,
  strategy: null,
  init: function(passport, LocalStrategy){
    this.passport = passport;
    this.strategy = LocalStrategy;

    this.fn(passport, LocalStrategy);
  },
  fn: function(passport, LocalStrategy) {
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
  }, 
  auth: function auth(req, res, next) {
    this.passport.authenticate('local', function (error, user, info){
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
  }
}