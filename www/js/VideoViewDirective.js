angular.module('phonertcdemo')
  .directive('videoView', function ($rootScope, $timeout) {
    return {
      restrict: 'E',
      template: `<div class="video-container">
                    <div ng-if="record.isRecording" class="media-box">
                        <h2><img src="img/progress.gif"><span>{{record.recordTime | secToTime}}</span></h2>
                    </div>
                    <video id="localView" width="150" height="112" autoplay muted></video>
                    <video id="remoteView" width="523" height="390" autoplay></video>
                 </div>`,
      replace: true,
      link: function (scope, element, attrs) {
        function updatePosition() {
          cordova.plugins.phonertc.setVideoView({
            container: element[0],
            local: {
              position: [0, 4],
              size: ['50%', 300]
            }
          });
        }

        // $timeout(updatePosition, 500);
        $rootScope.$on('videoView.updatePosition', updatePosition);
      }
    }
  });