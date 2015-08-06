//////////////////////////////////////////////////////////
///                              設定                                        ///
//////////////////////////////////////////////////////////
var os = require('os');
var ifaces = os.networkInterfaces();
var interfaces = os.networkInterfaces();
var localhost = '127.0.0.1';
for (var k in interfaces) {
	var addresses = [];
	for (var k2 in interfaces[k]) {
		var address = interfaces[k][k2];
		if (address.family === 'IPv4' && !address.internal) {
			addresses.push(address.address);
		}
	}
	localhost = addresses[0];
}
var port = process.env.PORT || 3000;
console.log('Start Control Server: ' + localhost + ':' + port);

//////////////////////////////////////////////////////////
///                   http server for user                         ///
//////////////////////////////////////////////////////////
var express = require('express'); 
var app = express();
var http = require('http').Server(app);
var server = app.listen(port);
var bodyParser = require('body-parser');

app.use(bodyParser.json()); // Body parser use JSON data
app.use(bodyParser.urlencoded({ extended: false })); 

app.post('/checkRoomByDes', function(request, response) {
	console.log("Http Get Message : checkRoomByDes, roomname:" + request.body.roomname);
	var roomname = request.body.roomname;
	var json = null, isRoomExit = false;
	//check room array by des;
	if (listOfRoom[roomname]) {
		isRoomExit = true;
	}
	json = JSON.stringify({ 
		result: isRoomExit
	});
	console.log('isRoomExit: ' + isRoomExit);
	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(json);
});

app.get('/queryServerList', function(request, response) {
	var serverlist = [];
	for(var i in listOfJanus){
		if(listOfJanus[i].cpuState != undefined 
			&& listOfJanus[i].cpuState != null
			&& listOfJanus[i].networkState != undefined
			&& listOfJanus[i].networkState != null) {
			if ((listOfJanus[i].cpuState < 80) && ( listOfJanus[i].networkState < 5120)) {
				var jarray = {
					nodejsIP : listOfJanus[i].nodejsIP,
					janusIP : listOfJanus[i].janusIP
				};
				serverlist.push(jarray);
			}
		}
	}
	var json = null;
	json = JSON.stringify({ 
		serverList: serverlist
	});
	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(json);
});

