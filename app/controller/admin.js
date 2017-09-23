let fn         = require('../helper/functions.js');
let socket     = require('../helper/socket.js');
let fse        = require('../global.js').fse;
let path       = require('../global.js').path;
let dateTime   = require('../global.js').dateTime;
let pdf2image  = require('../global.js').pdf2image;
let formidable = require('../global.js').formidable;
let c_admin    = {};

let lobby_io  = socket.lobby_io;
let room_list = socket.room_list;
let dir       = path.join(__dirname, '../../','/storage');

c_admin.index = (req, res) => {
  let host = fn.getHost(req);
  res.render('admin', { host: host });
};

c_admin.fileUpload = (req, res) => {
  let host = fn.getHost(req);
  let form = formidable.IncomingForm();
  let room_id  = req.params.room_id;
  let room_dir = dir + '/' + room_id;

  fse.ensureDir(dir, err => {
    if (err) res.send({ error: 'An error occured, please try again!' });

    fse.ensureDir(room_dir, err => {
      if (err) res.send({ error: 'An error occured, please try again!' });
      nextProcess();
    });
  });

  function nextProcess() {
    form.uploadDir      = dir;
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) res.send({ error: 'An error occured, please try again!' });
    });

    form.on('file', (name, file) => {
      fn.rmDir(room_dir);

      let dt        = dateTime.create();
      let curr_date = dt.format('Y_m_d');
      let fname     = room_dir + '/' + curr_date + '.pdf';

      fse.rename(file.path, fname, () => {
        pdf2image.convertPDF(fname,{
          density : 110,
          quality : 70,
          outputFormat : room_dir + '/%d',
          outputType : 'jpg'
        }).then((pageList) => {
          fse.readdir(room_dir, (err, list) => {
            if (err) res.send({ error: err.message });
            let result = socket.getSlides(list, room_dir);

            room_list[room_id].current = '#slide-0';
            lobby_io.in(room_id).emit('update_slide', { hash: room_list[room_id].current, slides: result });
            
            res.send({ success: 'Completed' });
          });
        }).catch((error) => {
          res.send({ error: error });
        });
      });
    });
  }
};

module.exports = c_admin;