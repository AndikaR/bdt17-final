let fse  = require('../global.js').fse;
let path = require('../global.js').path;
let fn   = {};

fn.rmDir = (dirPath, removeSelf = false) => {
  try { var files = fse.readdirSync(dirPath); }
  catch(e) { return; }
  
  if (files.length) {
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fse.statSync(filePath).isFile())
        fse.unlinkSync(filePath);
      else
        fn.rmDir(filePath);
    }
  }
    
  if (removeSelf) fse.rmdirSync(dirPath);
};

fn.loggedIn = (req, res, next) => {
  if (req.user) next();
  else res.redirect('/gateway');
};

fn.checkLogged = (req, res, next) => {
  if (req.user) res.redirect('/lobby');
  else next();
};

fn.getHost = (req) => {
  return req.protocol + '://' + req.headers.host;
};

fn.getMimeType = (filename) => {
  let ext  = path.extname(filename);
  let mime = 'application/octet-stream';

  switch (ext) {
    case '.png' : mime = 'image/png'; break;
    case '.jpg' : 
    case '.jpeg': mime = 'image/jpeg'; break;
    case '.gif' : mime = 'image/gif'; break;
    case '.svg' : mime = 'image/svg+xml'; break;

    default: break;  
  }

  return mime;
};

fn.CustomException = (message) => {
  this.message = message;
  this.name    = 'CustomException';
};

module.exports = fn;
