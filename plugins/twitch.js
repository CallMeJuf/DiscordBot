const DISABLED = false;

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const EventEmitter = require('events').EventEmitter;
const secret = crypto.randomBytes(16).toString();

/* Sub array 
Key     : name.toLowerCase()
interval: reference to webhook timer
id      : Twitch userID
channelID:Discord ID
logo    : url to logo pic
*/

/* Online Object 
Key         : name.toLowerCase()
interval    : reference to webhook timer
id          : Twitch userID
channelID   : Discord ID
image       : Thumbnail image URL
title       : Stream title
started_at  : String date (2018-07-26T09:05:24Z)
game        : Game name 
*/
class Twitch extends EventEmitter {


    constructor({ Client, Config, Discord }) {
        super();
        if (!( Config.Twitch && Config.Twitch.client_id && Config.Twitch.client_ip && Config.Twitch.port && Config.Twitch.callback_url && Config.Twitch.allowed_users))
            { throw 'Lacking requirnments.'; }
        this.port = Config.Twitch.port;
        this.client_id = Config.Twitch.client_id;
        this.client_ip = Config.Twitch.client_ip;
        this.callback_url = Config.Twitch.callback_url;
        this.subscribed = {};
        this.server = http.createServer(this.serverListener.bind(this));
        this.authorized_users = Config.Twitch.allowed_users;
        this.server.listen(Config.Twitch.port, Config.Twitch.client_ip);

        this.Commands = [{
            name : "follow",
            func : (message) => {
                this.subscribeByName(message.content.split(' ')[1], message.channel.id);
            },
            info  : "Follow a user on Twitch",
            match : (message) => {
                if ( !this.authorized_users.includes(message.author.id) )
                    { return false; }
                let split = message.content.split(' ');
                if ( split[0] != `${Config.command_char}follow` || split.length != 2 || split[1].match(/[^0-9a-zA-Z]/))
                    { return false; }
                return true;
            }
        }, {
		    name : "unfollow",
            func : (message) => {
                this.unsubscribeByName(message.content.split(' ')[1], message.channel.id);
            },
            info  : "Unfollow a user on Twitch",
            match : (message) => {
                if ( !this.authorized_users.includes(message.author.id) )
                    { return false; }
                let split = message.content.split(' ');
                if ( split[0] != `${Config.command_char}unfollow` || split.length != 2 || split[1].match(/[^0-9a-zA-Z]/))
                    { return false; }
                return true;
            }
        }, {
		    name  : "following",
            func  : (message) => this.following(message),
            info  : "List currently followed users on Twitch",
            match : (message) => {
                return this.authorized_users.includes(message.author.id) && message.content == `${Config.command_char}following`;
            }
        }];
        this.DiscordClient = Client;
        this.RichEmbed = Discord.MessageEmbed;
        Object.entries(Config.Twitch.default_subscriptions).forEach( channel => {
            let discord_channel = channel[0];
            channel[1].forEach( username => {
                this.subscribeByName(username, discord_channel);
            });
        });
    }

    getCommands() {
        return this.Commands;
    }

    following(message){
        let reply = "";
        let usernames = this.getSubscriptionsByChannel(message.channel.id);
        usernames.forEach( (username, index) => {
            reply += `**${index + 1})**  ${username}\n`;

        });

        if (usernames.length == 0){
          message.reply("Not following anyone.");
        } else {
          message.reply("**Following**\n" + reply);
        }
    }

    serverListener(req, res) {
        if (req.method == 'POST') {

            var incoming = req.headers['x-hub-signature'].split('=');

            var body = '';
            req.on('data', function (data) {
                body += data;
            });

            req.on('end', () => {
                var hash = crypto.createHmac(incoming[0], secret)
                    .update(body)
                    .digest('hex');

                if (incoming[1] != hash) {
                    console.log('Failed Hash Check');
                } else {
                    var url = req.url;
                    var jsonData = JSON.parse(body);
                    var name = url.substr(1).toLowerCase();
                    if (!this.subscribed.hasOwnProperty(name)) {
                        this.emit('message', `Recieved ${name} but isn't in sublist ${Object.keys(this.subscribed)}`);
                        return;
                    }
                    var sub = this.subscribed[name];
                    if (jsonData['data'].length == 0) {
                        this.emit('offline', sub);
                    } else {
                        if (!sub['lastID'].includes(jsonData['data'][0]['id'])) {
                            this.subscribed[name]['lastID'].push(jsonData['data'][0]['id']);
                            let game = false;

                            this.getGameByID(jsonData['data'][0]['game_id']).then( (g) => {
                                game = g['data'].length ? g['data'][0]['name'] : false;

                            })
                                .catch( (err) => {
                                    console.log("Couldn't get game, error: ");
                                    console.log(err);
                                })
                                .then( () => {
                                    let discord_channel = this.DiscordClient.channels.get(sub['channelID']);
                                    if (typeof discord_channel == 'undefined')
                                        { return; }
                                    
                                    let online_obj = {
                                        "name"       : sub['name'],
                                        "channelID"  : sub['channelID'],
                                        "image"      : jsonData['data'][0]['thumbnail_url'].replace('{height}', '720').replace('{width}', '1280') + '?' + Date.now(),
                                        "title"      : jsonData['data'][0]['title'],
                                        "started_at" : jsonData['data'][0]['started_at'],
                                        "logo"       : sub['logo'] + '?' + Date.now(),
                                        "game"       : game,
                                        "stream_id"  : jsonData['data'][0]['id']
                                    };

                                    let embed = new this.RichEmbed({
                                        'footer' : {
                                          'text' : 'Started Streaming'
                                        },
                                        'title'     : online_obj.name + ' is Streaming!',
                                        'thumbnail' : {
                                          'url' : (online_obj.logo ? online_obj.logo : "https://i.imgur.com/Hu00P2G.png")
                                        },
                                        'url'       : 'https://twitch.tv/' + online_obj.name,
                                        'timestamp' : new Date(online_obj.started_at),
                                        'fields'    : [{
                                          'name'  : (online_obj.title ? online_obj.title : "*None*"),
                                          'value' : 'Playing ' + (online_obj.game ? online_obj.game : " Unknown")
                                        }]
                                      });
                                  
                                    if (online_obj.image){
                                       embed.setImage(online_obj.image);
                                    }
                                    discord_channel.send(embed);
                                });

                        }
                    }
                }

            });
            res.writeHead(200);
            res.end();
        } else {
            var reqURL = req.url;
            var challenge = reqURL.match(/hub\.challenge=([^&]*)/);
            var challenge = (challenge ? challenge[1] : "Couldn't Find Challenge");
            res.writeHead(200, {
                'Content-Type' : 'text/plain'
            });
            res.end(challenge);
        }

    }