app.post('/queryServer', function(request, response) {
	console.log("Http Get Message : queryServer, identity:" + request.body.identity + ", rttResult:" + request.body.rttResult);
	var identity = request.body.identity;
	var roomname = request.body.roomname;
	var rttResult = JSON.parse(request.body.rttResult)['rttResult'];
	var json = null;
	
	rttResult.sort(sortByRTT);

	if (identity == 'Teacher') {
		var target = 0;
		var arrayJanusIP = [rttResult[target]['janusIP']];
		var arrayNodejsIP = [rttResult[target]['nodejsIP']];
		json = JSON.stringify({ 
			serverList: arrayJanusIP,
			nodejsList: arrayNodejsIP,
			callinServer: rttResult[target]['janusIP']
		});
		response.setHeader("Access-Control-Allow-Origin","*"); 
		response.end(json);
	} else if (identity == 'Student') {
		var target = 0;
		var targetRange = 10, rangeInterval = 10;

		var candidateArray = [];
		while (candidateArray.length == 0) {
			for(var i in rttResult) {
				console.log(rttResult[i]['rtt'] + '-' + targetRange);
				if (rttResult[i]['rtt'] < targetRange) {
					//偵測有沒有課程在edge server上 1:有而且是老師在的edge server 2:有但老師不在, 3:沒有 
					var roomstatus = 3;
					if(listOfRoom[roomname]) {
						if(listOfRoom[roomname].janusServer[rttResult[i]['janusIP']] != undefined) {
							roomstatus = listOfRoom[roomname].janusServer[rttResult[i]['janusIP']].main == true ? 1 : 2;
						}
					}
					rttResult[i]['roomstatus'] = roomstatus;

					candidateArray.push(rttResult[i]);
				}
			}
			targetRange += rangeInterval;
		}
/*
		//debug
		st++;
		if((st % 2) == 0){
			candidateArray.sort(asortByRoomstatus);
		} else {
			candidateArray.sort(sortByRoomstatus);
		}
		*/
		candidateArray.sort(sortByRoomstatus);
		console.log(candidateArray[0]['janusIP'] + '-' + candidateArray[0]['roomstatus']);

		if(candidateArray[0]['roomstatus'] == 3) {
			if(!listOfRoom[roomname].janusServer[candidateArray[0]['janusIP']]) {
				listOfRoom[roomname].janusServer[candidateArray[0]['janusIP']] = {
					main : false,
					state : 'off',
					roomid : null,
					studenList : []
				};
			}

			if(listOfRoom[roomname].janusServer[candidateArray[0]['janusIP']].state == 'off'){
				listOfRoom[roomname].janusServer[candidateArray[0]['janusIP']].state == 'prepare';
				checkCourseOnPath(roomname, candidateArray[0]['janusIP'], function (result) {
					console.log("Finish All Path Prepare");
					var arrayJanusIP = [candidateArray[0]['janusIP']];
					var arrayNodejsIP = [candidateArray[0]['nodejsIP']];
					json = JSON.stringify({ 
						serverList: arrayJanusIP,
						nodejsList: arrayNodejsIP,
						callinServer: listOfRoom[roomname].mainServer
					});
					response.setHeader("Access-Control-Allow-Origin","*"); 
					response.end(json);
				});
			}
		} else {
			var arrayJanusIP = [candidateArray[0]['janusIP']];
			var arrayNodejsIP = [candidateArray[0]['nodejsIP']];
			json = JSON.stringify({ 
				serverList: arrayJanusIP,
				nodejsList: arrayNodejsIP,
				callinServer: listOfRoom[roomname].mainServer
			});
			response.setHeader("Access-Control-Allow-Origin","*"); 
			response.end(json);
		}
	} 
});

app.get('/info', function(request, response) {
	console.log('-----------------------------------------------------------------------');
	console.log('listOfRoom');
	console.log(listOfRoom);
	console.log('-----------------------------------------------------------------------');
	console.log('listOfJanus');
	console.log(listOfJanus);

	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(str);
});
function sortByRTT(a,b) {  
	return a['rtt'] - b['rtt'];
}

function sortByRoomstatus(a,b) {  
	return a['roomstatus'] - b['roomstatus'];
}   

var st = 0;
function asortByRoomstatus(a,b) {  
	return b['roomstatus'] - a['roomstatus'];
}  

app.post('/registerRoomOnCS', function(request, response) {
	var roomname = request.body.roomname;
	var url = request.body.url;
	var roomid = parseInt(request.body.roomid, 10);
	var username = request.body.username;
	console.log("Http Post Message : registerRoomOnCS, roomname:" + roomname + ", " + "url:" + url + ", " + "roomid:" + roomid);
	
	if (!listOfRoom[roomname]) {
		listOfRoom[roomname] = {
			teacher : username,
			mainServer : url,
			questionList : {},
			janusServer : {}
		};
	}

	if(!listOfRoom[roomname].janusServer[url]) {
		listOfRoom[roomname].janusServer[url] = {
			main : true,
			state : 'on',
			roomid : roomid,
			pluginQuery : null,
			userid : null,
			publisherid : null,
			publishername : null,
			pluginListener : null,
			pluginPublisher : null,
			studenList : []
		};
	}

	var json = JSON.stringify({ 
		result: true
	});
	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(json);
});

