angular.module('phonertcdemo')

  .controller('LoginCtrl', function ($scope, $state, $ionicPopup, signaling, ContactsService, Window, md5, $http, config) {
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

        var url = `http://${config.server}/shuanglu/mobile/mobileBase/seatLogin`;
        // var url = 'http://218.65.115.5:8080/shuanglu/mobile/mobileBase/seatLogin';
        $http.get(url,{
          params:{workid: $scope.data.workid, password:md5.createHash($scope.data.password)}
        }).success(function(data){
          if(data.status === '0'){
            $scope.loading = true;
            $scope.data.name = data.data.username;
            signaling.emit('login', {name: data.data.userName, type: 1 /*坐席端*/});
          } else {
            $ionicPopup.alert({
              title: '错误',
              template: data.msg,
              buttons: [
                {text: '确定', type: 'button-positive'}
              ]
            });
          }
        }).error(function(err){
          console.log(err);
        });
      }
    };

    signaling.on('login_error', function (message) {
      $scope.loading = false;
      var alertPopup = $ionicPopup.alert({
        title: '登录失败',
        template: message
      });
    });

    signaling.on('login_successful', function (users) {

      ContactsService.setOnlineUsers(users, $scope.data);
      $state.go('app.contacts');
      Window.width = 800;
      Window.height = 600;
      var left = (window.screen.width - 800) / 2;
      var top = (window.screen.height - 600) / 2 - 30;
      Window.moveTo(left, top);
    });

  });