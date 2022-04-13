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
import { chance, currencyFormatter, sleep, unscramble } from '../utils';
import BaseBot from './BaseBot';

const items = minecraftData(VERSION);

export default class FishBot extends BaseBot {
	public bestFishingRod: number = 0;

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

	public async teleportToHome(ctx: Context, name: Location) {
		if (ctx.location === name || ctx.id !== this.contextId) return;

		if (name === Location.FOREST && config.fishing.sneak_while_fishing) {
			this.client.setControlState(ctx, 'sneak', false);
		}

		await super.teleport(ctx, name, LocationType.HOME);

		if (name === Location.FISHING && config.fishing.sneak_while_fishing) {
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

		if (index) {
			return FISHING_RODS.indexOf(
				// @ts-ignore
				item?.nbt?.value?.display?.value?.Name?.value,
			);
		}

		return FISHING_RODS.indexOf(
			// @ts-ignore
			item?.nbt?.value?.display?.value?.Name?.value,
		) === -1
			? null
			: item;
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

		await this.client.clickWindow(ctx, 17, 0, 0);

		return true;
	}

	private async sellFish(ctx: Context, homeContainsShop: boolean) {
		if (ctx.id !== this.contextId) return;

		await this.teleportToHome(
			ctx,
			homeContainsShop ? Location.FISHING : Location.FOREST,
		);

		const data = {
			pitch: this.client.entity.pitch,
			yaw: this.client.entity.yaw,
		};

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e =>
					e.username !== undefined &&
					e.username.includes('Fish') &&
					e.position.distanceTo(this.client.entity.position) < 4,
			);

			if (!entity) {
				if (ctx.id === this.contextId) process.exit(0);
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

		if (ctx.location === Location.FISHING)
			return this.client.look(ctx, data.yaw, data.pitch, true);
	}

	private async purchaseBait(ctx: Context, homeContainsShop: boolean) {
		if (ctx.id !== this.contextId) return;

		await this.teleportToHome(
			ctx,
			homeContainsShop ? Location.FISHING : Location.FOREST,
		);

		const data = {
			pitch: this.client.entity.pitch,
			yaw: this.client.entity.yaw,
		};

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e =>
					e.username !== undefined &&
					e.username.includes('Fish') &&
					e.position.distanceTo(this.client.entity.position) < 4,
			);

			if (!entity) {
				if (ctx.id === this.contextId) process.exit(0);
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

		this.client.closeWindow(ctx, window);

		if (ctx.location === Location.FISHING)
			return this.client.look(ctx, data.yaw, data.pitch, true);
	}

	private sellFishAndPurchaseBait(ctx: Context, homeContainsShop: boolean) {
		return this.purchaseBait(ctx, homeContainsShop);
	}

	private clearCommand(ctx: Context) {
		if (this.state === State.SOLVING_CAPTCHA) return;

		this.state = State.CLEARING_INVENTORY;

		return this.clearInventory(ctx);
	}

	private async clearInventory(ctx: Context) {
		await this.teleport(ctx, Location.SPAWN, LocationType.RAW);

		for (const item of this.client.inventory.slots) {
			if (item === null || item.slot < 9 || item.slot > 44) continue;

			if (
				item.type !== 52 &&
				item.type !== 7 &&
				// @ts-ignore
				item.nbt?.value?.arfshbait?.type !== 'string' &&
				// @ts-ignore
				item.nbt?.value?.arfshfishworth?.type !== 'double' &&
				// @ts-ignore
				!FISHING_RODS.includes(item.nbt?.value?.display?.value?.Name?.value)
			) {
				await this.client.toss(ctx, item.type, item.metadata, item.count);
				await this.client.waitForTicks(ctx, 10);
			}
		}
	}

	private async checkFishingThresholds(
		ctx: Context,
		homeContainsShop: boolean,
	) {
		const inventory = this.getInventoryData();

		if (this.isInventoryFull()) {
			await this.clearInventory(ctx);
		}

		if (inventory.count.bait <= BAIT_THRESHOLD) {
			await this.purchaseBait(ctx, homeContainsShop);
		} else if (
			inventory.slots.fish >= FISH_THRESHOLD ||
			inventory.count.fish >= FISH_COUNT_THRESHOLD
		) {
			if (inventory.count.bait >= FISH_THRESHOLD)
				await this.sellFish(ctx, homeContainsShop);
			else await this.sellFishAndPurchaseBait(ctx, homeContainsShop);
		}

		return ctx.location;
	}

	public async stopFishing() {
		if (this.state === State.FISHING) this.state = State.IDLE;
	}

	private async cast(ctx: Context) {
		if (ctx.id !== this.contextId) return;

		let cast = true;

		const listener = (name: string, position: Vec3) => {
			if (
				(name === 'entity.splash_potion.throw' || name === 'random.bow') &&
				position.distanceTo(this.client.entity.position) < 1
			) {
				cast = false;
				this._bot.off('soundEffectHeard', listener);
				this.off('context_changed', contextListener);
			}
		};

		const contextListener = () => {
			cast = false;
			this._bot.off('soundEffectHeard', listener);
		};

		this._bot.on('soundEffectHeard', listener);
		this.once('context_changed', contextListener);

		do {
			this.client.activateItem(ctx);
			await this.client.waitForTicks(ctx, 10);
		} while (cast);
	}

	private async reel(ctx: Context) {
		const promise = this.waitForItemOrMessage(ctx, [
			'Whatever fish you were about to catch broke your line!',
		]);

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
		this.state = State.FISHING;

		const ctx = this.context();
		const rod = this.getBestFishingRod();

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

		await this.teleportToHome(ctx, Location.FISHING);

		const homeContainsShop = this.getFishMonger() !== undefined;

		ctx.fishing = {
			pitch: this.client.entity.pitch,
			yaw: this.client.entity.yaw,
			position: this.client.entity.position,
			original_pitch: this.client.entity.pitch,
			original_yaw: this.client.entity.yaw,
			fix_after_current: false,
		};

		this.createMoveHandler(ctx);

		while (ctx.id === this.contextId) {
			ctx.allow_reaction = false;

			if (
				(await this.checkFishingThresholds(ctx, homeContainsShop)) !==
				Location.FISHING
			) {
				await this.teleportToHome(ctx, Location.FISHING);
			}

			if (
				config.fishing.random_movement.enabled &&
				chance(config.fishing.random_movement.chance)
			)
				await this.randomMovement(ctx);

			ctx.allow_reaction = true;

			const rod = this.getBestFishingRod();

			if (rod === null) break;
			if (
				// @ts-ignore
				rod?.nbt?.value?.display?.value?.Name?.value !==
				// @ts-ignore
				this.client.heldItem?.nbt?.value?.display?.value?.Name?.value
			)
				await this.client.equip(ctx, rod, 'hand');

			this.logger.info('Casting...');
			await this.cast(ctx);

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

			if (ctx.fishing.fix_after_current) {
				ctx.fishing.fix_after_current = false;
				ctx.id = this.contextId;

				await this.client.look(
					ctx,
					ctx.fishing.original_yaw,
					ctx.fishing.original_pitch,
				);
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
