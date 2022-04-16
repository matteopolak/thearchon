import fs from 'fs/promises';
import path from 'path';
import type { MessagePort } from 'worker_threads';

import chalk from 'chalk';
import minecraftData from 'minecraft-data';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import type { Vec3 } from 'vec3';

import config from '../config';
import {
	BAIT_THRESHOLD,
	CAPTCHA_TIME_THRESHOLD,
	FISHING_RODS,
	FISHING_ROD_DATA,
	FISH_COUNT_THRESHOLD,
	FISH_THRESHOLD,
	ROD_TO_BAIT,
	SLOT_TO_COLOURED_BAIT_NAME,
	SURPLUS_MONEY_THRESHOLD,
	TIME_BEFORE_FISH_AFTER_MOVEMENT_DETECT,
	VERSION,
} from '../constants';
import {
	BaseBotOptions,
	Location,
	LocationType,
	MessageType,
	SellType,
	State,
} from '../typings';
import type { Context, InventoryData, RawMapData } from '../typings';
import {
	chance,
	currencyFormatter,
	formatStaffList,
	sleep,
	unscramble,
} from '../utils';
import BaseBot from './BaseBot';

const items = minecraftData(VERSION);

export default class FishBot extends BaseBot {
	private sellType: SellType;

	constructor(options: BaseBotOptions, port: MessagePort) {
		super(options, port);

		this.sellType = options.sell_type ?? SellType.COINS;
		this.fisher = this;
	}

	public async init() {
		this.commands.set('fish', this.fish.bind(this));
		this.commands.set('value', this.showFishValue.bind(this));
		this.commands.set('clear', this.clearCommand.bind(this));
		this.commands.set('stop', this.stopFishing.bind(this));
		this.commands.set('sell', this.setSellTypeCommand.bind(this));

		await super.init();

		this._bot._client.on('map', async (map: RawMapData) => {
			if (this.captcha.solving || this.state !== State.SOLVING_CAPTCHA) return;

			if (
				!map.data?.length ||
				map.columns === map.rows ||
				map.columns <= 0 ||
				!map.rows ||
				map.rows <= 0 ||
				!map.columns ||
				!map.rows
			)
				return;

			this.captcha.solving = true;
			const answer = unscramble(map);

			if (answer.length === 5 && this.state === State.SOLVING_CAPTCHA) {
				this.logger.info(`Possible answer found: ${answer.join('')}`);

				this.state = State.IDLE;

				const ctx = this.context();
				const promise = this.waitForItem(ctx, 346);

				await sleep(
					this.captcha.startedAt - Date.now() + CAPTCHA_TIME_THRESHOLD,
				);

				await this.completeActionAndWaitForMessage(
					ctx,
					() => this.command(ctx, `/code ${answer.join('')}`),
					'Great job! You solved the captcha and can continue playing.',
				);

				if (this.captcha.fishing) {
					await promise;

					if (config.fishing.sneak_while_fishing) {
						this.client.setControlState(ctx, 'sneak', true);
					}

					this.fish(ctx);
				}
			}

			this.captcha.solving = false;
		});
	}

	public async teleportToHome(ctx: Context, name: Location | string) {
		if (ctx.location === name || ctx.id !== this.contextId) return;

		if (name === this.homes.forest && config.fishing.sneak_while_fishing) {
			this.client.setControlState(ctx, 'sneak', false);
		}

		await super.teleport(ctx, name, LocationType.HOME);

		if (name === this.homes.fishing && config.fishing.sneak_while_fishing) {
			this.client.setControlState(ctx, 'sneak', true);
		}
	}

	private async setSellType(type: SellType) {
		this.sellType = type;
		this.port.postMessage({
			type: MessageType.SELL_TYPE,
			data: {
				sell_type: this.sellType,
				is_fishing: this.state === State.FISHING,
			},
		});
	}