app.post('/unregisterRoomOnCS', function(request, response) {
	var roomname = request.body.roomname;
	console.log("Http Post Message : unregisterRoomOnCS, roomname:" + roomname);

	if (listOfRoom[roomname]) {
		for (var i in listOfRoom[roomname].janusServer) {
			console.log(i + "-" + listOfRoom[roomname].janusServer[i].roomid);
			unregisterRoomOnJanus(i, listOfRoom[roomname].janusServer[i].roomid);
		}

		delete listOfRoom[roomname];
	}

	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end();
});

/*
	app.post('/unregisterRoomOnJanus', function(request, response) {
		var janusIP = request.body.janusIP;
		var roomId = request.body.roomId;
		console.log("Http Post Message : unregisterRoomOnJanus, roomId:" + roomId);

		unregisterRoomOnJanus(janusIP, parseInt(roomId, 10));

		response.setHeader("Access-Control-Allow-Origin","*"); 
		response.end();
	});
*/

function unregisterRoomOnJanus (janusIP, roomId) {
	console.log("unregisterRoomOnJanus, roomId:" + roomId);
	var destroy = { 
		"request": "destroy", 
		"room": roomId
	};
	listOfJanus[janusIP].pluginAdmin.send({
		"message": destroy, 
		success: function(result) {
			console.log(result);
		}
	});
}

app.post('/registerStudentOnCS', function(request, response) {
	console.log("Http Post Message : registerStudentOnCS");
	var roomname = request.body.roomname;
	var janusIP = request.body.janusIP;
	var userid = request.body.userid;
	var username = request.body.username;

	if(listOfRoom[roomname] !== undefined)
		if(listOfRoom[roomname].janusServer[janusIP] == undefined) {
				var parentJanus = listOfRoom[roomname].janusServer[janusIP];
				parentJanus.studenList[userid] = username;
		}

	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end();
});

app.post('/unregisterStudentOnCS', function(request, response) {
	console.log("Http Post Message : unregisterStudentOnCS");
	var roomname = request.body.roomname;
	var janusIP = request.body.janusIP;
	var userid = request.body.userid;
	var username = request.body.username;
	
	if(listOfRoom[roomname] !== undefined)
		if(listOfRoom[roomname].janusServer[janusIP] == undefined) {
				var parentJanus = listOfRoom[roomname].janusServer[janusIP];
				if(parentJanus.studenList[userid] != undefined) {
					delete parentJanus.studenList[userid];
				}	
		}

	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end();
});

app.post('/addQuestion', function(request, response) {
	console.log("Http Post Message : addQuestion");
	var roomname = request.body.roomname;
	var username = request.body.username;

	var result = false;

	if(listOfRoom[roomname] !== undefined) 
		if(listOfRoom[roomname].questionList[username] == undefined) {
			listOfRoom[roomname].questionList[username] = true;
			result = true;
		} 

	var json = JSON.stringify({ 
		result: result
	});
	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(json);
});

app.post('/getQuestionList', function(request, response) {
	console.log("Http Post Message : getQuestionList");
	var roomname = request.body.roomname;

	var json = null;

	if(listOfRoom[roomname] !== undefined) {
		json = JSON.stringify({ 
			questionList: JSON.stringify(listOfRoom[roomname].questionList)
		});
	}

	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(json);
});

app.post('/deleteQuestion', function(request, response) {
	console.log("Http Post Message : deleteQuestion");
	var roomname = request.body.roomname;
	var username = request.body.username;

	var result = false;
	if(listOfRoom[roomname] !== undefined) 
		if(listOfRoom[roomname].questionList[username] != undefined) {
			delete listOfRoom[roomname].questionList[username];
			result = true;
		}

	var json = JSON.stringify({ 
		result: result
	});
	response.setHeader("Access-Control-Allow-Origin","*"); 
	response.end(json);
});

