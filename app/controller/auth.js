let passport    = require('../global').passport;
let bcrypt      = require('../global').bcrypt;
let fn          = require('../helper/functions.js');
let memberModel = require('../database.js').model('members');

let c_auth = {};

c_auth.gateway = (req, res) => {
  res.render('auth/gateway');
};

c_auth.login = (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    // A error also means, an unsuccessful login attempt
    let handler = (errors) => {
      req.flash('old', { 'login': req.body.email });

      for (let error of errors) req.flash('error', error);

      return res.redirect(301, '/gateway');
    };

    if (error) handler(error);
    if (!user) handler(['Email or password does not match!']);
    else {
      req.logIn(user, (err) => {
        if (err) { return next(err); }
        
        return res.redirect(301, '/lobby');
      });
    }
  })(req, res, next);
};

c_auth.register = (req, res) => {
  req.assert('name', 'required').notEmpty();
  req.assert('email', 'required').notEmpty();
  req.assert('email', 'valid email required').isEmail();
  req.assert('password', 'required').notEmpty();
  req.assert('password', '3 to 20 characters required').len(3, 20);
  req.assert('password', 'and repassword must be same').isEqual(req.body.repassword);
  req.assert('repassword', 'required').notEmpty();
  req.assert('repassword', '3 to 20 characters required').len(3, 20);

  req.getValidationResult().then((vr) => {
    let handler = (errors) => {
      req.flash('old', {
        'name'  : req.body.name,
        'email' : req.body.email
      });

      for (let error of errors) req.flash('error', error);

      res.redirect(301, '/gateway');
    };

    try {
      if (!vr.isEmpty()) throw vr.array();

      memberModel
      .findAsync({ 'email': req.body.email })
      .then((member) => {
        if (member.length) throw new fn.CustomException(['Member already registered']);
        
        var hash = bcrypt.hashSync(req.body.password, 10);

        var newMember = new memberModel({
          username : req.body.name,
          password : hash,
          email    : req.body.email
        });

        newMember.saveAsync();
        res.redirect('/lobby');
      }).catch((e) => {
        handler(e.message);
      });
    } catch(e) {
      var errors = [];

      e.forEach((element) => {
        errors.push(element.param + ' ' + element.msg);
      }, this);

      handler(errors);
    }
  });
};

c_auth.forgotPassword = (req, res) => {
  res.render('auth/forgot-password');
};

c_auth.deleteAccountView = (req, res) => {
  res.render('auth/delete-account');
};

c_auth.deleteAccount = (req, res) => {
  req.assert('email', 'required').notEmpty();
  req.assert('email', 'valid email required').isEmail();
  req.assert('password', 'required').notEmpty();

  req.getValidationResult().then((vr) => {
    let handler = (errors) => {
      req.flash('old', {
        'email' : req.body.email
      });

      for (let error of errors) req.flash('error', error);

      res.redirect(301, '/delete-account');
    };

    try {
      if (!vr.isEmpty()) throw vr.array();

      memberModel
      .findAsync({ 'email': req.body.email })
      .then((member) => {
        if (!member.length) throw new fn.CustomException(['Member does not exist!']);

        bcrypt.compare(req.body.password, member[0].password, (err, pass) => {
          if(!pass || err) {
            req.flash('error', 'Password does not match!');
            res.redirect('/delete-account');
          } else {
            memberModel.remove({
              'email' : req.body.email
            }, (err, result) => {
              req.flash('success', 'Your account has been deleted successfuly!');
              res.redirect('/gateway');
            });
          }
        });
      }).catch((e) => {
        handler(e.message);
      });
    } catch(e) {
      let errors = [];

      e.forEach((element) => {
        errors.push(element.param + ' ' + element.msg);
      }, this);

      handler(errors);
    }
  });
};

c_auth.logout = (req, res) => {
  req.logout();
  res.redirect('/gateway');
};

module.exports = c_auth;