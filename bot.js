const Discord = require('discord.js');
const youtubedl = require('youtube-dl');
const fs = require('fs');
const config = require('./config');
const player = require('./player');
const download = require('download-file');
const validUrl = require('valid-url');
const client = new Discord.Client();
player.client = client;
const replies = {};
const queue = {};
const voices = {};
const albums = {};
const formats = [".ogg", ".mp3", ".m4a"]
const voiceMappings = {
  "89172578026942464": "Jer",
  "126198941543825408": "Mati",
  "234853451056676864": "Juf"
};
const ytdlOptions = ['--playlist-end', '1', '--format=bestaudio/best', '--restrict-filenames'];
var voiceStr = "";
const commandList = ["**/help** - Shows this menu.",
  "**/vol** [0-100] - Sets volume, /vol to get volume.",
  "**/stop** - Remove bot from channel and keep queue (minus currently playing).",
  "**/play** [link] - Plays requested link, or adds link to queue.",
  "**/playnext** [link] - Plays requested links next.",
  "**/join** - Join your voice channel and start queue.",
  "**/[queue|list]** - Prints the current playlist.",
  "**/skip** - Skips current song.",
  "**/clear** - Stops bot, clears playlist",
  "**/playing** - Prints playing song",
  "**/[voice]** - Plays specified voice",
  "**/voices** - List voices",
  "**---NOTES---**",
  "Queue multiple tracks by seperating them with a newline (Shift+Enter)"
];

const commands = {

  help: function (message) {

    replyStr = "**---Available Commands---**\n";

    for (var i = 0; i < commandList.length; i++)
      replyStr += commandList[i] + '\n';

    message.reply(replyStr)

  },

  vol: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    if (message.content === "/vol") {
      curVolume = player.getVolume(message.guild.id);
      if (curVolume) {
        message.reply("Volume is " + curVolume.toString() + "% ");
      }
    } else {

      volumeReq = parseInt(message.content.substr(5));

      if (volumeReq >= 0 && volumeReq <= 100) {
        message.react("👍");
        player.adjustVolume(volumeReq, message.guild.id);
      } else {
        message.react("👎");
      }

    }


  },

  stop: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;
    player.stopPlaying(message.guild.id);
  },

  play: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    vidUrl = message.content.substr(6);
    vidUrl = vidUrl.split(/\n/);

    console.log("--------SONG REQUEST---------");
    console.log('Requestor id:', message.author.id);
    console.log('Requestor name:', message.author.username);
    for (var i = 0; i < vidUrl.length; i++)
      console.log('Request URL: ', vidUrl[i])

    addURLs(vidUrl, message.guild.id, message.author, message.member.voiceChannel, message)



    console.log("----------------------------\n");

  },

  playnext: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    vidUrl = message.content.substr(10);
    vidUrl = vidUrl.split(/\n/);

    console.log("--------SONG REQUEST---------");
    console.log('Requestor id:', message.author.id);
    console.log('Requestor name:', message.author.username);
    for (var i = 0; i < vidUrl.length; i++)
      console.log('Request URL: ', vidUrl[i])

    addNext(vidUrl, message.guild.id, message.author, message.author.voiceChannel, message);

    console.log("----------------------------\n");

  },

  join: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    if (player.inGuild(message.guild.id)) {
      player.stopPlaying(message.guild.id);
    }

    if (q = player.queue(message.guild.id)) {
      if (q.length > 0) {
        message.member.voiceChannel.join().then(connection => player.playUniversal(connection, message.guild.id));
      }
    }
  },

  queue: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    if (q = player.queue(message.guild.id)) {
      if (q.length > 0) {
        var queueStr = "**Queue (" + q.length + "):**\n";

        for (var i = 1; i <= q.length; i++) {
          tmpInfo = q[i - 1].info
          queueStr += i + ") **" + tmpInfo.title + "** *" + tmpInfo.extractor_key + " | " + tmpInfo.duration + "*\n";
        }

        replyArr = queueStr.match(/(.|[\r\n]){1,1900}/g);
        console.log(replyArr);
        for (i = 0; i < replyArr.length; i++) {
          message.reply(replyArr[i]);
        }
      }
    }
  },

  list: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    if (q = player.queue(message.guild.id)) {
      if (q.length > 0) {
        var queueStr = "**Queue (" + q.length + "):**\n";

        for (var i = 1; i <= q.length; i++) {
          tmpInfo = q[i - 1].info
          queueStr += i + ") **" + tmpInfo.title + "** *" + tmpInfo.extractor_key + " | " + tmpInfo.duration + "*\n";
        }

        replyArr = queueStr.match(/(.|[\r\n]){1,1900}/g);
        console.log(replyArr);
        for (i = 0; i < replyArr.length; i++) {
          message.reply(replyArr[i]);
        }
      }
    }
  },

  skip: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    trackToSkip = parseInt(message.content.substr(6));
    if ((isNaN(trackToSkip) && message.content.length == 5) || trackToSkip == 1) {
      message.react("👍");
      player.skipSong(message.guild.id);
    } else {
      if (player.skipSongById(message.guild.id, (trackToSkip - 1)))
        message.react("👍");
      else
        message.react("👎");
    }

  },

  clear: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;
    player.stopPlaying(message.guild.id);
    player.clearQueue(message.guild.id);
  },

  playing: function (message) {
    if (!message.guild || !message.member.voiceChannel)
      return;

    if (q = player.queue(message.guild.id))
      if (q.length > 0)
        message.reply("**" + q[0].info.title + "** *" + q[0].info.extractor_key + " | " + q[0].info.duration + "<" + q[0].info.webpage_url + ">*");
  },

  voices: function (message) {
    message.reply(voiceStr);
  }
}