//////////////////////////////////////////////////////////
///           web   socket server for edge                 ///
//////////////////////////////////////////////////////////
var io = require('socket.io').listen(server);
io.sockets.on('connection', function (socket) {
	var id;
		
	socket.on('message', function(msg){
		if(msg['type'] != 'edgeServerStateRes')
			console.log('Message In: ' + msg['type']);
		switch(msg['type']){
			case 'edgeServerConnected':
				id = msg['janusIP'];
				console.log('Edge Server Connected: ' + id);
				if(!listOfJanus[id]) {
					listOfJanus[id] = {
						socket : socket,
						janusController : null,
						pluginAdmin : null,
						janusIP :  id,
						nodejsIP : msg['nodejsIP'],
						cpuState : null,
						networkState : null
					};			
				}
				console.log('Initial Janus Controller...');
				initJanus(id);

				if (isInitialFirstTime == true) {
					initEdgeShortPath();
				}
			break;	
			case 'edgeServerStateRes': /* gather server status */
				listOfJanus[id].cpuState = msg['cpuState'];
				listOfJanus[id].networkState = msg['networkState'];
				//console.log(id+'-'+msg['cpuState']+'-'+msg['networkState']);
			break;
			case 'edgeToEdgeRttCollectRes': 
				isCollecting--;
				rttMatrix[listOfJanus[id].nodejsIP] = msg['rttResult'];
				if(isCollecting == 0) {
					calculateShortPath();
				}
			break;
			default:
			break;
		}
	});
	socket.on('disconnect', function(data){
		console.log('Edge Server Disconnected: ' + id);
		delete listOfJanus[id];
	});
});

function sendMessage (s, json) {
	s.emit('message', json);
}
//////////////////////////////////////////////////////////
///                              shortest path                      ///
//////////////////////////////////////////////////////////
var isInitialFirstTime = false;
var isCollecting = 0;
var rttMatrix = {};
var spMatrix = {}; //shortest path
var costMatrix = {}; //shortest path cost
var edgeServerNumber = 0;

var Graph = require('node-dijkstra');
console.log("Wait for edge server...");
setTimeout(function(){ 
	initEdgeShortPath();
	isInitialFirstTime = true;
}, 2000);

function initEdgeShortPath () {
	console.log("isCollecting:" + isCollecting);
	if(isCollecting == 0) {
		var nodejsList = [];
		var i = 0;
		for (var j in listOfJanus){
			nodejsList[i] = listOfJanus[j].nodejsIP;
			i++;
		}
		edgeServerNumber = i;
		isCollecting = i;

		for (var i in listOfJanus) {
			sendMessage(listOfJanus[i].socket, {
				'type' : 'edgeToEdgeRttCollect',
				'nodejsList' : nodejsList
			});
		}
	}
}

function calculateShortPath () {
	//get edge cost
	var g = new Graph();
	for(var i in rttMatrix) {
		var object = {};
		for(var j in rttMatrix[i]) {
			if (rttMatrix[i][j] != rttMatrix[j][i]){
				rttMatrix[i][j] = Math.floor((rttMatrix[i][j] + rttMatrix[j][i] ) / 2);
				rttMatrix[j][i]  = rttMatrix[i][j]; 
			}
			if(i != j) {
				object[j] = rttMatrix[j][i];
			}
		}
		g.addVertex(i,object);
	}

	//get short path and cost
	for(var i in rttMatrix) {
		spMatrix[i] = {};
		costMatrix[i] = [];
		for(var j in rttMatrix[i]) {
			if(i != j){
				spMatrix[i][j] = g.shortestPath(i,j);
				costMatrix[i][j] = calculatePathCost(spMatrix[i][j]);
				if(costMatrix[i][j] == -1) {
					console.log('Error when calculatePathCost ' + i + ' to ' + j);
				}
			} else {
				spMatrix[i][j] = i;
				costMatrix[i][j] = 0;
			}
		}
	}
}

function calculatePathCost(path){
	if(path == null){
		return -1;
	}
	var cost = 0;
	for(var i = 0; i < path.length -1 ; i++) {
		cost += rttMatrix[path[i]][path[i+1]];
	}
	return cost;
}

