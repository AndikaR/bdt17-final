(function() {
  var host   = $('#host').val() + '/lobby';
  var socket = io.connect(host);
  var progressBar = $('.progress-bar');

  function initDeck(is_admin) {
    if (is_admin) {
      $.deck.defaults = {
        classes: {
          after: 'deck-after',
          before: 'deck-before',
          childCurrent: 'deck-child-current',
          current: 'deck-current',
          loading: 'deck-loading',
          next: 'deck-next',
          onPrefix: 'on-slide-',
          previous: 'deck-previous'
        },

        selectors: {
          container: '.deck-container',
          slides: '.slide'
        },

        touch: {
          swipeDirection: false,
          swipeTolerance: 60
        },

        initLockTimeout: 1000,
        hashPrefix: 'slide',
        preventFragmentScroll: true,
        setAriaHiddens: true
      }
    }

    $.deck('.slide');
  }

  function leaveRoom(isUpload = false) {
    $(window).unload(function() {
      if (!isUpload) {
        socket.emit('room_deleted', { room_id: room });
      }
    });
  }

  function reloadSlides(slides) {
    var $slides = $('.deck-container');

    $slides.empty();

    if (slides.list.length >= 1) {
      for (var i = 0; i < slides.list.length; i++) {
        var slide = slides.list[i];
        var ext   = slide.split('.').pop();

        if (ext.toLowerCase() !== 'pdf') {
          var html = '';

          html += '<section class="slide">';
          html += '<img src="/slide/' + room + '/' + slide + '" style="width: 100%; height: 100%;">';
          html +=	'</section>';

          $slides.append(html);	
        }
      }
    } else {
      $slides.append('<section class="slide"><h1>No Slide Available</h1></section>');
    }

    $.deck('.slide');
  }

  var $container = $('.deck-container');
  $container.width('100%').height($(window).height() - 129);

  var room = $('input[name=room_number]').val();
  var user = JSON.parse($('#user').val());

  //leaveRoom();

  //Admin state
  var mouse_state = false;

  var prevMouseX, prevMouseY, currMouseX, currMouseY     = 0;
  var prevScreenX, prevScreenY, currScreenX, currScreenY = 0; 
  //End of Admin state

  // Admin and User
  socket.emit('join_room', { room: room, id: user.id });

  socket.on('access_granted', function(data){
    if (user.id == data.admin) {
      $('.ctrl-panel').append(data.html).show();
      initDeck(true);
      admin_privileges();
      reloadSlides(data.slides);
    }
  });

  socket.on('force_hash', function(currentHash){
    window.location.hash = currentHash;
  });

  socket.on('load_slides', function(data){
    if (user.id == data.caller) {
      initDeck(true);
      user_privileges();
      reloadSlides(data.slides);
      window.location.hash = data.hash;
    }
  });

  socket.on('admin_response', function(eventName){ 
    $.deck(eventName); 
    socket.emit('change_current', { hash: location.hash, room: room }); 
  });

  socket.on('update_slide', function(data){
    reloadSlides(data.slides);
    window.location.hash = data.hash;
    //leaveRoom(false);
    location.reload();
  });

  $('ul.chat-ul li a#toggle_chat').click(function(e) {
    e.preventDefault();
    $('.chat-list').toggle();
  });

  $('ul.chat-ul li a#toggle_none').click(function(e) {
    e.preventDefault();
    
    $('.ctrl-panel').toggle();
  });

  var key_map = {};
  onkeydown = onkeyup = function(e){
    e = e || event; // to deal with IE
    key_map[e.keyCode] = e.type == 'keydown';
    var isMsgFocus = (key_map[13] && $('#m').is(':focus')); //Enter key

    if (key_map[16] && isMsgFocus) {
      $('#m').val($('#m').val() + '\n');
    } else if (isMsgFocus) {
      emitMessage();
    }
  }

  function emitMessage() {
    socket.emit('chat_message', { 
      message: user.name + ': ' + $('#m').val(),
      room: room
    });
    $('#m').val('');
  }

  $('#sm').click(function(){
    emitMessage();
  });

  socket.on('chat_message', function(msg){
    $('#messages').append($('<li>').html('<p class="white">' + msg + '</p>'));
  });

  var user_privileges = function() {
    var paper = new Raphael(
      $('#canvas-container'), 
      window.width, 
      window.height
    );
    
    var circle = paper.circle(0, 0, 10).attr({ fill: '#fff' });

    circle.hide();

    $(window).on('hashchange', function() {
      socket.emit('illegal_change', { room: room, user: user.id});
    });

    socket.on('upload_started', function(data){
      $('.progress-wrapper').show();
      progressBar.css('width', '0%');
    });

    socket.on('upload_processed', function(data){
      $('#progress-value').text(data.ratio);

      progressBar.css('width', data.ratio);
      progressBar.css('width', '100%');
    });

    socket.on('upload_finished', function(data){
      $('#progress-status').text('Reloading Page...');
      $('#progress-value').text('100%');
      
      progressBar.css('width', '100%');
    });

    socket.on('illegal_result', function(data) {
      if (user.id == data.user) {
        location.hash = data.current;
      }
    });

    socket.on('room_deleted', function(){
      $.redirect(host, {'status': 1}, 'GET');
    });

    socket.on('mouse_toggle_update', function(data){
      if (data) circle.show();
      else circle.hide();
    });

    socket.on('mouse_position_update', function(data){
      circle.animate({
        cx: data.mx * $(window).width(),
        cy: data.my * $(window).height()
      }, 1, 'linear');
    });

    socket.on('online_counter', function(val){
      $('#online').text(val);
    });

    $(window).on('hashchange', function(){
      socket.emit('illegal_hash');
    });
  };

  var admin_privileges = function() {
    window.setInterval(function(){
      if (mouse_state) {
        $("body").mousemove(function(e) {
          currMouseX = e.pageX;
          currMouseY = e.pageY;
          currScreenX = e.screenX;
          currScreenY = e.screenY;
        });

        if (prevMouseX !== currMouseX || prevMouseY !== currMouseY) {
          var newX = (prevMouseX * currScreenX) / prevScreenX;
          var newY = (prevMouseY * currScreenY) / prevScreenY;

          prevMouseX = currMouseX;
          prevMouseY = currMouseY;

          prevScreenX = currScreenX;
          prevScreenY = currScreenY;

          socket.emit('mouse_position', { 
            mx: (newX / $(window).width()), 
            my: (newY / $(window).height())
          });
        }
      }
    }, 100);

    function toggle_mouse() {
      $icon = $('.mouse-toggle').find('.mouse');

      if (!mouse_state) $icon.css('color', 'green');
      else $icon.css('color', 'red');

      mouse_state = !mouse_state;
      socket.emit('admin_request', { eventName: 'mouse_toggle', content: mouse_state });
    };

    $(document).keydown(function(event){
      if (event.which == "17") toggle_mouse(); //ctrl key
    });

    $('.mouse-toggle').on('click', function(){
      toggle_mouse();
    });

    $('.ctrl-panel').on('click', '#upload-file', function(){
      $('#pdf-file').trigger('click');
    });

    $('.ctrl-panel').on('click', '#pdf-upload', function(){
      var formData = new FormData($('form#pdf-upload-form').get(0));
      
      $('.progress-wrapper').show();

      //https://zinoui.com/blog/ajax-request-progress-bar
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/admin/file-upload/' + room, true);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var ratio = Math.floor((e.loaded / e.total) * 100) + '%';
          $('#progress-value').text(ratio);
          
          progressBar.attr('aria-valuenow', e.loaded).css('width', ratio);
          progressBar.attr('aria-valuemax', e.total).css('width', '100%');
          socket.emit('upload_processed', { ratio: ratio, room: room });
        }
      }

      xhr.upload.onloadstart = function (e) {
        progressBar.attr('aria-valuenow', 0).css('width', '0%');
        socket.emit('upload_started', { room: room });
      }

      xhr.upload.onloadend = function (e) {
        $('#progress-value').text('100%');
        progressBar.attr('aria-valuenow', e.loaded).css('width', '100%');
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          var response = JSON.parse(xhr.responseText);
          
          if (xhr.status === 200 && response.status === 'OK') {
            $('#progress-status').text('Reloading Page...');
            socket.emit('upload_finished', { room: room });
          } else {
            $('#progress-status').text('Unable to process uploaded file...');
            
            setTimeout(function(){ 
              $('#progress-status').text('');
              $('.progress-wrapper').hide(); 
            }, 3000);
          }
        }
      }

      xhr.send(formData);
    });

    $('.ctrl-panel').on('change', '#pdf-file', function(){
      var fname = ($(this).val() != '') ? $(this).val().split('\\').pop().split('/').pop() : null;

      $('#pdf-name').val(fname);
    });

    $('.ctrl-panel').on('click', '.navigate', function() {
      var id = $(this).data('act'); // or this.id

      socket.emit('admin_request', { eventName: id, room: room });
    });

    $('.ctrl-panel').on('click', '.toggle-panel', function() {
      $('.sub-ctrl-panel').toggle();
    });
  }
})(jQuery);