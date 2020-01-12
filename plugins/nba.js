const DISABLED = false;

const Promise = require('bluebird');
const EventEmitter = require('events');
const Calendar = require('./nba/cal.json');
const VoiceChannelID = "535275306731307029";

class NBA extends EventEmitter {

    constructor({ Client, Config, Discord }) {
        super();
        this.client = Client;
        this.Commands = [];
        setInterval(() => this.checkForGames(), 60000);
    }

    getCommands(){  
	    return this.Commands;
    }

    checkForGames(){
        let now = Date.now();
        let name = "JURASSIC PARK 🏀";
        Calendar.forEach( game => {
            if ( now > game.start && now < game.end ){
                name = game.location.split(",")[0];
            }
        });
        let voiceChannel = this.client.channels.get(VoiceChannelID);
        if ( !voiceChannel || !voiceChannel.manageable ) {
            console.error("NBA - Couldn't find manageable voice channel.");
        } else if ( voiceChannel.name != name ) {
            return voiceChannel.setName(name);
        }
    }

}

module.exports = DISABLED ? false : NBA;
