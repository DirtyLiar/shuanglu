angular.module('phonertcdemo')
  .factory('ContactsService', function (signaling) {
    var onlineUsers = [];

    signaling.on('online', function (user) {
      var index = onlineUsers.findIndex(function(item){
        return user.name === item.name;
      })
      if (index === -1 && user.type !== 1 ) {
        onlineUsers.push(user);
      }
    });

    signaling.on('offline', function (user) {
      // var index = onlineUsers.indexOf(user.name);
      var index = onlineUsers.findIndex(function(item){
        return item.name === user.name;
      });
      if (index !== -1) {
        onlineUsers.splice(index, 1);
      }
    });

    return {
      onlineUsers: onlineUsers,
      setOnlineUsers: function (users, currentUser) {
        console.log(users);
        this.currentUser = currentUser;
        onlineUsers.length = 0;
        users.forEach(function (user) {
          if (user && user.name !== currentUser.name && user.type !== 1) {
            onlineUsers.push(user);
          }
        });
      }
    }
  });