import chalk from 'chalk';

import type { BaseBotOptions } from '../typings';

export default class Logger {
	private options: BaseBotOptions;
	private name: string;
	private infoPrefix: string;
	private errorPrefix: string;
	private warnPrefix: string;

	constructor(options: BaseBotOptions) {
		this.options = options;
		this.name = this.options.alias.padStart(16, ' ');
		this.infoPrefix = `${chalk.gray(this.name)}   ${chalk.bold(
			chalk.blue('Info'),
		)}`;
		this.errorPrefix = `${chalk.gray(this.name)}  ${chalk.bold(
			chalk.red('Error'),
		)}`;
		this.warnPrefix = `${chalk.gray(this.name)}   ${chalk.bold(
			chalk.yellow('Warn'),
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

	warn(message: string) {
		if (!this.options.logger) return;

		console.log(`${this.warnPrefix} ${message}`);
	}
}
