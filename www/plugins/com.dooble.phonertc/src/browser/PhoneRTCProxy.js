cordova.define("com.dooble.phonertc.PhoneRTCProxy", function(require, exports, module) { var PeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
var MediaStream = window.webkitMediaStream || window.mozMediaStream || window.MediaStream;

navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;

var localStreams = [];
var localVideoTrack, localAudioTrack;
var enableTrace = true;

function tracelog(message) {
  if (enableTrace) {
    console.log(message);
  }
}

function Session(sessionKey, config, sendMessageCallback) {
  tracelog('> Session() ' + sessionKey + ' ' + config) // TODO: temp
  var self = this;
  self.sessionKey = sessionKey;
  self.config = config;
  //self.sendMessage = sendMessageCallback;
  self.sendMessage = function(msg, args) {
    if (!args) {
      args = {};
    }
    args.keepCallback = true;

    tracelog('> Session.sendMessage ' + JSON.stringify(msg)); // TODO: temp
    sendMessageCallback(msg, args);
    tracelog('< Session.sendMessage') // TODO: temp
  }

  self.onIceCandidate = function (event) {
    tracelog('> Session.onIceCandidate ' + event) // TODO: temp
    if (event.candidate) {
      self.sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    }
    tracelog('< Session.onIceCandidate') // TODO: temp
  };

  self.onRemoteStreamAdded = function (event) {
    tracelog('> Session.onRemoteStreamAdded ' + event) // TODO: temp
    self.videoView = addRemoteStream(event.stream);
    self.remoteStream = event.stream;
    self.sendMessage({ type: '__answered' });
    tracelog('< Session.onRemoteStreamAdded') // TODO: temp
  };

  self.setRemote = function (message) {
    tracelog('> Session.setRemote ' + message) // TODO: temp
    message.sdp = self.addCodecParam(message.sdp, 'opus/48000', 'stereo=1');

    this.peerConnection.setRemoteDescription(new SessionDescription(message), function () {
      console.log('setRemote success');
    }, function (error) { 
      console.log(error); 
    });
    tracelog('< Session.setRemote') // TODO: temp
  };

  // Adds fmtp param to specified codec in SDP.
  self.addCodecParam = function (sdp, codec, param) {
    tracelog('> Session.addCodecParam ' + sdp + ' ' + codec + ' ' + param) // TODO: temp
    var sdpLines = sdp.split('\r\n');

    // Find opus payload.
    var index = self.findLine(sdpLines, 'a=rtpmap', codec);
    var payload;
    if (index) {
      payload = self.getCodecPayloadType(sdpLines[index]);
    }

    // Find the payload in fmtp line.
    var fmtpLineIndex = self.findLine(sdpLines, 'a=fmtp:' + payload.toString());
    if (fmtpLineIndex === null) {
      return sdp;
    }

    sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat('; ', param);

    sdp = sdpLines.join('\r\n');
    tracelog('< Session.addCodecParam returns ' + sdp) // TODO: temp

    return sdp;
  };

  // Find the line in sdpLines that starts with |prefix|, and, if specified,
  // contains |substr| (case-insensitive search).
  self.findLine = function (sdpLines, prefix, substr) {
    return self.findLineInRange(sdpLines, 0, -1, prefix, substr);
  };

  // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
  // and, if specified, contains |substr| (case-insensitive search).
  self.findLineInRange = function (sdpLines, startLine, endLine, prefix, substr) {
    var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
    for (var i = startLine; i < realEndLine; ++i) {
      if (sdpLines[i].indexOf(prefix) === 0) {
        if (!substr ||
            sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
          return i;
        }
      }
    }
    return null;
  };

  // Gets the codec payload type from an a=rtpmap:X line.
  self.getCodecPayloadType = function (sdpLine) {
    var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
    var result = sdpLine.match(pattern);
    return (result && result.length === 2) ? result[1] : null;
  };

  // Returns a new m= line with the specified codec as the first one.
  self.setDefaultCodec = function (mLine, payload) {
    tracelog('> Session.setDefaultCodec ' + mLine + ' ' + payload) // TODO: temp
    var elements = mLine.split(' ');
    var newLine = [];
    var index = 0;
    for (var i = 0; i < elements.length; i++) {
      if (index === 3) { // Format of media starts from the fourth.
        newLine[index++] = payload; // Put target payload to the first.
      }
      if (elements[i] !== payload) {
        newLine[index++] = elements[i];
      }
    }
    tracelog('< Session.setDefaultCodec returns ' + newLine.join(' ')) // TODO: temp
    return newLine.join(' ');
  };


  tracelog('< Session()') // TODO: temp
}

Session.prototype.createOrUpdateStream = function () {
  tracelog('> Session.createOrUpdateStream') // TODO: temp
  if (this.localStream) {
    this.peerConnection.removeStream(this.localStream);
  }

  this.localStream = new MediaStream();
  
  if (this.config.streams.audio) {
    this.localStream.addTrack(localAudioTrack);
  }

  if (this.config.streams.video) {
    this.localStream.addTrack(localVideoTrack);
  }

  this.peerConnection.addStream(this.localStream);
  tracelog('< Session.createOrUpdateStream') // TODO: temp
};

Session.prototype.sendOffer = function () {
  tracelog('> Session.sendOffer') // TODO: temp
  var self = this;
  self.peerConnection.createOffer(function (sdp) {
    self.peerConnection.setLocalDescription(sdp, function () {
      console.log('Set session description success.');
    }, function (error) {
      console.log(error);
    });

    self.sendMessage(sdp);
  }, function (error) {
    console.log(error);
  }, { mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: !!videoConfig }});

  tracelog('< Session.sendOffer') // TODO: temp
}

Session.prototype.sendAnswer = function () {
  tracelog('> Session.sendAnswer') // TODO: temp
  var self = this;
  self.peerConnection.createAnswer(function (sdp) {
    self.peerConnection.setLocalDescription(sdp, function () {
      console.log('Set session description success.');
    }, function (error) {
      console.log(error);
    });

    self.sendMessage(sdp);
  }, function (error) {
    console.log(error);
  }, { mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: !!videoConfig }});


  tracelog('< Session.sendAnswer') // TODO: temp
}

