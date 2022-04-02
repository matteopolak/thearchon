import path from 'path';

import config from './config';
import { ServerType } from './typings';
import type { FishingRodData } from './typings';

export const FISHING_RODS = [
	'§7§lOld Rod',
	'§e§lNovice Rod',
	'§a§lApprentice Rod',
	'§b§lSturdy Rod',
	'§c§lMega Rod',
];

export const ALL_FISHING_ROD_DATA: { [key in ServerType]: FishingRodData[] } = {
	[ServerType.ONYX]: [
		{
			slot: 10,
			price: 5_000,
		},
		{
			slot: 11,
			price: 20_000,
		},
		{
			slot: 13,
			price: 100_000,
		},
		{
			slot: 15,
			price: 400_000,
		},
		{
			slot: 16,
			price: 1_000_000,
		},
	],
	[ServerType.RUBY]: [
		{
			slot: 10,
			price: 5_000,
		},
		{
			slot: 11,
			price: 20_000,
		},
		{
			slot: 13,
			price: 100_000,
		},
		{
			slot: 15,
			price: 400_000,
		},
		{
			slot: 16,
			price: 1_000_000,
		},
	],
	[ServerType.AMBER]: [
		{
			slot: 10,
			price: 5_000,
		},
		{
			slot: 11,
			price: 20_000,
		},
		{
			slot: 13,
			price: 100_000,
		},
		{
			slot: 15,
			price: 400_000,
		},
		{
			slot: 16,
			price: 1_000_000,
		},
	],
	[ServerType.CHAOS]: [
		{
			slot: 10,
			price: 1_000_000,
		},
		{
			slot: 11,
			price: 2_000_000,
		},
		{
			slot: 13,
			price: 5_000_000,
		},
		{
			slot: 15,
			price: 10_000_000,
		},
		{
			slot: 16,
			price: 25_000_000,
		},
	],
	[ServerType.GENESIS]: [
		{
			slot: 10,
			price: 1_000_000,
		},
		{
			slot: 11,
			price: 2_000_000,
		},
		{
			slot: 13,
			price: 5_000_000,
		},
		{
			slot: 15,
			price: 10_000_000,
		},
		{
			slot: 16,
			price: 25_000_000,
		},
	],
	[ServerType.ORIGINS]: [
		{
			slot: 10,
			price: 1_000_000,
		},
		{
			slot: 11,
			price: 2_000_000,
		},
		{
			slot: 13,
			price: 5_000_000,
		},
		{
			slot: 15,
			price: 10_000_000,
		},
		{
			slot: 16,
			price: 25_000_000,
		},
	],
};

export const FISHING_ROD_DATA: FishingRodData[] =
	ALL_FISHING_ROD_DATA[config.server];

export const VERSION = config.version;
export const ROD_TO_BAIT = [9, 11, 13, 15, 15];

export const WORKER_PATH = path.join(__dirname, 'worker.js');

export const FISH_THRESHOLD = 24;
export const FISH_COUNT_THRESHOLD = 50;
export const BAIT_THRESHOLD = 5;

export const MESSAGE_COOLDOWN = 1_500;
export const COMMAND_COOLDOWN = 3_100;

export const COMMAND_REGEX = /^\((\w{3,16})\)\s(.+)$/;
export const TELEPORT_REGEX = /^(\w{3,16}) has requested to teleport to you\.$/;
export const BALANCE_REGEX = /^Your balance is \$([\d,\.]+)/;
export const MOBCOINS_REGEX = /^You have ([\d,\.]+) MobCoins/;
export const FISHMONGER_COINS_SELL_REGEX =
	/^You sold all your fish for \$([\d,\.]+)/;
export const FISHMONGER_MOBCOINS_SELL_REGEX =
	/^You sold all your fish for ([\d,\.]+) MobCoins/;
export const SEND_MONEY_REGEX = /^\$([\d,\.]+) has been sent to \w{1,16}\./;
export const DIRECT_MESSAGE_REGEX = /^(?:\[\w+\] )?\((\w{1,16}) ➥ me\) (.+)/;
export const CHAT_MESSAGE_REGEX =
	/^(?:\[\w{3,10}\] )?(?:\[\d+\] )?\[\w+\] (\w{1,16}): (.+)/;
export const RECEIVE_MONEY_REGEX =
	/^\$([\d,\.]+) has been received from \w{1,16}\./;
export const MONEY_THRESHOLD = 5_000_000;
export const SURPLUS_MONEY_THRESHOLD = 150_000;