	public getBestFishingRod(index: true): number;
	public getBestFishingRod(index?: false): Item | null;
	public getBestFishingRod(index = false) {
		const item = this.client.inventory.slots.reduce((a, b) =>
			// @ts-ignore
			FISHING_RODS.indexOf(a?.nbt?.value?.display?.value?.Name?.value) >
			// @ts-ignore
			FISHING_RODS.indexOf(b?.nbt?.value?.display?.value?.Name?.value)
				? a
				: b,
		);

		const i = FISHING_RODS.indexOf(
			// @ts-ignore
			item?.nbt?.value?.display?.value?.Name?.value,
		);

		if (index) return i;
		return i === -1 ? null : item;
	}

	private waitForBite(ctx: Context) {
		if (ctx.id !== this.contextId) return Promise.resolve();

		return new Promise(resolve => {
			const listener = (title: string) => {
				if (
					title ===
					'{"extra":[{"color":"dark_aqua","text":"You Got a Bite!"}],"text":""}'
				) {
					this._bot.off('title', listener);
					this.off('context_changed', contextListener);
					clearTimeout(timeout);

					return resolve(true);
				}
			};

			const contextListener = () => {
				this._bot.off('title', listener);
				clearTimeout(timeout);

				resolve(false);
			};

			this._bot.on('title', listener);
			this.once('context_changed', contextListener);

			const timeout = setTimeout(() => {
				this._bot.off('title', listener);
				this.off('context_changed', contextListener);

				return resolve(true);
			}, 60 * 1_000);

			if (ctx.id !== this.contextId) {
				this._bot.off('title', listener);
				this.off('context_changed', contextListener);

				clearTimeout(timeout);
				resolve(false);
			}
		});
	}

	private getInventoryData(): InventoryData {
		const inventory = {
			slots: {
				bait: 0,
				fish: 0,
				taken: 0,
			},
			count: {
				bait: 0,
				fish: 0,
			},
		};

		for (const slot of this.client.inventory.slots) {
			// @ts-ignore
			if (slot?.nbt?.value?.arfshbait?.type === 'string') {
				inventory.count.bait += slot.count;
				inventory.slots.bait++;
				// @ts-ignore
			} else if (slot?.nbt?.value?.arfshfishworth?.type === 'double') {
				inventory.count.fish += slot.count;
				inventory.slots.fish++;
			} else inventory.slots.taken++;
		}

		this.logger.info(
			`Fish: ${inventory.count.fish}/${inventory.slots.fish} Bait: ${inventory.count.bait}/${inventory.slots.bait}`,
		);

		return inventory;
	}

	private async sellFishAction(ctx: Context, window: Window) {
		if (ctx.id !== this.contextId) return;

		const slotName =
			this.balance < SURPLUS_MONEY_THRESHOLD ? SellType.COINS : this.sellType;
		const sellSlot =
			window.slots.find(i => i.displayName === slotName)?.slot ?? -1;

		if (sellSlot !== -1) {
			await this.client.clickWindow(ctx, sellSlot, 0, 0);

			return true;
		}

		return false;
	}

	private async upgradeRodAction(ctx: Context, window: Window) {
		if (ctx.id !== this.contextId) return;

		const best = this.getBestFishingRod(true);
		const data = FISHING_ROD_DATA[best < 4 ? best + 1 : 0];

		if (
			best !== -1 &&
			best < 4 &&
			data.price <= this.balance - SURPLUS_MONEY_THRESHOLD
		) {
			this.logger.info(`Purchasing ${data.name_coloured_pretty}`);

			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.clickWindow(ctx, 14, 0, 0),
				data.slot,
				346,
			);

			await this.client.clickWindow(ctx, data.slot, 0, 0);

			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.closeWindow(ctx, window),
				11,
				266,
			);