//////////////////////////////////////////////////////////
///                      janus gateway server                  ///
//////////////////////////////////////////////////////////
var JanusController = require('./Janus-Controller.js');
var listOfJanus = {};
var listOfRoom = {};

function initJanus(janusIP) {
	JanusController.init({
		debug : true, 
		callback : null
	});
	
	listOfJanus[janusIP].janusController = new JanusController({
		server: janusIP,
		success: function() {
			console.log('JanusController(' + janusIP + ') initial finish');
			attachAdminPlugin(janusIP);
		},
		error: function(error) {
			console.log(error);
		},
		destroyed: function() {
			console.log("destroyed");
		}
	});
}

function checkCourseOnPath (roomname, targetIP, callback){
	var sourceIP = listOfRoom[roomname].mainServer;
	var sourceIP_ = sourceIP.split(':4000/janus')[0] + ':4040';
	var targetIP_ = targetIP.split(':4000/janus')[0] + ':4040';
	var path = spMatrix[sourceIP_][targetIP_];

	checkCourseOnJanus(roomname, path, path.length-1, function (result) {
		return callback(result);
	});
}

function checkCourseOnJanus (roomname, path, i, callback) {
	var path_ =  path[i].split(':4040')[0] + ':4000/janus';
	if(listOfRoom[roomname].janusServer[path_].state == 'on') {
		return true;
	} else if(listOfRoom[roomname].janusServer[path_].state == 'connecting') {
		while (true) { //check connecting finish
			console.log("Check Janus Connecting Is Finish...");
			if(listOfRoom[roomname].janusServer[path_].state == 'on'){
				console.log('Connecting Finish');
				break;
			}
			sleep(1000);
		}
		return true;
	} else {
		if (path[i-1] == listOfRoom[roomname].mainServer) {
			console.log('Error : source janus server dont have the course');
			return false;
		}
		if (checkCourseOnJanus (roomname, path, i-1)) {
			var parentIP = path[i-1].split(':4040')[0] + ':4000/janus';
			notifyRelayStream(roomname, parentIP, path_, function (result) {
				return callback(result);
			});
		}
	}
}

function sleep(milliseconds) {
	var start = new Date().getTime();
	for (var i = 0; i < 1e7; i++) {
		if ((new Date().getTime() - start) > milliseconds){
			break;
		}
	}
}

function notifyRelayStream(roomname, parentIP, childIP, callback){
	attachQueryPlugin(roomname, parentIP, childIP, function (parentSDP) { 
		attachPublisherPlugin(roomname, childIP, parentIP, parentSDP, function (childSDP) { 
			askParentStart(roomname, parentIP, childSDP, function (result) {
				if(result) {
					listOfRoom[roomname].janusServer[childIP].state == 'on';
					return callback(true);
				}
			}); 
		});
	});
}

