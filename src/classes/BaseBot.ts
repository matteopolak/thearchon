import fs from 'fs/promises';
import path from 'path';
import type { MessagePort } from 'worker_threads';

import chalk from 'chalk';
import mineflayer from 'mineflayer';
import type { Bot } from 'mineflayer';
import type { Window } from 'prismarine-windows';
import { Vec3 } from 'vec3';

import config from '../config';
import {
	BALANCE_REGEX,
	CHAT_MESSAGE_REGEX,
	COMMAND_COOLDOWN,
	COMMAND_REGEX,
	DIRECT_MESSAGE_REGEX,
	FISHMONGER_COINS_SELL_REGEX,
	FISHMONGER_MOBCOINS_SELL_REGEX,
	MESSAGE_COOLDOWN,
	MOBCOINS_REGEX,
	MONEY_THRESHOLD,
	RECEIVE_MONEY_REGEX,
	SEND_MONEY_REGEX,
	SURPLUS_MONEY_THRESHOLD,
	TELEPORT_REGEX,
} from '../constants';
import {
	BaseBotOptions,
	Context,
	LocationType,
	MessageType,
	RawItem,
	State,
} from '../typings';
import { CommandFunction, Location, ParentMessage } from '../typings';
import {
	createPromiseResolvePair,
	currencyFormatter,
	generateResponse,
	sleep,
} from '../utils';
import BaseState from './BaseState';
import type FishBot from './FishBot';
import Logger from './Logger';

export default class BaseBot {
	public balance: number;
	public checkedBalance: boolean;
	public directory: string;
	public alias: string;
	public whitelist: Set<string>;
	public commands: Map<string, CommandFunction> = new Map();
	public options: BaseBotOptions;
	public _bot: Bot;
	public client: BaseState;
	public logger: Logger;
	public captcha = {
		startedAt: 0,
		promise: Promise.resolve(),
		resolve: () => {},
		fishing: false,
		solving: false,
	};
	public port: MessagePort;

	public previousState: State = State.IDLE;
	public _state: State = State.IDLE;
	public contextId: number = 0;

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
	private responseMap: Map<string, number> = new Map();

	public fisher?: FishBot;

	constructor(options: BaseBotOptions, port: MessagePort) {
		this.options = options;
		this._bot = mineflayer.createBot(options);
		this.client = new BaseState(this);
		this.alias = options.alias;
		this.whitelist = options.whitelist ?? new Set();
		this.directory = path.join(__dirname, '..', '..', 'data', this.alias);
		this.balance = 0;
		this.checkedBalance = false;
		this.logger = new Logger(options);
		this.port = port;

		this.commands.set('tp', this.teleportTo.bind(this));
		this.commands.set('look', this.lookAt.bind(this));
		this.commands.set('inventory', this.saveInventory.bind(this));
		this.commands.set('bal', this.showBalance.bind(this));
		this.commands.set('mobcoins', this.showMobCoinsBalance.bind(this));
		this.commands.set('accept', this.acceptTeleportRequest.bind(this));
		this.commands.set('entity', this.saveEntityList.bind(this));
		this.commands.set('pay', this.sendMoney.bind(this));
		this.commands.set('exec', this.executeCommand.bind(this));

		this._bot.once('spawn', this.join.bind(this));

		this.port.on('message', ({ command, args, sender }: ParentMessage) => {
			const run = this.commands.get(command);

			if (run !== undefined) {
				this.logger.info(`${sender} ran command '${command}'`);

				try {
					return run(this.context, sender, ...args);
				} catch (e: any) {
					this.logger.error(e);
				}
			}
		});
	}

	get context(): Context {
		return {
			id: this.contextId,
			allow_reaction: false,
			reacting_to_movement: false,
			fishing: {
				pitch: 0,
				yaw: 0,
				position: new Vec3(0, 0, 0),
			},
			location: Location.UNKNOWN,
		};
	}

	get state() {
		return this._state;
	}

	set state(value: State) {
		++this.contextId;
		// @ts-ignore
		this._bot.emit('context_changed');

		this.previousState = this._state;
		this._state = value;
	}

