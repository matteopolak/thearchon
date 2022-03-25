import fs from 'fs/promises';
import path from 'path';

import mineflayer from 'mineflayer';
import type { Bot, BotOptions } from 'mineflayer';
import type { Window } from 'prismarine-windows';

import config from '../config';
import {
	BALANCE_REGEX,
	COMMAND_COOLDOWN,
	COMMAND_REGEX,
	FISHMONGER_SELL_REGEX,
	MESSAGE_COOLDOWN,
	MOBCOINS_REGEX,
	MONEY_THRESHOLD,
	TELEPORT_REGEX,
} from '../constants';
import { Context, DestinationType, SellType, State } from '../typings';
import type { CommandFunction, Destination } from '../typings';
import { createPromiseResolvePair, currencyFormatter, sleep } from '../utils';
import BaseState from './BaseState';
import type FishBot from './FishBot';

export type BaseBotOptions = BotOptions & {
	alias: string;
	whitelist?: Set<string>;
	logger?: boolean;
	sellType?: SellType;
	fish?: boolean;
};

export default class BaseBot {
	public balance: number;
	public checkedBalance: boolean;
	public directory: string;
	public alias: string;
	public logger: boolean;
	public whitelist: Set<string>;
	public commands: Map<string, CommandFunction> = new Map();
	public options: BaseBotOptions;
	public _client: Bot;
	public client: BaseState;
	public captcha = {
		startedAt: 0,
		promise: Promise.resolve(),
		resolve: () => {},
	};

	public _state: State = State.IDLE;
	public previousState: State = State.IDLE;
	public context: Context = 0;

	private commandQueue: {
		message: string;
		resolve: () => void;
		ctx: Context;
	}[] = [];
	private lastCommandTimestamp: number = 0;

	private messageQueue: {
		message: string;
		resolve: () => void;
		ctx: Context;
	}[] = [];
	private lastMessageTimestamp: number = 0;
	private initialised = false;

	public fisher?: FishBot;

	constructor(options: BaseBotOptions) {
		this.options = options;
		this._client = mineflayer.createBot(options);
		this.client = new BaseState(this);
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

		this._client.once('spawn', this.join.bind(this));
	}

	set state(value: State) {
		this.previousState = this._state;
		++this.context;
		// @ts-ignore
		this._client.emit('context_changed');

		this._state = value;
	}

	public async join(ctx: Context = this.context): Promise<void> {
		const message = await this.completeActionAndWaitForMessages(
			ctx,
			() => this.command(ctx, `/${config.server}`),
			/^You have no new mail\./,
			/^Unable to connect to \w+: Server restarting/,
		);

		if (message !== 'You have no new mail.') {
			await this.client.waitForTicks(ctx, 200);

			return this.join(ctx);
		}

		if (this.fisher && config.fishOnJoin) {
			this.fisher.fish(ctx);
		}
	}