function attachQueryPlugin (roomname, janusIP, childIP, callback) {
	console.log('attachQueryPlugin');
	var thisCourse = listOfRoom[roomname].janusServer[janusIP];
	listOfJanus[janusIP].janusController.attach({
		plugin: "janus.plugin.videoroom",
		success: function(pluginHandle) {
			console.log("pluginQuery(" + roomname + ") Plugin attached! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");			
			thisCourse.pluginQuery = pluginHandle;
			joinRoom(roomname, janusIP);
		},
		error: function(error) {
			console.log("Error attaching plugin... " + error);
		},
		onmessage: function(msg, jsep) {
			console.log("Got a message (pluginQuery) : " + JSON.stringify(msg));
			var event = msg["videoroom"];
			if(event != undefined && event != null) {
				if(event === "joined") {
					console.log("Successfully joined room " + msg["room"] + " with ID " + msg["id"]);
					thisCourse.userid = msg["id"];
					if(msg["publishers"] !== undefined && msg["publishers"] !== null) { //attach a plugin to be a course listener
						var list = msg["publishers"];
						console.log("Got a list of available publishers/feeds:" + JSON.stringify(list));
						for(var f in list) {
							thisCourse.publisherid = list[f]["id"];
							thisCourse.publishername = list[f]["display"];
							console.log("Get publisher : [" + thisCourse.publisherid + "] " + thisCourse.publishername);
							attachListenerPlugin(roomname, janusIP, function (jsep) {
								return callback(jsep);
							});
							break;
						}
					}
				} 
				else if(event === "event") {
					if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
						console.log("The publisher left: " + msg["leaving"]);
					} else if(msg["message"] !== undefined && msg["message"] !== null) {
						console.log("Get message: " + msg["message"]);
						var array = msg["message"].split(':');
						var message = array[0];
						if (message === 'b') {
							if(listOfRoom[roomname] !== undefined)
								if(listOfRoom[roomname].janusServer[childIP] !== undefined) {
									var childCourse = listOfRoom[roomname].janusServer[childIP];
									if(parseInt(array[1], 10) !== childCourse.userid) {

										var broadcastmessage = { 
											"request": "broadcastmessage",
											"userId" : childCourse.userid, 
											"message" : array[0] + ":" + childCourse.userid + ":" + array[2] + ":" + array[3]
										};
										childCourse.pluginPublisher.send({
											"message": broadcastmessage, 
											success: function(result) {
											}
										});
									}
								}
						}
					} else if(msg["error"] !== undefined && msg["error"] !== null) {
						console.log("Janus error: " + JSON.stringify(msg["error"]));
					}
				}
			}
			if(jsep !== undefined && jsep !== null) {
			}
		},
		oncleanup: function() {
			console.log("Got a cleanup notification.");
		}
	});
}

function joinRoom (roomname, janusIP) {
	console.log('joinRoom');
	var thisCourse = listOfRoom[roomname].janusServer[janusIP];
	// Join an stream session
	var register = { 
		"request": "join", 
		"room": thisCourse.roomid, 
		"ptype": "publisher", 
		"display": janusIP 
	};
	thisCourse.pluginQuery.send({"message": register});
}

function attachListenerPlugin (roomname, janusIP, callback) {
	var thisCourse = listOfRoom[roomname].janusServer[janusIP];
	listOfJanus[janusIP].janusController.attach({
		plugin: "janus.plugin.videoroom",
		success: function(pluginHandle) {
			console.log("pluginListener(" + roomname + ") Plugin attached! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");
			thisCourse.pluginListener = pluginHandle;
			// We wait for the plugin to send us an offer
			var listen = { 
				"request": "join", 
				"room": thisCourse.roomid, 
				"ptype": "listener",
				"feed": thisCourse.publisherid 
			};
			thisCourse.pluginListener.send({"message": listen});
		},
		error: function(error) {
			console.log("Error attaching plugin... " + error);
		},
		onmessage: function(msg, jsep) {
			console.log("Got a message (pluginListener) : " + JSON.stringify(msg));
			var event = msg["videoroom"];
			if(event != undefined && event != null) {
				if(event === "attached") {
					console.log("Successfully attached to feed " + thisCourse.publisherid + " (" + thisCourse.publishername + ") in room " + msg["room"]);
				} else {
					// What has just happened?
				}
			}
			if(jsep !== undefined && jsep !== null) {
				console.log('Send Listener SDP to control');
				return callback(jsep);
			}
		},
		oncleanup: function() {
			console.log("Got a cleanup notification (remote feed " + thisCourse.publisherid + ") : ");
		}
	});
}