			return true;
		}

		return false;
	}

	private async purchaseBaitAction(ctx: Context) {
		if (ctx.id !== this.contextId) return;

		const rodIndex = this.getBestFishingRod(true);
		const bait = ROD_TO_BAIT[rodIndex === -1 ? 0 : rodIndex];

		this.logger.info(`Purchasing ${SLOT_TO_COLOURED_BAIT_NAME[bait.slot]}`);

		await this.completeActionAndWaitForSlotItem(
			ctx,
			() => this.client.clickWindow(ctx, 15, 0, 0),
			13,
			351,
			10,
		);

		await this.completeActionAndWaitForSlotItem(
			ctx,
			() => this.client.clickWindow(ctx, bait.slot, 0, 0),
			bait.slot === 9 ? 11 : 9,
			351,
			bait.metadata,
		);

		const maxCount = Math.floor(this.balance / bait.price);
		const slotCount =
			maxCount >= 64
				? 17
				: maxCount >= 32
				? 15
				: maxCount >= 10
				? 13
				: maxCount >= 5
				? 11
				: 9;

		await this.client.clickWindow(ctx, slotCount, 0, 0);

		return true;
	}

	private async sellDefaultResourcesAction(ctx: Context) {
		if (ctx.id !== this.contextId) return;

		const window = await this.completeActionAndWaitForWindow(ctx, () =>
			this.command(ctx, '/shop ores'),
		);

		if (!window) return false;

		this._bot._client.write('window_click', {
			windowId: window.id,
			slot: 16,
			mouseButton: 2,
			action: 32600,
			mode: 3,
			item: window.slots[16],
		});

		await this.client.waitForTicks(ctx, 10);

		this._bot._client.write('window_click', {
			windowId: window.id,
			slot: 12,
			mouseButton: 2,
			action: 32650,
			mode: 3,
			item: window.slots[12],
		});

		return true;
	}

	private async prepareFromNothing(ctx: Context) {
		if (ctx.id !== this.contextId) return null;

		const balance = await this.getCurrentBalance(ctx, true);

		if (balance < FISHING_ROD_DATA[0].price) {
			if (!(await this.sellDefaultResourcesAction(ctx))) {
				return null;
			}
		}

		await this.teleport(ctx, 'fishing', LocationType.WARP);
		await this.command(ctx, `/sethome ${this.homes.fishing}`);

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e =>
					e.username !== undefined &&
					e.username.includes('Fish') &&
					e.position.distanceTo(this.client.entity.position) < 4,
			);

			if (!entity) {
				if (ctx.id === this.contextId)
					this.exit(ctx, 'Could not find fishing NPC');
			} else await this.client.activateEntity(ctx, entity);
		});

		if (!window) return null;

		const data = FISHING_ROD_DATA[0];

		this.logger.info(`Purchasing ${data.name_coloured_pretty}`);

		await this.completeActionAndWaitForSlotItem(
			ctx,
			() => this.client.clickWindow(ctx, 14, 0, 0),
			data.slot,
			346,
		);

		await this.client.clickWindow(ctx, data.slot, 0, 0);

		await this.completeActionAndWaitForSlotItem(
			ctx,
			() => this.client.closeWindow(ctx, window),
			11,
			266,
		);

		return this.getBestFishingRod();
	}

	private async sellFish(ctx: Context, homeContainsShop: boolean) {
		if (ctx.id !== this.contextId) return;

		await this.teleportToHome(
			ctx,
			homeContainsShop ? this.homes.fishing : this.homes.forest,
		);

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e =>
					e.username !== undefined &&
					e.username.includes('Fish') &&
					e.position.distanceTo(this.client.entity.position) < 4,
			);

			if (!entity) {
				if (ctx.id === this.contextId)
					this.exit(ctx, 'Could not find fishing NPC');
			} else await this.client.activateEntity(ctx, entity);
		});

		if (window === undefined) return;

		if (
			(await this.sellFishAction(ctx, window)) &&
			config.fishing.upgrade_fishing_rod_automatically
		) {
			await this.upgradeRodAction(ctx, window);
		}

		this.client.closeWindow(ctx, window);

		if (ctx.location === this.homes.fishing) {
			return this.client.look(
				ctx,
				ctx.fishing!.original_yaw,
				ctx.fishing!.original_pitch,
			);
		}
	}

	private async purchaseBait(ctx: Context, homeContainsShop: boolean) {
		if (ctx.id !== this.contextId) return;

		await this.teleportToHome(
			ctx,
			homeContainsShop ? this.homes.fishing : this.homes.forest,
		);

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e =>
					e.username !== undefined &&
					e.username.includes('Fish') &&
					e.position.distanceTo(this.client.entity.position) < 4,
			);

			if (!entity) {
				if (ctx.id === this.contextId)
					this.exit(ctx, 'Could not find fishing NPC');
			} else await this.client.activateEntity(ctx, entity);
		});

		if (window === undefined) return;

		if (
			(await this.sellFishAction(ctx, window)) &&
			config.fishing.upgrade_fishing_rod_automatically
		) {
			await this.upgradeRodAction(ctx, window);
		}

		await this.purchaseBaitAction(ctx);

		this.client.closeWindow(ctx, this.client.currentWindow!);

		if (ctx.location === this.homes.fishing) {
			return this.client.look(
				ctx,
				ctx.fishing!.original_yaw,
				ctx.fishing!.original_pitch,
			);
		}
	}

	private sellFishAndPurchaseBait(ctx: Context, homeContainsShop: boolean) {
		return this.purchaseBait(ctx, homeContainsShop);
	}

	private clearCommand(ctx: Context) {
		if (this.state === State.SOLVING_CAPTCHA) return;

		this.state = State.CLEARING_INVENTORY;

		return this.clearInventory(ctx);
	}

	public isOwnedFish(item: Item) {
		if (item.nbt?.type !== 'compound') return false;

		return item.nbt?.value?.arfshfishcatcher?.value === this.client.player.uuid;
	}

	public isBait(item: Item) {
		if (item.nbt?.type !== 'compound') return false;

		return item.nbt?.value?.arfshbait?.type === 'string';
	}

	public isFishingRod(item: Item, onlyBest = true) {
		if (item.nbt?.type !== 'compound') return false;

		return (
			item.nbt?.value?.arfshrod?.type === 'string' &&
			(!onlyBest ||
				item.nbt?.value?.arfshrod?.value ===
					// @ts-ignore
					this.getBestFishingRod()?.nbt?.value?.arfshrod?.value)
		);
	}

	private async clearInventory(ctx: Context) {
		await this.teleport(ctx, Location.SPAWN, LocationType.RAW);

		const now = Date.now();
		await fs.writeFile(
			path.join(this.directory, `before-${now}.json`),
			JSON.stringify(this._bot.inventory.slots, null, 2),
		);

		for (const item of this.client.inventory.slots) {
			if (item === null || item.slot < 9 || item.slot > 44) continue;

			if (
				item.type !== 52 &&
				item.type !== 7 &&
				!this.isOwnedFish(item) &&
				!this.isBait(item) &&
				!this.isFishingRod(item, true)
			) {
				await this.client.waitForTicks(ctx, 10);
				await this.client.toss(ctx, item);
			}
		}

		await fs.writeFile(
			path.join(this.directory, `after-${now}.json`),
			JSON.stringify(this._bot.inventory.slots, null, 2),
		);
	}

	private async checkFishingThresholds(
		ctx: Context,
		homeContainsShop: boolean,
	) {
		const inventory = this.getInventoryData();

		if (this.isInventoryFull()) {
			await this.clearInventory(ctx);
		}

		const rodIndex = this.getBestFishingRod(true);
		const bait = ROD_TO_BAIT[rodIndex === -1 ? 0 : rodIndex];

		const potentialBalance =
			this.balance +
			this.client.inventory.items().reduce(
				// @ts-ignore
				(a, b) => a + (b.nbt?.value?.arfshfishworth?.value ?? 0),
				0,
			);

		if (
			inventory.count.bait <= BAIT_THRESHOLD &&
			bait.price <= potentialBalance
		) {
			await this.purchaseBait(ctx, homeContainsShop);
		} else if (
			inventory.slots.fish >= FISH_THRESHOLD ||
			inventory.count.fish >= FISH_COUNT_THRESHOLD
		) {
			if (inventory.count.bait >= FISH_THRESHOLD)
				await this.sellFish(ctx, homeContainsShop);
			else {
				if (bait.price <= potentialBalance)
					await this.sellFishAndPurchaseBait(ctx, homeContainsShop);
			}
		}

		return ctx.location;
	}

	public async stopFishing() {
		if (this.state === State.FISHING) this.state = State.IDLE;
	}

	private async cast(ctx: Context, rod: Item) {
		if (ctx.id !== this.contextId) return true;

		let cast = true;
		let error = false;

		const listener = (name: string, position: Vec3) => {
			if (
				(name === 'entity.splash_potion.throw' || name === 'random.bow') &&
				position.distanceTo(this.client.entity.position) < 1
			) {
				cast = false;
				this._bot.off('soundEffectHeard', listener);
				this._bot.off('messagestr', messageListener);
				this.off('context_changed', contextListener);
			}
		};

		const messageListener = (message: string) => {
			if (message === "You don't have any bait!") {
				cast = false;
				error = true;
				this._bot.off('soundEffectHeard', listener);
				this._bot.off('messagestr', messageListener);
				this.off('context_changed', contextListener);
			}
		};

		const contextListener = () => {
			cast = false;
			this._bot.off('soundEffectHeard', listener);
			this._bot.off('messagestr', messageListener);
		};

		this._bot.on('soundEffectHeard', listener);
		this._bot.on('messagestr', messageListener);
		this.once('context_changed', contextListener);

		do {
			if (
				// @ts-ignore
				rod?.nbt?.value?.display?.value?.Name?.value !==
				// @ts-ignore
				this.client.heldItem?.nbt?.value?.display?.value?.Name?.value
			)
				this.exit(ctx, 'Could not find fishing rod');

			this.client.activateItem(ctx);
			await this.client.waitForTicks(ctx, 10);
		} while (cast);

		return error;
	}

	private async reel(ctx: Context) {
		const promise = this.waitForItemOrMessage(
			ctx,
			['Whatever fish you were about to catch broke your line!'],
			undefined,
			5_000,
		);

		this.client.activateItem(ctx);

		return promise;
	}

	public getFishMonger() {
		return Object.values(this.client.entities).find(
			e =>
				e.username !== undefined &&
				e.username.includes('Fish') &&
				e.position.distanceTo(this.client.entity.position) < 4,
		);
	}

	public async fish(_: Context) {
		for (const username in this.client.players) {
			this.handlePlayerJoin(this.client.players[username]);
		}

		this.state = State.FISHING;

		const ctx = this.context();

		if (this.options.temporary && !this.flags.acceptedIP) {
			this.flags.acceptedIP = true;
			await this.command(ctx, '/yes');
		}

		const rod =
			this.getBestFishingRod() ?? (await this.prepareFromNothing(ctx));

		ctx.location = _.location;

		if (rod === null) return;

		if (!this.checkedBalance) await this.getCurrentBalance(ctx, true);
		if (
			// @ts-ignore
			rod?.nbt?.value?.display?.value?.Name?.value !==
			// @ts-ignore
			this.client.heldItem?.nbt?.value?.display?.value?.Name?.value
		)
			await this.client.equip(ctx, rod, 'hand');

		await this.teleportToHome(ctx, this.homes.fishing);

		const homeContainsShop = this.getFishMonger() !== undefined;

		ctx.fishing = {
			pitch: this.client.entity.pitch,
			yaw: this.client.entity.yaw,
			position: this.client.entity.position.clone(),
			original_pitch: this.client.entity.pitch,
			original_yaw: this.client.entity.yaw,
			original_position: this.client.entity.position.clone(),
			fix_after_current: false,
			paused: false,
		};

		this.createMoveHandler(ctx);

		while (ctx.id === this.contextId) {
			if (
				(config.fishing.pause_fishing_while_staff_hidden &&
					this.staff.hidden.size > 0) ||
				(config.fishing.pause_fishing_while_staff_online &&
					this.staff.online.size > 0)
			) {
				await this.client.waitForTicks(ctx, 20);

				if (!ctx.fishing.paused) {
					ctx.fishing.paused = true;

					if (
						config.fishing.pause_fishing_while_staff_hidden &&
						this.staff.hidden.size > 0
					) {
						this.logger.info(
							`Paused fishing as ${chalk.magenta(
								`${this.staff.hidden.size} staff`,
							)} ${
								this.staff.hidden.size === 1 ? 'is' : 'are'
							} vanished (${formatStaffList(this.staff.hidden)})`,
						);
					} else {
						this.logger.info(
							`Paused fishing as ${chalk.magenta(
								`${this.staff.online.size} staff`,
							)} ${
								this.staff.online.size === 1 ? 'is' : 'are'
							} online (${formatStaffList(this.staff.online)})`,
						);
					}
				}

				continue;
			}

			if (ctx.fishing.paused) {
				ctx.fishing.paused = false;
				this.logger.info('Fishing has been resumed');
			}

			ctx.allow_reaction = false;

			if (ctx.fishing.fix_after_current) {
				await sleep(TIME_BEFORE_FISH_AFTER_MOVEMENT_DETECT);

				await this.client.look(
					ctx,
					ctx.fishing.original_yaw,
					ctx.fishing.original_pitch,
				);

				if (config.fishing.random_movement.enabled)
					await this.randomMovement(ctx);
				else {
					ctx.fishing.pitch = this.client.entity.pitch;
					ctx.fishing.yaw = this.client.entity.yaw;
				}
			}

			if (
				(await this.checkFishingThresholds(ctx, homeContainsShop)) !==
				this.homes.fishing
			) {
				await this.teleportToHome(ctx, this.homes.fishing);

				ctx.fishing.pitch = this.client.entity.pitch;
				ctx.fishing.yaw = this.client.entity.yaw;
			}

			if (
				config.fishing.random_movement.enabled &&
				!ctx.fishing.fix_after_current &&
				chance(config.fishing.random_movement.chance)
			)
				await this.randomMovement(ctx);

			if (ctx.fishing.fix_after_current) ctx.fishing.fix_after_current = false;

			const rod = this.getBestFishingRod();

			if (rod === null) break;
			if (
				// @ts-ignore
				rod?.nbt?.value?.display?.value?.Name?.value !==
				// @ts-ignore
				this.client.heldItem?.nbt?.value?.display?.value?.Name?.value
			)
				await this.client.equip(ctx, rod, 'hand');

			ctx.allow_reaction = true;

			this.logger.info('Casting...');
			const error = await this.cast(ctx, rod);

			if (!error) {
				this.logger.info('Waiting for bite...');
				await this.waitForBite(ctx);

				this.logger.info('Reeling...');
				const reward = await this.reel(ctx);

				if (reward) {
					const rawName: string =
						// @ts-ignore
						reward.item.nbtData?.value?.display?.value?.Name?.value ??
						items.findItemOrBlockById(reward.item.blockId)?.displayName;
					const coins: number =
						// @ts-ignore
						reward.item.nbtData?.value?.arfshfishworth?.value ?? 0;
					const mobcoins: number =
						// @ts-ignore
						reward.item.nbtData?.value?.arfshfishmobcoins?.value ?? 0;
					const name = rawName ? rawName.replace(/§\w/g, '') : undefined;

					if (coins && mobcoins && name) {
						this.logger.info(
							`Caught ${chalk.bold(chalk.magenta(name))} [${chalk.red(
								reward.item.itemCount,
							)}] worth ${chalk.green(
								`$${currencyFormatter.format(coins)}${chalk.reset(
									'/',
								)}${chalk.yellow(
									`${currencyFormatter.format(mobcoins)} MobCoins`,
								)}`,
							)}`,
						);
					} else if (name) {
						this.logger.info(
							`Caught ${chalk.bold(chalk.magenta(name))} [${chalk.red(
								reward.item.itemCount,
							)}]`,
						);
					} else {
						this.logger.info('Reel complete');
					}
				}
			}
		}

		return true;
	}

	public async showFishValue(ctx: Context) {
		if (this.state === State.SOLVING_CAPTCHA) return;

		const value = this.client.inventory.items().reduce(
			// @ts-ignore
			(a, b) => a + (b.nbt?.value?.arfshfishworth?.value ?? 0),
			0,
		);

		return this.command(ctx, `/p ${currencyFormatter.format(value)}`);
	}

	public async setSellTypeCommand(_: Context, __: string, type: string) {
		if (type === 'coins') type = SellType.COINS;
		else if (type === 'mobcoins') type = SellType.MOB_COINS;
		else return;

		this.setSellType(type as SellType);
	}
}
