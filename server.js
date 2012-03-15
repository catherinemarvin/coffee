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

houseId_members -> Set 

houseId_chores -> Set of chore names
	ex. dishes

houseId_${CHORENAME} -> Sorted Set with:
	Person NumTimesDone


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
	client.exists(houseId, function (err, obj) {
		if (obj == 1) {
			client.hgetall(houseId, function (err, obj) {

			});
		} else {
			cb("DNE");
		}
	})
}














server.listen(80);
console.log("Express server listening on port %d", server.address().port);
