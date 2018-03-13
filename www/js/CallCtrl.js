angular.module('phonertcdemo')

  .controller('CallCtrl', function ($scope, $state, $rootScope, $timeout, $interval, $ionicModal, $ionicPopup, $ionicLoading, $stateParams, signaling, ContactsService, $http, mycrypto, myEvent, config) {
    var duplicateMessages = [];
    var client = null;
    var fileInfo = {};
    var timer = null;
    const packageSize = 51200;
    var localEl = document.getElementById('localView');
    var remoteEl = document.getElementById('remoteView');

    $scope.callInProgress = false;
    $scope.isUploaded = true;
    $scope.record = {isRecording:false,recordTime: 0};

    $scope.isCalling = $stateParams.isCalling === 'true';

    $scope.contactName = $stateParams.contactName;
    $scope.currenrContact = {
      uid: $stateParams.uid,
      reservation:$stateParams.reservation,
      name: $stateParams.contactName,
      gender: $stateParams.gender,
      number: $stateParams.number,
      productname: $stateParams.product,
      investmentAmount: $stateParams.amount,
      rate: $stateParams.rate,
      annualized: $stateParams.annualized,
      productPeriod: $stateParams.productPeriod
    };

    $scope.allContacts = ContactsService.onlineUsers;
    $scope.contacts = {};
    $scope.hideFromContactList = [$scope.contactName];
    $scope.muted = false;
    $scope.productWord = '';//话术信息，通过后台获取
    $scope.incomingConversation = null;
    $scope.currentConversation = null;
    $scope.localStream = null;
    $scope.remoteStream = null;
    $scope.recorder = null;

    console.log('进入到call页面...');
    $ionicLoading.show({
      template: '正在建立连接，请稍等...'
    });

    if($rootScope.videoInstance.__emitter._events.called){
      delete $rootScope.videoInstance.__emitter._events.called;
    }
    $rootScope.videoInstance.on('called', onInvite);

    if($rootScope.videoInstance.__emitter._events.token_error){
      delete $rootScope.videoInstance.__emitter._events.token_error;
    }
    $rootScope.videoInstance.on('token_error',function () {
      alert('token不合法或过期，请重新登录！');
    });

    $ionicModal.fromTemplateUrl('templates/select_contact.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.selectContactModal = modal;
    });

    if ($scope.isCalling) {
      console.log('is calling');

      // $timeout(function(){
      //   wilddogVideo.createLocalStream(
      //       {
      //         captureAudio:true,
      //         captureVideo:true,
      //         dimension:'360p',
      //         maxFPS: 25
      //       })
      //       .then(function(local){
      //         // 获取到localStream,将媒体流绑定到页面的video类型的标签上
      //         // 如果没有获得摄像头权限或无摄像头，则无法展示。
      //         // local.attach(localView);
      //         mConversation = $scope.videoInstance.call($scope.currenrContact.uid, local, "userData");
      //         console.log(mConversation);
      //         conversationStarted(mConversation);
      //         console.log('calling...')
      //       });
      // },2000);
      //
      // signaling.emit('sendMessage', $stateParams.contactName, { type: 'call' });
    }

    function onInvite(conversation) {
      console.log('监听到客户端请求....');
      $ionicLoading.hide();
      $scope.incomingConversation = conversation;
      //监听被邀请者的事件
      conversation.on('response',function (callstatus) {
        switch (callstatus){
          case 'TIMEOUT':
            break;
          case 'REJECTED':
            break;

        }
      });
      conversation.on('closed',function () {
        console.log('远程已挂断');
        $scope.incomingConversation = null;
        $scope.ended();
      });
    }

    function conversationStarted(conversation){
      //监听新参与者加入conversation事件
      conversation.on('stream_received', function(stream) {
        console.log('接收到远程视频流...');
        $scope.remoteStream = stream;
        $scope.remoteStream.attach(remoteEl);
      });
      //监听参与者离开conversation事件
      conversation.on('closed', onParticipantDisconnected);

      conversation.on('local_stats', function(statistics) {
        // console.log('local_stats', statistics);
      });
      conversation.on('remote_stats', function(statistics) {
        // console.log('remote_stats', statistics);
      });
      conversation.on('error', function (error) {
        console.log(error);
      });
      conversation.on('response',function (callstatus) {
        switch (callstatus){
          case 'REJECT':
            $scope.currentConversation = null;
            break;
          case 'BUSY':
            $scope.currentConversation = null;
            break;
          case 'TIMEOUT':
            $scope.currentConversation = null;
            break;

        }
      });
      $scope.currentConversation = conversation;
    }

    function onParticipantDisconnected(){
      if($scope.remoteStream){
        $scope.remoteStream.close();
        $scope.remoteStream.detach(remoteEl);
        $scope.localStream.close();
        $scope.localStream.detach(localEl);
        console.log('participant_disconnected');
        $scope.currentConversation.close();
        $scope.currentConversation = null;
      }
      $scope.callInProgress = false;
    }

    $scope.ignore = function () {

      signaling.emit('sendMessage', $stateParams.contactName, { type: 'ignore' });
      if($scope.incomingConversation) {
        $scope.incomingConversation.reject();
      }
      $state.go('app.contacts');
    };

    $scope.startRecording = function ($event) {

      if(!$scope.localStream || !$scope.remoteStream){
        console.log('未检测到视频信号');
        return;
      }
      if($event.target.innerHTML.indexOf('录像') > -1) {
        startRecord();
        $event.target.innerHTML = '停止';
      } else {
        stopRecord();
          // fs.writeFile(fileInfo.name,dataBuffer, function(err){
          //   if(err){
          //     alert('保存失败')
          //   }else{
          //     alert('保存成功')
          //   }
          // });
        $event.target.innerHTML = '录像';
      }
    };

    function startRecord() {
      $scope.remoteStream.stream.width = 270;
      $scope.remoteStream.stream.left = 480;

      $scope.recorder = new RecordRTC([$scope.localStream.stream, $scope.remoteStream.stream],{
        type: 'video',
        // mimeType: 'video/webm',
        mimeType: 'video/webm\;codecs=h264',
        fileExtension: 'mp4',
        video: {
          width: 480,
          height: 360
        },
        // bitsPerSecond: 128 * 8 * 1024, //码率 kbps
        // videoBitsPerSecond: 800000
        audioBitsPerSecond : 128000,
        videoBitsPerSecond : 2500000
      });
      $scope.recorder.startRecording();

      $scope.record.isRecording = true;
      timer = $interval(function () {
        $scope.record.recordTime++;
      },1000);
    }

    function stopRecord() {
      if(!$scope.recorder){
        return;
      }

      $scope.recorder.stopRecording(function(){
        var blob = $scope.recorder.getBlob();

        var reader = new FileReader();
        reader.onload = function(e) {
          $scope.isUploaded = false;
          $scope.record.isRecording = false;
          $scope.record.recordTime = 0;
          $interval.cancel(timer);

          var base64Data = e.target.result.replace(/^data:video\/\w+;codecs=\w+;base64,/,'');
          var dataBuffer = new Buffer(base64Data, 'base64');
          // alert(base64Data);

          fileInfo.name = (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '')+'.mp4';
          fileInfo.content = dataBuffer;
          fileInfo.path = 'D:\\Topcheer\\'+$scope.contactName+fileInfo.name;

          try{
            fs.exists('D:\\Topcheer',(exists) => {
              if(!exists) {
                fs.mkdir('D:\\Topcheer');
              }
              fs.writeFile(fileInfo.path, fileInfo.content, function(err){
                if(err){
                  console.log('保存到本地失败');
                }else{
                  $ionicPopup.alert({
                    title: '成功',
                    template: '文件已保存到 '+ fileInfo.path +',请点击保存！',
                    buttons: [
                      {text: '确定', type: 'button-positive'}
                    ]
                  })
                  console.log('保存到本地成功');
                }
              });
            });
          }catch(ex){
            fs.writeFile($scope.contactName+'.mp4', fileInfo.content);
            console.log(ex);
          }
          // console.log(e.target.result);
        };
        reader.readAsDataURL(blob);
      });
    }

    $scope.ended = function () {
      $interval.cancel(timer);
      if($scope.currentConversation) {
        $scope.localStream.close();
        $scope.remoteStream.close();
        $scope.localStream.detach(localEl);
        $scope.remoteStream.detach(remoteEl);
        $scope.currentConversation.close();
        $scope.currentConversation = null;
      }
      $scope.callInProgress = false;
    };

    $scope.upload = function() {
      var HOST = config.dms.ip;
      var PORT = config.dms.port;
      $ionicLoading.show({
        template: '正在上传，请稍等...'
      });

      client = new net.Socket();
      client.setNoDelay(false);
      client.connect(PORT, HOST, function() {
        console.log('CONNECTED TO: ' + HOST + ':' + PORT);
        var ConnectRequest = 'AAAREYOUREADY';

        var command = Buffer.from(ConnectRequest,'ascii');
        SendVarData(command);
      });

      client.on('data', onDataRecv);

      client.on('error',function(err){
        // $ionicLoading.hide();
        // console.log(err);
        // console.log("socket状态:",client.state);
        // if($scope.isShown) {
        //   return;
        // }
        // $ionicPopup.alert({
        //   title: '错误',
        //   template: '上传出错！'+ err.message,
        //   buttons: [
        //     {text: '确定', type: 'button-positive'}
        //   ]
        // }).then(() => {
        //   $scope.isShown = false;
        // });
        // $scope.isShown = true;
      });

      // 为客户端添加“close”事件处理函数
      client.on('close', function() {
        $ionicLoading.hide();
        console.log('Connection closed');
      });
    }

    $scope.cancel = function() {
      $scope.isUploaded = true;
      $state.go('app.contacts');
    }

    $scope.answer = function () {
      if ($scope.callInProgress) { return; }
      if(!$scope.incomingConversation){
        console.log("未检测到请求：", $scope.incomingConversation);
        return;
      }

      $scope.callInProgress = true;
      // $timeout($scope.updateVideoPosition, 1000);

      wilddogVideo.createLocalStream({
        captureVideo: true,
        captureAudio: true,
        dimension: '360p',
        maxFPS: 15
      })
      .then(function(wdStream) {
        $scope.localStream = wdStream;
        $scope.localStream.attach(localEl);
        $scope.incomingConversation.accept(wdStream).then(conversationStarted);
      })
      .catch(function(err) {
        console.error(err);
      });

      setTimeout(function () {
        console.log('sending answer');
        signaling.emit('sendMessage', $stateParams.contactName, { type: 'answer' });
      }, 1500);
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
            // $state.go('app.contacts'); //挂断以后不返回到排队界面，等待上传
          }

          break;

        case 'phonertc_handshake':

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
            videoType: 3,
            workId: $rootScope.workId
          }
        }).success(function(data){
          if(data.status === '0') {
            $ionicPopup.alert({
              title: '成功',
              template: '上传成功！',
              buttons: [
                {text: '确定', type: 'button-positive'}
              ]
            }).then(() => {
              fileInfo.content = null;
              fileInfo.sendIndex = 0;
              fileInfo = {};
              $scope.isUploaded = true;
              $state.go('app.contacts');
            });
            console.log('视频保存成功');
          } else {
            $ionicPopup.alert({
              title: '失败',
              template: '保存失败，'+ data.msg,
              buttons: [
                {text: '确定', type: 'button-positive'}
              ]
            })
            console.log('视频保存失败，'+data.msg)
          }
        });
        myEvent.emit('disConnect');
      } else {
        // alert('error');
        console.log('未知命令');
      }
    }

    function SendVarData(buffer) {
      // alert('buffer:'+buffer+'size:'+buffer.length);
      try {
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
        console.log('发包中...');
        client.write(sendBuf);
      }catch (e){
          console.error(e);
      }
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
      $ionicLoading.show({
        template: '正在上传('+ Math.floor(fileInfo.sendIndex / fileInfo.packageTotal * 100) +'%)，请稍等...'
      });
    });

    // 发送结束包
    myEvent.on('disConnect',function(){
      let command = 'ADENDCOMMUNICATION';
      let buffer = Buffer.from(command,'ascii');
      SendVarData(buffer);
    })
  });