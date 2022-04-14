import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';
import type { MessagePort } from 'worker_threads';

import chalk from 'chalk';
import mineflayer from 'mineflayer';
import type { Bot } from 'mineflayer';
import type { Window } from 'prismarine-windows';
import type TypedEventEmitter from 'typed-emitter';

import config from '../config';
import {
	BAIT_NAME_TO_PRICE,
	BALANCE_REGEX,
	CHAT_MESSAGE_REGEX,
	COMMAND_COOLDOWN,
	COMMAND_REGEX,
	DIRECT_MESSAGE_REGEX,
	FISHING_ROD_DATA,
	FISHMONGER_COINS_SELL_REGEX,
	FISHMONGER_MOBCOINS_SELL_REGEX,
	JOIN_ERROR_REGEX,
	MESSAGE_COOLDOWN,
	MOBCOINS_REGEX,
	MONEY_THRESHOLD,
	PURCHASE_BAIT_REGEX,
	PURCHASE_ITEM_REGEX,
	PURCHASE_ROD_REGEX,
	RECEIVE_MONEY_REGEX,
	RENEW_CAPTCHA_INTERVAL,
	SEND_MONEY_REGEX,
	SURPLUS_MONEY_THRESHOLD,
	TELEPORT_HERE_REGEX,
	TELEPORT_REGEX,
	TIME_BEFORE_FISH_AFTER_MOVEMENT_DETECT,
} from '../constants';
import {
	BaseBotOptions,
	Context,
	LocationType,
	MessageType,
	MovementInstruction,
	RawItem,
	RecordingStep,
	State,
} from '../typings';
import {
	CommandFunction,
	Direction,
	Location,
	ParentMessage,
} from '../typings';
import {
	createPromiseResolvePair,
	currencyFormatter,
	generateActions,
	generateResponse,
	random,
	sleep,
} from '../utils';
import BaseState from './BaseState';
import type FishBot from './FishBot';
import Logger from './Logger';

type BaseBotEvents = {
	context_changed: () => void;
	balance_changed: (balance: number, change: number, from?: string) => void;
	mobcoins_changed: (mobcoins: number) => void;
};

export default class BaseBot extends (EventEmitter as new () => TypedEventEmitter<BaseBotEvents>) {
	private _balance: number = 0;
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
	public joinedAt: number = 0;
	public logFileLocation: string;

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
	public movements: {
		steps: RecordingStep[];
		name: string;
	}[] = [];

	constructor(options: BaseBotOptions, port: MessagePort) {
		super();

		this.options = options;
		this._bot = mineflayer.createBot(options);
		this.client = new BaseState(this);
		this.alias = options.alias;
		this.whitelist = options.whitelist ?? new Set();
		this.directory = path.join(__dirname, '..', '..', 'data', this.alias);
		this.checkedBalance = false;
		this.logger = new Logger(options);
		this.port = port;
		this.logFileLocation = path.join(this.directory, 'latest.log');

		this.commands.set('tp', this.teleportTo.bind(this));
		this.commands.set('look', this.lookAt.bind(this));
		this.commands.set('inventory', this.saveInventory.bind(this));
		this.commands.set('bal', this.showBalance.bind(this));
		this.commands.set('mobcoins', this.showMobCoinsBalance.bind(this));
		this.commands.set('accept', this.acceptTeleportRequest.bind(this));
		this.commands.set('entity', this.saveEntityList.bind(this));
		this.commands.set('pay', this.sendMoney.bind(this));
		this.commands.set('exec', this.executeCommand.bind(this));
		this.commands.set('chat', this.sendChatMessage.bind(this));
		this.commands.set('move', this.executeMove.bind(this));

		this.port.on('message', ({ command, args, sender }: ParentMessage) => {
			const run = this.commands.get(command);

			if (run !== undefined) {
				this.logger.info(`${sender} ran command '${command}'`);

				try {
					return run(this.context(), sender, ...args);
				} catch (e: any) {
					this.logger.error(e);
				}
			}
		});
	}

	get balance() {
		return this._balance;
	}

	setBalance(value: number, from?: string) {
		const change = value - this._balance;

		this._balance = value;
		this.emit('balance_changed', value, change, from);
	}

	get state() {
		return this._state;
	}

	set state(value: State) {
		++this.contextId;
		this.emit('context_changed');

		this.previousState = this._state;
		this._state = value;
	}

