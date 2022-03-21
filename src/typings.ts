export type CommandFunction = (username: string, ...args: string[]) => any;

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