	public async addLoginHook(hook: (bot: BaseBot) => any) {
		this._client.once('spawn', () => hook(this));
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

		this._client.on('messagestr', async m => {
			if (m === 'You can also submit your answer with /code <code>') {
				const { promise, resolve } = createPromiseResolvePair();

				this.captcha.promise = promise;
				this.captcha.resolve = resolve;
				this.captcha.startedAt = Date.now();

				return (this.state = State.SOLVING_CAPTCHA);
			}

			if (
				m ===
					"It looks like you might be lost, so we've sent you back to spawn!" ||
				m.startsWith('TheArchon » This server is rebooting')
			) {
				return process.exit();
			}

			const ctx = this.context;

			if (FISHMONGER_SELL_REGEX.test(m)) {
				const value = parseFloat(
					m.match(FISHMONGER_SELL_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.balance += value;

				console.log(
					`[${this.alias}] [SELL] Sold fish for ${currencyFormatter.format(
						value,
					)} :: Balance: ${currencyFormatter.format(this.balance)}`,
				);

				if (this.balance >= MONEY_THRESHOLD) {
					return this.command(
						this.context,
						`/pay ${config.autopay_to} ${(this.balance - 150000).toFixed(2)}`,
					);
				}

				return;
			}

			if (
				TELEPORT_REGEX.test(m) &&
				this.whitelist.has(m.match(TELEPORT_REGEX)![1])
			) {
				return this.command(ctx, '/tpaccept');
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
					return run(this.context, sender, ...args);
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

	private addCommandToQueue(ctx: Context, message: string): Promise<any> {
		const { promise, resolve } = createPromiseResolvePair();

		if (message.startsWith('/code ')) {
			this.commandQueue.unshift({ message, resolve, ctx });
		} else this.commandQueue.push({ message, resolve, ctx });

		return promise;
	}

	private addMessageToQueue(ctx: Context, message: string): Promise<any> {
		const { promise, resolve } = createPromiseResolvePair();

		this.messageQueue.push({ message, resolve, ctx });

		return promise;
	}

	public async getCurrentMobCoins(ctx: Context) {
		const balance: Promise<number> = new Promise(resolve => {
			const listener = (m: string) => {
				if (MOBCOINS_REGEX.test(m)) {
					this._client.off('messagestr', listener);

					const balanceString = m.match(MOBCOINS_REGEX)![1];

					return resolve(parseFloat(balanceString.replaceAll(',', '')));
				}
			};

			const context = () => {
				this._client.off('messagestr', listener);

				resolve(0);
			};

			this._client.on('messagestr', listener);
			// @ts-ignore
			this._client.once('context_changed', () => context);

			if (ctx !== this.context) {
				// @ts-ignore
				this._client.off('context_changed', context);
				this._client.off('messagestr', listener);

				return resolve(0);
			}
		});

		await this.command(ctx, '/mobcoins balance');

		return balance;
	}

	public async getCurrentBalance(ctx: Context, real = false) {
		const balance: Promise<number> = new Promise(resolve => {
			const listener = (m: string) => {
				if (BALANCE_REGEX.test(m)) {
					this._client.off('messagestr', listener);

					const balanceString = m.match(BALANCE_REGEX)![1];
					const balance = parseFloat(balanceString.replaceAll(',', ''));

					this.balance = balance;
					this.checkedBalance = true;

					return resolve(balance - (real ? 0 : 150000));
				}
			};

			const context = () => {
				this._client.off('messagestr', listener);

				resolve(0);
			};

			this._client.on('messagestr', listener);

			// @ts-ignore
			this._client.on('context_changed', context);

			if (ctx !== this.context) {
				// @ts-ignore
				this._client.off('context_changed', context);
				this._client.off('messagestr', listener);

				return resolve(0);
			}
		});

		await this.command(ctx, '/balance');

		return Math.max(await balance, 0);
	}

	private async sendMoney(ctx: Context, username: string) {
		const balance = await this.getCurrentBalance(ctx);

		if (balance > 0) {
			await this.command(ctx, `/pay ${username} ${Math.floor(balance)}`);
		}
	}

	private async teleportTo(ctx: Context, username: string) {
		return this.command(ctx, `/tpa ${username}`);
	}

	private async lookAt(ctx: Context, username: string) {
		const player = this._client.players[username];

		if (player) return this.client.lookAt(ctx, player.entity.position);
	}

	private async saveInventory() {
		return fs.writeFile(
			path.join(this.directory, 'inventory.json'),
			JSON.stringify(this._client.inventory.slots, null, 2),
		);
	}

	private async saveEntityList() {
		await fs.writeFile(
			path.join(this.directory, 'players.json'),
			JSON.stringify(this._client.players, null, 2),
		);
		await fs.writeFile(
			path.join(this.directory, 'entities.json'),
			JSON.stringify(this._client.entities, null, 2),
		);
	}

	private async acceptTeleportRequest(ctx: Context) {
		return this.command(ctx, '/tpaccept');
	}

	private async executeCommand(ctx: Context, _: string, ...args: string[]) {
		return this.command(ctx, `/${args.join(' ')}`);
	}

	private async showMobCoinsBalance(ctx: Context) {
		const balance = await this.getCurrentMobCoins(ctx);

		return this.command(ctx, `/p ${currencyFormatter.format(balance)}`);
	}

	private async showBalance(ctx: Context) {
		const balance = await this.getCurrentBalance(ctx, true);

		return this.command(ctx, `/p ${currencyFormatter.format(balance)}`);
	}

	public async command(ctx: Context, message: string): Promise<void> {
		if (!message || ctx !== this.context) return;

		if (this.commandQueue.length === 0) {
			const waitFor = 2000 - this.lastCommandAgo;

			if (waitFor <= 0) {
				this.lastCommandTimestamp = Date.now();

				if (this.logger)
					console.log(`[${this.alias}] [CHAT] Sending command: ${message}`);

				return this.client.chat(ctx, message);
			}
		}

		const promise = this.addCommandToQueue(ctx, message);

		while (this.commandQueue.length !== 0) {
			const { message, resolve, ctx } = this.commandQueue.shift()!;

			if (ctx !== this.context) continue;

			await sleep(COMMAND_COOLDOWN - this.lastCommandAgo);
			this.lastCommandTimestamp = Date.now();

			if (this.logger)
				console.log(`[${this.alias}] [CHAT] Sending command: ${message}`);

			this.client.chat(ctx, message);

			resolve();
		}

		return promise;
	}

	public async chat(ctx: Context, message: string): Promise<void> {
		if (!message || ctx !== this.context) return;

		if (this.messageQueue.length === 0) {
			const waitFor = 2000 - this.lastMessageAgo;

			if (waitFor <= 0) {
				this.lastMessageTimestamp = Date.now();

				if (this.logger)
					console.log(`[${this.alias}] [CHAT] Sending message: ${message}`);

				return this.client.chat(ctx, message);
			}

			const promise = this.addMessageToQueue(ctx, message);

			while (this.messageQueue.length !== 0) {
				const { message, resolve, ctx } = this.messageQueue.shift()!;

				if (ctx !== this.context) continue;

				await sleep(MESSAGE_COOLDOWN - this.lastMessageAgo);
				this.lastMessageTimestamp = Date.now();

				if (this.logger)
					console.log(`[${this.alias}] [CHAT] Sending message: ${message}`);

				this.client.chat(ctx, message);

				resolve();
			}

			return promise;
		}

		return this.addMessageToQueue(ctx, message);
	}

	public async completeActionAndWaitForMessages(
		ctx: Context,
		action: () => any,
		...message: string[] | RegExp[]
	) {
		const promise = this.client.awaitMessage(ctx, ...message);

		await action();

		return promise;
	}

	public async completeActionAndWaitForMessage(
		ctx: Context,
		action: () => any,
		message: string,
	) {
		const promise = this.client.awaitMessage(ctx, message);

		await action();

		return promise;
	}

	public async teleport(
		ctx: Context,
		name: Destination,
		type: DestinationType = DestinationType.HOME,
	) {
		if (ctx !== this.context) return;

		await this.completeActionAndWaitForMessage(
			ctx,
			() => {
				this.command(
					ctx,
					type === DestinationType.HOME
						? `/home ${name}`
						: type === DestinationType.WARP
						? `/warp ${name}`
						: `/${name}`,
				);
			},
			'Teleportation commencing...',
		);

		await this.client.waitForTicks(ctx, 20);
		await this.client.waitForChunksToLoad(ctx);
	}

	public async completeActionAndWaitForWindow(
		ctx: Context,
		action: (ctx: Context) => any,
	): Promise<Window | undefined> {
		if (ctx !== this.context) return;

		const waitForWindow: Promise<Window | undefined> = new Promise(resolve => {
			const listener = (window?: Window) => {
				this._client.off('windowOpen', listener);
				// @ts-ignore
				this._client.off('context_changed', listener);

				return resolve(window);
			};

			this._client.once('windowOpen', resolve);
			// @ts-ignore
			this._client.once('context_changed', listener);
		});

		await action(ctx);

		const window = await waitForWindow;

		return window;
	}

	public isInventoryFull() {
		return !this._client.inventory.slots.some(
			(s, i) => i > 8 && i < 45 && (s === null || s.type === 0),
		);
	}
}
