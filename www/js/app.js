'use strict';

angular.module('phonertcdemo', ['ionic',
                                'ui.router', 
                                'btford.socket-io',
                                'angular-md5'])
    .factory('GUI',function(){
      if(typeof require === 'function') {
        return require('nw.gui');
      } else {
        return null;
      }
    })
    .factory('Window',['GUI',function(gui){
      if(gui) {
        return gui.Window.get();
      } else {
        return null;
      }
    }])
    .factory('mycrypto',function(){
      return require('crypto');
    })
    .factory('myEvent',function(){
      const EventEmitter = require('events');
      return new EventEmitter();
    })
    .factory('config',function(){
      return require('./package.json')
    })

    .filter('secToTime',function(){
      return function(s){
        var t;
        if(s > -1){
          var hour = Math.floor(s/3600);
          var min = Math.floor(s/60) % 60;
          var sec = s % 60;
          if(hour < 10) {
            t = '0'+ hour + ":";
          } else {
            t = hour + ":";
          }

          if(min < 10){t += "0";}
          t += min + ":";
          if(sec < 10){t += "0";}
          t += sec;
        }
        return t;
      }
    })

  .config(function ($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('app', {
        url: '/app',
        abstract: true,
        templateUrl: 'templates/app.html'
      })
      .state('app.login', {
        url: '/login',
        controller: 'LoginCtrl',
        templateUrl: 'templates/login.html'
      })
      .state('app.contacts', {
        url: '/contacts',
        controller: 'ContactsCtrl',
        templateUrl: 'templates/contacts.html'
      })
      .state('app.call', {
        url: '/call/:contactName?isCalling&reservation&gender&number&product&amount&rate',
        controller: 'CallCtrl',
        templateUrl: 'templates/call.html'
      });

    $urlRouterProvider.otherwise('/app/login');
  })

  .run(function ($ionicPlatform) {
    $ionicPlatform.ready(function() {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      if (window.cordova && window.cordova.plugins.Keyboard) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      }

      if(window.StatusBar) {
        // org.apache.cordova.statusbar required
        StatusBar.styleDefault();
      }

      var permissions = cordova.plugins.permissions;
      permissions.requestPermission([permissions.CAMERA, permissions.RECORD_AUDIO], function(){}, function() {});
    });
  })

  .run(function ($state, signaling) {

    signaling.on('messageReceived', function (name, message, user) {
      switch (message.type) {
        case 'call':
          if ($state.current.name === 'app.call') { return; }
          
          $state.go('app.call', { isCalling: false, contactName: name,reservation: user.user.reservation,
            gender:user.user.gender,number:user.user.number,product:user.user.productname,amount:user.user.investmentAmount });

          break;
      }
    });
  });
