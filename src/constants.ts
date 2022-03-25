import path from 'path';

import config from './config';

export const FISHING_RODS = [
	'§7§lOld Rod',
	'§e§lNovice Rod',
	'§a§lApprentice Rod',
	'§b§lSturdy Rod',
	'§c§lMega Rod',
];

export const FISHING_ROD_SLOTS = [10, 11, 13, 15, 16];

export const VERSION = config.version;
export const ROD_TO_BAIT = [9, 11, 13, 15, 15];

export const WORKER_PATH = path.join(__dirname, 'worker.js');

export const FISH_THRESHOLD = 24;
export const FISH_COUNT_THRESHOLD = 50;
export const BAIT_THRESHOLD = 0;

export const MESSAGE_COOLDOWN = 1500;
export const COMMAND_COOLDOWN = 3100;

export const COMMAND_REGEX = /^\((\w{3,16})\)\s(.+)$/;
export const TELEPORT_REGEX = /^(\w{3,16}) has requested to teleport to you\.$/;
export const BALANCE_REGEX = /^Your balance is \$([\d,\.]+)/;
export const MOBCOINS_REGEX = /^You have ([\d,\.]+) MobCoins/;
export const FISHMONGER_SELL_REGEX = /^You sold all your fish for \$([\d,\.]+)/;
export const MONEY_THRESHOLD = 5000000;