Session.prototype.call = function () {
  tracelog('> Session.call') // TODO: temp
  var self = this;

  function call() {
    tracelog('> Session.call.call') // TODO: temp
    // create the peer connection
    self.peerConnection = new PeerConnection({
      iceServers: [
        { 
          url: 'stun:stun.l.google.com:19302' 
        },
        { 
          url: self.config.turn.host, 
          username: self.config.turn.username, 
          //password: self.config.turn.password, 
          credential: self.config.turn.password
        }
      ]
    }, { optional: [ { DtlsSrtpKeyAgreement: true } ]});

    self.peerConnection.onicecandidate = self.onIceCandidate;
    self.peerConnection.onaddstream = self.onRemoteStreamAdded;

    // attach the stream to the peer connection
    self.createOrUpdateStream.call(self);

    // if initiator - create offer
    if (self.config.isInitiator) {
      self.sendOffer.call(self);
    }

    tracelog('< Session.call.call') // TODO: temp
  }

  var missingStreams = { 
    video: self.config.streams.video && !localVideoTrack, 
    audio: self.config.streams.audio && !localAudioTrack 
  };

  if (missingStreams.audio || missingStreams.video) {
    navigator.getUserMedia(missingStreams, function (stream) {
      tracelog('> navigator.getUserMedia.success ' + stream) // TODO: temp
      localStreams.push(stream);

      if (missingStreams.audio) {
        console.log('missing audio stream; retrieving');
        localAudioTrack = stream.getAudioTracks()[0];
      }

      if (missingStreams.video) {
        console.log('missing video stream; retrieving');
        localVideoTrack = stream.getVideoTracks()[0];
      }

      call();

      tracelog('< navigator.getUserMedia.success') // TODO: temp
    }, function (error) {
      tracelog('> navigator.getUserMedia.error ' + error) // TODO: temp
      tracelog(error);
      tracelog('< navigator.getUserMedia.error') // TODO: temp
    });
  } else {
    call();
  } 
  
  tracelog('< Session.call') // TODO: temp
};

Session.prototype.receiveMessage = function (message) {
  tracelog('> Session.receiveMessage ' + message) // TODO: temp
  var self = this;
  if (message.type === 'offer') {
    self.setRemote(message);
    self.sendAnswer.call(self);
  } else if (message.type === 'answer') {
    self.setRemote(message);
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    
    self.peerConnection.addIceCandidate(candidate, function () {
      console.log('Remote candidate added successfully.');
    }, function (error) {
      console.log(error);
    });
     
  } else if (message.type === 'bye') {
    this.disconnect(false);
  }

  tracelog('< Session.receiveMessage ' + message) // TODO: temp
};

Session.prototype.renegotiate = function () {
  tracelog('> Session.renegotiate ') // TODO: temp
  if (this.config.isInitiator) {
    this.sendOffer();
  } else {
    this.sendAnswer();
  }
  tracelog('< Session.receiveMessage') // TODO: temp
};

