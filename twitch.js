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
*/
class Twitch extends EventEmitter {


    constructor(client_id, client_ip, port, callback_url) {
        super()
        if (!(client_id && client_ip && port && callback_url))
            throw 'Lacking requirnments.'
        this.port = port;
        this.client_id = client_id;
        this.client_ip = client_ip;
        this.callback_url = callback_url;
        this.subscribed = {};
        this.server = http.createServer(this.serverListener.bind(this));

        this.server.listen(port, client_ip);
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
                        return
                    }
                    var sub = this.subscribed[name];
                    if (jsonData['data'].length == 0) {
                        this.emit('offline', sub);
                    } else {
                        if (sub['lastID'] != jsonData['data'][0]['id']) {
                            this.subscribed[name]['lastID'] = jsonData['data'][0]['id'];
                            this.emit('online', {
                                "name": sub['name'],
                                "channelID": sub['channelID'],
                                "image": jsonData['data'][0]['thumbnail_url'].replace('{height}', '720').replace('{width}', '1280') + '?' + Date.now(),
                                "title": jsonData['data'][0]['title'],
                                "started_at": jsonData['data'][0]['started_at'],
                                "logo": sub['logo'] + '?' + Date.now()
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
                'Content-Type': 'text/plain'
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
                'type': 'existing',
                'data': username
            })
            return
        }

        this.getUserByName(username, (jsonData) => {

            if (jsonData["_total"] == 0) {
                this.emit('message', {
                    'type': '404',
                    'data': username
                })
                return
            }

            var userID = jsonData['users'][0]["_id"];
            var name = jsonData['users'][0]["display_name"];
            var logo = jsonData['users'][0]["logo"];
            this.subscribeById(userID, name)
            this.subscribed[name.toLowerCase()] = {
                'interval': setInterval(this.subscribeById.bind(this), 864000000, userID, name),
                'name': name,
                'id': userID,
                'channelID': channelID,
                'logo': logo
            }
        })

    }


    getUserByName(username, callback) {
        var reqOpts = {
            hostname: "api.twitch.tv",
            port: 443,
            path: "/kraken/users?login=" + username,
            method: "GET",
            headers: {
                "Accept": "application/vnd.twitchtv.v5+json",
                "Client-ID": this.client_id
            }
        }

        https.get(reqOpts, (res) => {
            var data = ''
            res.on('data', (d) => {
                data += d;
            });
            res.on('end', () => {
                var jsonData = JSON.parse(data);
                callback(jsonData)

            })

        }).on('error', (e) => {
            console.error(e);
        });
    }

    subscribeById(user_id, username, unsub = false) {
        console.log((unsub ? "Unsubbing" : "Subbing ") + " UserID: " + username + " | " + user_id)
        var body = JSON.stringify({
            "hub.callback": 'http://' + this.callback_url + ":" + this.port + '/' + username,
            "hub.mode": (unsub ? "unsubscribe" : "subscribe"),
            "hub.topic": "https://api.twitch.tv/helix/streams?user_id=" + user_id,
            "hub.lease_seconds": "864000",
            "hub.secret": secret
        })

        var request = new https.request({
            hostname: "api.twitch.tv",
            port: 443,
            path: "/helix/webhooks/hub",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Client-ID": this.client_id,
                "Content-Length": Buffer.byteLength(body)
            }
        })

        request.end(body)
    }

    getSubscriptionsByChannel(channelID) {
        var usernames = [];
        for (var subKey in this.subscribed) {
            var sub = this.subscribed[subKey]
            if (sub.channelID == channelID)
                usernames.push(sub.name);
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
                        'type': '404',
                        'data': username
                    })
                    return
                }
                var userID = jsonData['users'][0]["_id"];
                var name = jsonData['users'][0]["display_name"];
                this.subscribeById(userID, name, true)

            })

        } else {

            var sub = this.subscribed[username.toLowerCase()]
            clearInterval(sub['interval'])
            this.subscribeById(sub['id'], sub['name'], true)
            delete this.subscribed[username.toLowerCase()]

        }
    }
}

module.exports = Twitch