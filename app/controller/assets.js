let c_assets = {};

let fn   = require('../helper/functions.js');
let path = require('../global.js').path;

c_assets.css = (req, res) => {
  getCss(res, req, 'canvas');
};

c_assets.js = (req, res) => {
  getJs(res, req, 'canvas');
};

c_assets.image = (req, res) => {
  getImage(res, req, 'canvas');
};

let getCss = (res, req, root) => {
  res.setHeader('Content-Type', 'text/css');
  res.setHeader('Cache-Control', 'public, max-age=2592000');
  res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
  
  res.sendFile(path.join(__dirname, '../../', 'public/' + root + '/css/' + req.params.css_file));
};

let getJs = (res, req, root) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=2592000');
  res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
  
  res.sendFile(path.join(__dirname, '../../', 'public/' + root + '/js/' + req.params.js_file));
};

let getImage = (res, req, image_name, root) => {
  let image = req.params.image_file;

  res.setHeader('Content-Type', fn.getMimeType(image));
  res.setHeader('Cache-Control', 'public, max-age=2592000');
  res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());

  res.sendFile(path.join(__dirname, '../../','public/' + root + '/js/' + image_name));
};

module.exports = c_assets;