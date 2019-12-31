const DISABLED = false;

const Promise      = require('bluebird');
const EventEmitter = require('events');
const FS           = require('fs');

const DISPATCHER_OPTS = {
    volume        : false,
    bitrate       : 'auto',
    highWaterMark : 24
};
const VOLUME_MULTIPLIER = 0.005;

class Voices extends EventEmitter {

    constructor({ Client, Config, logAction }){
        super();
        this.voices = {};
        this.voices_dir = Config.voices_dir;
        this.Client = Client;
        this.logAction = logAction;
        this.loadVoices();
        this.Commands = [{
			    name : "voices",
                func : (msg) => this.listVoices(msg),
                info : "Lists voices."
            }, {
			    name  : "playVoice",
                func  : (msg) => this.playVoice(msg),
                info  : "Plays specified voice.",
                match : msg => {
                    let voice = msg.content.substr(1).toLowerCase();
                    if ( msg.content[0] != Config.command_char || !msg.member || !msg.member.voice || !msg.member.voice.channel || this.Client.voice.connections.get(msg.member.voice.channel.guild.id) ) { return false; }

                    return Object.values(this.voices).some( category => Object.keys(category).includes(voice));
                }
            }, {
                name : "reloadVoices",
                func : (msg) => this.loadVoices(),
                info : "Reloads Voices." 
            }];
    }

    // Folder structure for voices should be as follows
    // BaseDir ( this.voices_dir )
    //     |---> CategoryDir ( Ex: "SuperMario")
    //                   |---> VoiceNameDir ( Ex: "Coin" )
    //                                  |---> VoiceFiles ( Ex: "Coin1.mp3", "Coinsplosion.mp3" )
    loadVoices() {
        FS.readdirSync(this.voices_dir).forEach(category_file => { // Get files in BaseDir

            let category = category_file;
            let category_path = this.voices_dir + category_file;

            if ( !FS.statSync(category_path).isDirectory() ) { return; }

            let voices = {};

            FS.readdirSync(category_path).forEach( voice => { // Get files in CategoryDir
                let voice_path = category_path + '/' + voice;
                if ( !FS.statSync(voice_path).isDirectory() ) { return; }
                let voice_name = voice.toLowerCase();
                voices[voice_name] = [];
                
                FS.readdirSync(voice_path).forEach(file => { // Get files in VoicesDir
                  voices[voice_name].push(voice_path + '/' + file);
                });
            });

            if ( voices ) { this.voices[category] = voices; }
            FS.writeFileSync('./voices.json', JSON.stringify(this.voices, null, 2));
        });

    }

    getCommands(){  
	    return this.Commands;
    }

    listVoices(message) {
        let reply_str = ["Voices:\n"];
        Object.entries(this.voices).forEach( category => {
            let string_addition = `**----- ${category[0]} -----**\n`;
            string_addition += Object.keys(category[1]).sort().map(str => str[0].toUpperCase() + str.substr(1)).join(', ') + '\n';
            if ( reply_str[reply_str.length - 1].length + string_addition.length > 2000 ){
                reply_str.push(string_addition);
            } else {
                reply_str[reply_str.length - 1] += string_addition;
            }
        });
        reply_str.forEach( str => message.reply(str) );
    }

    playVoice(message) {
        let voice = message.content.substr(1).toLowerCase();
        let category = Object.values(this.voices).find( category => Object.keys(category).includes(voice));
        let voice_number = Math.floor(Math.random() * category[voice].length);
        this.logAction({ plugin: "voices", action: "playVoice", data: { uid: message.author.id, gid: message.guild.id, voice: voice } });
        message.member.voice.channel.join()
            .then( connection => {
                connection.play(category[voice][voice_number], DISPATCHER_OPTS)
                    .on('end', reason => {
                    connection.disconnect();
                });
                if ( message.deletable ) { message.delete(); }
            })
            .catch( err => {
                console.log(`Error playing voice, Name: "${voice}", Number: "${voice_number}"`);
                console.log(err);
            });
    }

}

module.exports = DISABLED ? false : Voices;
