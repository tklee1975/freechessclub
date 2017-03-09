var ws = new ReconnectingWebSocket(location.protocol.replace("http","ws") + "//" + location.host + "/ws");

// A FICS session
var session = {
  connected: false,
  handle: ""
}

// List of active tabs
var tabs;

// An online chess game
var game = {
  chess: null,
  premoves: [],
  color: '',
  bclock: null,
  wclock: null,
  btime: 0,
  wtime: 0
}

// Type of messages we receive from the proxy
var msgType = {
  ctl: 0,
  chTell: 1,
  pTell: 2,
  gameMove: 3,
  gameStart: 4,
  unknown: 5
};

var highlightSquare = function(square) {
  if (square === undefined) {
    return;
  }
  var e = $('#board .square-' + square);
  if (e.hasClass('black-3c85d') === true) {
    e.css('background', '#278881');
  } else {
    e.css('background', '#e6ffdd');
  }
};

var highlightCheck = function(square) {
  if (square === undefined) {
    return;
  }
  var e = $('#board .square-' + square);
  if (e.hasClass('black-3c85d') === true) {
    e.css('background', '#aa8881');
  } else {
    e.css('background', '#ffdddd');
  }
};

var unHighlightSquare = function(square) {
  if (square !== undefined) {
    $('#board .square-' + square).css('background', '');
  } else {
    $('#board .square-55d63').css('background', '');
  }
}

var highlightMove = function(source, target) {
  unHighlightSquare();
  highlightSquare(source);
  highlightSquare(target);
}

var highlightPreMove = function(source, target) {
  highlightCheck(source);
  highlightCheck(target);
}

function SToHHMMSS(sec) {
  var h = Math.floor(sec / 3600);
  var m = Math.floor(sec % 3600 / 60);
  var s = Math.floor(sec % 3600 % 60);
  return ((h > 0 ? (h >= 0 && h < 10 ? "0" : "") + h + ":" : "") + (m >= 0 && m < 10 ? "0" : "") + m + ":" + (s >= 0 && s < 10 ? "0" : "") + s);
}

var startBclock = function(clock) {
  return setInterval(function() {
    if (game.chess.turn() === 'w') {
      return;
    }
    if (game.btime > 0) {
      game.btime = game.btime - 1;
    }
    clock.text(SToHHMMSS(game.btime));
  }, 1000);
}

var startWclock = function(clock) {
  return setInterval(function() {
    if (game.chess.turn() === 'b') {
      return;
    }
    if (game.wtime > 0) {
      game.wtime = game.wtime - 1;
    }
    clock.text(SToHHMMSS(game.wtime));
  }, 1000);
}

var onDragStart = function(source, piece, position, orientation) {
  var chess = game.chess;
  if (chess === null) {
    return false;
  }

  if (chess.game_over() === true ||
      (game.color !== piece.charAt(0)) ||
      (game.premoves.length !== 0)) {
    return false;
  }

  // get list of possible moves for this square
  var moves = chess.moves({square: source, verbose: true});
  highlightSquare(source);
  for (var i = 0; i < moves.length; i++) {
    highlightSquare(moves[i].to);
  }
};

function movePlayer(source, target) {
  var chess = game.chess;
  // see if the move is legal
  var move = chess.move({
    from: source,
    to: target,
    promotion: 'q' // TODO: Allow non-queen promotes
  });

  // illegal move
  if (move === null) {
    unHighlightSquare();
    return 'snapback';
  }

  // TODO: send a game move message
  ws.send(JSON.stringify({ type: msgType.pTell, handle: "", text: source+"-"+target }));
  highlightMove(source, target);
}

var onDrop = function(source, target) {
  // premove if it is not my turn yet
  if (game.color !== game.chess.turn()) {
    game.premoves.push({source: source, target: target});
    return highlightPreMove(source, target);
  } else {
    return movePlayer(source, target);
  }
};

// update the board position after the piece snap
// for castling, en passant, pawn promotion
var onSnapEnd = function() {
  board.position(game.chess.fen());
};

// Chess board
var board = ChessBoard('board', {
  position: 'start',
  showNotation: true,
  draggable: true,
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
});

// enable tooltips
$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

// Allow chat card to be collapsed
$('#collapse-chat').on('hidden.bs.collapse', function () {
  $("#chat-toggle").text("+");
})
$('#collapse-chat').on('show.bs.collapse', function () {
  $("#chat-toggle").text(String.fromCharCode(8211));
})

jQuery(document.body).on('click', '.closeTab', function(event) {
  var tabContentId = $(this).parent().attr("href");
  $(this).parent().remove();
  delete tabs["content-"+tabContentId.substr(1)];
  $('#tabs a:last').tab('show');
  $(tabContentId).remove();
});

