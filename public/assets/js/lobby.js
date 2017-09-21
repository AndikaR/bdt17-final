(function(){
  var status = $('#room-status').val();
  var host   = $('#host').val();
  var socket = io.connect(host + '/lobby');
  var user   = JSON.parse($('#user').val());

  if (status == '1') {
    $('#kickModal').modal('show');
  } else if (status == '2') {
    $('#notRoomModal').modal('show');
  }

  socket.emit('req_available_room', { user: user.id });

  socket.on('room_removed', function(data){
    $('#portfolio #' + data.room_id).remove();
  });

  socket.on('res_available_room', function(data){
    if (data.user == user.id) {
      setTimeout(function(){ 
        $('#portfolio').append(data.list); 
      }, 1);
    }
  });

  socket.on('append_room', function(data){
    $('#portfolio').append(data.room);
  });

  socket.on('room_exists', function(data){
    if (data.user == user.id) {
      $('#room-error').text(data.message);
      $('.room-error').show();
    }
  });

  socket.on('room_created', function(data){
    if (user.id == data.admin) {
      $('.room-error').hide();
      window.location = '/room/' + data.room;
    }
  });

  $('#c-room').on('click', function(){
    var room_id   = $('#room-id').val();
    var room_name = $('#room-name').val();

    socket.emit('create_room', { 
      id: room_id, 
      name: room_name,
      admin: JSON.stringify(user)
    });
  });
})(jQuery);