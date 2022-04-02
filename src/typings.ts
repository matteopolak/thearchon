import type { BotOptions } from 'mineflayer';
import type { Item } from 'prismarine-item';
import type { Vec3 } from 'vec3';

export type AuthType = 'mojang' | 'microsoft';
export enum ServerType {
	ONYX = 'onyx',
	RUBY = 'ruby',
	AMBER = 'amber',
	CHAOS = 'chaos',
	GENESIS = 'genesis',
	ORIGINS = 'origins',
}

export enum MessageType {
	SELL_TYPE,
	NOTIFICATION,
}

export type MessagePayload =
	| {
			type: MessageType.SELL_TYPE;
			data: {
				is_fishing: boolean;
				sell_type: SellType;
			};
	  }
	| {
			type: MessageType.NOTIFICATION;
			data: {
				message: string;
				sender: string;
				type: 'direct message' | 'message';
			};
	  };

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
	channels: Partial<{
		notifications: string;
	}>;
}

export interface Config {
	openai_key?: string;
	server: ServerType;
	whitelist: string[];
	autopay_to?: string;
	version: string;
	accounts: {
		alias: string;
		username: string;
		password: string;
		auth: AuthType;
	}[];
	fishing: {
		smart_casting: boolean;
		fish_on_join: boolean;
		sneak_while_fishing: boolean;
		upgrade_fishing_rod_automatically: boolean;
		stop_fishing_on_mention: boolean;
		random_movement: boolean;
	};
	log: boolean;
	notify_on_mention: boolean;
	react_to_external_move: boolean;
	minimize_memory_usage: boolean;
}

export type Context = {
	id: number;
	reacting_to_movement: boolean;
	allow_reaction: boolean;
	fishing: {
		pitch: number;
		yaw: number;
		position: Vec3;
	};
};

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
	sell_type?: SellType;
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
