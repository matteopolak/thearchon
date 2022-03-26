import fs from 'fs/promises';
import path from 'path';
import type { MessagePort } from 'worker_threads';

import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import type { Vec3 } from 'vec3';

import config from '../config';
import {
	BAIT_THRESHOLD,
	FISHING_RODS,
	FISHING_ROD_DATA,
	FISH_COUNT_THRESHOLD,
	FISH_THRESHOLD,
	ROD_TO_BAIT,
	SURPLUS_MONEY_THRESHOLD,
} from '../constants';
import { Destination, DestinationType, SellType, State } from '../typings';
import type { Context, InventoryData, RawMapData } from '../typings';
import { currencyFormatter, unscramble } from '../utils';
import BaseBot from './BaseBot';
import type { BaseBotOptions } from './BaseBot';

export default class FishBot extends BaseBot {
	public isFishing = false;
	public bestFishingRod: number = 0;

	private port: MessagePort;
	private sellType: SellType;

	constructor(options: BaseBotOptions, port: MessagePort) {
		super(options);

		this.port = port;
		this.sellType = options.sellType ?? SellType.COINS;
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
			if (this.state !== State.SOLVING_CAPTCHA) return;

			if (
				!map.data?.length ||
				map.columns === 128 ||
				map.rows === 128 ||
				map.columns === -128 ||
				map.rows === -128 ||
				!map.columns ||
				!map.rows
			)
				return;

			const ctx = this.context;
			const answer = unscramble(map);

			if (answer.length === 5 && this.state === State.SOLVING_CAPTCHA) {
				if (this.logger)
					console.log(
						`[${this.alias}] [CAPTCHA] Possible answer found: ${answer.join(
							'',
						)}`,
					);

				this.state = State.IDLE;

				await this.completeActionAndWaitForMessage(
					this.context,
					() => this.command(this.context, `/code ${answer.join('')}`),
					'Great job! You solved the captcha and can continue playing.',
				);

				if (this.captcha.fishing) {
					this.fish(ctx);
				}
			}
		});
	}

	public async teleportToHome(ctx: Context, name: Destination) {
		if (name === Destination.FOREST && config.sneakWhileFishing) {
			this.client.setControlState(ctx, 'sneak', false);
		}

		await super.teleport(ctx, name, DestinationType.HOME);

		if (name === Destination.FISHING && config.sneakWhileFishing) {
			this.client.setControlState(ctx, 'sneak', true);
		}
	}

	private async setSellType(type: SellType) {
		this.sellType = type;
		this.port.postMessage({
			sellType: this.sellType,
			isFishing: this.isFishing,
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
		if (ctx !== this.context) return Promise.resolve();

		return new Promise(resolve => {
			const listener = (title: string) => {
				if (
					title ===
					'{"extra":[{"color":"dark_aqua","text":"You Got a Bite!"}],"text":""}'
				) {
					this._bot.off('title', listener);
					// @ts-ignore
					this._bot.off('context_changed', contextListener);

					return resolve(true);
				}
			};

			const contextListener = () => {
				this._bot.off('title', listener);

				resolve(false);
			};

			this._bot.on('title', listener);
			// @ts-ignore
			this._bot.once('context_changed', contextListener);

			if (ctx !== this.context) {
				this._bot.off('title', listener);
				// @ts-ignore
				this._bot.off('context_changed', contextListener);

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

		if (this.logger)
			console.log(
				`[${this.alias}] [INVENTORY] Fish: ${inventory.count.fish}/${inventory.slots.fish} Bait: ${inventory.count.bait}/${inventory.slots.bait}`,
			);

		return inventory;
	}

	private async sellFishAction(ctx: Context, window: Window) {
		if (ctx !== this.context) return;

		const sellSlot =
			window.slots.find(i => i.displayName === this.sellType)?.slot ?? -1;

		if (sellSlot !== -1) {
			await this.client.clickWindow(ctx, sellSlot, 0, 0);
			await this.client.waitForTicks(ctx, 5);

			return true;
		}

		return false;
	}

	private async upgradeRodAction(ctx: Context, window: Window) {
		if (ctx !== this.context) return;

		const best = this.getBestFishingRod(true);
		const data = FISHING_ROD_DATA[best < 4 ? best + 1 : 0];

		if (
			best !== -1 &&
			best < 4 &&
			data.price >= this.balance - SURPLUS_MONEY_THRESHOLD
		) {
			console.log(
				`[${this.alias}] [PURCHASE] Purchasing ${FISHING_RODS[best + 1]}`,
			);

			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.clickWindow(ctx, 14, 0, 0),
				data.slot,
				346,
			);

			await fs.writeFile(
				path.join(this.directory, `window-${Date.now()}.json`),
				JSON.stringify(window, null, 2),
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
		if (ctx !== this.context) return;

		const rodIndex = this.getBestFishingRod(true);
		const baitSlot = ROD_TO_BAIT[rodIndex === -1 ? 0 : rodIndex];

		if (this.logger) console.log(`[${this.alias}] [PURCHASE] Purchasing bait`);

		await this.client.clickWindow(ctx, 15, 0, 0);
		await this.client.waitForTicks(ctx, 5);
		await this.client.clickWindow(ctx, baitSlot, 0, 0);
		await this.client.waitForTicks(ctx, 5);
		await this.client.clickWindow(ctx, 17, 0, 0);

		return true;
	}

	private async sellFish(ctx: Context, goBack = true) {
		if (ctx !== this.context) return;

		await this.teleportToHome(ctx, Destination.FOREST);

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e => e.username !== undefined && e.username.endsWith('Fishmonger'),
			);

			if (!entity) process.exit();
			else {
				await this.client.activateEntity(ctx, entity);
			}
		});

		if (window === undefined) return;

		if (await this.sellFishAction(ctx, window)) {
			await this.upgradeRodAction(ctx, window);
		}

		this.client.closeWindow(ctx, window);
		if (goBack) await this.teleportToHome(ctx, Destination.FISHING);
	}

	private async purchaseBait(ctx: Context) {
		if (ctx !== this.context) return;

		await this.teleportToHome(ctx, Destination.FOREST);

		const window = await this.completeActionAndWaitForWindow(ctx, async () => {
			const entity = Object.values(this.client.entities).find(
				e => e.username !== undefined && e.username.endsWith('Fishmonger'),
			);

			if (!entity) process.exit();
			else {
				await this.client.activateEntity(ctx, entity);
			}
		});

		if (window === undefined) return;

		if (await this.sellFishAction(ctx, window)) {
			await this.upgradeRodAction(ctx, window);
		}

		await this.purchaseBaitAction(ctx);

		this.client.closeWindow(ctx, window);
		await this.teleportToHome(ctx, Destination.FISHING);
	}

	private sellFishAndPurchaseBait(ctx: Context) {
		return this.purchaseBait(ctx);
	}

	private clearCommand(ctx: Context) {
		if (this.state === State.SOLVING_CAPTCHA) return;

		this.state = State.CLEARING_INVENTORY;

		return this.clearInventory(ctx);
	}

	private async clearInventory(ctx: Context) {
		await this.teleport(ctx, Destination.SPAWN, DestinationType.RAW);

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

	private async checkFishingThresholds(ctx: Context) {
		const inventory = this.getInventoryData();

		if (this.isInventoryFull()) {
			await this.clearInventory(ctx);
		}

		if (inventory.count.bait === BAIT_THRESHOLD) {
			await this.purchaseBait(ctx);

			return true;
		} else if (
			inventory.slots.fish >= FISH_THRESHOLD ||
			inventory.count.fish >= FISH_COUNT_THRESHOLD
		) {
			if (inventory.count.bait >= FISH_THRESHOLD) await this.sellFish(ctx);
			else await this.sellFishAndPurchaseBait(ctx);

			return true;
		}

		return false;
	}

	public async stopFishing() {
		this.isFishing = false;
	}

	private async cast(ctx: Context) {
		if (ctx !== this.context) return;

		let cast = true;

		const listener = (name: string, position: Vec3) => {
			if (
				name === 'entity.splash_potion.throw' &&
				position.distanceTo(this.client.entity.position) < 1
			) {
				cast = false;
				this._bot.off('soundEffectHeard', listener);
				// @ts-ignore
				this._bot.off('context_changed', contextListener);
			}
		};

		const contextListener = () => {
			cast = false;
			this._bot.off('soundEffectHeard', listener);
		};

		this._bot.on('soundEffectHeard', listener);
		// @ts-ignore
		this._bot.once('context_changed', contextListener);

		while (cast) {
			this.client.activateItem(ctx);
			await this.client.waitForTicks(ctx, 10);
		}
	}

	public async fish(_: Context) {
		if (this.state === State.FISHING || this.state === State.SOLVING_CAPTCHA)
			return false;

		this.state = State.FISHING;
		this.isFishing = true;

		const ctx = this.context;
		const rod = this.getBestFishingRod();

		if (rod === null) return;

		if (rod.displayName !== this.client.heldItem?.displayName)
			await this.client.equip(ctx, rod, 'hand');

		if (!(await this.checkFishingThresholds(ctx)))
			await this.teleportToHome(ctx, Destination.FISHING);

		while (this.isFishing && ctx === this.context) {
			await this.checkFishingThresholds(ctx);
			await this.client.waitForTicks(ctx, 5);

			const rod = this.getBestFishingRod();

			if (rod === null) break;
			if (rod.displayName !== this.client.heldItem?.displayName)
				await this.client.equip(ctx, rod, 'hand');

			if (this.logger) console.log(`[${this.alias}] [FISHING] Casting...`);

			await this.cast(ctx);
			await this.waitForBite(ctx);
			this.client.activateItem(ctx);

			if (this.logger) console.log(`[${this.alias}] [FISHING] Reeling...`);

			await this.client.waitForTicks(ctx, 5);
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
