import type { ControlState, EquipmentDestination } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import type { Vec3 } from 'vec3';

import type { Context } from '../typings';
import type BaseBot from './BaseBot';

export default class BaseState {
	private client: BaseBot;

	constructor(client: BaseBot) {
		this.client = client;
	}

	waitForTicks(ctx: Context, ticks: number) {
		if (ctx !== this.client.context) return;

		return this.client._bot.waitForTicks(ticks);
	}

	waitForChunksToLoad(ctx: Context) {
		if (ctx !== this.client.context) return;

		return this.client._bot.waitForChunksToLoad();
	}

	awaitMessage(ctx: Context, ...args: string[] | RegExp[]) {
		if (ctx !== this.client.context) return;

		return new Promise<string | undefined>(resolve => {
			const listener = (message: string) => {
				if (
					args.some(x =>
						x instanceof RegExp ? x.test(message) : message === x,
					)
				) {
					this.client._bot.off('messagestr', listener);
					// @ts-ignore
					this.client._bot.off('context_changed', contextListener);

					resolve(message);
				}
			};

			const contextListener = () => {
				this.client._bot.off('messagestr', listener);

				resolve(undefined);
			};

			this.client._bot.on('messagestr', listener);
			// @ts-ignore
			this.client._bot.once('context_changed', contextListener);

			if (ctx !== this.client.context) {
				this.client._bot.off('messagestr', listener);
				// @ts-ignore
				this.client._bot.off('context_changed', contextListener);

				resolve(undefined);
			}
		});
	}

	chat(ctx: Context, message: string) {
		if (ctx !== this.client.context) return;

		return this.client._bot.chat(message);
	}

	lookAt(ctx: Context, point: Vec3, force?: boolean) {
		if (ctx !== this.client.context) return;

		return this.client._bot.lookAt(point, force);
	}

	setControlState(ctx: Context, control: ControlState, state: boolean) {
		if (ctx !== this.client.context) return;

		return this.client._bot.setControlState(control, state);
	}

	activateEntity(ctx: Context, entity: Entity) {
		if (ctx !== this.client.context) return;

		return this.client._bot.activateEntity(entity);
	}

	clickWindow(ctx: Context, slot: number, mouseButton: number, mode: number) {
		if (ctx !== this.client.context) return;

		return this.client._bot.clickWindow(slot, mouseButton, mode);
	}

	closeWindow(ctx: Context, window: Window) {
		if (ctx !== this.client.context) return;

		return this.client._bot.closeWindow(window);
	}

	activateItem(ctx: Context, offhand?: boolean) {
		if (ctx !== this.client.context) return;

		return this.client._bot.activateItem(offhand);
	}

	toss(
		ctx: Context,
		itemType: number,
		metadata: number | null,
		count: number | null,
	) {
		if (ctx !== this.client.context) return;

		return this.client._bot.toss(itemType, metadata, count);
	}

	equip(
		ctx: Context,
		item: number | Item,
		destination: EquipmentDestination | null,
	) {
		if (ctx !== this.client.context) return;

		return this.client._bot.equip(item, destination);
	}

	get heldItem() {
		return this.client._bot.heldItem;
	}

	get inventory() {
		return this.client._bot.inventory;
	}

	get entities() {
		return this.client._bot.entities;
	}
}
