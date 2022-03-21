import config from '../config';
import { once } from 'events';
import fs from 'fs/promises';
import mineflayer from 'mineflayer';
import path from 'path';
import { DestinationType, SellType } from '../typings';
import { createPromiseResolvePair, currencyFormatter, sleep } from '../utils';

import type { Bot, BotOptions } from 'mineflayer';
import type { Window } from 'prismarine-windows';
import type { CommandFunction, Destination } from '../typings';
import type FishBot from './FishBot';

export type BaseBotOptions = BotOptions & {
	alias: string;
	whitelist?: Set<string>;
	logger?: boolean;
	sellType?: SellType;
	fish?: boolean;
};

const MESSAGE_COOLDOWN = 1500;
const COMMAND_COOLDOWN = 2100;

const COMMAND_REGEX = /^\((\w{3,16})\)\s(.+)$/;
const TELEPORT_REGEX = /^(\w{3,16}) has requested to teleport to you\.$/;
const BALANCE_REGEX = /^Your balance is \$([\d,\.]+)/;
const MOBCOINS_REGEX = /^You have ([\d,\.]+) MobCoins/;
const FISHMONGER_SELL_REGEX = /^You sold all your fish for \$([\d,\.]+)/;
const MONEY_THRESHOLD = 40000000;

export default class BaseBot {
	public balance: number;
	public checkedBalance: boolean;
	public client: Bot;
	public directory: string;
	public alias: string;
	public logger: boolean;
	public whitelist: Set<string>;
	public commands: Map<string, CommandFunction> = new Map();
	public options: BaseBotOptions;
	public captcha = {
		active: false,
		startedAt: 0,
		promise: Promise.resolve(),
		resolve: () => {},
	};

	private commandQueue: { message: string; resolve: () => void }[] = [];
	private lastCommandTimestamp: number = 0;

	private messageQueue: { message: string; resolve: () => void }[] = [];
	private lastMessageTimestamp: number = 0;
	private initialised = false;
	public fisher?: FishBot;

	constructor(options: BaseBotOptions) {
		this.options = options;
		this.client = mineflayer.createBot(options);
		this.alias = options.alias;
		this.logger = options.logger ?? config.log;
		this.whitelist = options.whitelist ?? new Set();
		this.directory = path.join(__dirname, '..', '..', 'data', this.alias);
		this.balance = 0;
		this.checkedBalance = false;

		this.commands.set('tp', this.teleportTo.bind(this));
		this.commands.set('look', this.lookAt.bind(this));
		this.commands.set('inventory', this.saveInventory.bind(this));
		this.commands.set('bal', this.showBalance.bind(this));
		this.commands.set('mobcoins', this.showMobCoinsBalance.bind(this));
		this.commands.set('accept', this.acceptTeleportRequest.bind(this));
		this.commands.set('entity', this.saveEntityList.bind(this));
		this.commands.set('pay', this.sendMoney.bind(this));
		this.commands.set('exec', this.executeCommand.bind(this));

		this.client.once('spawn', this.join.bind(this));
	}

	public async join(): Promise<void> {
		const message = await this.completeActionAndWaitForMessages(
			() => this.command('/ruby'),
			/^You have no new mail\./,
			/^Unable to connect to \w+: Server restarting/,
		);

		if (message !== 'You have no new mail.') {
			await this.client.waitForTicks(200);

			return this.join();
		}
	}

	public async addLoginHook(hook: (bot: BaseBot) => any) {
		this.client.once('spawn', () => hook(this));
	}

