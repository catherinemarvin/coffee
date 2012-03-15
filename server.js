var express = require('express');
var nowjs = require('now');
var redis = require('redis')

server = express.createServer();

var everyone = nowjs.initialize(server, {socketio:{"log level": process.argv[2]}});

var client = redis.createClient()

/*
Here I lay out the database design.

Username -> Hash with these fields:
	password
	email
	house

maxHouseId -> String:
	000000 (6 digit, increments by 1 each time)

houseIds -> Set
	contains all houseIds

houseId_members -> Set 

houseId_chores -> Set of chore names
	ex. dishes

houseId_chore_${CHORENAME}_people -> Sorted Set with elements:
	Person NumTimesDone

houseId_chore_${CHORENAME}_rotation -> List
	["Daily"], ["Weekly","Monday"], ["Monthly","2"]

houseId_todos -> Set of things to do

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

server.get('/', function (req, res){
	res.render("index");
});

server.get('/manage', function (req, res) {
	res.render("manage");
});

server.get('/splash', function (req, res) {
	res.render("splash");
});

server.get('/create', function (req, res) {
	res.render("create");
});

server.get('/join', function (req, res) {
	res.render("join");
})

everyone.now.tryRegister = function (userJSON) {
	var self = this;
	var username = userJSON.username;
	var password = userJSON.password;
	var email = userJSON.email;
	client.exists(username, function (err, obj) {
		console.log(obj)
		if (obj == 0) {
			client.HMSET(username, {
			"password" : password,
			"email" : email,
			"house" : "None"
			});
		} else {
			console.log("haro")
			self.now.failRegister()
		}
	});
}

everyone.now.tryLogin = function (userJSON) {
	var self = this;
	var username = userJSON.username;
	var password = userJSON.password;

	client.exists(username, function (err, obj) {
		console.log(obj)
		if (obj == 1) {
			client.hgetall(username, function (err, obj) {
				if (obj.password == password) {
					self.now.finishLogin(obj.house);
				} else {
					self.now.failLogin();
				}
			});
		} else {
			self.now.failLogin();
		}
	});

}

everyone.now.tryJoin = function (houseId, cb) {
	var self = this;
	console.log("joining: " + houseId)
	client.exists(houseId, function (err, obj) {
		if (obj == 1) {
			client.hgetall(houseId, function (err, obj) {

			});
		} else {
			cb("DNE");
		}
	});
}

everyone.now.generateId = function (cb) {
	var self = this;
	client.exists("maxHouseId", function (err, obj) {
		if (obj == 0) {
			client.set("maxHouseId", "000000", function (err, res) {
				cb("000000");
			});
		} else {
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
					cb(arg)
				});
			});
		}
	});
}












server.listen(80);
console.log("Express server listening on port %d", server.address().port);