	context(): Context {
		return {
			id: this.contextId,
			allow_reaction: false,
			reacting_to_movement: false,
			location: Location.UNKNOWN,
			last_window_click: 0,
		};
	}

	async executeMove(ctx: Context, _?: string, ...instructions: string[]) {
		const parsed: MovementInstruction[] = [];

		for (const instruction of instructions) {
			const match = instruction.match(
				/(left|right|forward|back|center)(?:\((\d+)\))?/,
			);

			if (match === null) continue;

			const [, direction, _distance] = match;
			const distance = _distance ? parseInt(_distance) : 0;

			parsed.push({ direction: direction as Direction, distance });
		}

		if (parsed.length > 0) {
			return this.client.processMovementInstructions(ctx, parsed);
		}
	}

	async randomMovement(ctx: Context) {
		if (ctx.id !== this.contextId || this.movements.length === 0) return;

		const movement = this.movements[random(this.movements.length)];

		this.logger.info(`Started random movement ${chalk.red(movement.name)}...`);
		await this.client.replay(ctx, movement.steps);
		await this.client.waitForTicks(ctx, 10);
		this.logger.info(`Finished random movement ${chalk.red(movement.name)}`);

		if (ctx.fishing) {
			ctx.fishing.pitch = this.client.entity.pitch;
			ctx.fishing.yaw = this.client.entity.yaw;
		}
	}

	setState(ctx: Context, value: State, update = false) {
		if (ctx.id !== this.contextId) return;

		this.state = value;

		if (update) {
			ctx.id = this.contextId;
		}
	}

	createMoveHandler(ctx: Context) {
		const listener = async () => {
			if (
				!ctx.reacting_to_movement &&
				ctx.allow_reaction &&
				this.state === State.FISHING
			) {
				if (
					this.client.entity.pitch !== ctx.fishing!.pitch ||
					this.client.entity.yaw !== ctx.fishing!.yaw ||
					this.client.entity.position.xzDistanceTo(ctx.fishing!.position) > 0.1
				) {
					const message = `Unusual movement. Detected yaw/pitch/movement change: ${
						ctx.fishing!.pitch - this.client.entity.yaw
					}/${
						ctx.fishing!.yaw - this.client.entity.pitch
					}/${this.client.entity.position.distanceTo(ctx.fishing!.position)}`;

					this.logger.warn(message);

					this.port.postMessage({
						type: MessageType.WARNING,
						data: {
							message,
						},
					});

					this._bot.off('move', listener);
					this.off('context_changed', contextListener);

					if (config.react_to_external_move) {
						if (
							this.client.entity.position.xzDistanceTo(ctx.fishing!.position) >
							0.1
						) {
							this.setState(ctx, State.IDLE);
							await sleep(TIME_BEFORE_FISH_AFTER_MOVEMENT_DETECT);

							if (this.fisher && this.previousState === State.FISHING) {
								this.fisher.fish(ctx);
							}

							return;
						}

						if (ctx.fishing) ctx.fishing.fix_after_current = true;

						this.setState(ctx, State.IDLE);
						await sleep(TIME_BEFORE_FISH_AFTER_MOVEMENT_DETECT);

						if (this.fisher && this.previousState === State.FISHING) {
							this.fisher.fish(ctx);
						}
					}

					return;
				}
			}
		};

		const contextListener = () => {
			this._bot.off('move', listener);
		};

		this._bot.on('move', listener);
		this.once('context_changed', contextListener);

		if (ctx.id !== this.contextId) {
			this._bot.off('move', listener);
			this.off('context_changed', contextListener);
		}
	}

	public async waitForItemOrMessage(
		ctx: Context,
		messages: string[] | RegExp[],
		item?: number,
	) {
		if (ctx.id !== this.contextId) return;

		return new Promise<RawItem | null>(resolve => {
			const slotListener = (packet: RawItem) => {
				if (
					packet.item.blockId === 351 ||
					packet.item.blockId === -1 ||
					(item !== undefined && packet.item.blockId !== item)
				)
					return;

				this._bot._client.off('set_slot', slotListener);
				this._bot.off('messagestr', messageListener);
				this.off('context_changed', contextListener);

				resolve(packet);
			};

			const contextListener = () => {
				this._bot._client.off('set_slot', slotListener);
				this._bot.off('messagestr', messageListener);

				resolve(null);
			};

			const messageListener = (message: string) => {
				if (
					messages.some(x =>
						x instanceof RegExp ? x.test(message) : message === x,
					)
				) {
					this._bot.off('messagestr', messageListener);
					this._bot._client.off('set_slot', slotListener);
					this.off('context_changed', contextListener);

					resolve(null);
				}
			};

			this._bot._client.on('set_slot', slotListener);
			this._bot.on('messagestr', messageListener);
			this.once('context_changed', contextListener);

			if (ctx.id !== this.contextId) {
				this._bot._client.off('set_slot', slotListener);
				this._bot.off('messagestr', messageListener);
				this.off('context_changed', contextListener);

				resolve(null);
			}
		});
	}

