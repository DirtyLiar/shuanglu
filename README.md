# shaunglu
这是一个录音录像的项目，项目采用`JavaScript`、`nodejs`、`angularjs`、`ionic`、`webRTC`、`recordRTC`等技术做的一个混合开发，主要运行在node-webkit中，单独在浏览器中无法运行。因为涉及到录像完成后，利用`socket`把文件上传到后台文件服务器。
## 代码运行
        首先安装依赖包
```
npm install server-static connect
```

        进入到www目录，执行以下命令
```
node server.js
```

## node-webkit 配置
### package.json

``` Javascript
{
  "name": "中江信托-云双录",
  "description": "中江信托公司理财双录系统",
  "version": "0.0.1",
  "main": "http://192.168.1.103:8080/index.html",
  "node-remote": "http://192.168.1.103:8080/*",
  "chromium-args":"--unsafely-treat-insecure-origin-as-secure='http://192.168.1.103:8080' --user-data-dir=%appdata%\\Topcheer\\AnyChat",
  "nodejs":true,
  "single-instance":false,
  "window": {
    "title": "中江信托",    
    "toolbar": true,
    "icon": "main.png",
    "resizable" : false,
    "position": "center",
    "width": 430,
    "height": 330,
    "min_width": 400,
    "min_height": 300,
    "max_width": 1024,
    "max_height": 768
  },
  "dms":{
    "ip":"127.0.0.1",
    "port": 5555
  },
  "signaling":"127.0.0.1:3000",
  "server":"127.0.0.1:8081"
}
```

* `name` app的名称(必须)
* `description` 描述
* `version` 应用程序的版本
* `main` 主程序入口(必须),可以是本地文件，也可以是服务器地址
* `node-remote` 控制远程页面是否允许调用nodejs
* `chromium-args` 谷歌浏览器的启动参数，47版本以后的浏览器已经禁止http协议的网站调用摄像头，`--unsafely-treat-insecure-origin-as-secure` 和 `--user-data-dir` 配置允许调用摄像头
* `nodejs` *(boolean)* set `nodejs` to false will disable Node support in WebKit.
* `single-instance` 控制是否允许打开多个实例
* `window` 窗体相关配置
* `dms` 配置dms的IP地址和端口号
* `signaling` 信令服务的地址
* `server` 双录服务的地址