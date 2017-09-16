const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const fs = require('fs');
const client = new Discord.Client();
const config = require('./config');
const player = require('./player');
player.client = client;
const replies = {};
const queue = {};
const voices = {};
const tsundres = ["https://cdn.awwni.me/tk2h.jpg",
  "https://imgur.com/Poi4gkr",
  "http://pm1.narvii.com/6094/3c1978f57a011af3d9a2069901ce2e86160dd696_hq.jpg",
  "https://68.media.tumblr.com/c5c260dcb303f9c2414485a69f057fcb/tumblr_nzk87vmJ1c1uz8vb5o1_500.gif",
  "https://i.pinimg.com/originals/84/a6/4d/84a64d010b04aa2a8d80484b81b71e98.jpg"
];

getVoices();

function getVoices() {
  fs.readdirSync(config.installLocation + 'Audio/Voices/').forEach(file => {
    voices[file] = [];
    var voiceDir = config.installLocation + 'Audio/Voices/' + file + '/';
    var voice = file;
    fs.readdirSync(voiceDir).forEach(file => {
      voices[voice].push(voiceDir + file);
    });
  });
}

const commands = ["/help - Shows this menu.",
  "/vol [0-100] - Sets volume",
  "/stop - Remove bot from channel and keep queue (minus currently playing).",
  "/play [youtubeLink] - Plays requested link, or adds link to queue.",
  "/join - Join your voice channel and start queue.",
  "/[queue|list] - Prints the current playlist.",
  "/skip - Skips current song.",
  "/clear - Stops bot, clears playlist",
  "/playing - Prints playing song",
  "/tsundere - For your daily dose of tsundere",
  "Default Volume is 40%"
];

client.on('ready', () => {
  console.log('I am ready!');
});

playlists = {};



//Voices
client.on('message', message => {
  
  if (!message.guild)
    return;
  if (voice = voices[message.content.substr(1)]) {
    if (player.inGuild(message.guild.id) || !message.member.voiceChannel)
      return;

    message.member.voiceChannel.join().then(connection => {
      const file = voice[Math.floor(Math.random() * voice.length)];
      player.playFile(file, connection, message.guild.id);
    });
  }
});

//Admin Commands
client.on('message', message => {
  if(message.author.id != config.admin)
    return
  switch(message.content){
    case "/reloadVoices":
      getVoices();
      break
  }
});


//Tsundere
client.on('message', message => {
  if (!(message.content === "/tsundere"))
    return;

  var messageID = message.id;
  message.reply(tsundres[Math.floor(Math.random() * tsundres.length)]);
});


//Help
client.on('message', message => {
  if (!(message.content === "/help"))
    return;

  replyStr = "Available Commands:\n";

  for (var i = 0; i < commands.length; i++)
    replyStr += commands[i] + '\n';

  message.reply(replyStr)

});

//Guild required commands (skip, stop, clear, join, play, vol, list, playing)
client.on('message', message => {
  if (!message.guild)
    return;

  if (message.content === "/stop") {

    player.stopPlaying(message.guild.id);

  } else if (message.content === "/skip") {

    message.react("👍");
    player.skipSong(message.guild.id);

  } else if (message.content === "/clear") {

    player.stopPlaying(message.guild.id);
    player.clearQueue(message.guild.id);

  } else if (message.content.substr(0, 5) === "/vol ") {

    volumeReq = parseInt(message.content.substr(5));

    if (volumeReq >= 0 && volumeReq <= 100) {
      message.react("👍");
      player.adjustVolume(volumeReq, message.guild.id);
    }else{
      message.react("👎");
    }

  } else if (message.content === "/join") {

    if (player.inGuild(message.guild.id))
      player.stopPlaying(message.guild.id);

    if (q = player.queue(message.guild.id))
      if (q.length > 0)
        message.member.voiceChannel.join().then(connection => player.playMusic(connection, message.guild.id));

  } else if (message.content.substr(0, 6) === "/play ") {

    vidUrl = message.content.substr(6);

    if (ytdl.validateLink(vidUrl)) {

      message.react("👍");

      if (player.inGuild(message.guild.id)) {

        player.addToQueue(vidUrl, message.guild.id);

      } else {

        player.addToQueue(vidUrl, message.guild.id);
        message.member.voiceChannel.join().then(connection => player.playMusic(connection, message.guild.id));
      }

    } else {
      message.react("👎");
    }
  } else if (message.content === "/list" || message.content === "/queue") {
    if (q = player.queue(message.guild.id))
      if (q.length > 0) {
        var queueStr = "Queue (" + q.length + "):\n";

        for (var i = 1; i <= q.length; i++) {
          queueStr += i + ") <" + q[i - 1] + ">\n";
        }
        message.reply(queueStr);
      }
  } else if (message.content === "/playing") {
    if (q = player.queue(message.guild.id))
      if (q.length > 0)
        message.reply(q[0]);
  }


});

client.on('messageDelete', message => {
  if (message.id in replies)
    replies[message.id].delete();
});

client.login(config.apikey);