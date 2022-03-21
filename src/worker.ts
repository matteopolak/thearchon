import FishBot from './classes/FishBot';
import fs from 'fs/promises';
import path from 'path';
import { workerData, parentPort } from 'worker_threads';

import type { BaseBotOptions } from './classes/BaseBot';

const { options }: { options: BaseBotOptions } = workerData;
const bot = new FishBot(options, parentPort!);

console.log(`[WORKER] Starting ${options.alias}`);

const logFileLocation = path.join(bot.directory, 'latest.log');

bot.client.on('messagestr', (m, _, json) => {
	if (m.startsWith('██')) return;

	fs.appendFile(logFileLocation, `${m} ::: ${JSON.stringify(json)}\n`);
});

bot.client.on('kicked', async reason => {
	console.log(`[${bot.alias}] [INFO] Kicked: ${reason}`);

	process.exit();
});

bot.client.on('end', async reason => {
	console.log(`[${bot.alias}] [INFO] Kicked: ${reason}`);

	process.exit();
});

bot.init();