	public async init() {
		if (this.initialised) throw new Error('Already initialised');

		this.initialised = true;

		await fs.mkdir(this.directory, { recursive: true });
		await fs
			.rename(
				path.join(this.directory, 'latest.log'),
				path.join(this.directory, `chat_${Date.now()}.log`),
			)
			.catch(() => {});

		this.client.on('messagestr', async m => {
			if (m === 'You can also submit your answer with /code <code>') {
				const { promise, resolve } = createPromiseResolvePair();

				this.captcha.promise = promise;
				this.captcha.resolve = resolve;
				this.captcha.startedAt = Date.now();

				return (this.captcha.active = true);
			}

			if (
				m ===
					"It looks like you might be lost, so we've sent you back to spawn!" ||
				m.startsWith('TheArchon » This server is rebooting')
			) {
				return process.exit();
			}

			if (FISHMONGER_SELL_REGEX.test(m)) {
				const value = parseFloat(
					m.match(FISHMONGER_SELL_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance();
				else this.balance += value;

				console.log(
					`[${this.alias}] [SELL] Sold fish for ${currencyFormatter.format(
						value,
					)} :: Balance: ${currencyFormatter.format(this.balance)}`,
				);

				if (this.balance >= MONEY_THRESHOLD) {
					return this.command(
						`/pay ${config.autopay_to} ${(this.balance - 150000).toFixed(2)}`,
					);
				}

				return;
			}

			if (
				TELEPORT_REGEX.test(m) &&
				this.whitelist.has(m.match(TELEPORT_REGEX)![1])
			) {
				return this.command('/tpaccept');
			}

			if (COMMAND_REGEX.test(m) === false) return;

			const [, sender, raw] = m.match(COMMAND_REGEX)!;
			const args = raw.split(/\s+/g);
			const command = args.shift()!;

			if (!this.whitelist.has(sender)) return;

			const run = this.commands.get(command);

			if (run !== undefined) {
				if (this.logger)
					console.log(
						`[${this.alias}] [COMMAND] ${sender} ran command '${command}'`,
					);

				try {
					return run(sender, ...args);
				} catch (e) {
					console.log(`[${this.alias}] [ERROR] ${e}`);
				}
			}
		});
	}

	private get lastMessageAgo() {
		return Date.now() - this.lastMessageTimestamp;
	}

	private get lastCommandAgo() {
		return Date.now() - this.lastCommandTimestamp;
	}

	private addCommandToQueue(message: string): Promise<any> {
		const { promise, resolve } = createPromiseResolvePair();

		if (message.startsWith('/code ')) {
			this.commandQueue.unshift({ message, resolve });
			// @ts-ignore
			this.client.emit('custom::code_added');
		} else this.commandQueue.push({ message, resolve });

		return promise;
	}

	private addMessageToQueue(message: string): Promise<any> {
		const { promise, resolve } = createPromiseResolvePair();

		this.messageQueue.push({ message, resolve });

		return promise;
	}

	public async getCurrentMobCoins() {
		const balance: Promise<number> = new Promise(resolve => {
			const listener = (m: string) => {
				if (MOBCOINS_REGEX.test(m)) {
					this.client.removeListener('messagestr', listener);

					const balanceString = m.match(MOBCOINS_REGEX)![1];

					return resolve(parseFloat(balanceString.replaceAll(',', '')));
				}
			};

			this.client.on('messagestr', listener);
		});

		await this.command('/mobcoins balance');

		return balance;
	}

	public async getCurrentBalance(real = false) {
		const balance: Promise<number> = new Promise(resolve => {
			const listener = (m: string) => {
				if (BALANCE_REGEX.test(m)) {
					this.client.removeListener('messagestr', listener);

					const balanceString = m.match(BALANCE_REGEX)![1];
					const balance = parseFloat(balanceString.replaceAll(',', ''));

					this.balance = balance;
					this.checkedBalance = true;

					return resolve(balance - (real ? 0 : 150000));
				}
			};

			this.client.on('messagestr', listener);
		});

		await this.command('/balance');

		return Math.max(await balance, 0);
	}

	private async sendMoney(username: string) {
		const balance = await this.getCurrentBalance();

		if (balance > 0)
			await this.command(`/pay ${username} ${Math.floor(balance)}`);
	}

	private async teleportTo(username: string) {
		return this.command(`/tpa ${username}`);
	}

	private async lookAt(username: string) {
		const player = this.client.players[username];

		if (player) return this.client.lookAt(player.entity.position);
	}

	private async saveInventory() {
		return fs.writeFile(
			path.join(this.directory, 'inventory.json'),
			JSON.stringify(this.client.inventory.slots, null, 2),
		);
	}

	private async saveEntityList() {
		await fs.writeFile(
			path.join(this.directory, 'players.json'),
			JSON.stringify(this.client.players, null, 2),
		);
		await fs.writeFile(
			path.join(this.directory, 'entities.json'),
			JSON.stringify(this.client.entities, null, 2),
		);
	}

	private async acceptTeleportRequest() {
		return this.command('/tpaccept');
	}

	private async executeCommand(_: string, ...args: string[]) {
		return this.command(`/${args.join(' ')}`);
	}

	private async showMobCoinsBalance() {
		const balance = await this.getCurrentMobCoins();

		return this.command(`/p ${currencyFormatter.format(balance)}`);
	}

	private async showBalance() {
		const balance = await this.getCurrentBalance(true);

		return this.command(`/p ${currencyFormatter.format(balance)}`);
	}

	public async command(message: string): Promise<void> {
		if (!message) return;

		if (this.commandQueue.length === 0) {
			const waitFor = 2000 - this.lastCommandAgo;

			if (
				waitFor <= 0 &&
				(!this.captcha.active || message.startsWith('/code '))
			) {
				this.lastCommandTimestamp = Date.now();

				if (this.logger)
					console.log(`[${this.alias}] [CHAT] Sending command: ${message}`);

				return this.client.chat(message);
			}
		}

		const promise = this.addCommandToQueue(message);

		while (this.commandQueue.length !== 0) {
			const { message, resolve } = this.commandQueue.shift()!;

			if (this.captcha.active && !message.startsWith('/code ')) {
				this.commandQueue.unshift({ message, resolve });

				await once(this.client, 'custom::code_added');

				continue;
			}

			await sleep(COMMAND_COOLDOWN - this.lastCommandAgo);
			this.lastCommandTimestamp = Date.now();

			if (this.logger)
				console.log(`[${this.alias}] [CHAT] Sending command: ${message}`);

			this.client.chat(message);

			resolve();
		}

		return promise;
	}

	public async chat(message: string): Promise<void> {
		if (!message) return;

		if (this.messageQueue.length === 0) {
			const waitFor = 2000 - this.lastMessageAgo;

			if (waitFor <= 0) {
				this.lastMessageTimestamp = Date.now();

				if (this.logger)
					console.log(`[${this.alias}] [CHAT] Sending message: ${message}`);

				return this.client.chat(message);
			}

			const promise = this.addMessageToQueue(message);

			while (this.messageQueue.length !== 0) {
				const { message, resolve } = this.messageQueue.shift()!;

				await sleep(MESSAGE_COOLDOWN - this.lastMessageAgo);
				this.lastMessageTimestamp = Date.now();

				if (this.logger)
					console.log(`[${this.alias}] [CHAT] Sending message: ${message}`);

				this.client.chat(message);

				resolve();
			}

			return promise;
		}

		return this.addMessageToQueue(message);
	}

	public async completeActionAndWaitForMessages(
		action: () => any,
		...message: string[] | RegExp[]
	) {
		const promise = this.client.awaitMessage(...message);

		await action();

		return promise;
	}

	public async completeActionAndWaitForMessage(
		action: () => any,
		message: string,
	) {
		const promise = this.client.awaitMessage(message);

		await action();

		return promise;
	}

	public async teleport(
		name: Destination,
		type: DestinationType = DestinationType.HOME,
	) {
		await this.completeActionAndWaitForMessage(() => {
			this.command(
				type === DestinationType.HOME
					? `/home ${name}`
					: type === DestinationType.WARP
					? `/warp ${name}`
					: `/${name}`,
			);
		}, 'Teleportation commencing...');

		await this.client.waitForTicks(20);
		await this.client.waitForChunksToLoad();
	}

	public async completeActionAndWaitForWindow(
		action: () => any,
	): Promise<Window> {
		const waitForWindow = once(this.client, 'windowOpen');

		await action();

		const [window] = await waitForWindow;

		return window;
	}

	public isInventoryFull() {
		return !this.client.inventory.slots.some(
			(s, i) => i > 8 && i < 45 && (s === null || s.type === 0),
		);
	}
}
