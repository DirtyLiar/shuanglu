angular.module('phonertcdemo')

  .controller('CallCtrl', function ($scope, $state, $rootScope, $timeout, $ionicModal, $stateParams, signaling, ContactsService, $http) {
    var duplicateMessages = [];
    var recorder;

    $scope.callInProgress = false;

    $scope.isCalling = $stateParams.isCalling === 'true';

    $scope.contactName = $stateParams.contactName;
    $scope.currenrContact = {
      reservation:$stateParams.reservation,
      name: $stateParams.contactName,
      gender: $stateParams.gender,
      number: $stateParams.number,
      productname: $stateParams.product,
      investmentAmount: $stateParams.amount
    };

    $scope.allContacts = ContactsService.onlineUsers;
    $scope.contacts = {};
    $scope.hideFromContactList = [$scope.contactName];
    $scope.muted = false;
    $scope.productWord = '';//话术信息，通过后台获取

    $ionicModal.fromTemplateUrl('templates/select_contact.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.selectContactModal = modal;
    });

    function call(isInitiator, contactName) {
      console.log(new Date().toString() + ': calling to ' + contactName + ', isInitiator: ' + isInitiator);

      var config = { 
        isInitiator: isInitiator,
        turn: {
          //host: 'turn:ec2-54-68-238-149.us-west-2.compute.amazonaws.com:3478',
          //username: 'test',
          //password: 'test'
          host: 'turn:106.14.42.192:3478',
          username: 'tzrtc',
          password: 'webrtc'
        },
        streams: {
          audio: true,
          video: true
        }
      };

      var session = new cordova.plugins.phonertc.Session(config);
      
      session.on('sendMessage', function (data) { 
        signaling.emit('sendMessage', contactName, { 
          type: 'phonertc_handshake',
          data: JSON.stringify(data)
        });
      });

      session.on('answer', function () {
        console.log('Answered!');
      });

      session.on('disconnect', function () {
        $scope.callInProgress = false;
        if ($scope.contacts[contactName]) {
          delete $scope.contacts[contactName];
        }

        if (Object.keys($scope.contacts).length === 0) {
          signaling.emit('sendMessage', contactName, { type: 'ignore' });
          $state.go('app.contacts');
        }
      });

      session.call();

      $scope.contacts[contactName] = session; 
    }

    if ($scope.isCalling) {
      signaling.emit('sendMessage', $stateParams.contactName, { type: 'call' });
    }

    $scope.ignore = function () {
      var contactNames = Object.keys($scope.contacts);
      if (contactNames.length > 0) { 
        $scope.contacts[contactNames[0]].disconnect();
      } else {
        signaling.emit('sendMessage', $stateParams.contactName, { type: 'ignore' });
        $state.go('app.contacts');
      }
    };

    $scope.startRecording = function ($event) {
      let session = $scope.contacts[$scope.contactName];

      console.log(session.localStream);
      console.log(session.remoteStream);


      return;
      var session = {
        audio: true,
        video: true
      }
      if($event.target.innerHTML.indexOf('录像') > -1) {
        navigator.getUserMedia(session, function (stream) {
          $event.target.innerHTML = '停止';
          recorder = RecordRTC(stream, {
            type: 'video',
            mimeType: 'video/webm\;codecs=h264',
            sampleRate: 44100,
            bufferSize: 4096,
            // mimeType: 'video/x-matroska;codecs=avc1',
            fileExtension: 'mp4',
            frameRate: 24,
            bitsPerSecond: 128 * 8 * 1024 //码率 kbps
          });
          recorder.startRecording();
        }, function (err) {
          alert('Unable to capture your camera. Please check console logs.');
          console.log(err);
        });
      }else {
        recorder.stopRecording(function(){
          $event.target.innerHTML = '录像';
          recorder.getDataURL(function (data) {
            var base64Data = data.replace(/^data:video\/\w+;codecs=\w+;base64,/,'');
            var dataBuffer = new Buffer(base64Data, 'base64');
            alert(base64Data);
            fs.writeFile('aaaa.mp4',dataBuffer, function(err){
              if(err){
                alert('保存失败')
              }else{
                alert('保存成功')
              }
            })
          });
        });
      }
    }

    $scope.ended = function () {
      Object.keys($scope.contacts).forEach(function (contact) {
        $scope.contacts[contact].close();
        delete $scope.contacts[contact];
      });
    };

    $scope.answer = function () {
      if ($scope.callInProgress) { return; }

      $scope.callInProgress = true;
      $timeout($scope.updateVideoPosition, 1000);

      call(false, $stateParams.contactName);

      setTimeout(function () {
        console.log('sending answer');
        signaling.emit('sendMessage', $stateParams.contactName, { type: 'answer' });
      }, 1500);
    };

    $scope.updateVideoPosition = function () {
      console.log('update video');
      if ($scope.callInProgress) {
        $rootScope.$broadcast('videoView.updatePosition');
      }
    };

    $scope.openSelectContactModal = function () {
      cordova.plugins.phonertc.hideVideoView();
      $scope.selectContactModal.show();
    };

    $scope.closeSelectContactModal = function () {
      cordova.plugins.phonertc.showVideoView();
      $scope.selectContactModal.hide();      
    };

    $scope.addContact = function (newContact) {
      $scope.hideFromContactList.push(newContact);
      signaling.emit('sendMessage', newContact, { type: 'call' });

      cordova.plugins.phonertc.showVideoView();
      $scope.selectContactModal.hide();
    };

    $scope.hideCurrentUsers = function () {
      return function (item) {
        return $scope.hideFromContactList.indexOf(item) === -1;
      };
    };

    $scope.toggleMute = function () {
      $scope.muted = !$scope.muted;

      Object.keys($scope.contacts).forEach(function (contact) {
        var session = $scope.contacts[contact];
        session.streams.audio = !$scope.muted;
        session.renegotiate();
      });
    };

    function onMessageReceive (name, message, user) {
      console.log('message',message);
      switch (message.type) {
        case 'answer':
          $scope.$apply(function () {
            $scope.callInProgress = true;
            $timeout($scope.updateVideoPosition, 1000);
          });

          var existingContacts = Object.keys($scope.contacts);
          console.log('existContacts',existingContacts);
          if (existingContacts.length !== 0) {
            signaling.emit('sendMessage', name, {
              type: 'add_to_group',
              contacts: existingContacts,
              isInitiator: false
            });
          }

          call(true, name);
          break;

        case 'ignore':
          var len = Object.keys($scope.contacts).length;
          if (len > 0) { 
            if ($scope.contacts[name]) {
              $scope.contacts[name].close();
              delete $scope.contacts[name];
            }

            var i = $scope.hideFromContactList.indexOf(name);
            if (i > -1) {
              $scope.hideFromContactList.splice(i, 1);
            }

            if (Object.keys($scope.contacts).length === 0) {
              $state.go('app.contacts');
            }
          } else {
            $state.go('app.contacts');
          }

          break;

        case 'phonertc_handshake':
          if (duplicateMessages.indexOf(message.data) === -1) {
            $scope.contacts[name].receiveMessage(JSON.parse(message.data));
            duplicateMessages.push(message.data);
          }
          console.log('duplicateMessages',duplicateMessages);
          
          break;

        case 'add_to_group':
          message.contacts.forEach(function (contact) {
            $scope.hideFromContactList.push(contact);
            call(message.isInitiator, contact);

            if (!message.isInitiator) {
              $timeout(function () {
                signaling.emit('sendMessage', contact, { 
                  type: 'add_to_group',
                  contacts: [ContactsService.currentName],
                  isInitiator: true
                });
              }, 1500);
            }
          });

          break;
      } 
    }

    signaling.on('messageReceived', onMessageReceive);

    // var url = 'http://218.65.115.5:8080/shuanglu/mobile/mobileBase/getProductWord?reservation='+$scope.currenrContact.reservation;
    var url = 'http://218.65.115.5:8080/shuanglu/mobile/mobileBase/getProductWord?reservation=1504771710326';
    $http.get(url).success(function (res) {
      if(res.status === '0'){
        $scope.productWord = res.data;
      } else {
        $scope.productWord = '';
      }
    }).error(function (data, status, headers, config) {
      //失败后的提示
      console.log("error", data, status, headers, JSON.stringify(config));
    })

    $scope.$on('$destroy', function() { 
      signaling.removeListener('messageReceived', onMessageReceive);
    });
  });