Session.prototype.disconnect = function (sendByeMessage) {
  tracelog('> Session.disconnect ' + sendByeMessage) // TODO: temp

  console.log(this.videoView);
  if (this.videoView) {
    removeRemoteStream(this.videoView);
  }

  if (sendByeMessage) {
    this.sendMessage({ type: 'bye' });
  }

  this.peerConnection.close();
  this.peerConnection = null;

  this.sendMessage({ type: '__disconnected' });

  onSessionDisconnect(this.sessionKey);

  tracelog('< Session.disconnect') // TODO: temp
};


var sessions = {};
var videoConfig;
var localVideoView;
var remoteVideoViews = [];

module.exports = {
  createSessionObject: function (success, error, options) {
  tracelog('> createSessionObject ' + JSON.stringify(options)) // TODO: temp
    var sessionKey = options[0];
    var session = new Session(sessionKey, options[1], success);

    session.sendMessage({
      type: '__set_session_key',
      sessionKey: sessionKey
    });

    sessions[sessionKey] = session;

    tracelog('< createSessionObject ') // TODO: temp
  },
  call: function (success, error, options) {
    tracelog('> call ' + JSON.stringify(options)) // TODO: temp
    sessions[options[0].sessionKey].call();
    tracelog('< call ') // TODO: temp
  },
  receiveMessage: function (success, error, options) {
    tracelog('> receiveMessage ' + JSON.stringify(options)) // TODO: temp
    sessions[options[0].sessionKey]
      .receiveMessage(JSON.parse(options[0].message));
    tracelog('< receiveMessage ') // TODO: temp
  },
  renegotiate: function (success, error, options) {
    tracelog('> renegotiate ' + JSON.stringify(options)) // TODO: temp
    tracelog('Renegotiation is currently only supported in iOS and Android.')
    // var session = sessions[options[0].sessionKey];
    // session.config = options[0].config;
    // session.createOrUpdateStream();
    // session.renegotiate();
    tracelog('< renegotiate ') // TODO: temp
  },
  disconnect: function (success, error, options) {
    tracelog('> disconnect ' + JSON.stringify(options)) // TODO: temp
    var session = sessions[options[0].sessionKey];
    if (session) {
      session.disconnect(true);
    }

    tracelog('< disconnect') // TODO: temp
  },
  setVideoView: function (success, error, options) {
    tracelog('> setVideoView ' + JSON.stringify(options)) // TODO: temp
    videoConfig = options[0];

    if (videoConfig.containerParams.size[0] === 0 
        || videoConfig.containerParams.size[1] === 0) {
      return;
    }

    if (videoConfig.local) {
      if (!localVideoView) {
        localVideoView = document.createElement('video');
        localVideoView.autoplay = true;
        localVideoView.muted = true;
        localVideoView.style.position = 'absolute';
        localVideoView.style.zIndex = 999;
        localVideoView.addEventListener("loadedmetadata", scaleToFill);

        refreshLocalVideoView();

        if (!localVideoTrack) {
          navigator.getUserMedia({ audio: true, video: true }, function (stream) {
            tracelog('> navigator.getUserMedia.success ' + stream) // TODO: temp

            localStreams.push(stream);

            localAudioTrack = stream.getAudioTracks()[0];
            localVideoTrack = stream.getVideoTracks()[0];

            localVideoView.src = URL.createObjectURL(stream);
            localVideoView.load();

            tracelog('< navigator.getUserMedia.success') // TODO: temp
          }, function (error) {
            tracelog('> navigator.getUserMedia.error ' + error) // TODO: temp
            tracelog(error);
            tracelog('< navigator.getUserMedia.error ') // TODO: temp
          }); 
        } else {
          var stream = new MediaStream();
          stream.addTrack(localVideoTrack);

          localVideoView.src = URL.createObjectURL(stream);
          localVideoView.load();         
        }

        document.getElementsByClassName('video-container')[0].appendChild(localVideoView);
      } else {    
        refreshLocalVideoView();
        refreshVideoContainer();
      }
    }

    tracelog('< setVideoView') // TODO: temp
  },
  hideVideoView: function (success, error, options) {
    tracelog('> hideVideoView ' + JSON.stringify(options)) // TODO: temp
    localVideoView.style.display = 'none';
    remoteVideoViews.forEach(function (remoteVideoView) {
      remoteVideoView.style.display = 'none';
    });
    tracelog('< hideVideoView ') // TODO: temp
  },
  showVideoView: function (success, error, options) {
    tracelog('> showVideoView ' + JSON.stringify(options)) // TODO: temp
    localVideoView.style.display = '';
    remoteVideoViews.forEach(function (remoteVideoView) {
      remoteVideoView.style.display = '';
    });
    tracelog('< showVideoView ') // TODO: temp
  }
};

