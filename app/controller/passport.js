let passport    = require('../global').passport;
let bcrypt      = require('../global').bcrypt;
let fn          = require('../helper/functions');
let memberModel = require('../database').model('members');

let LocalStrategy = require('../global').LocalStrategy;

let c_passport = {};

c_passport.serialize = (user, done) => {
  done(null, user.id);
};

c_passport.deserialize = (user, done) => {
  memberModel.findById(user, (err, user) => {
    let data = {};

    data.id    = user.id;
    data.name  = user.username;
    data.email = user.email;
    
    data.last_room = {
      is_admin: 0,
      room_id: 0
    };

    done(err, data);
  });
};

c_passport.LocalStrategy = new LocalStrategy({
  usernameField     : 'email',
  passwordField     : 'password',
  passReqToCallback : true
}, (req, username, password, done) => {
  memberModel.findOne({ 
    'email': username 
  }, (err, user) => {
    if (err) return done(err);
    if (!user) return done(null, false);
    else {
      bcrypt.compare(password, user.password, (err, res) => {
        if (!res) return done(null, false);
        else return done(null, user);
      });
    }
  });
});

module.exports = c_passport;