	public async waitForItem(ctx: Context, item?: number) {
		if (ctx.id !== this.contextId) return;

		return new Promise<RawItem | undefined>(resolve => {
			const listener = (packet: RawItem) => {
				if (
					packet.item.blockId === 351 ||
					packet.item.blockId === -1 ||
					(item !== undefined && packet.item.blockId !== item)
				)
					return;

				this._bot._client.off('set_slot', listener);
				this.off('context_changed', contextListener);

				resolve(packet);
			};

			const contextListener = () => {
				this._bot._client.off('set_slot', listener);

				resolve(undefined);
			};

			this._bot._client.on('set_slot', listener);
			this.once('context_changed', contextListener);

			if (ctx.id !== this.contextId) {
				this._bot._client.off('set_slot', listener);
				this.off('context_changed', contextListener);

				resolve(undefined);
			}
		});
	}

	public async waitForSlotItem(
		ctx: Context,
		slot: number,
		item: number | number[],
		metadata?: number | (number | undefined)[],
	) {
		if (ctx.id !== this.contextId) return;

		const itemArray =
			item === undefined || !Array.isArray(item) ? [item] : item;
		const metadataArray =
			metadata === undefined || !Array.isArray(metadata)
				? [metadata]
				: metadata;

		return new Promise<undefined>(resolve => {
			const listener = (packet: RawItem) => {
				if (
					packet.slot !== slot ||
					!itemArray.some(
						(x, i) =>
							x === undefined ||
							(x === packet.item.blockId &&
								(metadataArray[i] === undefined ||
									metadataArray[i] === packet.item.itemDamage)),
					)
				)
					return;

				this._bot._client.off('set_slot', listener);
				this.off('context_changed', contextListener);

				resolve(undefined);
			};

			const contextListener = () => {
				this._bot._client.off('set_slot', listener);

				resolve(undefined);
			};

			this._bot._client.on('set_slot', listener);
			this.once('context_changed', contextListener);

			if (ctx.id !== this.contextId) {
				this._bot._client.off('set_slot', listener);
				this.off('context_changed', contextListener);

				resolve(undefined);
			}
		});
	}