function addRemoteStream(stream) {
  tracelog('> addRemoteStream ' + stream) // TODO: temp
  var videoView = document.createElement('video');
  videoView.autoplay = true;
  videoView.addEventListener("loadedmetadata", scaleToFill);
  videoView.style.position = 'absolute';
  videoView.style.zIndex = 998;

  videoView.src = URL.createObjectURL(stream);
  videoView.load();

  remoteVideoViews.push(videoView);
  document.getElementsByClassName('video-container')[0].appendChild(videoView);

  refreshVideoContainer();
  tracelog('< addRemoteStream ') // TODO: temp
  return videoView;
}

function removeRemoteStream(videoView) {
  tracelog('> removeRemoteStream ' + videoView) // TODO: temp
  console.log(remoteVideoViews);
  document.getElementsByClassName('video-container')[0].removeChild(videoView);
  remoteVideoViews.splice(videoView, 1);
  console.log(remoteVideoViews);

  refreshVideoContainer();

  tracelog('< removeRemoteStream ') // TODO: temp
}

function getCenter(videoCount, videoSize, containerSize) {
  return Math.round((containerSize - videoSize * videoCount) / 2); 
}

function refreshVideoContainer() {
  var n = remoteVideoViews.length;

  if (n === 0) {
    return;
  }

  var rows = n < 9 ? 2 : 3;
  var videosInRow = n === 2 ? 2 : Math.ceil(n/rows);    

  var videoSize = videoConfig.containerParams.size[0] / videosInRow;
  var actualRows = Math.ceil(n / videosInRow);

  var y = getCenter(actualRows, 
                    videoSize,
                    videoConfig.containerParams.size[1])
          + videoConfig.containerParams.position[1];

  var videoViewIndex = 0;

  for (var row = 0; row < rows && videoViewIndex < n; row++) {
    var x = videoConfig.containerParams.position[0] + 
      getCenter(row < rows - 1 || n % rows === 0 ? videosInRow : n - (Math.min(n, videoViewIndex + videosInRow) - 1), 
                videoSize,
                videoConfig.containerParams.size[0]);

    for (var video = 0; video < videosInRow && videoViewIndex < n; video++) {
      var videoView = remoteVideoViews[videoViewIndex++];
      // videoView.style.width = videoSize + 'px';
      // videoView.style.height = videoSize + 'px';

      // videoView.style.left = x + 'px';
      // videoView.style.top = y + 'px';

      videoView.style.width = '50%';
      videoView.style.height = '300px';

      videoView.style.left = 0;
      videoView.style.top = 0;

      x += videoSize;
    }

    y += videoSize;
  }
}

function refreshLocalVideoView() {
  localVideoView.style.width = videoConfig.local.size[0];
  localVideoView.style.height = videoConfig.local.size[1] + 'px';

  localVideoView.style.right = 0;
    // (videoConfig.containerParams.position[0] + videoConfig.local.position[0]) + 'px';

  localVideoView.style.top = 0;
    // (videoConfig.containerParams.position[1] + videoConfig.local.position[1]) + 'px';
}

function scaleToFill(event) {
  var element = this;
  var targetRatio = element.offsetWidth / element.offsetHeight;
  var lastScaleType, lastAdjustmentRatio;

  function refreshTransform () {
    var widthIsLargerThanHeight = element.videoWidth > element.videoHeight;
    var actualRatio = element.videoWidth / element.videoHeight;

    var scaleType = widthIsLargerThanHeight ? 'scaleY' : 'scaleX';
    var adjustmentRatio = widthIsLargerThanHeight ? 
      actualRatio / targetRatio : 
      targetRatio / actualRatio ; 

    if (lastScaleType !== scaleType || lastAdjustmentRatio !== adjustmentRatio) {
      var transform = scaleType + '(' + adjustmentRatio + ')';

      element.style.webkitTransform = transform;
      element.style.MozTransform = transform;
      element.style.msTransform = transform;
      element.style.OTransform = transform;
      element.style.transform = transform;

      lastScaleType = scaleType;
      lastAdjustmentRatio = adjustmentRatio;
    }

    setTimeout(refreshTransform, 100);
  }

  refreshTransform();
}

function onSessionDisconnect(sessionKey) {
  tracelog('> onSessionDisconnect ' + sessionKey) // TODO: temp
  delete sessions[sessionKey];

  if (Object.keys(sessions).length === 0) {
    if (localVideoView) {
      document.getElementsByClassName('video-container')[0].removeChild(localVideoView);
      localVideoView = null;
    }

    localStreams.forEach(function (stream) {
      try {
        stream.stop();
      } catch (err) {
        stream.getTracks().forEach(function (track) { track.stop(); });
      }
    });

    localStreams = [];
    localVideoTrack = null;
    localAudioTrack = null;
  }

  tracelog('< onSessionDisconnect ') // TODO: temp
}

require("cordova/exec/proxy").add("PhoneRTCPlugin", module.exports);
});
