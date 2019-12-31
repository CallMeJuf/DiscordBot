const DISABLED = false;

const Promise      = require('bluebird');
const YouTubeDL    = require('youtube-dl');
const EventEmitter = require('events');
const COLLECTION      = { MESSAGES: 'messages', EMOTES: 'emotes' };

const ENUMS        = {
    STOPPED_BY_USER : 'stopped_by_user',
    SKIPPED_BY_USER : 'skipped_by_user',
    MONGO           : {
        DB     : 'discord',
        PARAMS : {
            INCR   : { '$inc': { count: 1 } },
            UPSERT : { upsert: true }
        },
        COLLECTION : {
            PLAYLISTS : 'playlists'
        }
    },
    ERROR : {
        PLAYLIST_EXISTS         : "Playlist already exists.",
        PLAYLIST_DOES_NOT_EXIST : "Playlist does not exist."
    }
};

Promise.promisifyAll(YouTubeDL);

const DISPATCHER_OPTS = {
    volume        : 1.0,
    bitrate       : 'auto',
    highWaterMark : 24
};
const VOLUME_MULTIPLIER = 0.005;

class Player extends EventEmitter {

    constructor({ Client, Config, MongoConnection, logAction }){
        super();
        this.command_char = Config.command_char;
        this.client = Client;
        this.guilds = {};
        this.MongoConnection = MongoConnection;
        this.logAction = logAction;

        this.Commands = [{
			    name  : "play",
                func  : (msg) => this.playURLsMessage(msg),
                info  : "[link] - Plays requested link, or adds link to queue.",
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}play`;
                }
            }, {
			    name  : "playnext",
                func  : (msg) => this.playURLsMessage(msg, true),
                info  : "[link] - Plays requested links next.",
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}playnext`;
                }
            }, {
			    name  : "search",
                func  : (msg) => this.search(msg),
                info  : "[term] - Searches YouTube and adds the first result to the end of the queue.",
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}search`;
                }
            }, {
			    name  : "searchnext",
                func  : (msg) => this.search(msg, true),
                info  : "[term] - Searches YouTube and adds the first result to the beginning of the queue.",
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}searchnext`;
                }
	    }, {
                name  : "vol",
                func  : (msg) => this.vol(msg),
                info  : `[0-100] - Sets volume, ${Config.command_char}vol to get volume.`,
                match : (msg) => this.verifyMatch(msg, "vol")
            }, {
                name  : "stop",
                func  : (msg) => this.stop(msg),
                info  : "Stop the player but keep the queue.",
                match : (msg) => this.verifyMatch(msg, "stop")

            }, {
                name  : "clear",
                func  : (msg) => this.stop(msg, true),
                info  : "Stop player and clear queue.",
                match : (msg) => this.verifyMatch(msg, "clear")

            }, {
                name  : "list",
                func  : (msg) => this.list(msg),
                info  : `**${Config.command_char}queue** - Get current playlist.`,
                match : (msg) => this.verifyMatch(msg, ["list", "queue"])
            }, {
                name  : "skip",
                func  : (msg) => this.skip(msg),
                info  : `[n] - Skips current (or #n in queue) song.`,
                match : (msg) => this.verifyMatch(msg, "skip")
            }, {
                name  : "save",
                func  : (msg) => this.save(msg),
                info  : `[name] - Saves playlist under 'name'.`,
                match : (msg) => this.verifyMatch(msg, "save")
            }, {
                name  : "load",
                func  : (msg) => this.load(msg),
                info  : `[name] - Loads playlist under 'name'.`,
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}load`;
                }
            }, {
                name  : "playlists",
                func  : (msg) => this.playlists(msg),
                info  : `Prints a list of available playlists.`,
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}playlists`;
                }
            }, {
                name  : "playlist",
                func  : (msg) => this.playlist(msg),
                info  : `[name] - Prints a list of songs in 'name' playlist.`,
                match : msg => {
                    return msg.member && msg.member.voice.channel && msg.content.split(' ')[0] == `${this.command_char}playlist`;
                }
            }, {
                name  : "playing",
                func  : (msg) => this.playing(msg),
                info  : `Prints currently playing song.`,
                match : msg => this.verifyMatch(msg, "playing")
            }];
    }

    verifyMatch(msg, command_names){
        if ( !Array.isArray(command_names) ){
            command_names = [command_names];
        }
        if ( !command_names.map( name => this.command_char + name ).includes(msg.content.split(' ')[0].toLowerCase()) ) { return false; }
        let vc = this.client.voice.connections.get(msg.guild.id);
        return ( vc && msg.member && msg.member.voice.channel && msg.member.voice.channel.id == vc.channel.id );
    }

    skip(msg){
        let split = msg.content.split(' ');
        let skip_num = -1;
        if ( split.length > 1 && !isNaN(split[1]) ){
            skip_num = split[1] - 1;
        }
        if ( skip_num < 0 ){
            this.client.voice.connections.get(msg.guild.id).dispatcher.end(ENUMS.SKIPPED_BY_USER);
        } else {
            this.guilds[msg.guild.id].playlist[skip_num].skip = true;
        }
    }

    playing(msg) {
        let cur_song = this.guilds[msg.guild.id].current_song;
        return msg.reply(this.guilds[msg.guild.id].playlist[cur_song].title);
    }

    playlists(msg){
        return this.getPlaylists({ gid: msg.guild.id })
            .then( playlists => {
                msg.reply(`Playlists: ${playlists.map(list => list.name).join()}`);
            });
    }

    playlist(msg){

        let split = msg.content.split(" ");

        if ( split.length < 2 ) { return false; }
        let playlist_name = split[1];

        return this.getPlaylist({ gid: msg.guild.id, name: playlist_name })
            .then(playlist => {

                let reply_str = [`**${playlist_name}:**\n`];
    
                playlist.playlist.forEach( (song, index) => {
                    let addt_str = `**${index + 1})** ${song.title}\n`;

                    if ( reply_str[reply_str.length - 1].length + addt_str.length > 1800 ){
                        reply_str.push(addt_str);
                    } else {
                        reply_str[reply_str.length - 1] += addt_str;
                    }
        
                });
        
                reply_str.forEach( str => msg.reply(str));

            })
            .catch( err => {
                if ( err.message == ENUMS.ERROR.PLAYLIST_DOES_NOT_EXIST ){
                    msg.reply("that playlist doesn't exist.");
                } else {
                    console.log(`Error listing playlist data for playlist '${playlist_name}'`);
                    console.log(err);
                }
            });
        
    }
    
    load(msg){
        let split = msg.content.split(" ");

        if ( split.length < 2 ) { return false; }
        let playlist_name = split[1];
        return this.getPlaylist({ gid: msg.guild.id, name: playlist_name })
            .then( playlist => {
                return this.playURLs({
                    urls          : playlist.playlist.map( item => item.request_url ),
                    gid           : msg.guild.id,
                    voiceChannel  : msg.member.voice.channel,
                    playlist_name : playlist.name
                });
            });
    }

    save(msg){

        if ( !this.guilds[msg.guild.id] || !this.guilds[msg.guild.id].playlist ) { return false; }
        let split = msg.content.split(' ');
        let playlist = {
            playlist : this.guilds[msg.guild.id].playlist.map( entry => { 
                        delete entry.url;
                        return entry;
                    }),
            gid : msg.guild.id
        };

        if ( split.length > 1 ){
            playlist.name = split[1];
        } else if ( this.guilds[msg.guild.id].playlist_name ){
            playlist.name = this.guilds[msg.guild.id].playlist_name;
        }
           
        if ( playlist.name == this.guilds[msg.guild.id].playlist_name )  { playlist.force = true; }

        return this.createPlaylist(playlist).then(() => { this.guilds[msg.guild.id].playlist_name = playlist.name; }).catch(err => { console.log(err); });
    }

    list(msg){

        let reply_str = [`**Playlist:**\n`];
        
        if ( this.guilds[msg.guild.id].playlist_name ) { reply_str = [`**Playlist (${this.guilds[msg.guild.id].playlist_name}):**\n`]; }
        this.guilds[msg.guild.id].playlist.forEach( (song, index) => {
            let addt_str;
            if ( index == this.guilds[msg.guild.id].current_song ){
                addt_str = `**${index + 1}) ${song.title}**\n`;
            } else {
                if ( song.skip ){
                    addt_str = `~~${index + 1}) ${song.title}~~\n`;

                } else {
                    addt_str = `**${index + 1})** ${song.title}\n`;

                }
            }
                
            if ( reply_str[reply_str.length - 1].length + addt_str.length > 1800 ){
                reply_str.push(addt_str);
            } else {
                reply_str[reply_str.length - 1] += addt_str;
            }

        });

        reply_str.forEach( str => msg.reply(str));
    }

    stop(msg, clear_queue = false){
        let vc = this.client.voice.connections.get(msg.guild.id);
        if ( clear_queue ) {
            this.guilds[msg.guild.id].current_song = 0;
            this.guilds[msg.guild.id].playlist = [];
            this.guilds[msg.guild.id].skip = [];
        }
        if ( vc.dispatcher ){
            vc.dispatcher.end(ENUMS.STOPPED_BY_USER);
        } else {
            vc.disconnect(ENUMS.STOPPED_BY_USER);
        }
    }

    vol(msg){
        let split = msg.content.split(' ');
        if ( split.length == 2 ){
            if ( !isNaN(split[1]) && split[1] >= 0 && split[1] <= 100 ){
                this.setVolume(msg.guild.id, split[1]);
            }
        }
    }

    getCommands(){  
	    return this.Commands;
    }

    setVolume(gid, volume) {
        if ( !this.guilds[gid] ) { return; }
        this.guilds[gid].volume = volume * VOLUME_MULTIPLIER;
        let vc = this.client.voice.connections.get(gid);
        if ( vc && vc.dispatcher ){
            vc.dispatcher.setVolumeLogarithmic(this.guilds[gid].volume);
        }
    }

    search(msg, add_to_top = false){
        let urls = msg.content.slice(8).split('\n');
        this.logAction({ plugin: "player", action: "playURLs", data: { uid: msg.author.id, gid: msg.guild.id, urls: urls } });
        return this.playURLs({
            urls         : urls,
            gid          : msg.guild.id,
            add_to_top   : add_to_top,
            search       : true,
            voiceChannel : msg.member.voice.channel
        });
    }

    playURLsMessage(msg, add_to_top = false){
        let urls = msg.content.split(/[\s\n]+/);
        urls.splice(0, 1);
        this.logAction({ plugin: "player", action: "playURLs", data: { uid: msg.author.id, gid: msg.guild.id, urls: urls } });
        return this.playURLs({
            urls         : urls,
            gid          : msg.guild.id,
            add_to_top   : add_to_top,
            voiceChannel : msg.member.voice.channel
        });
    }

    playURLs({ urls, gid, add_to_top = false, voiceChannel, playlist_name = false, search = false }) {
        gid = `${gid}`;
        if ( !this.guilds[gid] || playlist_name ) {
            this.guilds[gid] = {};
            this.guilds[gid].playlist = [];
            this.guilds[gid].playlist_name = playlist_name;
            this.guilds[gid].current_song = 0;
        }
        Promise.mapSeries(urls, url => {
            let file = { length: 10 };

            let info;

            if ( search ) {
                info = YouTubeDL.getInfoAsync(url, ['--no-playlist', '--default-search', 'ytsearch'], {});
            } else {
                info = YouTubeDL.getInfoAsync(url, ['--no-playlist'], {});
            }
            return info
                .then( info => {
                    file.retrieved_at = Date.now();
                    file.length       = info._duration_raw;
                    file.url          = info.url;
                    file.title        = info.fulltitle;
                    file.request_url  = search ? info.webpage_url : url;
                    if ( add_to_top ){
                        this.guilds[gid].playlist.splice(1 + this.guilds[gid].current_song, 0, file);
    
                    } else {
                        this.guilds[gid].playlist.push(file);
                    }
                    let vc = this.client.voice.connections.get(gid);
                    if ( !vc ){
                        return voiceChannel.join()
                            .then( connection => {
                                this.play(gid);
                            });
                    }
                })
              .catch( err => {
                  console.log("ERR");
                  console.log(err);
              })
              .then(() => Promise.delay(500 * ( playlist_name ? 20 : 1 )) );
        });

    }

    createPlaylist({ gid, name = Date.now(), playlist = [], force = false }) {
        let db;
        let search_obj = {
            gid  : `${gid}`,
            name : `${name}`
        };
        return this.MongoConnection
        .then( (client) => {
            db = client.db(ENUMS.MONGO.DB);
            return db.collection(ENUMS.MONGO.COLLECTION.PLAYLISTS).findOne(search_obj);
        })
        .then( results => {
            if ( results && !force ){
                return Promise.reject(new Error(ENUMS.ERROR.PLAYLIST_EXISTS));
            }
            let playlist_obj = {
                gid        : `${gid}`,
                name       : `${name}`,
                safename   : `${name.toLowerCase()}`,
                playlist   : playlist,
                created_at : Date.now(),
                updated_at : Date.now()
            };

            if ( results ){
                return db.collection(ENUMS.MONGO.COLLECTION.PLAYLISTS).updateOne(search_obj, { $set: playlist_obj })
                .then( res => {
                    return playlist_obj;
                });
            } else {
                return db.collection(ENUMS.MONGO.COLLECTION.PLAYLISTS).insertOne(playlist_obj)
                .then( res => {
                    return playlist_obj;
                });
            }
        })
        .catch( (err) => {
            if ( err.message == ENUMS.ERROR.PLAYLIST_EXISTS ) { return err; }
            console.log("ERROR CREATING PLAYLIST");
            console.log(err.message);
            return err;
        });        
    }

    getPlaylist({ gid, name }) {
        let db;
        return this.MongoConnection
        .then( (client) => {
            db = client.db(ENUMS.MONGO.DB);
            return db.collection(ENUMS.MONGO.COLLECTION.PLAYLISTS).findOne({
                gid      : `${gid}`,
                safename : `${name.toLowerCase()}`
            });
        })
        .then( results => {
            if ( !results ) { return Promise.reject(new Error(ENUMS.ERROR.PLAYLIST_DOES_NOT_EXIST)); }
            return results;
        })
        .catch( (err) => {
            console.log("ERROR GETTING PLAYLIST");
            console.log(err.message);
            return Promise.reject(err);
        });        
    }

    getPlaylists({ gid }) {
        let db;
        return this.MongoConnection
        .then( (client) => {
            db = client.db(ENUMS.MONGO.DB);
            return db.collection(ENUMS.MONGO.COLLECTION.PLAYLISTS).find({ gid: `${gid}` }).toArray();
        })
        .then( results => {
            if ( !results ) { return Promise.reject(new Error(ENUMS.ERROR.PLAYLIST_DOES_NOT_EXIST)); }
            return results;
        })
        .catch( (err) => {
            console.log("ERROR GETTING PLAYLIST");
            console.log(err.message);
            return Promise.reject(err);
        });        
    }

    updatePlaylist({ gid, name, playlist }) {
        let db;
        return this.MongoConnection
        .then( (client) => {
            db = client.db(ENUMS.MONGO.DB);
            return db.collection(ENUMS.MONGO.COLLECTION.PLAYLISTS).updateOne({
                gid      : `${gid}`,
                safename : `${name.toLowerCase()}`
            }, {
                $set : {
                    playlist   : playlist,
                    updated_at : Date.now()
                }
            });
        })
        .then( results => {
            return results;
        })
        .catch( (err) => {
            if ( err.message == ENUMS.ERROR.PLAYLIST_EXISTS ) { return err; }
            console.log("ERROR CREATING PLAYLIST");
            console.log(err.message);
            return err;
        });        
    }


    play(gid, attempt = 0){
        let song = this.guilds[gid].playlist[this.guilds[gid].current_song];
        let vc = this.client.voice.connections.get(gid);
        let dispatcher;
        try {
            dispatcher = vc.play(song.url, DISPATCHER_OPTS);
        } catch ( error ){
            if ( attempt > 3 ){
                this.guilds[gid].current_song++;
                while ( this.guilds[gid].current_song < this.guilds[gid].playlist.length && this.guilds[gid].playlist[this.guilds[gid].current_song].skip ){ 
                    this.guilds[gid].current_song++;
                }
                if ( this.guilds[gid].current_song < this.guilds[gid].playlist.length ) {
                    return this.play(gid);
                } else {
                    this.guilds[gid] = {};
                    this.guilds[gid].playlist = [];
                    this.guilds[gid].playlist_name = false;
                    this.guilds[gid].current_song = 0;
                    return vc.disconnect();
                }
            } else {
                return this.play(gid, attempt + 1);
            }
        }

        this.setVolume(gid, 100);
        vc.dispatcher.on('end', (reason) => {
            if ( this.guilds[gid].playlist.length && reason != ENUMS.STOPPED_BY_USER ){
                this.guilds[gid].current_song++;
                while ( this.guilds[gid].current_song < this.guilds[gid].playlist.length && this.guilds[gid].playlist[this.guilds[gid].current_song].skip ){ 
                    this.guilds[gid].current_song++;
                }
                if ( this.guilds[gid].current_song < this.guilds[gid].playlist.length ) {
                    return this.play(gid);
                } else {
                    this.guilds[gid] = {};
                    this.guilds[gid].playlist = [];
                    this.guilds[gid].playlist_name = false;
                    this.guilds[gid].current_song = 0;
                    return vc.disconnect(reason);
                }

            } else {
                vc.disconnect(reason);
            }
        });
    }
}

module.exports = DISABLED ? false : Player;