function attachPublisherPlugin(roomname, janusIP, parentIP, listenerSDP, callback) {
	var thisCourse = listOfRoom[roomname].janusServer[janusIP];
	listOfJanus[janusIP].janusController.attach({
		plugin: "janus.plugin.videoroom",
		success: function(pluginHandle) {
			console.log("pluginPublisher(" + roomname + ") Plugin attached! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");
			thisCourse.pluginPublisher = pluginHandle;
			createRoom(roomname, janusIP);
		},
		error: function(error) {
			console.log("Error attaching plugin... " + error);
		},
		onmessage: function(msg, jsep) {
			console.log("Got a message (pluginPublisher) : " + JSON.stringify(msg));
			var event = msg["videoroom"];
			if(event != undefined && event != null) {
				if(event === "joined") {
					console.log("Negotiating WebRTC stream");
					thisCourse.userid = msg["id"];
					listenerSDP["sdp"] = listenerSDP["sdp"].replace(/sendrecv/g, "sendonly");
					console.log("Got publisher SDP!" + JSON.stringify(listenerSDP));
					var publish = { 
						"request": "configure", 
						"audio": true, 
						"video": true 
					};
					thisCourse.pluginPublisher.send({
						"message": publish, 
						"jsep": listenerSDP
					});
				} else if(event === "event") {
					//only watching a session, attach any feed.
					if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
						console.log("Room message: publisher (" + msg["leaving"] + ") leaving.");
					} else if(msg["message"] !== undefined && msg["message"] !== null) {
						console.log("Room message: " + msg["message"]);
						if(listOfRoom[roomname] !== undefined)
							if(listOfRoom[roomname].janusServer[parentIP] !== undefined) {
								var parentCourse = listOfRoom[roomname].janusServer[parentIP];

								var relaymessage = { 
									"request": "notifymessage",
									"userId" : parentCourse.publisherid, 
									"message" : msg["message"]
								};
								parentCourse.pluginQuery.send({
									"message": relaymessage, 
									success: function(result) {
									}
								});
							}
					} else if(msg["error"] !== undefined && msg["error"] !== null) {
						console.log("Janus error: " + JSON.stringify(msg["error"]));
					}
				}
			}
			if(jsep !== undefined && jsep !== null) {
				console.log('Send Publisher SDP to control');
				return callback(jsep);
			}
		},
		oncleanup: function() {
			console.log("Got a cleanup notification.");
		}
	});
}

function createRoom (roomname, janusIP) {
	var thisCourse = listOfRoom[roomname].janusServer[janusIP];
	console.log(janusIP);
	var create = { 
		"request": "create", 
		"description": roomname, 
		"bitrate": 512000, 
		"publishers": 1 
	};
	thisCourse.pluginPublisher.send({
		"message": create, 
		success: function(result) {
			var event = result["videoroom"];
			if(event != undefined && event != null) {
				// Stream session has been created, join it
				thisCourse.roomid = result["room"];
				console.log("Stream session has been created: " + thisCourse.roomid);
				var register = { 
					"request": "join", 
					"room": thisCourse.roomid, 
					"ptype": "publisher", 
					"display": janusIP 
				};
				thisCourse.pluginPublisher.send({"message": register});
			}
		}
	});
}

function askParentStart (roomname, janusIP, childSDP, callback) {
	var thisCourse = listOfRoom[roomname].janusServer[janusIP];
	var body = { 
		"request": "start", 
		"room": thisCourse.roomid 
	};
	thisCourse.pluginListener.send({
		"message" : body, 
		"jsep" : childSDP,
		success: function(result) {
			return callback(true);
		}
	});
}

function attachAdminPlugin(janusIP) {
	listOfJanus[janusIP].janusController.attach({
		plugin: "janus.plugin.videoroom",
		success: function(pluginHandle) {
			console.log("pluginAdmin Plugin attached! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");
			listOfJanus[janusIP].pluginAdmin = pluginHandle;
		},
		error: function(error) {
			console.log("Error attaching plugin... " + error);
		},
		onmessage: function(msg, jsep) {
			console.log("Got a message (pluginAdmin) : " + JSON.stringify(msg));
		},
		oncleanup: function() {
			console.log("Got a cleanup notification.");
		}
	});
}