const Discord   = require('discord.js');
const Config    = require('./config');
const Client    = new Discord.Client();
const CONSTS    = {
    MESSAGE : 'message'
};
// TODO: Wrap Discord.js module for easier transition to another 
//       platform if needed.

Client.login(Config.apikey);

module.exports = {
    Client  : Client,
    CONSTS  : CONSTS,
    Discord : Discord
};