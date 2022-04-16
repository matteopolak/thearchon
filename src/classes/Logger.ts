import chalk from 'chalk';

import type { BaseBotOptions } from '../typings';

export default class Logger {
	private options: BaseBotOptions;
	private name: string;
	private infoPrefix: string;
	private errorPrefix: string;
	private warnPrefix: string;
	private joinedPrefix: string;
	private leftPrefix: string;
	private vanishedPrefix: string;

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
		this.joinedPrefix = `${chalk.gray(this.name)} ${chalk.bold(
			chalk.green('Joined'),
		)}`;
		this.leftPrefix = `${chalk.gray(this.name)}   ${chalk.bold(
			chalk.red('Left'),
		)}`;
		this.vanishedPrefix = `${chalk.gray(this.name)} ${chalk.bold(
			chalk.magenta('Vanish'),
		)}`;
	}

	joined(username: string) {
		if (!this.options.logger) return;

		console.log(`${this.joinedPrefix} ${chalk.cyan(username)} has joined`);
	}

	left(username: string) {
		if (!this.options.logger) return;

		console.log(`${this.leftPrefix} ${chalk.cyan(username)} has left`);
	}

	vanished(username: string) {
		if (!this.options.logger) return;

		console.log(`${this.vanishedPrefix} ${chalk.cyan(username)} has vanished`);
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
