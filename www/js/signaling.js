angular.module('phonertcdemo')
  .factory('signaling',function (socketFactory) {
    // var socket = io.connect('http://106.14.42.192:3000/');
    var socket = io.connect('http://sl.zjgjxt.com:3000/');
    // let socket = io.connect('http://127.0.0.1:3000/');

    return socketFactory({
      ioSocket: socket
    });
  });
