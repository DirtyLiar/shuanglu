angular.module('phonertcdemo')

  .controller('CallCtrl', function ($scope, $state, $rootScope, $timeout, $interval, $ionicModal, $ionicLoading, $stateParams, signaling, ContactsService, $http, mycrypto, myEvent, config) {
    var duplicateMessages = [];
    var client = null;
    var fileInfo = {};
    var timer = null;
    const packageSize = 204800;

    $scope.callInProgress = false;
    $scope.record = {isRecording:false,recordTime: 0};

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
      if(!session || !session.startRecord){
        return;
      }
      if($event.target.innerHTML.indexOf('录像') > -1) {
        session.startRecord();
        $event.target.innerHTML = '停止';
        $scope.record.isRecording = true;
        timer = $interval(function () {
          $scope.record.recordTime++;
        },1000);
      } else {
        session.stopRecord(function (data) {
          $scope.record.isRecording = false;
          $interval.cancel(timer);
          client = new net.Socket();
          var base64Data = data.replace(/^data:video\/\w+;codecs=\w+;base64,/,'');
          var dataBuffer = new Buffer(base64Data, 'base64');
          // alert(base64Data);

          fileInfo.name = (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '')+'.mp4';
          fileInfo.content = dataBuffer;

          var HOST = config.dms.ip;
          var PORT = config.dms.port;

          $ionicLoading.show({
            template: '正在上传，请稍等...'
          });
          client.connect(PORT, HOST, function() {
            console.log('CONNECTED TO: ' + HOST + ':' + PORT);
            var ConnectRequest = 'AAAREYOUREADY';

            var command = Buffer.from(ConnectRequest,'ascii');
            SendVarData(command);
          });

          client.on('data', onDataRecv);

          client.on('error',function(err){
            $ionicLoading.hide();
            console.log(err);
            alert('上传出错！'+ err.message)
          });

          // 为客户端添加“close”事件处理函数
          client.on('close', function() {
            $ionicLoading.hide();
            console.log('Connection closed');
          });

          // fs.writeFile(fileInfo.name,dataBuffer, function(err){
          //   if(err){
          //     alert('保存失败')
          //   }else{
          //     alert('保存成功')
          //   }
          // });
        });
        $event.target.innerHTML = '录像';
      }
    };

    $scope.ended = function () {
      $interval.cancel(timer);
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

    var url = `http://${config.server}/shuanglu/mobile/mobileBase/getProductWord?reservation=${$scope.currenrContact.reservation}`;
    // var url = 'http://218.65.115.5:8080/shuanglu/mobile/mobileBase/getProductWord?reservation=1504771710326';
    $http.get(url).success(function (res) {
      if(res.status === '0'){
        $scope.productWord = res.data;
      } else {
        $scope.productWord = '';
      }
    }).error(function (data, status, headers, config) {
      //失败后的提示
      console.log("error", data, status, headers, JSON.stringify(config));
    });

    $scope.$on('$destroy', function() { 
      signaling.removeListener('messageReceived', onMessageReceive);
    });

    /* 上传相关代码 */
    function onDataRecv(data) {

      var recvString = RecvData(data);
      if(!recvString) {
        return;
      }

      // alert('接收到报文：'+recvString);
      console.log('接收到报文：',recvString);
      if(recvString === 'AEENDOK') {
        console.log('结束连接：', new Date().getTime());
        // 完全关闭连接
        client.destroy();
      } else if(recvString === 'ACREADY') {
        console.log('建立连接后返回:', new Date().getTime());
        myEvent.emit('sendFileIndex');
      } else if(recvString === 'IOINDEXOK') {
        console.log('发送文件索引后返回:', new Date().getTime());
        console.log('开始发送文件包...');
        myEvent.emit('sendFilePackage');
      } else if(recvString === 'FCFILEPACKAGEOK') {
        console.log('文件包响应:', new Date().getTime());
        fileInfo.sendIndex++;
        myEvent.emit('sendFilePackage');
      } else if(recvString.indexOf('FO') === 0) {
        console.log('filePath>>>',recvString.substr(2));
        var url = `http://${config.server}/shuanglu/mobile/mobileBase/submit`;
        var filePath = recvString.substr(2);
        $http.get(url,{
          params:{
            reservation: $scope.currenrContact.reservation,
            filePath:filePath,
            videoType: 3
          }
        }).success(function(data){
          if(data.status === '0') {
            alert('视频保存成功');
          } else {
            alert('视频保存失败，'+data.msg)
          }
        });
        myEvent.emit('disConnect');
      } else {
        alert('error');
        console.log('未知命令');
      }
    }

    function SendVarData(buffer) {
      // alert('buffer:'+buffer+'size:'+buffer.length);
      var dataLen = buffer.length;

      var sendBuf = Buffer.alloc(4 + 4 + dataLen);

      var crcValue = crc16(buffer);
      var dataSize = Buffer.alloc(4);
      dataSize.writeInt32LE(buffer.length);
      dataSize.reverse();
      // alert(crcValue);
      //console.log('dataSize:',dataSize);

      var crcArray = Buffer.alloc(4);
      crcArray.writeInt32LE(crcValue);
      crcArray.reverse();
      // alert(crcArray);
      //console.log('crcArray:',crcArray);

      dataSize.copy(sendBuf, 0);
      crcArray.copy(sendBuf, 4);
      buffer.copy(sendBuf, 8);
      // alert(sendBuf);
      //console.log('sendBuf:', sendBuf,'size:',sendBuf.length);
      client.write(sendBuf);
    }

    var recvBuffer = Buffer.alloc(0);
    function RecvData(buffer){
      let totalLen = recvBuffer.length + buffer.length;
      recvBuffer = Buffer.concat([recvBuffer, buffer], totalLen);

      if(recvBuffer.length > 8) {
        let len = recvBuffer.slice(0, 4).reverse().readInt32LE();
        let crc = recvBuffer.slice(4, 8).reverse().readInt32LE();
        let res = recvBuffer.slice(8);
        if(res.length === len) {
          recvBuffer = Buffer.alloc(0);
          return res.toString('ascii');
        }
      }
    }

    // 发送文件索引信息
    myEvent.on('sendFileIndex',function () {
      if(!fileInfo.content){
        return;
      }
      let hash = mycrypto.createHash('md5');
      hash.update(fileInfo.content);
      var fileMD5 = hash.digest('hex');
      var datalen = fileInfo.content.length;
      var packageTotal = datalen % packageSize !== 0 ? Math.floor(datalen / packageSize) + 1 : (datalen / packageSize);

      let FileIndexRequst = format('IS<File><Parameter name=\"fileName\" value=\"{0}\"/>'+
          '<Parameter name=\"packageTotal\" value=\"{1}\"/>'+
          '<Parameter name=\"fileMD5\" value=\"{2}\"/>'+
          '<Parameter name=\"fileId\" value=\"{3}\"/>'+
          '<Parameter name=\"cacheFlag\" value=\"{4}\"/></File>',
          fileInfo.name, packageTotal,fileMD5,'','Y');

      fileInfo.fileMD5 = fileMD5;
      fileInfo.packageTotal = packageTotal;
      fileInfo.orignalPackage = datalen;
      fileInfo.sendIndex = 0;

      let buffer = Buffer.from(FileIndexRequst,"ascii");
      SendVarData(buffer);
      //
      // console.log('开始发送文件索引...');
    });

    // 发送文件包
    myEvent.on('sendFilePackage',function(){

      if(fileInfo.sendIndex < fileInfo.packageTotal) {
        var bSendFilePackage = null;

        if (fileInfo.orignalPackage > packageSize){
          bSendFilePackage = Buffer.alloc(packageSize);

          fileInfo.content.copy(bSendFilePackage, 0, fileInfo.sendIndex * packageSize, (fileInfo.sendIndex + 1) * packageSize);
        } else {
          let size = fileInfo.content.length - fileInfo.sendIndex * packageSize;

          bSendFilePackage = Buffer.alloc(size);

          fileInfo.content.copy(bSendFilePackage, 0, fileInfo.sendIndex * packageSize);
        }
        var tag = Buffer.from('FP','ascii');
        let filePackage = Buffer.concat([tag, bSendFilePackage], (2 + bSendFilePackage.length));

        fileInfo.orignalPackage -= packageSize;
        SendVarData(filePackage);
      }
    });

    // 发送结束包
    myEvent.on('disConnect',function(){
      let command = 'ADENDCOMMUNICATION';
      let buffer = Buffer.from(command,'ascii');
      SendVarData(buffer);
    })
  });