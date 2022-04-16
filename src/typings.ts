import type { BotOptions } from 'mineflayer';
import type { Item } from 'prismarine-item';
import type { Vec3 } from 'vec3';

export type AuthType = 'mojang' | 'microsoft' | 'thealtening';
export const enum ServerType {
	ONYX = 'onyx',
	RUBY = 'ruby',
	AMBER = 'amber',
	CHAOS = 'chaos',
	GENESIS = 'genesis',
	ORIGINS = 'origins',
}

export const enum MessageType {
	SELL_TYPE,
	NOTIFICATION,
	WARNING,
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
	  }
	| {
			type: MessageType.WARNING;
			data: {
				message: string;
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

type BotType = 'storage' | 'fisher';

export interface StorageAccount {
	type: 'storage';
	storage: 'enderchest' | 'drop';
	price: number;
	instructions: number[];
}

export interface FishingAccount {
	type: 'fisher';
}

export interface TheAlteningAccount {
	username?: string;
	expires?: number;
	auth: 'thealtening';
}

export interface NormalAccount {
	username: string;
	expires?: number;
	auth?: AuthType;
}

export type Account = (StorageAccount | FishingAccount) &
	(NormalAccount | TheAlteningAccount) & {
		alias: string;
		password: string;
		channels?: string[];
		viewer_port?: number;
		temporary?: boolean;
		type: BotType;
		proxy?: `${
			| 'socks4'
			| 'socks5'}://${number}.${number}.${number}.${number}:${number}`;
		homes?: Partial<{
			fishing: string;
			drop: string;
			ender_chest: string;
			forest: string;
		}>;
		authServer?: string;
		sessionServer?: string;
	};

export interface Config {
	openai_key?: string;
	witai_key?: string;
	server: ServerType;
	whitelist: string[];
	autopay_to?: string;
	version: string;
	accounts: Account[];
	fishing: {
		fish_on_join: boolean;
		sneak_while_fishing: boolean;
		upgrade_fishing_rod_automatically: boolean;
		stop_fishing_on_mention: boolean;
		pause_fishing_while_staff_hidden: boolean;
		pause_fishing_while_staff_online: boolean;
		random_movement: {
			enabled: boolean;
			recordings: string[];
			chance: number;
		};
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
	fishing?: {
		pitch: number;
		yaw: number;
		position: Vec3;
		original_pitch: number;
		original_yaw: number;
		original_position: Vec3;
		fix_after_current: boolean;
		paused: boolean;
	};
	location: Location | string;
	last_window_click: number;
};

export type CommandFunction = (
	ctx: Context,
	username: string,
	...args: string[]
) => any;

export interface FishingRodData {
	slot: number;
	price: number;
	name: string;
	name_raw: string;
	name_coloured_pretty: string;
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

export type BaseBotOptions = BotOptions &
	Account & {
		whitelist?: Set<string>;
		logger?: boolean;
		sell_type?: SellType;
		fish?: boolean;
		staff: Map<string, StaffMember>;
	};

export const enum State {
	IDLE,
	FISHING,
	SOLVING_CAPTCHA,
	CLEARING_INVENTORY,
	PROCESSING_MOVEMENT,
	PURCHASING,
}

export const enum LocationType {
	HOME,
	WARP,
	RAW,
}

export const enum SellType {
	COINS = 'Chest',
	MOB_COINS = 'Gold Ingot',
}

export const enum Location {
	FISHING = 'fishing',
	FOREST = 'forest',
	SPAWN = 'spawn',
	ENDER_CHEST = 'enchant',
	DROP = 'storage',
	UNKNOWN = 'unknown',
}

export interface RawMapData {
	itemDamage: number;
	scale: number;
	icons: number[];
	columns: number;
	rows: number | undefined;
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

export type RecordingStep = {
	forward?: boolean;
	back?: boolean;
	left?: boolean;
	right?: boolean;
	jump?: boolean;
	swing?: boolean;
	crouch?: boolean;
	sprint?: boolean;
	yaw?: number;
	pitch?: number;
	time?: number;
	wait?: number;
};

export type Direction =
	| 'forward'
	| 'back'
	| 'left'
	| 'right'
	| 'jump'
	| 'sneak'
	| 'punch';

export interface MovementInstruction {
	direction: Direction | 'center';
	distance: number;
}

export interface OpenAIResponse {
	answers: string[];
	completion: string;
	model: string;
	object: string;
	search_model: string;
	selected_documents: { document: number; text: string }[];
}

export interface WitIntent {
	id: string;
	name: string;
	confidence: number;
}

export type WitEntity = WitEntityNumber | WitEntityMovementType;

export interface WitEntityNumber extends BaseWitEntity {
	name: 'wit$number';
	role: 'number';
	value: number;
}

export interface WitEntityMovementType extends BaseWitEntity {
	name: 'movement_type';
	role: 'movement_type';
	value: Direction | 'spin';
}

export interface WitEntityMovementWithRepeat extends BaseWitEntity {
	name: 'movement_with_repeat';
	role: 'movement_with_repeat';
	value: string;
}

export interface BaseWitEntity {
	id: string;
	name: string;
	role: string;
	start: number;
	end: number;
	body: string;
	confidence: number;
	value: string | number;
	type: string;
	entities: WitEntity[];
}

export interface WitResponse {
	text: string;
	intents: WitIntent[];
	entities: Partial<{
		'movement_with_repeat:movement_with_repeat': WitEntityMovementWithRepeat[];
	}>;
	traits: {};
}

export interface StaffMember {
	name: string;
	title: string;
	img: string;
}

export interface StaffCategory {
	name: string;
	members: StaffMember[];
}
