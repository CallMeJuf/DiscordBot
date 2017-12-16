const Discord = require('discord.js');
const youtubedl = require('youtube-dl');
const fs = require('fs');
const client = new Discord.Client();
const config = require('./config');
const player = require('./player');
const validUrl = require('valid-url');
player.client = client;
const replies = {};
const queue = {};
const voices = {};
const albums = {};
const botChannels = [357203097275072526, 254128624955817984]
const ytdlOptions = [ '--playlist-end','1', '--format=bestaudio/best', '--restrict-filenames'];
var voiceStr = "";
const tsundres = ["https://cdn.awwni.me/tk2h.jpg",
  "https://imgur.com/Poi4gkr",
  "http://pm1.narvii.com/6094/3c1978f57a011af3d9a2069901ce2e86160dd696_hq.jpg",
  "https://68.media.tumblr.com/c5c260dcb303f9c2414485a69f057fcb/tumblr_nzk87vmJ1c1uz8vb5o1_500.gif",
  "https://i.pinimg.com/originals/84/a6/4d/84a64d010b04aa2a8d80484b81b71e98.jpg"
];

getVoices();
getAlbums();

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

function getAlbums() {
  albumStr = "Voices: ";
  fs.readdirSync(config.installLocation + 'Audio/Albums/').forEach(file => {

    var album = file.toLowerCase();
    albums[album] = [];
    albumStr += file + ", ";
    var albumDir = config.installLocation + 'Audio/Albums/' + file + '/';

    fs.readdirSync(albumDir).forEach(file => {
      albums[album].push(albumDir + file);
    });
  });
  albumStr = albumStr.slice(0, -2) + ".";
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
      if(info.length == null)
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

const commands = ["**/help** - Shows this menu.",
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

client.on('ready', () => {
  console.log('I am ready!');
});

playlists = {};


/*Albums
client.on('message', message => {
  
    if (!message.guild)
      return;
    if (album = albums[message.content.substr(1).toLowerCase()]) {
      if (player.inGuild(message.guild.id) || !message.member.voiceChannel)
        return;
  
      message.member.voiceChannel.join().then(connection => {
        player.playAlbum(album, connection, message.guild.id);
      });
    }
  });
*/

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


/*Tsundere
client.on('message', message => {
  if (!(message.content === "/tsundere"))
    return;

  var messageID = message.id;
  message.reply(tsundres[Math.floor(Math.random() * tsundres.length)]);
});*/

//Help
client.on('message', message => {

  if (!(message.content === "/help"))
    return;

  replyStr = "**---Available Commands---**\n";

  for (var i = 0; i < commands.length; i++)
    replyStr += commands[i] + '\n';

  message.reply(replyStr)

});

//Guild required commands (skip, stop, clear, join, play, vol, list, playing, voices)
client.on('message', message => {
  if (!message.guild)
    return;

  if (message.member.voiceChannel) {
    if (message.content === "/stop") {

      player.stopPlaying(message.guild.id);

    } else if (message.content.substr(0, 5) === "/skip") {


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

    } else if (message.content === "/clear") {

      player.stopPlaying(message.guild.id);
      player.clearQueue(message.guild.id);

    } else if (message.content.substr(0, 5) === "/vol ") {

      volumeReq = parseInt(message.content.substr(5));

      if (volumeReq >= 0 && volumeReq <= 100) {
        message.react("👍");
        player.adjustVolume(volumeReq, message.guild.id);
      } else {
        message.react("👎");
      }

    } else if (message.content === "/vol") {
      curVolume = player.getVolume(message.guild.id);
      if (curVolume) {
        message.reply("Volume is " + curVolume.toString() + "% ");
      }

    } else if (message.content === "/join") {

      if (player.inGuild(message.guild.id))
        player.stopPlaying(message.guild.id);

      if (q = player.queue(message.guild.id))
        if (q.length > 0)
          message.member.voiceChannel.join().then(connection => player.playUniversal(connection, message.guild.id));

    } else if (message.content.substr(0, 6) === "/play ") {


      vidUrl = message.content.substr(6);
      vidUrl = vidUrl.split(/\n/);

      console.log("--------SONG REQUEST---------");
      console.log('Requestor id:', message.author.id);
      console.log('Requestor name:', message.author.username);
      for (var i = 0; i < vidUrl.length; i++)
        console.log('Request URL: ', vidUrl[i])

      addURLs(vidUrl, message.guild.id, message.author, message.member.voiceChannel, message)



      console.log("----------------------------\n");


    } else if (message.content.substr(0, 10) === "/playnext ") {

      vidUrl = message.content.substr(10);
      vidUrl = vidUrl.split(/\n/);

      console.log("--------SONG REQUEST---------");
      console.log('Requestor id:', message.author.id);
      console.log('Requestor name:', message.author.username);
      for (var i = 0; i < vidUrl.length; i++)
        console.log('Request URL: ', vidUrl[i])

      addNext(vidUrl, message.guild.id, message.author, message.author.voiceChannel, message);

      console.log("----------------------------\n");
    } else if (voice = voices[message.content.substr(1).toLowerCase()]) {
      if (player.inGuild(message.guild.id) || !message.member.voiceChannel)
        return;

      message.member.voiceChannel.join().then(connection => {
        const file = voice[Math.floor(Math.random() * voice.length)];
        player.playFile(file, connection, message.guild.id);
      });
    }
  }

  if (message.content === "/list" || message.content === "/queue") {
    if (q = player.queue(message.guild.id))
      if (q.length > 0) {
        var queueStr = "**Queue (" + q.length + "):**\n";

        for (var i = 1; i <= q.length; i++) {
          tmpInfo = q[i - 1].info
          queueStr += i + ") **" + tmpInfo.title + "** *" + tmpInfo.extractor_key + " | " + tmpInfo.duration + "*\n";
        }
        message.reply(queueStr);
      }
  } else if (message.content === "/playing") {
    if (q = player.queue(message.guild.id))
      if (q.length > 0)
        message.reply("**" + q[0].info.title + "** *" + q[0].info.extractor_key + " | " + q[0].info.duration + "<" + q[0].info.webpage_url + ">*");
  } else if (message.content === "/voices") {
    message.reply(voiceStr);
  }



});

client.on('messageDelete', message => {
  if (message.id in replies)
    replies[message.id].delete();
});

client.login(config.apikey);