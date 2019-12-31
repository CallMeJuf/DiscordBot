const Promise      = require('bluebird');
const FS           = require('fs');
const Config       = require('./config');
const Discord      = require('./discord.js');
const MongoDB      = require('mongodb');
Promise.promisifyAll(MongoDB);
const MongoClient     = MongoDB.MongoClient;
const Collection      = MongoDB.Collection;
const MONGO_URL       = "mongodb://localhost:27017/discord";
const MONGO_DB        = 'discord';
const MONGO_LOG_COL   = 'botlogs';
const MongoConnection = MongoClient.connect(MONGO_URL, { useNewUrlParser: true });

const Client       = Discord.Client;
const Plugins      = {};
const command_list = {
    [Discord.CONSTS.MESSAGE] : {}
};

const PLUGIN_DIR   = `./plugins/`;

function init() {
    populatePlugins();
    populateCommands();
}

/*
 * Iterate through PLUGIN_DIR, require all files
 * Add required module to Plugins[plugin_name]
 */
function populatePlugins() {
    let plugins = FS.readdirSync(PLUGIN_DIR).filter( x => x.slice(-3) == '.js' );
    let plugin_init = [];
    plugins.forEach( plugin => {
        let plugin_name = plugin.split('.js')[0];
        if ( Plugins[plugin_name] ) {
            throw new Error("Conflicting plugin names.");
        }
        let plugin_instance = require(`${PLUGIN_DIR}${plugin}`);
        if ( plugin_instance ) {
            let obj = { Client, Config, Discord: Discord.Discord, MongoConnection, logAction };
            Plugins[plugin_name] = new plugin_instance(obj);
        }
        plugin_init.push({
            Name   : plugin_name,
            Loaded : plugin_instance ? true : false
        });
        // TODO:
        // Register plugin events for messages and rich embeds etc.
        // So plugins don't need direct access to discord ( or other platforms )
    });
    console.table(plugin_init);
}

// Iterate through plugins and populate command list
// If command doesn't have it's own match function, match based on command name
function populateCommands(){

    Object.keys(Plugins).forEach( name => {

        let commands = Plugins[name].getCommands();

		commands.forEach( command => {
            let type = command.type ? command.type : Discord.CONSTS.MESSAGE;
            if ( !command_list[type] ) {
                command_list[type] = {};
            }
            if ( command_list[type][command.name] ) {
                throw `Duplicate Command: '${command.name}'`;
            }

            command_list[type][command.name] = {
                exec  : command.func,
                info  : command.info ? command.info : "",
                match : command.match ? command.match : (msg) => {
                    return msg.content.split(' ')[0] == `${Config.command_char}${command.name}`;
                },
                plugin : name,
                hide   : command.hide ? true : false
            };
        });
    });

    command_list[Discord.CONSTS.MESSAGE]['help'] = {
        exec   : (msg) => listCommands().forEach( str => msg.reply(str)),
        info   : "Prints this menu.",
        match  : (msg) =>  msg.content.split(' ')[0] == `${Config.command_char}help`,
        plugin : "Misc"
    };

}

Client.on(Discord.CONSTS.MESSAGE, message => {
    let success = false;
    Promise.mapSeries(Object.values(command_list[Discord.CONSTS.MESSAGE]), command => {
        if ( command.match(message) ){
            if ( !['logger', 'react'].includes(command.plugin) ) { success = true; }
            return command.exec(message);
        }
    }).catch( err => {
        console.log("Error with commands.");
        console.log(err);
        success = false;
        // message.react('👎');
    })
    .then(() => {
        if ( success ) { message.react('👍'); }
    });

});

function listCommands(){
    let reply_str = ["Commands:\n"];
    let seen_plugins = [];
    Object.entries(command_list[Discord.CONSTS.MESSAGE]).forEach( command => {
        let string_addition = "";
        if (!seen_plugins.includes(command[1].plugin)) {
            string_addition += `**----- ${command[1].plugin[0].toUpperCase() + command[1].plugin.substr(1)} -----**\n`;
            seen_plugins.push(command[1].plugin);
        }
        if ( !command[1].hide ) { string_addition += `**${Config.command_char}${command[0]}** - ${command[1].info}\n`; }
        if ( reply_str[reply_str.length - 1].length + string_addition.length > 2000 ){
            reply_str.push(string_addition);
        } else {
            reply_str[reply_str.length - 1] += string_addition;
        }
    });
    return reply_str;
}

function logAction({ plugin, action, data }){

        let db;
        return MongoConnection
        .then( (client) => {
            db = client.db(MONGO_DB);
            return db.collection(MONGO_LOG_COL).insertOne({ plugin, action, data, created_at: Date.now() });
        })
        .catch( (err) => {
            console.log("ERROR LOGGING ACTION");
            console.log({ plugin, action, data });
            console.log(err.message);
        });        
    
}

let idle = setInterval(function() {
    if ( Client.user ) {
       clearInterval(idle);
       init();
    }
 }, 500);
