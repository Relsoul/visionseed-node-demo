const {YtVisionSeed} = require('visionseed')
const DIRPATH = `/dev/ttyS3`
const express = require('express');
const app = express()
var http = require('http').createServer(app);

var io = require('socket.io')(http);


app.use(express.static('src'))


http.listen(9977, () => console.log('Example app listening on port 9977!'))

var fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws');

// if (process.argv.length < 3) {
// 	console.log(
// 		'Usage: \n' +
// 		'node websocket-relay.js <secret> [<stream-port> <websocket-port>]'
// 	);
// 	process.exit();
// }

var STREAM_SECRET = process.argv[2] || 'v1',
	STREAM_PORT = process.argv[3] || 9988,
	WEBSOCKET_PORT = process.argv[4] || 9989,
	RECORD_STREAM = false;

// Websocket Server
var socketServer = new WebSocket.Server({port: WEBSOCKET_PORT, perMessageDeflate: false});
socketServer.connectionCount = 0;
socketServer.on('connection', function(socket, upgradeReq) {
	socketServer.connectionCount++;
	console.log(
		'New WebSocket Connection: ', 
		(upgradeReq || socket.upgradeReq).socket.remoteAddress,
		(upgradeReq || socket.upgradeReq).headers['user-agent'],
		'('+socketServer.connectionCount+' total)'
	);
	socket.on('close', function(code, message){
		socketServer.connectionCount--;
		console.log(
			'Disconnected WebSocket ('+socketServer.connectionCount+' total)'
		);
	});
});
socketServer.broadcast = function(data) {
	socketServer.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var streamServer = http.createServer( function(request, response) {
	var params = request.url.substr(1).split('/');

	if (params[0] !== STREAM_SECRET) {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + ':' +
			request.socket.remotePort + ' - wrong secret.'
		);
		response.end();
	}

	response.connection.setTimeout(0);
	console.log(
		'Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort
	);
	request.on('data', function(data){
		socketServer.broadcast(data);
		if (request.socket.recording) {
			request.socket.recording.write(data);
		}
	});
	request.on('end',function(){
		console.log('close');
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});

	// Record the stream to a local file?
	if (RECORD_STREAM) {
		var path = 'recordings/' + Date.now() + '.ts';
		request.socket.recording = fs.createWriteStream(path);
	}
}).listen(STREAM_PORT);

console.log('Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/<secret>');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');

const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();



io.on('connection', function(socket){
  console.log('a user connected');

  myEmitter.on('face', (e) => {

    // console.log('触发事件人脸检测',e);
    const arr = e.map((n)=>{
      const _a = {
       
        "追踪id":n.traceid,
        "人脸可信度,>0.5可信":n.shape.confidence
      }
      if(n.name){
        _a['当前用户跟匹配库人脸识别度']=n.nameconfidence
        _a["检测到匹配库中的人脸"] = n.name
      }
      return _a
    })

    // 发送前端
    socket.emit('face',arr);

  });
  
  socket.on('registerFace',function(){
    console.log('注册人脸')
    myEmitter.emit('registerFace')
  })
});

let vs = new YtVisionSeed();
vs.registerOnResult( (msg) => {
  if(msg.result.facedetectionresult.faceList&&msg.result.facedetectionresult.faceList.length>0){
    // console.log('检测到人脸')
    myEmitter.emit('face',msg.result.facedetectionresult.faceList);
  }
  // console.log(msg)
})

/**
 * 
 * ffmpeg -f avfoundation -pixel_format uyvy422 -i "1" -f mpeg1video http://localhost:9977/v
 * .\ffmpeg.exe -f dshow -i video="Tencent Youtu(R) VisionSeed" -f mpegts -codec:v mpeg1video -codec:a mp2 -s 640x480 -r 32 http://localhost:9988/v1
 * 
 */

const main = async function () {
  try {
    await vs.open(DIRPATH)
    console.log('device-id',await vs.getDeviceInfo())
    const dataLink = vs.datalink;
    const port = dataLink.port;
    myEmitter.on('registerFace',async ()=>{
      const res = await vs.registerFaceIdFromCamera('soul',5000)
      console.log('registerFace-res',res)
    })

  


    // console.log('Face in the lib:', await vs.listFaceId())

    // don't call close() if you want to receive registerOnResult callback
    // vs.close()
  } catch (e) {
    console.log('err',e)
  }
}
main()