	createMoveHandler(ctx: Context) {
		const listener = async () => {
			if (
				!ctx.reacting_to_movement &&
				ctx.allow_reaction &&
				this.state === State.FISHING
			) {
				if (
					this.client.entity.pitch !== ctx.fishing.pitch ||
					this.client.entity.yaw !== ctx.fishing.yaw ||
					this.client.entity.position.xzDistanceTo(ctx.fishing.position) > 0.1
				) {
					this.logger.warn(
						`Unusual movement. Detected yaw/pitch/movement change: ${
							ctx.fishing.pitch - this.client.entity.yaw
						}/${
							ctx.fishing.yaw - this.client.entity.pitch
						}/${this.client.entity.position.distanceTo(ctx.fishing.position)}`,
					);

					this._bot.off('move', listener);
					// @ts-ignore
					this._bot.off('context_changed', contextListener);

					this.state = State.IDLE;
					await this.client.lookAround(this.context);

					if (this.fisher) {
						this.fisher.fish(ctx);
					}

					return;
				}
			}
		};

		const contextListener = () => {
			this._bot.off('move', listener);
		};

		this._bot.on('move', listener);
		// @ts-ignore
		this._bot.once('context_changed', contextListener);

		if (ctx.id !== this.contextId) {
			this._bot.off('move', listener);
			// @ts-ignore
			this._bot.off('context_changed', contextListener);
		}
	}

	public async waitForItem(ctx: Context, item: number) {
		if (ctx.id !== this.contextId) return;

		return new Promise<undefined>(resolve => {
			const listener = (packet: RawItem) => {
				if (packet.item.blockId !== item) return;

				this._bot._client.off('set_slot', listener);
				// @ts-ignore
				this._bot.off('context_changed', contextListener);

				resolve(undefined);
			};

			const contextListener = () => {
				this._bot._client.off('set_slot', listener);

				resolve(undefined);
			};

			this._bot._client.on('set_slot', listener);
			// @ts-ignore
			this._bot.once('context_changed', contextListener);

			if (ctx.id !== this.contextId) {
				this._bot._client.off('set_slot', listener);
				// @ts-ignore
				this._bot.off('context_changed', contextListener);

				resolve(undefined);
			}
		});
	}

	public async waitForSlotItem(ctx: Context, slot: number, item: number) {
		if (ctx.id !== this.contextId) return;

		return new Promise<undefined>(resolve => {
			const listener = (packet: RawItem) => {
				if (packet.slot !== slot || packet.item.blockId !== item) return;

				this._bot._client.off('set_slot', listener);
				// @ts-ignore
				this._bot.off('context_changed', contextListener);

				resolve(undefined);
			};

			const contextListener = () => {
				this._bot._client.off('set_slot', listener);

				resolve(undefined);
			};

			this._bot._client.on('set_slot', listener);
			// @ts-ignore
			this._bot.once('context_changed', contextListener);

			if (ctx.id !== this.contextId) {
				this._bot._client.off('set_slot', listener);
				// @ts-ignore
				this._bot.off('context_changed', contextListener);

				resolve(undefined);
			}
		});
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

		if (this.fisher && config.fishing.fish_on_join) {
			this.fisher.bestFishingRod = this.fisher.getBestFishingRod(true);
			this.fisher.fish(ctx);
		}
	}

