const dotenv = require("dotenv");
const util = require("util");
const vlc = require("vlc.js");
const fs = require("fs");
const path = require("path");

dotenv.config();

const { VIDEO_FOLDER, MESSAGE_PREFIX, BOT_TOKEN, BOT_NAME, CHANNEL_NAME } = process.env;
if (!VIDEO_FOLDER || !MESSAGE_PREFIX || !BOT_TOKEN || !BOT_NAME || !CHANNEL_NAME) throw new Error("incorrect env's");

const bot = {
  paused: false,
  player: new vlc.Client({ address: "localhost", password: "vlcremote", port: 5000 }),
  client: new tmi.Client({
    options: { debug: true },
    connection: {
      reconnect: true,
      secure: true,
    },
    identity: {
      username: BOT_NAME,
      password: BOT_TOKEN,
    },
    channels: [CHANNEL_NAME],
  }),
  playlist: new Map(),
};

const updatePlaylist = async () => {
  bot.player.empty();

  await util.promisify(fs.readdir(VIDEO_FOLDER)).map((v) => bot.player.queue("file:///" + path.join(VIDEO_FOLDER, v)));

  const playlist = await bot.player.getPlaylist();
  playlist.children[0].children.forEach((v) => {
    bot.playlist.set(path.basename(v.uri, ".avi"), v.id);
  });
};

bot.client.connect();

updatePlaylist().then(() => {
  bot.client.on("message", (channel, tags, message, self) => {
    if (self) return;
    if (!message.startsWith(MESSAGE_PREFIX)) return;

    message = message.substring(MESSAGE_PREFIX.length);

    const togglePause = () => {
      const { client, player } = bot;
      if (!player) {
        client.say(channel, `@${tags.username}, для начала запусти видео командой !запуск <видео>`);
        return;
      }

      if (bot.paused) {
        player.forceResume();
        client.say(channel, `@${tags.username}, снял с паузы ⏏️`);
      } else {
        player.forcePause();
        client.say(channel, `@${tags.username}, поставил на паузу ⏸️`);
      }

      bot.paused = !bot.paused;
    };

    const startPlayer = (video) => {
      const { client, player } = bot;
      const videoPath = path.join(VIDEO_FOLDER, `${video}.avi`);
      const isExists = fs.existsSync(videoPath);
      if (!isExists) return client.say(channel, `@${tags.username}, извини, эпизода ${video} нет :(`);

      const id = bot.playlist.get(video);
      player.resume(id);

      client.say(channel, `@${tags.username}, запустил ${video} эпизод`);
    };

    const [command, ...args] = message.match(/\S+/g).map((v) => v.toLowerCase());
    const { client, player } = bot;

    switch (command) {
      case "пауза": {
        togglePause();
        break;
      }
      case "запусти": {
        if (args.length === 0) client.say(channel, `@${tags.username}, тебе нужно указать эпизод`);
        else startPlayer(args[0]);
        break;
      }
    }
  });
});
