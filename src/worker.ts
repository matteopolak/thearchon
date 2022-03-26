import fs from 'fs/promises';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import chalk from 'chalk';

import type { BaseBotOptions } from './classes/BaseBot.js';
import FishBot from './classes/FishBot.js';

const { options }: { options: BaseBotOptions } = workerData;
const bot = new FishBot(options, parentPort!);

console.log(
	`${' '.repeat(17)}${chalk.bold(chalk.cyan('Worker'))} Starting ${chalk.yellow(
		options.alias,
	)}`,
);

const logFileLocation = path.join(bot.directory, 'latest.log');

bot._bot.on('messagestr', (m, _, json) => {
	if (m.startsWith('██')) return;

	fs.appendFile(logFileLocation, `${m} ::: ${JSON.stringify(json)}\n`);
});

bot._bot.on('kicked', async reason => {
	bot.logger.error(`Kicked: ${chalk.redBright(reason)}`);

	process.exit();
});

bot._bot.on('end', async reason => {
	bot.logger.error(`Ended: ${chalk.redBright(reason)}`);

	process.exit();
});

bot.init();
