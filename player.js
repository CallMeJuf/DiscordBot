const config = require('./config');
const ytdl = require('ytdl-core');
queue = {};
module.exports = {

    client : {},
    inGuild : function(guildID){
        if(module.exports.client.voiceConnections.get(guildID))
            return true;
        return false;
    },
    queue : function(guildID){
        return queue[guildID];
    },

    clearQueue : function(guildID){
        queue[guildID] = [];
    },

    stopPlaying: function (guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID)) {
            if (dis = vc.dispatcher)
                dis.end(1);
            vc.disconnect();
        }
    },

    skipSong: function (guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID)) {
            if (dis = vc.dispatcher) {
                dis.end(2);
            }
        }
    },

    adjustVolume: function (vol, guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID)) {
            vc.dispatcher.setVolumeLogarithmic(vol / 100);
        }
    },

    addToQueue: function (url, guildID) {
        if (!queue[guildID])
            queue[guildID] = [];
        queue[guildID].push(url);
    },

    playMusic: function (connection, guildID) {
        const stream = ytdl(queue[guildID][0], {
            filter: 'audioonly'
        });
        const dispatcher = connection.playStream(stream, {
            volume: 0.4
        });

        dispatcher.on('end', (reason) => {
            if (reason != 2)
                queue[guildID].shift();

            if (queue[guildID].length === 0 || reason === 1) {
                connection.disconnect();
            } else {
                module.exports.playMusic(connection, guildID);
            }

        });

    },

    playFile: function (fileName, connection) {

        const dispatcher = connection.playFile(config.installLocation + fileName);
        dispatcher.on('end', () => {
            connection.disconnect();
        });

    }
}