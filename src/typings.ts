import type { BotOptions } from 'mineflayer';

export type Context = number;
export type CommandFunction = (
	ctx: Context,
	username: string,
	...args: string[]
) => any;

export type BaseBotOptions = BotOptions & {
	alias: string;
	whitelist?: Set<string>;
	logger?: boolean;
	sellType?: SellType;
	fish?: boolean;
};

export enum State {
	IDLE,
	FISHING,
	SOLVING_CAPTCHA,
	CLEARING_INVENTORY,
}

export enum DestinationType {
	HOME,
	WARP,
	RAW,
}

export enum SellType {
	COINS = 'Chest',
	MOB_COINS = 'Gold Ingot',
}

export enum Destination {
	FISHING = 'fishing',
	FOREST = 'forest',
	SPAWN = 'spawn',
}

export interface RawMapData {
	itemDamage: number;
	scale: number;
	icons: number[];
	columns: number;
	rows: number;
	x: number;
	y: number;
	data: Buffer;
}

export interface InventoryData {
	slots: {
		bait: number;
		fish: number;
		taken: number;
	};
	count: {
		bait: number;
		fish: number;
	};
}
