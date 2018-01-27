const config = require('./config');
const youtubedl = require('youtube-dl');
var dispatcher = {};
queue = {};
volume = {};

const disOptions = {
    volume: 1.0,
    bitrate: 320000
};

function setVolume(vol, guildID) {
    volume[guildID] = (vol * 0.005);
}
module.exports = {
    client: {},
    inGuild: function (guildID) {
        if (module.exports.client.voiceConnections.get(guildID))
            return true;
        return false;
    },
    queue: function (guildID) {
        return queue[guildID];
    },
    clearQueue: function (guildID) {
        queue[guildID] = [];
    },
    stopPlaying: function (guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID)) {
            if (dis = vc.dispatcher)
                dis.end(1);
            else if (dispatcher[guildID])
                dispatcher[guildID].end(1);
            vc.disconnect();
        }
    },
    skipSong: function (guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID)) {
            if (dis = vc.dispatcher) {
                dis.end();
            } else if (dispatcher[guildID]) {
                dispatcher[guildID].end();
            }
        }
    },
    skipSongById: function (guildID, queueID) {
        if (queue[guildID])
            if (queue[guildID].splice(queueID, 1).length == 1)
                return true;
        return false;
    },
    adjustVolume: function (vol, guildID) {
        if (vc = module.exports.client.voiceConnections.get(guildID))
            setVolume(vol, guildID)
        if (dis = vc.dispatcher)
            dis.setVolumeLogarithmic(volume[guildID]);
        else if (dispatcher[guildID])
            dispatcher[guildID].setVolumeLogarithmic(volume[guildID]);
    },
    getVolume: function (guildID) {
        return volume[guildID] ? (volume[guildID] * 100) : false;
    },
    addToQueue: function (url, guildID, urlInfo) {
        if (!queue[guildID])
            queue[guildID] = [];

        queue[guildID].push({
            url: url,
            info: urlInfo
        });
    },
    playUniversal: function (connection, guildID) {

        if (!volume[guildID])
            setVolume(100, guildID)

        dispatcher[guildID] = connection.playArbitraryInput(queue[guildID][0].url, disOptions);
        dispatcher[guildID].setVolumeLogarithmic(volume[guildID])


        dispatcher[guildID].setVolumeLogarithmic(volume[guildID])

        dispatcher[guildID].on('end', (reason) => {
            if (reason != 2)
                queue[guildID].shift();
            if (queue[guildID].length === 0 || reason === 1) {
                connection.disconnect();
            } else {
                module.exports.playUniversal(connection, guildID);
            }
        });
    },
    playFile: function (file, connection, guildID) {
        if (!volume[guildID])
            setVolume(100, guildID)

        dispatcher[guildID] = connection.playFile(file, disOptions);

        dispatcher[guildID].setVolumeLogarithmic(volume[guildID])

        dispatcher[guildID].on('end', () => {
            connection.disconnect();
        });
    },
    playAlbum: function (files, connection, guildID) {
        if (!volume[guildID])
            setVolume(100, guildID)

        dispatcher[guildID] = connection.playFile(files.pop(), disOptions);

        dispatcher[guildID].setVolumeLogarithmic(volume[guildID] * 1.5)

        dispatcher[guildID].on('end', (reason) => {

            if (files.length === 0 || reason === 1) {
                connection.disconnect();
            } else {
                module.exports.playAlbum(files, connection, guildID);
            }

        });
    },
    playNext: function (url, guildID, urlInfo) {
        if (!queue[guildID])
            queue[guildID] = [];
        queue[guildID].splice(1, 0, {
            url: url,
            info: urlInfo
        });
    },
}