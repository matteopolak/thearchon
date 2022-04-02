import fs from 'fs/promises';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import chalk from 'chalk';

import FishBot from './classes/FishBot';
import type { BaseBotOptions } from './typings';

const { options }: { options: BaseBotOptions } = workerData;
const bot = new FishBot(options, parentPort!);

console.log(
	`${' '.repeat(17)}${chalk.bold(chalk.cyan('Worker'))} Starting ${chalk.yellow(
		options.alias,
	)}`,
);

const logFileLocation = path.join(bot.directory, 'latest.log');

bot._bot.on('messagestr', message => {
	if (message.startsWith('██')) return;

	const date = new Date();
	const format = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;

	fs.appendFile(
		logFileLocation,
		`[${format}] [Client thread/INFO] ${message}\n`,
	);
});

bot._bot.on('kicked', async reason => {
	bot.logger.error(`Kicked: ${chalk.redBright(reason)}`);

	process.exit(0);
});

bot._bot.on('end', async reason => {
	bot.logger.error(`Ended: ${chalk.redBright(reason)}`);

	process.exit(reason === 'socketClosed' ? 1 : 0);
});

bot.init();
