const mineflayer = require('mineflayer');
const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
const bots = {};

function createBot(config, client, id) {
  let bot;

  try {
    bot = mineflayer.createBot({
      host: config.host,
      port: config.port,
      username: config.username,
      auth: config.auth,
      version: false, // 🔥 AUTO DETECT (ESSENCIAL)
      skipValidation: true
    });

    bots[id] = bot;

    client.send(JSON.stringify({ event: 'log', level: 'INFO', msg: `Conectando ${id}...` }));

    bot.once('spawn', () => {
      client.send(JSON.stringify({ event: 'bot_online', id }));
    });

    bot.on('login', () => {
      client.send(JSON.stringify({ event: 'log', level: 'OK', msg: `${id} logado!` }));
    });

    bot.on('kicked', (reason) => {
      client.send(JSON.stringify({ event: 'bot_kicked', id, msg: reason.toString() }));
      delete bots[id];
    });

    bot.on('error', (err) => {
      client.send(JSON.stringify({ event: 'bot_error', id, msg: err.message }));

      // 🔥 tenta fallback automático
      setTimeout(() => {
        client.send(JSON.stringify({ event: 'log', level: 'WARN', msg: `Tentando reconectar ${id}...` }));
        createBot(config, client, id);
      }, 3000);

      delete bots[id];
    });

    bot.on('end', () => {
      delete bots[id];
    });

  } catch (e) {
    client.send(JSON.stringify({ event: 'bot_error', id, msg: e.message }));
  }
}

wss.on('connection', (client) => {
  console.log('Frontend conectado');

  client.on('message', async (raw) => {
    const data = JSON.parse(raw);

    if (data.action === 'launch') {
      const { host, port, count, delay, prefix, auth } = data;

      for (let i = 1; i <= count; i++) {
        await new Promise(res => setTimeout(res, delay));

        const username = `${prefix}${String(i).padStart(4,'0')}`;
        const id = username;

        client.send(JSON.stringify({ event: 'bot_spawn', id }));

        createBot({
          host,
          port,
          username,
          auth: auth === 'offline' ? 'offline' : 'microsoft'
        }, client, id);
      }
    }

    if (data.action === 'stop_all') {
      Object.values(bots).forEach(bot => {
        try { bot.quit(); } catch(e){}
      });

      for (let k in bots) delete bots[k];

      client.send(JSON.stringify({
        event: 'log',
        level: 'OK',
        msg: 'Todos bots parados.'
      }));
    }
  });
});

console.log('🔥 Backend rodando em ws://localhost:8080');