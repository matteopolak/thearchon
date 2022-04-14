import type { MessagePort } from 'worker_threads';

import chalk from 'chalk';
import type { Window } from 'prismarine-windows';

import config from '../config';
import { BaseBotOptions, Context, State, StorageAccount } from '../typings';
import { Location, LocationType } from '../typings';
import { currencyFormatter, getItemDisplayName } from '../utils';
import BaseBot from './BaseBot';

export default class FishBot extends BaseBot {
	public declare options: BaseBotOptions & StorageAccount;

	constructor(options: BaseBotOptions & StorageAccount, port: MessagePort) {
		super(options, port);

		config.fishing.fish_on_join = false;
	}

	public async join(ctx: Context = this.context()) {
		await super.join(ctx);

		await this.teleport(ctx, Location.SPAWN, LocationType.RAW);
		await this.getCurrentBalance(ctx);
	}

	public async init() {
		await super.init();

		this.on('balance_changed', (balance, change, from) => {
			if (change > 0 && from) {
				this.logger.info(
					`Received ${chalk.green(
						`$${currencyFormatter.format(change)} ${chalk.reset(
							'from',
						)} ${chalk.yellow(from)} ${chalk.reset(
							`(total of ${chalk.green(
								`$${currencyFormatter.format(balance)}`,
							)}${chalk.reset(')')}`,
						)}`,
					)}`,
				);
			}

			if (this.state === State.IDLE)
				return this.createPurchase(this.context(), this.balance);
		});
	}

	private async createPurchase(ctx: Context, balance: number): Promise<void> {
		if (ctx.id !== this.contextId || balance < this.options.price) return;

		this.setState(ctx, State.PURCHASING, true);
		this.logger.info(
			`Purchasing up to ${Math.floor(balance / this.options.price)} items`,
		);

		// Close any windows that are open
		while (this.client.currentWindow) {
			this.client.closeWindow(ctx, this.client.currentWindow);
		}

		await this.completeActionAndWaitForWindow(ctx, () =>
			this.command(ctx, '/shop'),
		);

		for (const slot of this.options.instructions) {
			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.clickWindow(ctx, slot - 1, 0, 0),
				49,
				[166, 95],
				[undefined, 5],
			);
		}

		if (this.client.currentWindow === null) return;

		const item = this.client.currentWindow.slots[22];
		const availableItems = this.client.inventory.slots.reduce((a, b) => {
			if (b === null) return a + item.stackSize;
			if (item.type === b.type && item.metadata === b.metadata)
				return a + (b.stackSize - b.count);

			return a;
		}, 0);
		let count = Math.min(
			availableItems,
			Math.floor(balance / this.options.price),
		);

		this.logger.info(
			`Purchasing ${Math.floor(balance / this.options.price)}x ${chalk.green(
				getItemDisplayName(item),
			)}`,
		);

		if (count >= 64) {
			const slot = Math.min(8, Math.floor(count / 64) - 1);

			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.clickWindow(ctx, 49, 0, 0),
				13,
				95,
				14,
			);

			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.clickWindow(ctx, slot, 0, 0),
				49,
				166,
			);
		} else {
			--count;

			const tens = Math.floor(count / 10);
			const ones = count % 10;

			for (let i = 0; i < tens; i++) {
				await this.completeActionAndWaitForSlotItem(
					ctx,
					() => this.client.clickWindow(ctx, 25, 0, 0),
					22,
					item.type,
					item.metadata,
				);
			}

			for (let i = 0; i < ones; i++) {
				await this.completeActionAndWaitForSlotItem(
					ctx,
					() => this.client.clickWindow(ctx, 24, 0, 0),
					22,
					item.type,
					item.metadata,
				);
			}

			await this.completeActionAndWaitForSlotItem(
				ctx,
				() => this.client.clickWindow(ctx, 39, 0, 0),
				49,
				166,
			);
		}

		if (this.client.currentWindow)
			this.client.closeWindow(ctx, this.client.currentWindow);

		await this.teleport(ctx, Location.ENDER_CHEST, LocationType.WARP);

		const depositCount = this.client.inventory.count(item.type, item.metadata);

		if (depositCount > 0) {
			if (this.options.storage === 'drop') {
				await this.teleport(ctx, Location.DROP, LocationType.HOME);

				for (let _ = 0; _ < 300; ++_) {
					await this.client.waitForTicks(ctx, 20);

					const username = config.whitelist.find(u => this.client.players[u]);
					if (!username) continue;

					const player = this.client.players[username];
					if (!player) continue;

					await this.client.lookAt(ctx, player.entity.position);

					const start = Date.now();

					this.logger.info(
						`Dropping ${depositCount}x ${chalk.green(
							getItemDisplayName(item),
						)} to ${chalk.yellow(player.username)}`,
					);

					for (const item of this.client.inventory.items()) {
						if (item.type !== item.type || item.metadata !== item.metadata)
							continue;

						await this.client.tossStack(ctx, item);
					}

					this.logger.info(
						`Dropped ${depositCount}x ${chalk.green(
							getItemDisplayName(item),
						)} to ${chalk.yellow(player.username)} (${chalk.cyan(
							`took ${Date.now() - start}ms`,
						)})`,
					);

					break;
				}
			} else {
				const block = this.client.findBlock(ctx, {
					matching: 130,
					maxDistance: 5,
				});

				if (block) {
					block.name = 'chest';
					const enderchest = await this.client.openChest(ctx, block);
					block.name = 'ender_chest';

					if (enderchest) {
						const start = Date.now();

						this.logger.info(
							`Depositing ${depositCount}x ${chalk.green(
								getItemDisplayName(item),
							)} into the Ender Chest`,
						);

						await this.client.deposit(
							ctx,
							enderchest as unknown as Window,
							item.type,
							item.metadata,
							depositCount,
						);
						enderchest.close();

						this.logger.info(
							`Deposited ${depositCount}x ${chalk.green(
								getItemDisplayName(item),
							)} into the Ender Chest (${chalk.cyan(
								`took ${Date.now() - start}ms`,
							)})`,
						);
					} else {
						this.logger.warn('Could not open the Ender Chest');
					}
				} else {
					this.logger.warn('Could not find an Ender Chest');
				}
			}
		}

		await this.teleport(ctx, Location.SPAWN, LocationType.RAW);
		this.setState(ctx, State.IDLE, true);

		if (this.balance >= this.options.price) {
			return this.createPurchase(ctx, this.balance);
		}
	}
}