	public async join(ctx: Context = this.context()): Promise<void> {
		if (ctx.id !== this.contextId) return;

		if (this.fisher && config.fishing.fish_on_join) {
			this.setState(ctx, State.FISHING);
			ctx.id = this.contextId;
		}

		const message = await this.completeActionAndWaitForMessages(
			ctx,
			() => this.command(ctx, `/${config.server}`),
			/^You have no new mail\./,
			/^Unable to connect to \w+: Server restarting/,
			/^Connection to \w+ timed out\./,
			/^You're already connected to that server!/,
			/^You are already trying to connect to a server!/,
		);

		this.joinedAt = Date.now();

		if (
			message !== "You're already connected to that server!" &&
			message !== 'You have no new mail.' &&
			message !== 'You are already trying to connect to a server!' &&
			message !== null
		) {
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

		if (config.fishing.random_movement.enabled) {
			const recordingDirectory = path.join(__dirname, '..', '..', 'recordings');
			const recordings = config.fishing.random_movement.recordings;

			for (const name of recordings) {
				try {
					const steps = JSON.parse(
						await fs.readFile(path.join(recordingDirectory, name), 'utf8'),
					) as RecordingStep[];
					this.movements.push({
						name,
						steps,
					});
				} catch {
					this.logger.warn(`Failed to load recording ${name}`);
				}
			}
		}

		this._bot.on('messagestr', async m => {
			if (m.startsWith('██')) return;

			const date = new Date();
			const format = `${date.getHours().toString().padStart(2, '0')}:${date
				.getMinutes()
				.toString()
				.padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

			const messages = m
				.split('\n')
				.map(message => `[${format}] [Client thread/INFO] ${message}\n`);

			await fs.appendFile(this.logFileLocation, messages.join(''));

			const ctx = this.context();

			if (
				this.state !== State.SOLVING_CAPTCHA &&
				(m ===
					"Don't panic! This is just a routine check to stop AFK fishing" ||
					m === 'You are required to complete a captcha to continue playing.')
			) {
				const { promise, resolve } = createPromiseResolvePair();

				this.captcha.fishing = this.state === State.FISHING;
				this.captcha.promise = promise;
				this.captcha.resolve = resolve;
				this.captcha.startedAt = Date.now();
				this.setState(ctx, State.SOLVING_CAPTCHA);

				const newCtx = this.context();

				if (Date.now() - this.joinedAt < 5_000)
					this.client.activateItem(newCtx);

				this.client.setInterval(
					newCtx,
					() => {
						this.logger.info('Renewing captcha...');
						this.client.activateItem(newCtx);
					},
					RENEW_CAPTCHA_INTERVAL,
				);

				this.logger.info('Captcha detected. Solving...');

				return;
			}

			if (
				m ===
				"It looks like you might be lost, so we've sent you back to spawn!"
			) {
				this.setState(ctx, State.IDLE);

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
					this.setState(ctx, State.IDLE);
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
				else this.setBalance(this.balance + value);

				this.logger.info(
					`Sold fish for ${chalk.green(`$${currencyFormatter.format(value)}`)}`,
				);

				this.logger.info(
					`Current balance is ${chalk.green(
						`$${currencyFormatter.format(this.balance)}`,
					)}`,
				);

				if (this.balance >= MONEY_THRESHOLD && config.autopay_to) {
					const amount = Math.floor(this.balance - SURPLUS_MONEY_THRESHOLD);

					return this.command(
						ctx,
						`/pay ${config.autopay_to} ${Math.floor(amount)}`,
					);
				}

				return;
			}

			if (FISHMONGER_MOBCOINS_SELL_REGEX.test(m)) {
				const value = parseFloat(
					m.match(FISHMONGER_MOBCOINS_SELL_REGEX)![1].replaceAll(',', ''),
				);

				this.logger.info(
					`Sold fish for ${chalk.magenta(
						`${currencyFormatter.format(value)} MobCoins`,
					)}`,
				);

				return;
			}

			if (SEND_MONEY_REGEX.test(m)) {
				const value = parseFloat(
					m.match(SEND_MONEY_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.setBalance(this.balance - value);

				return;
			}

			if (PURCHASE_ITEM_REGEX.test(m)) {
				const value = parseFloat(
					m.match(PURCHASE_ITEM_REGEX)![1].replaceAll(',', ''),
				);

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.setBalance(this.balance - value);

				return;
			}

			if (RECEIVE_MONEY_REGEX.test(m)) {
				const [, _value, name] = m.match(RECEIVE_MONEY_REGEX)!;
				const value = parseFloat(_value.replaceAll(',', ''));

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.setBalance(this.balance + value, name);

				return;
			}

			if (PURCHASE_BAIT_REGEX.test(m)) {
				const [, _count, name] = m.match(PURCHASE_BAIT_REGEX)!;
				const count = parseInt(_count);

				const value =
					count * BAIT_NAME_TO_PRICE[name as keyof typeof BAIT_NAME_TO_PRICE];

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else this.setBalance(this.balance - value);

				return;
			}

			if (PURCHASE_ROD_REGEX.test(m)) {
				const [, name] = m.match(PURCHASE_ROD_REGEX)!;
				const value = FISHING_ROD_DATA.find(r => r.name === name)?.price;

				if (this.checkedBalance === false) await this.getCurrentBalance(ctx);
				else if (value) this.setBalance(this.balance - value);

				return;
			}

			if (
				TELEPORT_REGEX.test(m) &&
				this.whitelist.has(m.match(TELEPORT_REGEX)![1])
			) {
				return this.command(ctx, '/tpaccept');
			}

			if (
				TELEPORT_HERE_REGEX.test(m) &&
				this.whitelist.has(m.match(TELEPORT_HERE_REGEX)![1])
			) {
				return this.command(ctx, '/tpaccept');
			}

			if (DIRECT_MESSAGE_REGEX.test(m)) {
				const [, name, message] = m.match(DIRECT_MESSAGE_REGEX)!;

				if (config.fishing.stop_fishing_on_mention) {
					this.setState(ctx, State.IDLE);
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

				const [response, actions] = await Promise.all([
					generateResponse(message),
					generateActions(message),
				]);

				if (response) {
					const wait = 2_000 + response.length * 250;

					this.logger.info(
						`Responding to ${name} (in ${wait}ms) from prompt '${message}': ${chalk.underline(
							response,
						)}`,
					);

					await sleep(wait);
					await this.command(ctx, `/msg ${name} ${response}`);
				}

				if (actions.length > 0) {
					this.logger.info(
						`Processing movement from ${name}: ${actions.map(
							a => `${a.direction}(${a.distance})`,
						)}`,
					);
					await this.client.processMovementInstructions(ctx, actions);
				}

				return;
			}

			if (JOIN_ERROR_REGEX.test(m)) {
				const [, reason] = m.match(JOIN_ERROR_REGEX)!;

				this.logger.warn(`Unable to connect: ${reason}`);

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
					return run(ctx, sender, ...args);
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
				ctx?.id !== this.contextId ||
				message === undefined ||
				resolve === undefined ||
				ctx === undefined
			) {
				if (resolve) resolve();

				continue;
			}

			await sleep(COMMAND_COOLDOWN - this.lastCommandAgo);
			this.lastCommandTimestamp = Date.now();

			this.logger.info(`Sending command: ${chalk.yellow(message)}`);
			this.client.chat(ctx, message);

			resolve();
		}
	}

	private async initializeMessageLoop() {
		while (await sleep(MESSAGE_COOLDOWN)) {
			const { message, resolve, ctx } = this.messageQueue.shift() ?? {};

			if (
				ctx?.id !== this.contextId ||
				message === undefined ||
				resolve === undefined ||
				ctx === undefined
			) {
				if (resolve) resolve();

				continue;
			}

			await sleep(MESSAGE_COOLDOWN - this.lastMessageAgo);
			this.lastMessageTimestamp = Date.now();

			this.logger.info(`Sending message: ${chalk.yellow(message)}`);
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
			this.once('context_changed', () => context);

			if (ctx.id !== this.contextId) {
				this.off('context_changed', context);
				this._bot.off('messagestr', listener);

				return resolve(0);
			}
		});

		await this.command(ctx, '/mobcoins balance');

		return balance;
	}

	public async getCurrentBalance(ctx: Context, real = false) {
		if (this.checkedBalance)
			return this.balance - (real ? 0 : SURPLUS_MONEY_THRESHOLD);

		const balance: Promise<number> = new Promise(resolve => {
			const listener = (m: string) => {
				if (BALANCE_REGEX.test(m)) {
					this._bot.off('messagestr', listener);

					const balanceString = m.match(BALANCE_REGEX)![1];
					const balance = parseFloat(balanceString.replaceAll(',', ''));

					this.setBalance(balance);
					this.checkedBalance = true;

					return resolve(balance - (real ? 0 : SURPLUS_MONEY_THRESHOLD));
				}
			};

			const context = () => {
				this._bot.off('messagestr', listener);

				resolve(0);
			};

			this._bot.on('messagestr', listener);
			this.on('context_changed', context);

			if (ctx.id !== this.contextId) {
				this.off('context_changed', context);
				this._bot.off('messagestr', listener);

				return resolve(0);
			}
		});

		await this.command(ctx, '/balance');

		return Math.max(await balance, 0);
	}

	private async sendChatMessage(ctx: Context, _?: string, ...args: string[]) {
		if (args.length > 0) return this.chat(ctx, args.join(' '));
	}

	private async sendMoney(ctx: Context, username?: string) {
		await this.getCurrentBalance(ctx);

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
		if (args.length > 0) return this.command(ctx, `/${args.join(' ')}`);
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
		item: number | number[],
		metadata?: number | (number | undefined)[],
	) {
		const promise = this.waitForSlotItem(ctx, slot, item, metadata);

		await action();

		return promise;
	}

	public async completeActionAndWaitForItem(
		ctx: Context,
		action: () => any,
		item?: number,
	) {
		const promise = this.waitForItem(ctx, item);

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
		await this.client.waitForTicks(ctx, 5);

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
				this.off('context_changed', listener);

				return resolve(window);
			};

			this._bot.once('windowOpen', listener);
			this.once('context_changed', listener);

			if (ctx.id !== this.contextId) {
				this.off('context_changed', listener);
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