function getVoices() {
  voiceStr = "Voices: ";
  fs.readdirSync(config.installLocation + 'Audio/Voices/').forEach(file => {

    var voice = file.toLowerCase();
    voices[voice] = [];
    voiceStr += file + ", ";
    var voiceDir = config.installLocation + 'Audio/Voices/' + file + '/';

    fs.readdirSync(voiceDir).forEach(file => {
      voices[voice].push(voiceDir + file);
    });
  });
  voiceStr = voiceStr.slice(0, -2) + ".";
}

function addURLs(urls, guildID, requestor, voiceChannel, message, first = true) {
  url = urls.shift();
  if (validUrl.isUri(url)) {
    youtubedl.getInfo(url, ytdlOptions, {
      maxBuffer: 1024 * 1000
    }, function (err, info) {
      if (err) {
        if (message)
          message.react("😠");
        console.log(err)
        return
      }
      if (info.length == null)
        info = [info]

      for (i = 0; i < info.length; i++) {
        console.log('--------ADDING TO QUEUE----------');
        console.log('title:', info[i].title);
        console.log('filename:', info[i]._filename);
        console.log('------', requestor.username, '---', requestor.id, '------\n');
        if (message)
          message.react("👍");
        player.addToQueue(info[i].url, guildID, info[i]);
      }
      if (first && !player.inGuild(guildID))
        voiceChannel.join().then(connection => player.playUniversal(connection, guildID));

      if (urls.length > 0)
        addURLs(urls, guildID, requestor, voiceChannel, false, false);

    });
  } else {
    if (urls.length > 0)
      addURLs(urls, guildID, requestor, voiceChannel, message, true);
    else if (message)
      message.react("👎");
  }
}

function addNext(urls, guildID, requestor, voiceChannel, message) {
  url = urls.pop()
  if (validUrl.isUri(url)) {
    youtubedl.getInfo(url, ytdlOptions, {
      maxBuffer: 1024 * 1000
    }, function (err, info) {
      if (err) {
        if (message)
          message.react("😠");
        console.log(err)
        return
      }
      console.log('--------ADDING TO QUEUE----------');
      console.log('title:', info.title);
      console.log('filename:', info._filename);
      console.log('------', requestor.username, '---', requestor.id, '------\n');
      if (message)
        message.react("👍");
      player.playNext(info.url, guildID, info);

      if (urls.length > 0)
        addNext(urls, guildID, requestor, voiceChannel, false);

    });
  } else {
    if (urls.length > 0)
      addNext(urls, guildID, requestor, voiceChannel, message);
    else if (message)
      message.react("👎");
  }
}


function playVoice(message) {
  if (player.inGuild(message.guild.id) || !message.member.voiceChannel)
    return;
  voice = voices[message.content.substr(1).split(" ", 1)[0].toLowerCase()];

  message.member.voiceChannel.join().then(connection => {
    const file = voice[Math.floor(Math.random() * voice.length)];
    player.playFile(file, connection, message.guild.id);
  });
}



client.on('ready', () => {
  console.log("Getting Voices...")
  getVoices();
  console.log('I am ready!');
});


//Admin Commands
client.on('message', message => {
  if (message.author.id != config.admin)
    return

  switch (message.content) {
    case "/reloadVoices":
      getVoices();
      message.react("👍");
      break
  }


});

//Upload
client.on('message', message => {
  if (message.channel.type != "dm")
    return

  if (!voiceMappings[message.author.id])
    return
  console.log(message.attachments);
  if (message.attachments)
    message.attachments.forEach(file => {
      if (formats.indexOf(file.filename.substr(-4).toLowerCase()) == -1)
        return

      download(file.url, {
        directory: config.installLocation + "Audio/Voices/" + voiceMappings[message.author.id] + "/",
        filename: file.filename
      }, function (err) {
        if (err) {
          console.log(err);
          message.react("👎");
        } else {
          message.react("👍");
        }
      });

    });

});

// Command Check
client.on('message', message => {

  if (message.content[0] != "/")
    return
  var requestedCommand = message.content.substr(1).split(" ", 1)[0].toLowerCase();
  if (requestedCommand in commands) {

    commands[requestedCommand](message);

  } else if (requestedCommand in voices) {

    playVoice(message);
    if (player.inGuild(message.guild.id) || !message.member.voiceChannel)
      return;

    message.member.voiceChannel.join().then(connection => {
      const file = voice[Math.floor(Math.random() * voice.length)];
      player.playFile(file, connection, message.guild.id);
    });

  }


});

client.on('messageDelete', message => {
  if (message.id in replies)
    replies[message.id].delete();
});

client.login(config.apikey);