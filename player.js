const config = require('./config'); const ytdl = require('ytdl-core'); var dispatcher = {}; queue = {}; 
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
            else if(dispatcher[guildID])
                dispatcher[guildID].end(1);
            vc.disconnect();
        }
    },
    skipSong: function (guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID)) {
            if (dis = vc.dispatcher){
                dis.end(2);
            }else if (dispatcher[guildID]){
                dispatcher[guildID].end();
            }
        }
    },
    skipSongById: function (guildID, queueID) {
        if(queue[guildID])
            if(queue[guildID].splice(queueID, 1).length == 1)
                return true;
        return false;
    },
    adjustVolume: function (vol, guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID))
            if(dis = vc.dispatcher)
                dis.setVolumeLogarithmic(vol / 100);
            else if (dispatcher[guildID])
                dispatcher[guildID].setVolumeLogarithmic(vol / 100);
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
        dispatcher[guildID] = connection.playStream(stream, {
            volume: 0.4
        });
        dispatcher[guildID].on('end', (reason) => {
            if (reason != 2)
                queue[guildID].shift();
            if (queue[guildID].length === 0 || reason === 1) {
                connection.disconnect();
            } else {
                module.exports.playMusic(connection, guildID);
            }
        });
    },
    playFile: function (file, connection, guildID) {
        dispatcher[guildID] = connection.playFile(file);
        dispatcher[guildID].on('end', () => {
            connection.disconnect();
        });
    }
}