    /*
    Get userID from api via username and calls subByID on response.
    */

    subscribeByName(username, channelID = -1) {
        if (this.subscribed.hasOwnProperty(username.toLowerCase())) {
            this.emit('message', {
                'type' : 'existing',
                'data' : username
            });
            return;
        }

        this.getUserByName(username, (jsonData) => {

            if (jsonData["_total"] == 0) {
                this.emit('message', {
                    'type' : '404',
                    'data' : username
                });
                return;
            }

            var userID = jsonData['users'][0]["_id"];
            var name = jsonData['users'][0]["display_name"];
            var logo = jsonData['users'][0]["logo"];
            this.subscribeById(userID, name);
            this.subscribed[name.toLowerCase()] = {
                'interval'  : setInterval(this.subscribeById.bind(this), 864000000, userID, name),
                'name'      : name,
                'id'        : userID,
                'channelID' : channelID,
                'logo'      : logo,
                'lastID'    : []
            };
        });

    }


    getUserByName(username, callback) {
        var reqOpts = {
            hostname : "api.twitch.tv",
            port     : 443,
            path     : "/kraken/users?login=" + username,
            method   : "GET",
            headers  : {
                "Accept"    : "application/vnd.twitchtv.v5+json",
                "Client-ID" : this.client_id
            }
        };

        https.get(reqOpts, (res) => {
            var data = '';
            res.on('data', (d) => {
                data += d;
            });
            res.on('end', () => {
                var jsonData = JSON.parse(data);
                callback(jsonData);

            });

        }).on('error', (e) => {
            console.error(e);
        });
    }

    subscribeById(user_id, username, unsub = false) {
        console.log((unsub ? "Unsubbing" : "Subbing ") + " UserID: " + username + " | " + user_id);
        var body = JSON.stringify({
            "hub.callback"      : 'http://' + this.callback_url + ":" + this.port + '/' + username,
            "hub.mode"          : (unsub ? "unsubscribe" : "subscribe"),
            "hub.topic"         : "https://api.twitch.tv/helix/streams?user_id=" + user_id,
            "hub.lease_seconds" : "864000",
            "hub.secret"        : secret
        });

        var request = new https.request({
            hostname : "api.twitch.tv",
            port     : 443,
            path     : "/helix/webhooks/hub",
            method   : "POST",
            headers  : {
                "Content-Type"   : "application/json",
                "Client-ID"      : this.client_id,
                "Content-Length" : Buffer.byteLength(body)
            }
        });

        request.end(body);
    }

    getSubscriptionsByChannel(channelID) {
        var usernames = [];
        for (var subKey in this.subscribed) {
            var sub = this.subscribed[subKey];
            if (sub.channelID == channelID)
                { usernames.push(sub.name); }
        }
        return usernames;
    }

    getSubscriptions() {
        var usernames = [];
        for (var subKey in this.subscribed) {
            usernames.push(this.subscribed[subKey].name + "  -  " + this.subscribed[subKey].channelID);
        }
        return usernames;
    }

    unsubscribeByName(username) {

        if (!this.subscribed.hasOwnProperty(username.toLowerCase())) {

            this.getUserByName(username, (jsonData) => {
                if (jsonData["_total"] == 0) {
                    this.emit('message', {
                        'type' : '404',
                        'data' : username
                    });
                    return;
                }
                var userID = jsonData['users'][0]["_id"];
                var name = jsonData['users'][0]["display_name"];
                this.subscribeById(userID, name, true);

            });

        } else {

            var sub = this.subscribed[username.toLowerCase()];
            clearInterval(sub['interval']);
            this.subscribeById(sub['id'], sub['name'], true);
            delete this.subscribed[username.toLowerCase()];

        }
    }

    getGameByID(gameID){
        let cID = this.client_id;
        return new Promise(function(resolve, reject){
            var reqOpts = {
                hostname : "api.twitch.tv",
                port     : 443,
                path     : "/helix/games?id=" + gameID,
                method   : "GET",
                headers  : {
                    "Accept"    : "application/vnd.twitchtv.v5+json",
                    "Client-ID" : cID
                }
            };

            https.get(reqOpts, (res) => {
                var data = '';
                res.on('data', (d) => {
                    data += d;
                });
                res.on('end', () => {
                    var jsonData = JSON.parse(data);
                    resolve(jsonData);

                });

            }).on('error', (e) => {
                reject(e);
            });
        });
    }
}

module.exports = DISABLED ? false : Twitch;
