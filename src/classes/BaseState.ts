import type { ControlState, EquipmentDestination } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import type { Vec3 } from 'vec3';

import { TIME_BETWEEN_WINDOW_CLICKS } from '../constants';
import type { Context, RecordingStep } from '../typings';
import { cooldownSleep, sleep } from '../utils';
import type BaseBot from './BaseBot';

export default class BaseState {
	private client: BaseBot;

	constructor(client: BaseBot) {
		this.client = client;
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
					// @ts-ignore
					this.client._bot.off('context_changed', contextListener);

					resolve(message);
				}
			};

			const contextListener = () => {
				this.client._bot.off('messagestr', listener);

				resolve(null);
			};

			this.client._bot.on('messagestr', listener);
			// @ts-ignore
			this.client._bot.once('context_changed', contextListener);

			if (ctx.id !== this.client.contextId) {
				this.client._bot.off('messagestr', listener);
				// @ts-ignore
				this.client._bot.off('context_changed', contextListener);

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

	async jumpOnce(ctx: Context) {
		this.setControlState(ctx, 'jump', true);
		await this.waitForTicks(ctx, 1);
		this.setControlState(ctx, 'jump', false);
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
}
