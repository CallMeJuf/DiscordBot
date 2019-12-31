const DISABLED = false;

const Promise      = require('bluebird');
const EventEmitter = require('events').EventEmitter;
const MONGO_DB        = 'discord';
const INCR            = { '$inc': { count: 1 } };
const UPSERT          = { upsert: true };
const TYPE            = { CHANNEL: 'CHANNEL', SERVER: 'SERVER', USER: 'USER' };
const COLLECTION      = { MESSAGES: 'messages', EMOTES: 'emotes' };
const EMOJI_REGEX     = /<[a-zA-Z0-9]?:([a-zA-Z0-9]+):([0-9]+)>/g;
const LOG_ALL         = true;

class Logger extends EventEmitter {
    constructor({ Client, MongoConnection }){
        super();
        this.id = Client.user.id;
        this.MongoConnection = MongoConnection;
        this.Commands = [{
            name : "log",
            func : (message) => {
                if ( message.author.id == this.id ) { return; }
  
                let emoji_match = RegExp(EMOJI_REGEX.source, EMOJI_REGEX.flags);
                let match;
                let emotes = [];
                while ( match = emoji_match.exec(message.content) ) { // eslint-disable-line no-cond-assign
                    emotes.push({ 
                      emote_id   : match[2],
                      emote_name : match[1],
                      user       : message.author.id,
                      server     : message.channel.guild ? message.channel.guild.id : "DM",
                      channel    : message.channel.id
                    });
                }
                Promise.mapSeries( emotes, emote => {
                    return this.logEmote(emote);
                });
            },
            info  : "Log Emote Usage",
            hide  : true,
            match : (message) => {
                let emoji_match = RegExp(EMOJI_REGEX.source, EMOJI_REGEX.flags);
                return emoji_match.test(message.content);
            }
        }, {
            name : "logAll",
            func : (message) => {
                this.logMessage({
                    message : message.id,
                    user    : message.author.id,
                    content : message.content,
                    server  : message.channel.guild ? message.channel.guild.id : "DM",
                    channel : message.channel.id
                  });
            },
	    hide  : true,
            info  : `Log All ${ LOG_ALL ? "Enabled" : "Disabled" }`,
            match : (message) => {
                return LOG_ALL;
            }
        }, {
            name : "emotestats",
            info : "Displays number of times emotes have been used.",
            func : (message) => {
                let getEmotes;
                let tokens = message.content.split(' ');
                if ( tokens.length == 2 ){
                  getEmotes = this.getEmotesByID(tokens[1]);
                } else {
                  getEmotes = this.getEmotesByServer(message.channel.guild.id);
                }

                getEmotes.then( emotes => {
                    if (emotes){
                        return emotes.toArray();
                    }
                    return [];
                })
                .then( emotes => {
                    if ( emotes.length == 0 ){
                        return message.reply("No emote used yet...");
                    }
            
                    let reply_str = ['Emotes:\n'];
                    emotes.forEach( emote => {
                        let emote_obj = Client.emojis.get(emote.emote_id);
                        let str = `:${emote.emote_name}: : ${emote.count}\n`;
                        if ( emote_obj ){
                            str = `${emote_obj} : ${emote.count}\n`;
                        }
                        if ( reply_str[reply_str.length - 1].length + str.length > 1800 ){
                            reply_str.push(str);
                        } else {
                            reply_str[reply_str.length - 1] += str;
                        }
                    });
                    reply_str.forEach( str => message.author.send(str));
            
                });
            }
        }];
    }

    getCommands(){
        return this.Commands;
    }

    logEmote({ emote_id, emote_name, user, server, channel }) {
        return this.MongoConnection
        .then( (client) => {

            let db = client.db(MONGO_DB);
            let logUser = () => {
                let match = { 
                    type       : TYPE.USER,
                    id         : user,
                    emote_id   : emote_id,
                    emote_name : emote_name
                }; 
                return db.collection(COLLECTION.EMOTES).updateOne(match, INCR, UPSERT);
            };

            let logServer = () => {
                let match = { 
                    type       : TYPE.SERVER,
                    id         : server,
                    emote_id   : emote_id,
                    emote_name : emote_name
                };
                return db.collection(COLLECTION.EMOTES).updateOne(match, INCR, UPSERT);
            };

            let logChannel = () => {
                let match = { 
                    type       : TYPE.CHANNEL,
                    id         : channel,
                    emote_id   : emote_id,
                    emote_name : emote_name
                };
                return db.collection(COLLECTION.EMOTES).updateOne(match, INCR, UPSERT);
            };

            return Promise.props({
                user    : logUser(),
                server  : logServer(),
                channel : logChannel()
            });
        })
        .catch( (err) => {
            console.log("ERROR Logging Emote");
            console.log(`emote_id: '${emote_id}',  emote_name: '${emote_name}',  user: '${user}',  server: '${server}',  channel: '${channel}'`);
            console.log(err.message);
        });
    
    }
    
    logMessage({ message, user, server, channel, content, update = false, deleted = false }) {
        return this.MongoConnection
        .then( (client) => {
            let db = client.db(MONGO_DB);

            return db.collection(COLLECTION.MESSAGES).insertOne({
                id      : message,
                uid     : user,
                message : content,
                server  : server,
                channel : channel,
                update  : update,
                deleted : deleted,
                ts      : Date.now()
            });
        })
        .catch( (err) => {
            console.log("ERROR Logging Message");
            console.log(`message: '${message}',  user: '${user}',  server: '${server}',  channel: '${channel}',  content: '${content}',  update: '${update}',  deleted: '${deleted}'`);
            console.log(err.message);
        });
    }
    
    getEmotesByServer(server) {
        return this.MongoConnection
        .then( (client) => {
            let db = client.db(MONGO_DB);
            return db.collection(COLLECTION.EMOTES).find({ id: server, type: TYPE.SERVER }).sort({ count: -1 });
        })
        .catch( (err) => {
            console.log(`ERROR Getting Emote for server ${server}`);
            console.log(err.message);
        });
    }
    
    getEmotesByID(id){
        return this.MongoConnection
        .then( (client) => {
            let db = client.db(MONGO_DB);
            return db.collection(COLLECTION.EMOTES).find({ id: id }).sort({ count: -1 });
        })
        .catch( (err) => {
            console.log(`ERROR Getting Emote for server ${id}`);
            console.log(err.message);
        });
    }

}

module.exports = DISABLED ? false : Logger;
