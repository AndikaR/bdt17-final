let io        = require('../global.js').io;
let fse       = require('../global.js').fse;
let ejs       = require('../global.js').ejs;
let jdenticon = require('../global.js').jdenticon;
let path      = require('../global.js').path;
let fn        = require('./functions.js');

let $socket = {};

$socket.online_client = [];
$socket.room_list     = {};
$socket.online        = 0;
$socket.lobby_io      = io.of('/lobby');

let ejs_dir = (suffix) => { return path.join(__dirname, '../../', suffix) };
let dir     = ejs_dir('/storage');

$socket.init = () => {
  $socket.lobby_io.on('connection', function(socket){
    socket.key = socket.conn.remoteAddress;
    $socket.online_client[socket.key] = socket;

    socket.on('req_available_room', function(data){
      let list = [];

      function checkList() {
        if (list.length === Object.keys($socket.room_list).length)
          $socket.lobby_io.emit('res_available_room', { user: data.user, list: list.join('') });
      }

      for (let room in $socket.room_list) {
        let data  = $socket.room_list[room];
        data.id   = room;

        ejs.renderFile(ejs_dir('/views/lobby/room-list.ejs'), data, function(err, str){
          list.push(str);
          checkList();
        }); 
      }
    });

    socket.on('join_room', function(data){
      socket.join(data.room);
      let room_dir = dir + '/' + data.room;

      if ($socket.room_list[data.room].admin.id == data.id) {
        ejs.renderFile(
          ejs_dir('/views/room/admin-panel.ejs'),
          function(err, str){
            fse.readdir(room_dir, function(err, files){
              let result = $socket.getSlides(files, room_dir);

              $socket.lobby_io.in(data.room).emit('access_granted', { admin: data.id, html: str, slides: result });
            });
          }
        );
      } else {
        fse.readdir(room_dir, function(err, files){
          let result = $socket.getSlides(files, room_dir);

          $socket.lobby_io.in(data.room).emit('load_slides', { caller: data.id, slides: result, hash: $socket.room_list[data.room].current });
        });
      }
    });

    socket.on('create_room', function(data){
      let admin_data = JSON.parse(data.admin);

      if (data.name == '' || data.id == '') {
        $socket.lobby_io.emit('room_exists', { 
          user: admin_data.id, 
          message: 'Room ID or name cannot be empty.' 
        });
      } else if (data.id < 1 || data.id > 999) {
        $socket.lobby_io.emit('room_exists', { 
          user: admin_data.id, 
          message: 'Room ID must be between 1 - 999' 
        });
      } else if (!$socket.room_list.hasOwnProperty(data.id)) {
        let identicon  = jdenticon.toPng(data.id, 100);
        let room_user  = {};

        room_user[admin_data.email] = 1; //1 for admin, 0 for user

        $socket.room_list[data.id] = { 
          name: data.name,
          admin: admin_data,
          current: '#',
          room_user: room_user,
          identicon: identicon.toString('base64')
        };

        let room_dir = dir + '/' + data.id;

        fse.ensureDir(room_dir, (err) => {
          fn.rmDir(room_dir); //clear directory before used

          let new_room  = $socket.room_list[data.id];
          new_room.id   = data.id;

          ejs.renderFile(ejs_dir('/views/lobby/room-list.ejs'), new_room, function(err, str){
            $socket.lobby_io.emit('append_room', { room: str, room_id: data.id });
          }); 

          $socket.lobby_io.emit('room_created', { room: data.id, admin: admin_data.id });
        });
      } else {
        $socket.lobby_io.emit('room_exists', { 
          user: admin_data.id, 
          message: 'Room with ID : ' + data.id + ' is not available' 
        });
      }
    });

    socket.on('room_deleted', function(data){
      delete $socket.room_list[data.room_id];
      
      $socket.lobby_io.in(data.room_id).emit('room_deleted');
      $socket.lobby_io.emit('room_removed', { room_id: data.room_id });
    });

    socket.on('disconnect', function(data){
      delete $socket.online_client[socket.key];
    });

    socket.on('chat_message', function(data){
      $socket.lobby_io.in(data.room).emit('chat_message', data.message); 
    });

    socket.on('admin_request', function(data){
      switch(data.eventName) {
        case 'mouse_toggle' : $socket.lobby_io.in(data.room).emit('mouse_toggle_update', data.content); break;
        default : $socket.lobby_io.in(data.room).emit('admin_response', data.eventName); break; 
      }
    });

    socket.on('change_current', function(data){
      if (data.hash !== '') {
        $socket.room_list[data.room].current = data.hash;
        $socket.lobby_io.in(data.room).emit('force_hash', data.hash);
      }
    });

    socket.on('illegal_change', function(data) {
      $socket.lobby_io.in(data.room).emit('illegal_result', { 
        current: $socket.room_list[data.room].current, 
        user: data.user
      });
    });

    socket.on('upload_started', function(data){
      $socket.lobby_io.in(data.room).emit('upload_started');
    });

    socket.on('upload_processed', function(data){
      $socket.lobby_io.in(data.room).emit('upload_processed', { ratio: data.ratio });
    });

    socket.on('upload_finished', function(data){
      $socket.lobby_io.in(data.room).emit('upload_finished');
    });
  });
};

$socket.getSlides = (list, room_dir) => {
  data = { list: [], mtime: [] };

  if (typeof list != 'undefined') {
    for (content of list) {
      data.list.push(content);
      data.mtime.push(fse.statSync(room_dir + '/' + content).mtime.getTime());
    }
  }

  return data;
};

$socket.updateSlide = (socket, room_dir, room_id) => {
  fse.readdir(room_dir, (err, list) => {
    if (err) console.log(err);
    var data = $socket.getSlides(list, room_dir);

    socket.in(room_id).emit('update_slide', data);
  });
}

module.exports = $socket;