	public async addLoginHook(hook: (bot: BaseBot) => any) {
		this._bot.once('spawn', () => hook(this));
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

		this._bot.on('messagestr', async m => {
			const ctx = this.context;

			if (
				m === "Don't panic! This is just a routine check to stop AFK fishing" ||
				m === 'You are required to complete a captcha to continue playing.'
			) {
				const { promise, resolve } = createPromiseResolvePair();

				this.captcha.fishing = this.state === State.FISHING;
				this.captcha.promise = promise;
				this.captcha.resolve = resolve;
				this.captcha.startedAt = Date.now();

				this.client.waitForTicks(ctx, 20 * 15).then(() => {
					if (this.state !== State.SOLVING_CAPTCHA) return;

					this.client.activateItem(ctx);
				});

				this.logger.info('Captcha detected. Solving...');

				return (this.state = State.SOLVING_CAPTCHA);
			}

			if (
				m ===
				"It looks like you might be lost, so we've sent you back to spawn!"
			) {
				this.state = State.IDLE;

				if (this.previousState === State.FISHING && this.fisher) {
					return this.fisher.fish(ctx);
				}
			}

			if (m.startsWith('TheArchon » This server is rebooting')) {
				return process.exit(0);
			}

			if (CHAT_MESSAGE_REGEX.test(m)) {
				const [, name, message] = m.match(CHAT_MESSAGE_REGEX)!;
				const lower = this._bot.entity.username!.toLowerCase();

				if (!message.toLowerCase().includes(lower)) return;

				if (config.fishing.stop_fishing_on_mention) {
					this.state = State.IDLE;
				}

				if (config.notify_on_mention) {
					this.port.postMessage({
						type: MessageType.NOTIFICATION,
						data: {
							message,
							sender: name,
							type: 'message',
						},
					});
				}

				return;
			}

			if (FISHMONGER_COINS_SELL_REGEX.test(m)) {
				const value = parseFloat(
					m.match(FISHMONGER_COINS_SELL_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.balance += value;

				this.logger.info(
					`Sold fish for $${currencyFormatter.format(
						value,
					)} : Balance: $${currencyFormatter.format(this.balance)}`,
				);

				if (this.balance >= MONEY_THRESHOLD && config.autopay_to) {
					const amount = Math.floor(this.balance - SURPLUS_MONEY_THRESHOLD);

					return this.command(
						this.context,
						`/pay ${config.autopay_to} ${amount.toFixed(2)}`,
					);
				}

				return;
			}

			if (FISHMONGER_MOBCOINS_SELL_REGEX.test(m)) {
				const value = parseFloat(
					m.match(FISHMONGER_MOBCOINS_SELL_REGEX)![1].replaceAll(',', ''),
				);

				this.logger.info(
					`Sold fish for ${currencyFormatter.format(value)} MobCoins`,
				);

				return;
			}

			if (SEND_MONEY_REGEX.test(m)) {
				const value = parseFloat(
					m.match(SEND_MONEY_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.balance -= value;

				return;
			}

			if (RECEIVE_MONEY_REGEX.test(m)) {
				const value = parseFloat(
					m.match(RECEIVE_MONEY_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.balance += value;

				return;
			}

			if (
				TELEPORT_REGEX.test(m) &&
				this.whitelist.has(m.match(TELEPORT_REGEX)![1])
			) {
				return this.command(ctx, '/tpaccept');
			}

			if (DIRECT_MESSAGE_REGEX.test(m)) {
				const [, name, message] = m.match(DIRECT_MESSAGE_REGEX)!;

				if (config.fishing.stop_fishing_on_mention) {
					this.state = State.IDLE;
				}

				if (config.notify_on_mention) {
					this.port.postMessage({
						type: MessageType.NOTIFICATION,
						data: {
							message,
							sender: name,
							type: 'direct message',
						},
					});
				}

				if (this.responseMap.has(name)) {
					const last = this.responseMap.get(name)!;
					const now = Date.now();

					if (last + 5_000 > now) return;
				}

				this.responseMap.set(name, Date.now());

				const response = await generateResponse(message);

				if (response) {
					const wait = 2_000 + response.length * 250;

					this.logger.info(
						`Responding to ${name} (in ${wait}ms) from prompt '${message}': ${chalk.underline(
							response,
						)}`,
					);

					await sleep(wait);

					return this.command(ctx, `/msg ${name} ${response}`);
				}

				return;
			}

			if (COMMAND_REGEX.test(m) === false) return;

			const [, sender, raw] = m.match(COMMAND_REGEX)!;
			const args = raw.split(/\s+/g);
			const command = args.shift()!;

			if (!this.whitelist.has(sender)) return;

			const run = this.commands.get(command);

			if (run !== undefined) {
				this.logger.info(`${sender} ran command '${command}'`);

				try {
					return run(this.context, sender, ...args);
				} catch (e: any) {
					this.logger.error(e);
				}
			}
		});

		this.initializeCommandLoop();
		this.initializeMessageLoop();
	}

	private async initializeCommandLoop() {
		while (await sleep(COMMAND_COOLDOWN)) {
			const { message, resolve, ctx } = this.commandQueue.shift() ?? {};

			if (
				ctx?.id !== this.context.id ||
				message === undefined ||
				resolve === undefined ||
				ctx === undefined
			) {
				if (resolve) resolve();

				continue;
			}

			await sleep(COMMAND_COOLDOWN - this.lastCommandAgo);
			this.lastCommandTimestamp = Date.now();

			this.logger.info(`Sending command: ${message}`);
			this.client.chat(ctx, message);

			resolve();
		}
	}

	private async initializeMessageLoop() {
		while (await sleep(MESSAGE_COOLDOWN)) {
			const { message, resolve, ctx } = this.messageQueue.shift() ?? {};

			if (
				ctx?.id !== this.context.id ||
				message === undefined ||
				resolve === undefined ||
				ctx === undefined
			) {
				if (resolve) resolve();

				continue;
			}

			await sleep(MESSAGE_COOLDOWN - this.lastMessageAgo);
			this.lastMessageTimestamp = Date.now();

			this.logger.info(`Sending message: ${message}`);
			this.client.chat(ctx, message);

			resolve();
		}
	}

	private get lastMessageAgo() {
		return Date.now() - this.lastMessageTimestamp;
	}

	private get lastCommandAgo() {
		return Date.now() - this.lastCommandTimestamp;
	}

	private addCommandToQueue(ctx: Context, message: string): Promise<any> {
		const { promise, resolve } = createPromiseResolvePair();

		this.commandQueue.push({ message, resolve, ctx });

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
					this._bot.off('messagestr', listener);

					const balanceString = m.match(MOBCOINS_REGEX)![1];

					return resolve(parseFloat(balanceString.replaceAll(',', '')));
				}
			};

			const context = () => {
				this._bot.off('messagestr', listener);

				resolve(0);
			};

			this._bot.on('messagestr', listener);
			// @ts-ignore
			this._bot.once('context_changed', () => context);

			if (ctx.id !== this.contextId) {
				// @ts-ignore
				this._bot.off('context_changed', context);
				this._bot.off('messagestr', listener);

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
					this._bot.off('messagestr', listener);

					const balanceString = m.match(BALANCE_REGEX)![1];
					const balance = parseFloat(balanceString.replaceAll(',', ''));

					this.balance = balance;
					this.checkedBalance = true;

					return resolve(balance - (real ? 0 : SURPLUS_MONEY_THRESHOLD));
				}
			};

			const context = () => {
				this._bot.off('messagestr', listener);

				resolve(0);
			};

			this._bot.on('messagestr', listener);

			// @ts-ignore
			this._bot.on('context_changed', context);

			if (ctx.id !== this.contextId) {
				// @ts-ignore
				this._bot.off('context_changed', context);
				this._bot.off('messagestr', listener);

				return resolve(0);
			}
		});

		await this.command(ctx, '/balance');

		return Math.max(await balance, 0);
	}

	private async sendMoney(ctx: Context, username?: string) {
		if (!this.checkedBalance) await this.getCurrentBalance(ctx);

		const balance = this.balance - SURPLUS_MONEY_THRESHOLD;

		if (balance > 0 && username) {
			const amount = Math.floor(balance);

			await this.command(ctx, `/pay ${username} ${amount}`);
		}
	}

	private async teleportTo(ctx: Context, username?: string) {
		if (username) return this.command(ctx, `/tpa ${username}`);
	}

	private async lookAt(ctx: Context, username: string) {
		const player = this._bot.players[username];

		if (player) return this.client.lookAt(ctx, player.entity.position);
	}

	private async saveInventory() {
		return fs.writeFile(
			path.join(this.directory, 'inventory.json'),
			JSON.stringify(this._bot.inventory.slots, null, 2),
		);
	}

	private async saveEntityList() {
		await fs.writeFile(
			path.join(this.directory, 'players.json'),
			JSON.stringify(this._bot.players, null, 2),
		);
		await fs.writeFile(
			path.join(this.directory, 'entities.json'),
			JSON.stringify(this._bot.entities, null, 2),
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
		if (!message || ctx.id !== this.contextId) return;
		return this.addCommandToQueue(ctx, message);
	}

	public async chat(ctx: Context, message: string): Promise<void> {
		if (!message || ctx.id !== this.contextId) return;
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

	public async completeActionAndWaitForSlotItem(
		ctx: Context,
		action: () => any,
		slot: number,
		item: number,
	) {
		const promise = this.waitForSlotItem(ctx, slot, item);

		await action();

		return promise;
	}

	public async teleport(
		ctx: Context,
		name: Location,
		type: LocationType = LocationType.HOME,
	) {
		if (ctx.id !== this.contextId) return;

		await this.completeActionAndWaitForMessage(
			ctx,
			() => {
				this.command(
					ctx,
					type === LocationType.HOME
						? `/home ${name}`
						: type === LocationType.WARP
						? `/warp ${name}`
						: `/${name}`,
				);
			},
			'Teleportation commencing...',
		);

		await this.client.waitForTicks(ctx, 20);
		await this.client.waitForChunksToLoad(ctx);

		ctx.location = name;
	}

	public async completeActionAndWaitForWindow(
		ctx: Context,
		action: (ctx: Context) => any,
	): Promise<Window | undefined> {
		if (ctx.id !== this.contextId) return;

		const waitForWindow: Promise<Window | undefined> = new Promise(resolve => {
			const listener = (window?: Window) => {
				this._bot.off('windowOpen', listener);
				// @ts-ignore
				this._bot.off('context_changed', listener);

				return resolve(window);
			};

			this._bot.once('windowOpen', listener);
			// @ts-ignore
			this._bot.once('context_changed', listener);

			if (ctx.id !== this.contextId) {
				// @ts-ignore
				this._bot.off('context_changed', listener);
				this._bot.off('windowOpen', listener);

				return resolve(undefined);
			}
		});

		await action(ctx);

		const window = await waitForWindow;

		return window;
	}

	public isInventoryFull() {
		return !this._bot.inventory.slots.some(
			(s, i) => i > 8 && i < 45 && (s === null || s.type === 0),
		);
	}
}
