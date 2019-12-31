const DISABLED = false;

const Promise = require('bluebird');
const EventEmitter = require('events');
const MESSAGE_ID_REGEX = /^[0-9]+$/;
class React extends EventEmitter {

    constructor({ Client, Config }){
        super();
        this.client = Client;
        this.Commands = [{
			    name  : "react",
                func  : (msg) => this.react(msg),
                match : (msg) => {
                    let split = msg.content.split(' ');
                    if ( split.length != 3 || split[0] != `${Config.command_char}react` ){
                        return false;
                    }
                    split.shift();
                    return split.find( a => MESSAGE_ID_REGEX.test(a) ) && split.find( a => !MESSAGE_ID_REGEX.test(a) );
                },
                info : "[emote_name] [message_id] - React to a message with specified emoji ( auto removed after 1 second )"
            }];
    }

    getCommands(){  
	    return this.Commands;
    }

    react(message){
        let split = message.content.split(' ');
        split.shift();
        let emote_name = split.find( a => !MESSAGE_ID_REGEX.test(a) );
        let emote = this.client.emojis.find( a => a.name == emote_name);
        let message_id = split.find( a => MESSAGE_ID_REGEX.test(a) );
        let prom = Promise.resolve(false);
        if ( message.deletable ){
            prom = message.delete().catch( () => { /* ignore */ });
        }
        prom
            .then( () => {
                if ( !emote ){
                    return Promise.reject(new Error(`Cannot find emote: "${emote_name}"`));
                } else {
                    return message.channel.messages.fetch(message_id);
                }
            })
            .then( react_to_message => {
                return react_to_message.react(emote)
                .then( reaction =>{
                    setTimeout(() => {
                        if ( reaction && reaction.me ) { reaction.users.remove(this.client.user.id); }
                    }, 1000);
                });

            })
            .catch( err => {
                console.log("ERROR REACTING");
                console.log(err);
            });
    }
}

module.exports = DISABLED ? false : React;
