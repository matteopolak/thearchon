import type {
	ControlState,
	EquipmentDestination,
	FindBlockOptions,
} from 'mineflayer';
import type { Block } from 'prismarine-block';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import type { Vec3 } from 'vec3';

import {
	NORMAL_DIRECTION,
	OPPOSITE_DIRECTION,
	TIME_BETWEEN_WINDOW_CLICKS,
} from '../constants';
import {
	Context,
	Direction,
	MovementInstruction,
	RecordingStep,
	State,
} from '../typings';
import { cooldownSleep, sleep } from '../utils';
import type BaseBot from './BaseBot';

interface TransferOptions {
	window: Window | undefined;
	itemType: number;
	metadata: number | null;
	count: number;
	nbt: Item['nbt'] | undefined;
	sourceStart: number;
	sourceEnd: number;
	destStart: number;
	destEnd: number;
}

export default class BaseState {
	private client: BaseBot;

	constructor(client: BaseBot) {
		this.client = client;
	}

	waitUntilGrounded(ctx: Context) {
		return new Promise(resolve => {
			const listener = () => {
				if (this.entity.onGround) {
					this.client._bot.off('move', listener);
					this.client.off('context_changed', listener);

					resolve(undefined);
				}
			};

			const contextListener = () => {
				this.client._bot.off('move', listener);
				resolve(undefined);
			};

			this.client._bot.on('move', listener);
			this.client.once('context_changed', contextListener);

			if (ctx.id !== this.client.contextId || this.entity.onGround) {
				this.client._bot.off('move', listener);
				this.client.off('context_changed', contextListener);

				resolve(undefined);
			}
		});
	}