$(document).on('shown.bs.tab', 'a[data-toggle="tab"]', function (e) {
  var tab = $(e.target);
  tab.css('color', 'black');
});

function handleChatMsg(from, data) {
  var tab;
  if (!tabs.hasOwnProperty(from)) {
    var chName = from;
    if (from === "4") {
      chName = "Help";
    }
    $('<a class="flex-sm-fill text-sm-center nav-link" data-toggle="tab" href="#content-'+from+'" id="'+from+'" role="tab">'+chName+'<span class="btn btn-default btn-sm closeTab">×</span></a>').appendTo('#tabs');
    $('<div class="tab-pane chat-text" id="content-'+from+'" role="tabpanel"></div>').appendTo('.tab-content');
    $(".chat-text").height($("#board").height()-115);
    tab = $("#content-"+from);
    tabs[from] = tab;
  } else {
    tab = tabs[from];
  }

  who = "";
  var tabheader = $("#" + $("ul#tabs a.active").attr("id"));
  if (data.hasOwnProperty('handle')) {
    var textclass = "";
    if (session.handle == data.handle) {
      textclass = " class=\"mine\"";
    }
    who = "<strong"+textclass+">"+$('<span/>').text(data.handle).html()+"</strong>: ";
    if (data.type == msgType.chTell) {
      tabheader = $("#"+data.channel);
    } else {
      tabheader = $("#"+data.handle);
    }
  }
  tab.append(who +
    anchorme($('<span/>').text(data.text).html(), {attributes:[{name:"target",value:"_blank"}]})+"</br>");

  if (tabheader.hasClass('active')) {
    tab.scrollTop(tab[0].scrollHeight);
  } else {
    tabheader.css('color', 'red');
  }
}

ws.onmessage = function(message) {
  var data = JSON.parse(message.data);
  switch(data.type) {
    case msgType.ctl:
      if (session.connected == false && data.command == 1) {
        session.connected = true;
        session.handle = data.text;
        $("#chat-status").text("Connected as " + session.handle);
      }
      break;
    case msgType.chTell:
      handleChatMsg(data.channel, data)
      break;
    case msgType.pTell:
      handleChatMsg(data.handle, data);
      break;
    case msgType.gameMove:
      game.btime = data.btime;
      game.wtime = data.wtime;

      if (game.chess === null) {
        game.chess = new Chess();
        if (data.role === 1) {
          game.color = 'w';
          board.orientation('white');
          game.wclock = startWclock($("#player-time"));
          game.bclock = startBclock($("#opponent-time"));
          $("#player-name").text(data.wname);
          $("#opponent-name").text(data.bname);
        } else if (data.role === -1) {
          game.color = 'b';
          board.orientation('black');
          game.bclock = startBclock($("#player-time"));
          game.wclock = startWclock($("#opponent-time"));
          $("#player-name").text(data.bname);
          $("#opponent-name").text(data.wname);
        }
      }

      if (data.role === 1) {
        if (data.move !== "none") {
          var move = game.chess.move(data.move);
          if (move !== null) {
            highlightMove(move.from, move.to);
          }
          if (game.premoves.length > 0) {
            var move = game.premoves.shift();
            movePlayer(move.source, move.target);
          }
        }
      }
      board.position(data.fen);
      break;
    case msgType.gameStart:
      break;
    case msgType.unknown:
    default:
      handleChatMsg($("ul#tabs a.active").attr("id"), data);
      break;
  }
};

ws.onclose = function(){
  session.connected = false;
  session.handle = "";
  $("#chat-status").text("Disconnected");
};

$("#input-form").on("submit", function(event) {
  event.preventDefault();
  var text;
  if (!$("#input-command").is(':checked')) {
    if ($("#input-text").val().charAt(0) != "@") {
      msg = $("#input-text").val();
      var tab = $("ul#tabs a.active").attr("id")
      text = "t " + tab + " " + msg;
      handleChatMsg(tab, { type: msgType.chTell, channel: tab, handle: session.handle, text: msg });
    } else {
      text = $("#input-text").val().substr(1);
    }
  } else {
    if ($("#input-text").val().charAt(0) != "@") {
      text = $("#input-text").val();
    } else {
      text = $("#input-text").val().substr(1);
    }
  }
  ws.send(JSON.stringify({ type: msgType.pTell, handle: session.handle, text: text }));
  $("#input-text").val("");
});

$(document).ready(function() {
  session.connected = false;
  $("#chat-status").text("Connecting...");
  $("#opponent-time").text("00:00");
  $("#player-time").text("00:00");
  $(".chat-text").height($("#board").height()-64);
  tabs = { "53": $("#content-53") };
  board.start(false);
});

$(window).resize(function() {
  board.resize();
  $(".chat-text").height($("#board").height()-64);
});
