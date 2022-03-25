import fs from 'fs/promises';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import type { BaseBotOptions } from './classes/BaseBot';
import FishBot from './classes/FishBot';

const { options }: { options: BaseBotOptions } = workerData;
const bot = new FishBot(options, parentPort!);

console.log(`[WORKER] Starting ${options.alias}`);

const logFileLocation = path.join(bot.directory, 'latest.log');

bot._client.on('messagestr', (m, _, json) => {
	if (m.startsWith('██')) return;

	fs.appendFile(logFileLocation, `${m} ::: ${JSON.stringify(json)}\n`);
});

bot._client.on('kicked', async reason => {
	console.log(`[${bot.alias}] [INFO] Kicked: ${reason}`);

	process.exit();
});

bot._client.on('end', async reason => {
	console.log(`[${bot.alias}] [INFO] Kicked: ${reason}`);

	process.exit();
});

bot.init();
