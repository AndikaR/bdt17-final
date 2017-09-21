let fn         = require('../helper/functions');
let lobby_io   = require('../helper/socket').lobby_io;
let room_list  = require('../helper/socket').room_list;
let path       = require('../global').path;
let formidable = require('../global').formidable;
let c_user     = {};

let dir = path.join(__dirname, '../../', '/storage');

c_user.index = (req, res) => {
  res.redirect('/lobby');
};

c_user.room = (req, res) => {
  let host    = fn.getHost(req);
  let room_id = req.params.room_id;
  let found   = false;
  let user    = req.user;

  for (let room in room_list) {
    if (room == room_id) {
      found = true;
      break;
    }
  }

  if (!found) {
    return res.redirect('/lobby?status=2');
  } else {
    let last_room = req.session.last_room;
    let is_admin  = req.session.is_admin;
    let email     = req.user.email;

    if (email in room_list[room_id].room_user) {
      if (last_room && last_room != room_id) {
        if (is_admin) {
          //emit event to destroy room, kick user to lobby
          lobby_io.in(last_room).emit('room_deleted');
          lobby_io.emit('room_removed', { room_id: last_room });
          delete room_list[last_room];
        } else {
          delete room_list[last_room].room_user[email];
        }

        req.session.is_admin = 0;
      } else {
        req.session.is_admin = room_list[room_id].room_user[email];
      }
    } else {
      room_list[room_id].room_user[email] = 0;
      req.session.is_admin = 0;
    }
    
    req.session.last_room = room_id;

    res.render('room/index', { 
      host: host, 
      user: JSON.stringify(user), 
      room_id: room_id
    });
  }
};

c_user.lobby = (req, res) => {
  let host = fn.getHost(req);

  let last_room = req.session.last_room;
  let is_admin  = req.session.is_admin;
  let email     = req.user.email;
  let status    = req.query.status || 0;

  if (last_room > 0) {
    if (is_admin) {
      //emit event to destroy room, kick user to lobby
      lobby_io.in(last_room).emit('room_deleted');
      lobby_io.emit('room_removed', { room_id: last_room });
      delete room_list[last_room];
    } else {
      if (room_list[last_room] !== undefined) {
        delete room_list[last_room].room_user[email];
      }
    }

    req.session.is_admin  = 0;
    req.session.last_room = 0;
  }

  res.render('lobby/index', { 
    host: host, 
    user: JSON.stringify(req.user),
    status: status 
  });
};

c_user.slide = (req, res) => {
  let img     = req.params.img;
  let room_id = req.params.room_id;

  if (!img) console.log('Error!');

  res.writeHead(200, { 'Content-Type': mime.lookup(img) });
  res.end(dir + '/' + room_id + '/' + img); // Send the file data to the browser.
};

module.exports = c_user;