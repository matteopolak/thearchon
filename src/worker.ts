import fs from 'fs/promises';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import type { BaseBotOptions } from './classes/BaseBot';
import FishBot from './classes/FishBot';

const { options }: { options: BaseBotOptions } = workerData;
const bot = new FishBot(options, parentPort!);

console.log(`[WORKER] Starting ${options.alias}`);

const logFileLocation = path.join(bot.directory, 'latest.log');

bot._bot.on('messagestr', (m, _, json) => {
	if (m.startsWith('██')) return;

	fs.appendFile(logFileLocation, `${m} ::: ${JSON.stringify(json)}\n`);
});

bot._bot.on('kicked', async reason => {
	console.log(`[${bot.alias}] [INFO] Kicked: ${reason}`);

	process.exit();
});

bot._bot.on('end', async reason => {
	console.log(`[${bot.alias}] [INFO] Kicked: ${reason}`);

	process.exit();
});

bot._bot.on('title', console.log);

bot.init();
