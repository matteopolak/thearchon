import chalk from 'chalk';

import type { BaseBotOptions } from '../typings.js';

export default class Logger {
	private options: BaseBotOptions;
	private name: string;
	private infoPrefix: string;
	private errorPrefix: string;

	constructor(options: BaseBotOptions) {
		this.options = options;
		this.name = this.options.alias.padStart(16, ' ');
		this.infoPrefix = `${chalk.yellow(this.name)}   ${chalk.bold(
			chalk.blue('Info'),
		)}`;
		this.errorPrefix = `${chalk.yellow(this.name)}  ${chalk.bold(
			chalk.red('Error'),
		)}`;
	}

	info(message: string) {
		if (!this.options.logger) return;

		console.log(`${this.infoPrefix} ${message}`);
	}

	error(message: string) {
		if (!this.options.logger) return;

		console.log(`${this.errorPrefix} ${message}`);
	}
}
