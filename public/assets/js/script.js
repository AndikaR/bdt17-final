$(function() {
	// Initialize the Reveal.js library with the default config options
	// See more here https://github.com/hakimel/reveal.js#configuration
	var init_reveal = false;

	function initReveal() {
		Reveal.initialize({ 
			history: true, 
			mouseWheel: false,
			controls: false,
			touch: false,
			keyboard: false,
			embedded: false,
			progress: false,
			autoSlide: 0
		});
	}
  
	var paper = new Raphael(
    $('#canvas-container'), 
    window.width, 
    window.height
  );
	
	var circle = paper.circle(0, 0, 10).attr({ fill: '#fff' });
	var socket = io.connect($('#host').val() + '/client');

	var username = 'Guest';

	circle.hide();

	$('#toggle_chat').on('click', function(){
	  $('#messages').toggle();
	});

	$('form').submit(function(){
		var temp = (parseInt($('#username').val().length) === 0) ? 'Guest' : $('#username').val();

		if (temp !== username) {
			socket.emit('change_username', username + ' changed into ' + temp);
			username = temp;
		}

    socket.emit('chat_message', username + ': ' + $('#m').val());
    $('#m').val('');
    
		return false;
  });

	socket.on('update_slide', function(slides){ 
		var $slides = $('.slides');

		$slides.empty();

		if (slides.list.length) {
			for (var i = 0; i < slides.list.length; i++) {
				$slides.append('<section data-background="/slide/' + slides.list[i] + '"></section>');
			}
		} else {
			$slides.append('<section data-background="http://via.placeholder.com/1280x800"></section>');
		}

		socket.emit('illegal_hash');
		initReveal();
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

	socket.on('chat_message', function(msg){
    $('#messages').append($('<li>').html('<p class="white">' + msg + '</p>'));
  });

	socket.on('change_username', function(msg){
    $('#messages').append($('<li>').html('<p class="darkorange"><i>' + msg + '</i></p>'));
  });

	socket.on('force_hash', function(currentHash){
		window.location.hash = currentHash;
  });

	$(window).on('hashchange', function(){
		socket.emit('illegal_hash');
	});
  
  socket.on('admin_response', function(eventName){ 
		Reveal[eventName](); 
		socket.emit('change_current', { hash: location.hash }); 
	});
});