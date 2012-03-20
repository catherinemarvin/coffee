var express = require('express');
var nowjs = require('now');
var redis = require('redis')

server = express.createServer();

var everyone = nowjs.initialize(server, {socketio:{"log level": process.argv[2]}});

var client = redis.createClient()

/*
Here I lay out the database design.

user_Username -> Hash with these fields:
	password //eventually this will be hashed but right now it's plain-text. :3
	email
	house

maxHouseId -> String:
	000000 (6 digit, increments by 1 each time).
	//TODO: Use an actual UUID

houseIds -> Set
	contains all houseIds
	ex. {000001, 000002}

houseId_members -> Set 
	ex. {mordekaiser, rdash}

houseId_chores -> Set of chore names
	ex. {dishes, trash}

houseId_chore_${CHORENAME}_people -> Sorted Set with elements:
	Person NumTimesDone

houseId_chore_${CHORENAME}_rotation -> String
	"Daily"
	"Weekly:Monday"

houseId_todos -> Set of things to do
	ex. {"Complain about faucet", "annoy neighbors"}

houseId_todo_${TODONAME}_people -> Set with elements:
	Person

*/

server.set('view options', {
	layout: false
});

server.set('view engine', 'ejs');

// Configuration
server.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
server.set('views', __dirname + '/views');
server.use("/static", express.static(__dirname + '/static'));

/* 

Eventually I want there to be three pages only: splash page, pre-house, and house.

For ease of testing everything is separated since I don't want to deal with the CSS. But soon!

*/
server.get('/', function (req, res){
	res.render("index");
});

server.get('/manage', function (req, res) {
	res.render("manage");
});

server.get('/splash', function (req, res) {
	res.render("splash");
});

server.get('/lookupmembers/:house', function (req, res) {
	console.log(req.params.house)
	var foo = [{"id":"856","name":"House"}, {"id":"1035","name":"Desperate Housewives"}, {"id":"1048","name":"Dollhouse"}, {"id":"1113","name":"Full House"}]
	res.send(foo);
});

everyone.now.tryRegister = function (userJSON) {
	var self = this;
	var username = userJSON.username;
	var password = userJSON.password;
	var email = userJSON.email;
	client.exists("user_"+username, function (err, obj) {
		//console.log(obj)
		if (obj == 0) {
			client.HMSET("user_"+username, {
			"password" : password,
			"email" : email,
			"house" : "None"
			}, function (err, res) {
				self.now.finishRegister(username);
			});
		} else {
			//console.log("haro")
			self.now.failRegister();
		}
	});
}

everyone.now.tryLogin = function (userJSON) {
	var self = this;
	var username = userJSON.username;
	var password = userJSON.password;

	client.exists("user_"+username, function (err, obj) {
		console.log(obj)
		if (obj == 1) {
			client.hgetall("user_"+username, function (err, obj) {
				if (obj.password == password) {
					self.now.finishLogin(username, obj.house);
				} else {
					self.now.failLogin();
				}
			});
		} else {
			self.now.failLogin();
		}
	});

}

everyone.now.tryJoin = function (username, houseId, cb) {
	var self = this;
	console.log("joining: " + houseId)
	client.sismember("houseIds", houseId, function (err, obj) {
		if (obj == 1) {
			client.hset('user_'+username, 'house', houseId, function (err, obj) {
				cb("success");
			});
		} else {
			cb("DNE");
		}
	});
}

everyone.now.generateId = function (username, cb) {
	var self = this;
	client.exists("maxHouseId", function (err, obj) {
		if (obj == 0) {
			client.set("maxHouseId", "000000", function (err, res) {
			});
		}
		client.incr("maxHouseId", function (err, res) {
			var res = parseInt(res)
			var arg = null
			/* Yes, this is probably the worst code I have ever written in my life */
			if (res < 10) {
				arg = "00000" + res;
			} else if (res < 100) {
				arg = "0000" + res;
			} else if (res < 1000) {
				arg = "000" + res;
			} else if (res < 10000) {
				arg = "00" + res;
			} else if (res < 100000) {
				arg = "0" + res;
			} else {
				arg = res
			}
			client.sadd("houseIds", arg, function (err, res) {
				client.hset(username, "house", arg, function (err, res) {
					client.sadd(arg+"_members", username, function (err, res) {
						cb(arg);
					});	
				});
			});
		});
	});
}

everyone.now.getChores = function (house) {
	var self = this;
	console.log("GRABBING CHORES");
	client.sismember("houseIds", house, function (err, obj) {
		if (obj == 0) {
			console.log('wat')
		} else {
			client.smembers(house+"_chores", function (err, obj) { //cb arg: a list of JSON of: {chore, rotation, person}
				var toReturn = []
				for (item in obj) {
					var chore = obj[item]
					client.zrange(house+"_chore_"+obj[item]+"_people", 0,-1, function (err, obj) {
						var person = obj[0]
						client.get(house+"_chore_"+chore+"_rotation", function (err, obj) {
							var rotation = obj;
							//cb({"chore" : chore, "rotation" : rotation, "person" : person});
							self.now.appendChore({"chore" : chore, "rotation" : rotation, "person" : person});
						});
					});
				}
			});
		}
	});
}

/*
houseId_chores -> Set of chore names
	ex. {dishes, trash}

houseId_chore_${CHORENAME}_people -> Sorted Set with elements:
	Person NumTimesDone

houseId_chore_${CHORENAME}_rotation -> String
	"Daily"
	"Weekly:Monday"

	cb("done")
*/

everyone.now.insertChore = function (choreJSON, cb) {
	var self = this;
	var house = choreJSON.house;
	var person = choreJSON.person;
	var rotation = choreJSON.rotation
	var chore = choreJSON.chore
	client.sismember(house+"_chores", chore, function (err, obj) {
		if (obj == 1) {
			cb("failure");
		} else {
			client.sadd(house+"_chores", chore, function (err, obj) {
				client.zadd(house+"_chore_"+chore+"_people", 0, person, function (err, obj) {
					client.set(house+"_chore_"+chore+"_rotation", rotation, function (err, obj) {
						cb("done")
					})
				})
				
			});
		}
	});
}

server.listen(80);
console.log("Express server listening on port %d", server.address().port);
