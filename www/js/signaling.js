angular.module('phonertcdemo')
  .factory('signaling', function (socketFactory) {
    // var socket = io.connect('http://106.14.42.192:3000/');
    var socket = io.connect('http://192.168.1.104:3000/');

    var socketFactory = socketFactory({
      ioSocket: socket
    });

    return socketFactory;
  });