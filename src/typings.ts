import type { BotOptions } from 'mineflayer';
import type { Item } from 'prismarine-item';

export type AuthType = 'mojang' | 'microsoft';
export enum ServerType {
	ONYX = 'onyx',
	RUBY = 'ruby',
	AMBER = 'amber',
	CHAOS = 'chaos',
	GENESIS = 'genesis',
	ORIGINS = 'origins',
}

export interface ParentMessage {
	command: string;
	args: string[];
	sender: string;
}

export interface DiscordConfig {
	token: string;
	prefix: string;
	enabled: boolean;
	whitelist: string[];
}

export interface Config {
	fishOnJoin: boolean;
	sneakWhileFishing: boolean;
	upgradeFishingRodAutomatically: boolean;
	server: ServerType;
	whitelist: string[];
	autopay_to: string;
	log: boolean;
	version: string;
	accounts: {
		alias: string;
		username: string;
		password: string;
		auth: AuthType;
	}[];
}

export type Context = number;
export type CommandFunction = (
	ctx: Context,
	username: string,
	...args: string[]
) => any;

export interface FishingRodData {
	slot: number;
	price: number;
}

export interface RawItem {
	windowId: number;
	slot: number;
	item: {
		blockId: number;
		itemCount: number;
		itemDamage: number;
		nbtData: Item['nbt'];
	};
}

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
	UNKNOWN = 'unknown',
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
