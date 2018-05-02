angular.module('phonertcdemo')

  .controller('LoginCtrl', function ($scope, $state, $rootScope, $ionicPopup, $ionicLoading, signaling, ContactsService, Window, md5, $http, config) {
    
	  try{
		  fs.exists('D:\\SHUANGLULOG',(exists) => {
			  if(!exists) {
				  fs.mkdir('D:\\SHUANGLULOG');
			  }
		  });
	  }catch(ex){
		  
	  }
	  
	$scope.data = { type:1 /*桌面端默认1-坐席*/};
    $scope.loading = false;

    $scope.login = function ($event) {
      if(($event.type === 'keyup' && $event.which === 13) || $event.type === 'click') {
        if (!$scope.data.workid) {
          $ionicPopup.alert({
            title: '提示',
            template: '操作号不能为空！',
            buttons: [
              {text: '确定', type: 'button-positive'}
            ]
          });
          return;
        } else if(!$scope.data.password) {
          $ionicPopup.alert({
            title: '提示',
            template: '密码不能为空！',
            buttons: [
              {text: '确定', type: 'button-positive'}
            ]
          });
          return;
        }
        $ionicLoading.show({
          template: '正在登录...'
        });
        let url = `http://${config.server}/shuanglu/mobile/mobileBase/seatLogin`;
        // var url = 'http://218.65.115.5:8080/shuanglu/mobile/mobileBase/seatLogin';
        $http.get(url,{
          params:{workid: $scope.data.workid, password:md5.createHash($scope.data.password)}
        }).success(function(data){
          if(data.status === '0'){
            var conf = {
              authDomain: 'wd6125123002awzvbo.wilddog.com'
            };
            $scope.loading = true;
            wilddog.initializeApp(conf);
            wilddog.auth().signInAnonymously()
            .then(function(user){
              wilddogVideo.initialize({'appId':'wd1159478137oduppv','token':user.getToken()});
              $rootScope.videoInstance = wilddogVideo.call();
              $rootScope.workId = data.data.workId;
              $scope.data.name = data.data.username;
              signaling.emit('login', {uid: user.uid, name: data.data.userName, type: 1 /*坐席端*/});
              
            }).catch(function (errors){
	        	fs.appendFile('D:\\SHUANGLULOG\\LoginCtrl'+new Date().Format("yyyy-MM-dd")+'.txt', '['+new Date().Format("yyyy-MM-dd hh:mm:ss")+']视频服务登入失败,原因:'+errors+'\n',  function(err) {
	     		   if (err) {
	     			   alert(err)
	     			   return console.error(err);
	     		   }
	     		});
              $ionicPopup.alert({
                title: '错误',
                template: '登录视频服务失败：'+ errors,
                buttons: [
                  {text: '确定', type: 'button-positive'}
                ]
              });
            });
          } else {
            $ionicPopup.alert({
              title: '错误',
              template: data.msg,
              buttons: [
                {text: '确定', type: 'button-positive'}
              ]
            });
          }
          $ionicLoading.hide();
        }).error(function(err){
          $ionicLoading.hide();
          console.log(err);
        });
      }
    };

    signaling.on('login_error', function (message) {
      $ionicLoading.hide();
      $scope.loading = false;
      $ionicPopup.alert({
        title: '登录失败',
        template: message
      });
    });

    signaling.on('login_successful', function (users) {
      $ionicLoading.hide();
      ContactsService.setOnlineUsers(users, $scope.data);
      $state.go('app.contacts');
      Window.width = 800;
      Window.height = 600;
      let left = (window.screen.width - 800) / 2;
      let top = (window.screen.height - 600) / 2 - 30;
      Window.moveTo(left, top);
    });

    //日期格式化
    Date.prototype.Format = function (fmt) { //author: meizz
  	  var o = {
  		"M+": this.getMonth() + 1, //月份
  		"d+": this.getDate(), //日
  		"h+": this.getHours(), //小时
  		"m+": this.getMinutes(), //分
  		"s+": this.getSeconds(), //秒
  		"q+": Math.floor((this.getMonth() + 3) / 3), //季度
  		"S": this.getMilliseconds() //毫秒
  	  };
  	  if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  	  for (var k in o)
  	  if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  	  return fmt;
  	}
    
  });