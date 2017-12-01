angular.module('phonertcdemo')

  .controller('ContactsCtrl', function ($scope, $ionicPopup, ContactsService, $interval, signaling) {
    $scope.contacts = ContactsService.onlineUsers;
    $scope.currenrContact = {};

    $scope.selectContact = function(user){
      $scope.currenrContact = user;
    }

    $scope.cancel = function(){
      $scope.currenrContact = {};
    }

    $scope.offline = function(user, $event){
      $ionicPopup.confirm({
        title:'询问',
        template: '是否让此用户下线？',
        cancelText: '取消',
        cancelType: 'button-light',
        okText: '确定',
        okType: 'button-assertive'
      }).then(e=> {
        if(e){
          signaling.emit('logout', user);
          if($scope.currenrContact == user){
            $scope.currenrContact = {};
          }
          $scope.contacts.splice($scope.contacts.findIndex(item=>item == user),1);
        }
      });
      $event.cancelBubble = true;
    }

    $scope.$on('$destroy',function(){
      $interval.cancel(timer);
    });

    var timer = $interval(function(){
      $scope.contacts.forEach(function(user){
        if(!user.wait) {
          user.wait = 1;
        } else {
          user.wait++;
        }
      });
    },1000)
  });

/*
* type: 客户端类型，1-坐席端，2-移动端
* reservation： 预约号
* name: 姓名
* gender: 性别
* number: 身份证号
* productname： 产品名称
* investmentAmount： 金额
* rate: 风险评级
*
* */