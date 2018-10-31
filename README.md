# DiscordBot
Discord Bot For Multiple Servers written in NodeJS. Written for fun and learning, wanted a self hosted bot I could customize for my needs.


## Commands

Preceded with a '/', Case-Inensitive. To queue multiple songs at once, use a playlist (max 20 songs) or seperate links with a newline.

| Command | Description |
| --- | --- |
| **Help** | Prints this list. |
| **Spoiler**\ | Creates hoverable link with spoiler text. | 
| **Vol**\* | Replys with the current volume. |
| **Vol** [0-100]\* | Set bot's volume in user's channel. |
| **Stop**\* | Remove bot from channel and retain queue (minus now playing) | 
| **Play**\* [link] | Plays requested link or adds to queue. |
| **PlayNext**\* [link] | Adds requested links to the front of the queue. |
| **Join**\* | Join your voice channel and start queue (if any) |
| **Queue**\* | Prints the current playlist |
| **List**\* | Same as 'Queue' |
| **Playing**\* | Prints current song |
| **Skip**\* | Skips current song. | 
| **Clear**\* | Clears playlist and removes bot from channel |
| **Voices** | Lists voices | 
| **[voice]**\* | Plays specified voice |
| **follow [twitchUser]**\*\* | Display a message in the channel when the streamer goes live. |

\* Must be in a voice channel.

\*\* Must be in twitchAdmin array.

### Example Twitch Notification:

![Twitch Notification](https://i.imgur.com/0Pn7Blb.png)

## Notes

Not really written with best practices in mind, just for fun, working on cleaning it up :P