	waitForTicks(ctx: Context, ticks: number) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		return this.client._bot.waitForTicks(ticks);
	}

	setInterval(ctx: Context, fn: () => any, interval: number) {
		const id = setInterval(() => {
			if (ctx.id !== this.client.contextId) {
				clearInterval(id);
				return;
			}

			fn();
		}, interval);

		return id;
	}

	async setTickInterval(ctx: Context, fn: () => any, ticks?: number) {
		while (ctx.id === this.client.contextId) {
			await this.waitForTicks(ctx, ticks ? 5 : 0);
			fn();
		}
	}

	waitForChunksToLoad(ctx: Context) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		return this.client._bot.waitForChunksToLoad();
	}

	awaitMessage(ctx: Context, ...args: string[] | RegExp[]) {
		if (ctx.id !== this.client.contextId) return Promise.resolve(null);

		return new Promise<string | null>(resolve => {
			const listener = (message: string) => {
				if (
					args.some(x =>
						x instanceof RegExp ? x.test(message) : message === x,
					)
				) {
					this.client._bot.off('messagestr', listener);
					this.client.off('context_changed', contextListener);

					resolve(message);
				}
			};

			const contextListener = () => {
				this.client._bot.off('messagestr', listener);

				resolve(null);
			};

			this.client._bot.on('messagestr', listener);
			this.client.once('context_changed', contextListener);

			if (ctx.id !== this.client.contextId) {
				this.client._bot.off('messagestr', listener);
				this.client.off('context_changed', contextListener);

				resolve(null);
			}
		});
	}

	chat(ctx: Context, message: string) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		return this.client._bot.chat(message);
	}

	lookAt(ctx: Context, point: Vec3, force?: boolean) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		return this.client._bot.lookAt(point, force);
	}

	async look(ctx: Context, yaw: number, pitch: number, force?: boolean) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		await this.client._bot.look(yaw, pitch);

		if (force) await this.client._bot.look(yaw, pitch, force);
	}

	async lookAround(ctx: Context) {
		ctx.reacting_to_movement = true;

		const pitch = ctx.fishing?.pitch ?? this.entity.pitch;
		const yaw = ctx.fishing?.yaw ?? this.entity.yaw;

		await this.look(ctx, yaw - Math.PI * 0.3, pitch + Math.PI * 0.2);
		await this.waitForTicks(ctx, 2);
		await this.look(ctx, yaw - Math.PI * 1.2, Math.PI * 0.5);
		await this.waitForTicks(ctx, 2);
		await this.look(ctx, yaw, pitch);

		ctx.reacting_to_movement = false;
	}

	setControlState(ctx: Context, control: ControlState, state: boolean) {
		if (ctx.id !== this.client.contextId) return;

		return this.client._bot.setControlState(control, state);
	}

	async activateEntity(ctx: Context, entity: Entity) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		await this.lookAt(ctx, entity.position, true);

		return this.client._bot.activateEntity(entity);
	}

	async clickWindow(
		ctx: Context,
		slot: number,
		mouseButton: number,
		mode: number,
	) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		await cooldownSleep(ctx.last_window_click, TIME_BETWEEN_WINDOW_CLICKS);
		ctx.last_window_click = Date.now();

		return this.client._bot.clickWindow(slot, mouseButton, mode);
	}

	closeWindow(ctx: Context, window: Window) {
		if (ctx.id !== this.client.contextId) return;

		return this.client._bot.closeWindow(window);
	}

	activateItem(ctx: Context, offhand?: boolean) {
		if (ctx.id !== this.client.contextId) return;

		return this.client._bot.activateItem(offhand);
	}

	toss(
		ctx: Context,
		itemType: number,
		metadata: number | null,
		count: number | null,
	) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		return this.client._bot.toss(itemType, metadata, count);
	}

	equip(
		ctx: Context,
		item: number | Item,
		destination: EquipmentDestination | null,
	) {
		if (ctx.id !== this.client.contextId) return Promise.resolve();

		return this.client._bot.equip(item, destination);
	}

	get entity() {
		return this.client._bot.entity;
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

	get players() {
		return this.client._bot.players;
	}

	get currentWindow(): Window | null {
		return this.client._bot.currentWindow;
	}

	get registry() {
		// @ts-ignore
		return this.client._bot.registry;
	}

	swingArm(ctx: Context, hand?: 'right' | 'left', showHand?: boolean) {
		if (ctx.id !== this.client.contextId) return;

		return this.client._bot.swingArm(hand, showHand);
	}

	get controlState() {
		return this.client._bot.controlState;
	}

	clearControlStates(ctx: Context) {
		if (ctx.id !== this.client.contextId) return;

		return this.client._bot.clearControlStates();
	}

	openChest(ctx: Context, chest: Block | Entity) {
		if (ctx.id !== this.client.contextId) return;

		return this.client._bot.openChest(chest);
	}

	findBlock(ctx: Context, options: FindBlockOptions) {
		if (ctx.id !== this.client.contextId) return null;

		return this.client._bot.findBlock(options);
	}

	async tossStack(ctx: Context, item: Item) {
		if (ctx.id !== this.client.contextId) return;

		await this.clickWindow(ctx, item.slot, 0, 0);
		await this.clickWindow(ctx, -999, 0, 0);

		this.closeWindow(ctx, this.currentWindow ?? this.inventory);
	}

	// Taken from `mineflayer/lib/plugins/inventory.js`
	async deposit(
		ctx: Context,
		window: Window,
		itemType: number,
		metadata: number | null,
		count: number,
		nbt?: Item['nbt'],
	) {
		const options = {
			window: window,
			itemType,
			metadata,
			count,
			nbt,
			sourceStart: window.inventoryStart,
			sourceEnd: window.inventoryEnd,
			destStart: 0,
			destEnd: window.inventoryStart,
		};

		return this.transfer(ctx, options);
	}

	// Taken from `mineflayer/lib/plugins/inventory.js`
	async putSelectedItemRange(
		ctx: Context,
		start: number,
		end: number,
		window: Window,
		slot: number | null,
	) {
		while (window.selectedItem) {
			const item = window.findItemRange(
				start,
				end,
				window.selectedItem.type,
				window.selectedItem.metadata,
				true,
				window.selectedItem.nbt,
			);

			const tossLeftover = async () => {
				if (window.selectedItem) {
					await this.clickWindow(ctx, -999, 0, 0);
				}
			};

			if (item && item.stackSize !== item.count) {
				// something to join with
				await this.clickWindow(ctx, item.slot, 0, 0);
			} else {
				// nothing to join with
				const emptySlot = window.firstEmptySlotRange(start, end);
				if (emptySlot === null) {
					// no room left
					if (slot === null) {
						// no room => drop it
						await tossLeftover();
					} else {
						// if there is still some leftover and slot is not null, click slot
						await this.clickWindow(ctx, slot, 0, 0);
						await tossLeftover();
					}
				} else {
					await this.clickWindow(ctx, emptySlot, 0, 0);
				}
			}
		}
	}

	// Taken from `mineflayer/lib/plugins/inventory.js`
	async transfer(ctx: Context, options: TransferOptions) {
		const window = options.window || this.currentWindow || this.inventory;
		const itemType = options.itemType;
		const metadata = options.metadata;
		const nbt = options.nbt;
		let count = options.count === null ? 1 : options.count;
		let firstSourceSlot: number | null = null;

		const sourceStart = options.sourceStart;
		const destStart = options.destStart;
		const sourceEnd =
			options.sourceEnd === null ? sourceStart + 1 : options.sourceEnd;
		const destEnd = options.destEnd === null ? destStart + 1 : options.destEnd;

		const transferOne = async () => {
			if (count === 0) {
				await this.putSelectedItemRange(
					ctx,
					sourceStart,
					sourceEnd,
					window,
					firstSourceSlot,
				);
				return;
			}
			if (
				!window.selectedItem ||
				window.selectedItem.type !== itemType ||
				(metadata != null && window.selectedItem.metadata !== metadata) ||
				(nbt != null && window.selectedItem.nbt !== nbt)
			) {
				// we are not holding the item we need. click it.
				const sourceItem = window.findItemRange(
					sourceStart,
					sourceEnd,
					itemType,
					metadata,
					false,
					nbt,
				);
				const mcDataEntry = this.registry.itemsArray.find(
					(x: any) => x.id === itemType,
				);
				if (!sourceItem)
					throw new Error(
						`Can't find ${mcDataEntry.name} in slots [${sourceStart} - ${sourceEnd}], (item id: ${itemType})`,
					);
				if (firstSourceSlot === null) firstSourceSlot = sourceItem.slot;
				// number of item that can be moved from that slot
				await this.clickWindow(ctx, sourceItem.slot, 0, 0);
			}

			const clickDest = async () => {
				let destItem;
				let destSlot;
				// special case for tossing
				if (destStart === -999) {
					destSlot = -999;
				} else {
					// find a non full item that we can drop into
					destItem = window.findItemRange(
						destStart,
						destEnd,
						window.selectedItem!.type,
						window.selectedItem?.metadata ?? null,
						true,
						nbt,
					);
					// if that didn't work find an empty slot to drop into
					destSlot = destItem
						? destItem.slot
						: window.firstEmptySlotRange(destStart, destEnd);
					// if that didn't work, give up
					if (destSlot === null) {
						throw new Error('destination full');
					}
				}
				// move the maximum number of item that can be moved
				const destSlotCount = destItem && destItem.count ? destItem.count : 0;
				const movedItems = Math.min(
					window.selectedItem!.stackSize - destSlotCount,
					window.selectedItem!.count,
				);
				// if the number of item the left click moves is less than the number of item we want to move
				// several at the same time (left click)
				if (movedItems <= count) {
					await this.clickWindow(ctx, destSlot, 0, 0);
					// update the number of item we want to move (count)
					count -= movedItems;
					await transferOne();
				} else {
					// one by one (right click)
					await this.clickWindow(ctx, destSlot, 1, 0);
					count -= 1;
					await transferOne();
				}
			};

			await clickDest();
		};

		await transferOne();
	}

	async jumpOnce(ctx: Context) {
		this.setControlState(ctx, 'jump', true);
		await this.waitForTicks(ctx, 1);
		this.setControlState(ctx, 'jump', false);

		return this.waitUntilGrounded(ctx);
	}

	async replay(ctx: Context, steps: RecordingStep[]) {
		for (const step of steps) {
			if (step.swing) this.swingArm(ctx);
			if (step.jump) this.jumpOnce(ctx);

			if (step.sprint === !this.controlState.sprint) {
				this.setControlState(ctx, 'sprint', step.sprint);
			}

			if (step.crouch === !this.controlState.sneak) {
				this.setControlState(ctx, 'sneak', step.crouch);
			}

			if (step.forward === !this.controlState.forward) {
				this.setControlState(ctx, 'forward', step.forward);
				if (step.forward) this.setControlState(ctx, 'back', !step.forward);
			}

			if (step.back === !this.controlState.back) {
				if (step.back) this.setControlState(ctx, 'forward', !step.back);
				this.setControlState(ctx, 'back', step.back);
			}

			if (step.left === !this.controlState.left) {
				this.setControlState(ctx, 'left', step.left);
				if (step.left) this.setControlState(ctx, 'right', !step.left);
			}

			if (step.right === !this.controlState.right) {
				if (step.right) this.setControlState(ctx, 'left', !step.right);
				this.setControlState(ctx, 'right', step.right);
			}

			if (step.yaw !== undefined || step.pitch !== undefined) {
				this.entity.pitch = step.pitch ?? this.entity.pitch;
				this.entity.yaw += step.yaw ?? 0;
			}

			if (step.wait) {
				await sleep(step.wait);
			}
		}

		this.setControlState(ctx, 'forward', false);
		this.setControlState(ctx, 'back', false);
		this.setControlState(ctx, 'left', false);
		this.setControlState(ctx, 'right', false);
		this.setControlState(ctx, 'sprint', false);
		this.setControlState(ctx, 'jump', false);

		await this.look(
			ctx,
			ctx.fishing!.original_yaw,
			ctx.fishing!.original_pitch,
		);
	}

	async processMovementInstructions(
		ctx: Context,
		instructions: MovementInstruction[],
	) {
		if (ctx.id !== this.client.contextId) return;

		this.client.setState(ctx, State.PROCESSING_MOVEMENT);

		ctx = this.client.context();
		const backwards: (MovementInstruction & { direction: Direction })[] = [];

		for (const { direction, distance } of instructions) {
			if (direction === 'center') {
				for (const { direction, distance } of backwards) {
					await this.move(ctx, OPPOSITE_DIRECTION[direction], distance);
				}

				backwards.splice(0, backwards.length);
			} else {
				await this.move(ctx, NORMAL_DIRECTION[direction], distance);

				if (direction !== 'jump' && direction !== 'sneak')
					backwards.unshift({ direction, distance });
			}

			await this.waitForTicks(ctx, 5);
		}

		if (this.client.previousState === State.FISHING && this.client.fisher) {
			return this.client.fisher.fish(ctx);
		}

		this.client.setState(ctx, State.IDLE);
	}

	private async move(ctx: Context, direction: Direction, distance: number) {
		if (direction === 'jump') {
			for (let _ = 0; _ < distance; _++) {
				await this.jumpOnce(ctx);
			}

			return;
		} else if (direction === 'sneak') {
			for (let _ = 0; _ < distance; _++) {
				this.setControlState(ctx, 'sneak', true);
				await this.waitForTicks(ctx, 3);
				this.setControlState(ctx, 'sneak', false);
				await this.waitForTicks(ctx, 3);
			}

			return;
		} else if (direction === 'punch') {
			for (let _ = 0; _ < distance; _++) {
				this.swingArm(ctx);
				await this.waitForTicks(ctx, 5);
			}

			return;
		}

		const original = this.entity.position.clone();

		this.setControlState(ctx, direction, true);

		while (original.distanceTo(this.entity.position) < distance) {
			await this.waitForTicks(ctx, 1);
		}

		this.setControlState(ctx, direction, false);
	}
}
