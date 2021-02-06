const discord = require('discord.js'), ytdl = require('ytdl-core'), YouTube = require('simple-youtube-api');

const Client = new discord.Client();
const youtube = new YouTube(process.env.YOUTUBE_API_KEY);
const queue = new Map();

Client.on('message', async msg => { // eslint-disable-line
    let prefix = process.env.prefix || "poly "

    if (msg.author.bot || msg.channel.type === "dm") return;
    if (!msg.content.startsWith(prefix)) return undefined;
    if (!msg.member.voiceChannel) return msg.channel.send(':x: You are not in a voice channel!');

    const args = msg.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(msg.guild.id);

    let command = (msg.content.toLowerCase().split(' ')[0]).slice(prefix.length);

    switch (command) {
        case `play`:
            if (!args[1]) {
                return msg.channel.send(":x: What should I play?")
            }
            const voiceChannel = msg.member.voiceChannel;
            const permissions = voiceChannel.permissionsFor(msg.client.user);
            if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
                return msg.channel.send(':x: I dont have the necessary permissions.');
            }

            if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
                const playlist = await youtube.getPlaylist(url);
                const videos = await playlist.getVideos();
                for (const video of Object.values(videos)) {
                    const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                    await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
                }

                msg.channel.send("🔍 Searching `" + searchString + "`").then(msg => {
                    msg.delete(1000)
                })
                let embed = new Discord.RichEmbed()
                    .setAuthor("Music", client.user.displayAvatarURL)
                    .setColor("GREEN")
                    .addField("Playlist Queued", `**[${playlist.title}](${playlist.url})**`)
                    .setFooter(msg.author.tag, msg.author.displayAvatarURL)
                    .setTimestamp()
                return msg.channel.send(embed);
            } else {
                try {
                    var video = await youtube.getVideo(url);
                } catch (error) {
                    try {
                        msg.channel.send("🔍 Searching `" + searchString + "`").then(msg => {
                            msg.delete(2000)
                        })
                        var videos = await youtube.searchVideos(searchString);
                        var video = await youtube.getVideoByID(videos[0].id);
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send(':x: No result found.');
                    }
                }
                return handleVideo(video, msg, voiceChannel);
            }
        break;

        case `youtube`:
            if (!args[0]) return msg.channel.send(":x: Please provide search query m8.")
            const voiceChannel = msg.member.voiceChannel;
            const permissions = voiceChannel.permissionsFor(msg.client.user);
            if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
                return msg.channel.send(':x: I dont have the necessary permissions.');
            }

            if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
                const playlist = await youtube.getPlaylist(url);
                const videos = await playlist.getVideos();
                for (const video of Object.values(videos)) {
                    const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                    await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
                }
                msg.channel.send("🔍 Searching `" + searchString + "`").then(msg => {
                    msg.delete(1000)
                })
                let embed1 = new Discord.RichEmbed()
                    .setAuthor("Music", client.user.displayAvatarURL)
                    .setColor("GREEN")
                    .addField("Playlist Queued", `[${playlist.title}](${playlist.url})`)
                    .setFooter(msg.author.tag, msg.author.displayAvatarURL)
                    .setTimestamp()
                return msg.channel.send(embed1);
            } else {
                try {
                    var video = await youtube.getVideo(url);
                } catch (error) {
                    try {
                        var videos = await youtube.searchVideos(searchString, 5);
                        let index = 0;
                        msg.channel.send("🔍 Searching `" + searchString + "`").then(msg => {
                            msg.delete(1000)
                        })
                        let sEmbed = new Discord.RichEmbed()
                            .setAuthor("YouTube Search", msg.author.avatarURL)
                            .setColor("RANDOM")
                            .setDescription(`${videos.map(video2 => `**${++index}. [${video2.title}](${video2.url})**`).join('\n')}`)
                            .setFooter(`Provide a number of a song.`, client.user.avatarURL)
                            .setTimestamp()
                        msg.channel.send(sEmbed).then(msg => {
                            msg.delete(10000)
                        });
                        // eslint-disable-next-line max-depth
                        try {
                            var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                                maxMatches: 1,
                                time: 10000,
                                errors: ['time']
                            });
                        } catch (err) {
                            console.error(err);
                            return msg.channel.send(':x: Invalid Value/Time\'s up, Cancelling video selection.');
                        }
                        const videoIndex = parseInt(response.first().content);
                        var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send(':x: No result found.');
                    }
                }
                return handleVideo(video, msg, voiceChannel);
            }
        break;

        case `skip`:
            if (!serverQueue) return msg.channel.send(':x: There is no song to skip.');
            serverQueue.connection.dispatcher.end(':white_check_mark: Song Skipped!');
            msg.channel.send(":white_check_mark: Song Skipped!")
            return undefined;
        break;

        case `stop`:
            if (!serverQueue) return msg.channel.send(':x: No song currently playing.');
            serverQueue.songs = [];
            serverQueue.voiceChannel.leave();
            msg.channel.send(":white_check_mark: Disconnected!")
            return undefined;
        break;

        case `join`:
            msg.member.voiceChannel.join();
            msg.channel.send(":white_check_mark: Connected!")
            return undefined;
        break;

        case `vol`:
            if (!serverQueue) return msg.channel.send(':x: There is nothing playing.');
            if (!args[1]) {
                let vEmbed = new Discord.RichEmbed()
                    .setAuthor("Current Volume", msg.guild.iconURL)
                    .setColor("ORANGE")
                    .setDescription(`**${(serverQueue.volume * 20)}/100**`)
                    .setFooter(client.user.tag, client.user.displayAvatarURL)
                return msg.channel.send(vEmbed)
            }
            if (!isNaN(args[0])) {
                serverQueue.volume = args[1] / 20;
                serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 100);
                let Embed = new Discord.RichEmbed()
                    .setAuthor("Music Volume", msg.guild.iconURL)
                    .setColor("ORANGE")
                    .setDescription(`Volume Changed To **${args[1]}/100**.`)
                    .setFooter(client.user.tag, client.user.displayAvatarURL)
                return msg.channel.send(Embed);
            }
            return msg.channel.send(":x: Provide a valid number between 1-100.");
        break;

        case `np`:
            if (!serverQueue) return msg.channel.send(':x: There is nothing playing.');
            console.log(serverQueue.songs[0])
            const nsong = {
                id: serverQueue.songs[0].id,
                title: discord.escapeMarkdown(serverQueue.songs[0].title),
                url: `https://www.youtube.com/watch?v=${serverQueue.songs[0].id}`,
                channel: serverQueue.songs[0].channel.id,
                ct: serverQueue.songs[0].channel.title,
                tp: serverQueue.songs[0].publishedAt,
                duration: serverQueue.songs[0].duration,
                thumbnail: `https://i.ytimg.com/vi/${serverQueue.songs[0].id}/maxresdefault.jpg`
            };
            let Embed = new Discord.RichEmbed()
                .setAuthor("Current Song", msg.guild.iconURL)
                .setColor("ORANGE")
                .addField("Channel", `**[${serverQueue.songs[0].ct}](https://youtube.com/channel/${serverQueue.songs[0].channel})**`, true)
                .addField("Duration", `\`${nsong.duration.hours}:${nsong.duration.minutes}:${nsong.duration.seconds}\``, true)
                .addField("Published At", `${moment(serverQueue.songs[0].tp).format("dddd, MMMM do YYYY")}`, true)
                //          .addField("Next Song:", `**[${serverQueue.songs[1].title}](${serverQueue.songs[1].url})**`, true)
                .setThumbnail(serverQueue.songs[0].thumbnail)
                .setDescription(`🎶 **[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})**`)
                .setFooter(client.user.tag, client.user.avatarURL)
            return msg.channel.send(Embed);
        break;

        case `queue`:
            let index = "0"
            if (!serverQueue) return msg.channel.send(':x: There is nothing playing.');
            else {
                let Embed = new Discord.RichEmbed()
                    .setAuthor("MUSIC QUEUE", msg.author.avatarURL)
                    .setColor("RANDOM")
                    //  .setThumbnail(serverQueue.songs[0].get().Thumbnail)
                    .addField("Current Song:", `**- [${serverQueue.songs[0].title}](${serverQueue.songs[0].url})**`)
                    .addField("Next Song:", `**- [${serverQueue.songs[1].title}](${serverQueue.songs[1].url})**`)
                    .setDescription("**Queue:**\n" + serverQueue.songs.map(song => `**${++index})** **[${song.title}](${song.url})**`).join('\n'))
                    .setFooter(`${client.user.username}`, client.user.avatarURL)
                    .setTimestamp()
                msg.channel.send(Embed);

            }
        break;

        case `pause`:
            if (serverQueue && serverQueue.playing) {
                serverQueue.playing = false;
                serverQueue.connection.dispatcher.pause();
                return msg.channel.send('⏸ Audio Paused!');
            }
            return msg.channel.send(':x: I am not playing anything?');
        break;

        case `resume`:
            if (serverQueue && !serverQueue.playing) {
                serverQueue.playing = true;
                serverQueue.connection.dispatcher.resume();
                return msg.channel.send('▶ Audio Resumed!');
            }
            return msg.channel.send(':x: Please pause a song to resume.');
        break;

        default:
            return undefined;
        break;
    }
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    console.log(video);
    const song = {
        id: video.id,
        title: discord.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        channel: video.channel.id,
        ct: video.channel.title,
        tp: video.publishedAt,
        duration: video.duration,
        thumbnail: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 3,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            queueConstruct.connection = await voiceChannel.join();
            play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
            queue.delete(msg.guild.id);
            return msg.channel.send(`:x: I got some problem.: **${error}**.`);
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        if (playlist) return undefined;
        else {
            let embed1 = new Discord.RichEmbed()
                .setAuthor("Music", client.user.displayAvatarURL)
                .setColor("GREEN")
                .setThumbnail(`https://i.ytimg.com/vi/${song.id}/maxresdefault.jpg`)
                .addField("Music Queued", `**[${song.title}](${song.url})**`, true)
                .addField("Uploaded by", `**[${song.ct}](https://youtube.com/channel/${song.channel})**`, true)
                .addField("Duration", `\`${song.duration.hours}:${song.duration.minutes}:${song.duration.seconds}\``, true)
                .addField("Published At", `${moment(song.tp).format("dddd, MMMM do YYYY")}`, true)
                .setFooter(msg.author.tag, msg.author.displayAvatarURL)
                .setTimestamp()
            return msg.channel.send(embed1);
        }
    }
    return undefined;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        //serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on('end', reason => {
            if (reason === 'Stream is not generating quickly enough.') {

                console.log('Song ended.')
                // serverQueue.textChannel.channel.send('Song Ended!');

            } else console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 3);
    let embed1 = new Discord.RichEmbed()
        .setAuthor("Music", serverQueue.iconURL)
        .setColor("GREEN")
        .setThumbnail(`https://i.ytimg.com/vi/${song.id}/maxresdefault.jpg`)
        .addField("Started Playing", `🎶 **[${song.title}](${song.url})**`, true)
        .addField("Uploaded By", `**[${song.ct}](https://youtube.com/channel/${song.channel})**`, true)
        .addField("Duration", `\`${song.duration.hours}:${song.duration.minutes}:${song.duration.seconds}\``, true)
        .addField("Published At", `${moment(song.tp).format("dddd, MMMM do YYYY")}`, true)
        .setFooter(client.user.tag, client.user.displayAvatarURL)
        .setTimestamp()
    return serverQueue.textChannel.send(embed1);
}
