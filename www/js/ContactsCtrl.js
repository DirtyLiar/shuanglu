angular.module('phonertcdemo')

  .controller('ContactsCtrl', function ($scope, ContactsService, $interval) {
    $scope.contacts = ContactsService.onlineUsers;
    $scope.currenrContact = {};

    $scope.selectContact = function(user){
      $scope.currenrContact = user;
    }

    $scope.cancel = function(){
      $scope.currenrContact = {};
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