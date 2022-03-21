import BaseBot from './BaseBot';
import { FISHING_RODS, ROD_TO_BAIT } from '../constants';
import { Destination, DestinationType, SellType } from '../typings';
import { currencyFormatter, formatMapData, unscramble } from '../utils';

import type { BaseBotOptions } from './BaseBot';
import type { InventoryData, RawMapData } from '../typings';
import type { Item } from 'prismarine-item';
import type { MessagePort } from 'worker_threads';

const FISH_THRESHOLD = 24;
const FISH_COUNT_THRESHOLD = 50;
const BAIT_THRESHOLD = 0;

export default class FishBot extends BaseBot {
	private isFishing = false;
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

		this.client._client.on('map', async (map: RawMapData) => {
			if (!this.captcha.active) return;

			map.columns = Math.abs(map.columns);
			map.rows = Math.abs(map.rows);

			if (
				!map.data?.length ||
				map.columns === 128 ||
				map.rows === 128 ||
				!map.columns ||
				!map.rows
			)
				return;

			const answer = unscramble(formatMapData(map));

			if (answer.length === 5 && this.captcha.active) {
				if (this.logger)
					console.log(
						`[${this.alias}] [CAPTCHA] Possible answer found: ${answer.join(
							'',
						)}`,
					);

				await this.command(`/code ${answer.join('')}`);

				this.captcha.active = false;

				await this.client.awaitMessage(
					'Great job! You solved the captcha and can continue playing.',
				);

				process.exit(50);
			}
		});
	}

	public async teleportToHome(name: Destination) {
		if (name === Destination.FOREST) {
			this.client.setControlState('sneak', false);
		}

		await super.teleport(name, DestinationType.HOME);

		if (name === Destination.FISHING) {
			this.client.setControlState('sneak', true);
		}
	}

	private async setSellType(type: SellType) {
		this.sellType = type;
		this.port.postMessage({
			sellType: this.sellType,
			isFishing: this.isFishing,
		});
	}

	private getBestFishingRod(index: true): number;
	private getBestFishingRod(index?: false): Item | null;
	private getBestFishingRod(index = false) {
		const item = this.client.inventory.slots.reduce((a, b) =>
			// @ts-ignore
			FISHING_RODS.indexOf(a?.nbt?.value?.display?.value?.Name?.value) -
				// @ts-ignore
				FISHING_RODS.indexOf(b?.nbt?.value?.display?.value?.Name?.value) >
			0
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

	private waitForBite() {
		return new Promise(resolve => {
			const listener = (title: string) => {
				if (
					title ===
					'{"extra":[{"color":"dark_aqua","text":"You Got a Bite!"}],"text":""}'
				) {
					this.client.removeListener('title', listener);

					return resolve(true);
				}
			};

			this.client.on('title', listener);
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

	private async sellFish(goBack = true) {
		await this.teleportToHome(Destination.FOREST);

		const window = await this.completeActionAndWaitForWindow(async () => {
			const entity = Object.values(this.client.entities).find(
				e => e.username === '§a§lFishmonger',
			);

			if (!entity) process.exit();
			else {
				await this.client.activateEntity(entity);
			}
		});

		const sellSlot =
			window.slots.find(i => i.displayName === this.sellType)?.slot ?? -1;

		if (sellSlot !== -1) {
			await this.client.clickWindow(sellSlot, 0, 0);
			await this.client.waitForTicks(5);
		} else {
			if (this.logger)
				console.log(
					`[${this.alias}] [WARNING] Could not sell fish because the slot was not found`,
				);
		}

		this.client.closeWindow(window);
		if (goBack) await this.teleportToHome(Destination.FISHING);
		this.client.activateItem();
	}

	private async purchaseBait() {
		await this.teleportToHome(Destination.FOREST);

		const window = await this.completeActionAndWaitForWindow(async () => {
			const entity = Object.values(this.client.entities).find(
				e => e.username === '§a§lFishmonger',
			);

			if (!entity) process.exit();
			else {
				await this.client.activateEntity(entity);
			}
		});

		const [sellSlot, buySlot] = window.slots.reduce(
			(a, b) => {
				if (b === null) return a;

				if (b.displayName === this.sellType) a[0] = b.slot;
				else if (b.displayName === 'Pink Dye') a[1] = b.slot;

				return a;
			},
			[-1, -1],
		);

		if (sellSlot !== -1) {
			await this.client.clickWindow(sellSlot, 0, 0);
			await this.client.waitForTicks(5);
		} else {
			if (this.logger)
				console.log(
					`[${this.alias}] [WARNING] Could not sell fish because the slot was not found`,
				);
		}

		if (buySlot !== -1) {
			const rodIndex = this.getBestFishingRod(true);
			const baitSlot = ROD_TO_BAIT[rodIndex === -1 ? 0 : rodIndex];

			await this.client.clickWindow(buySlot, 0, 0);
			await this.client.waitForTicks(5);
			await this.client.clickWindow(baitSlot, 0, 0);
			await this.client.waitForTicks(5);
			await this.client.clickWindow(17, 0, 0);
		} else {
			if (this.logger)
				console.log(
					`[${this.alias}] [WARNING] Could not buy bait because the slot was not found`,
				);
		}

		this.client.closeWindow(window);
		await this.teleportToHome(Destination.FISHING);
		this.client.activateItem();
	}

	private sellFishAndPurchaseBait() {
		return this.purchaseBait();
	}

	private clearCommand() {
		return this.clearInventory();
	}

	private async clearInventory() {
		await this.teleport(Destination.SPAWN, DestinationType.RAW);

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
				await this.client.toss(item.type, item.metadata, item.count);
				await this.client.waitForTicks(10);
			}
		}
	}

	private async checkFishingThresholds() {
		const inventory = this.getInventoryData();

		if (this.isInventoryFull()) {
			await this.clearInventory();
		}

		if (inventory.count.bait === BAIT_THRESHOLD) {
			await this.purchaseBait();

			return true;
		} else if (
			inventory.slots.fish >= FISH_THRESHOLD ||
			inventory.count.fish >= FISH_COUNT_THRESHOLD
		) {
			if (inventory.count.bait >= FISH_THRESHOLD) await this.sellFish();
			else await this.sellFishAndPurchaseBait();

			return true;
		}

		return false;
	}

	public async fish() {
		try {
			return this.startFishing();
		} catch (e) {
			console.log(`[${this.alias}] [ERROR] Error during fishing: ${e}`);
		}
	}

	private async stopFishing() {
		this.isFishing = false;
	}

	private async startFishing() {
		if (this.isFishing) return false;

		this.isFishing = true;

		const captchaState = this.captcha.startedAt;
		const rod = this.getBestFishingRod();

		if (rod === null) {
			return (this.isFishing = false);
		}

		this.port.postMessage({ sellType: this.sellType, isFishing: true });

		if (rod.displayName !== this.client.heldItem?.displayName)
			await this.client.equip(rod, 'hand');

		if (!(await this.checkFishingThresholds()))
			await this.teleportToHome(Destination.FISHING);

		while (this.isFishing && captchaState === this.captcha.startedAt) {
			await this.checkFishingThresholds();
			await this.client.waitForTicks(5);

			if (rod.displayName !== this.client.heldItem?.displayName)
				await this.client.equip(rod, 'hand');

			this.client.activateItem();
			await this.waitForBite();
			this.client.activateItem();

			await this.client.waitForTicks(5);
		}

		return true;
	}

	public async showFishValue() {
		const value = this.client.inventory.items().reduce(
			// @ts-ignore
			(a, b) => a + (b.nbt?.value?.arfshfishworth?.value ?? 0),
			0,
		);

		return this.command(`/p ${currencyFormatter.format(value)}`);
	}

	public async setSellTypeCommand(_: string, type: string) {
		if (type === 'coins') type = SellType.COINS;
		else if (type === 'mobcoins') type = SellType.MOB_COINS;
		else return;

		this.setSellType(type as SellType);
	}
}
