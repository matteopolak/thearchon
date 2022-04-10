import path from 'path';

import chalk from 'chalk';

import config from './config';
import { ServerType } from './typings';
import type { FishingRodData } from './typings';

// Name of each fishing rod, sorted by rarity
export const FISHING_RODS = [
	'§7§lOld Rod',
	'§e§lNovice Rod',
	'§a§lApprentice Rod',
	'§b§lSturdy Rod',
	'§c§lMega Rod',
];

// Information of each fishing rod by server
export const ALL_FISHING_ROD_DATA: { [key in ServerType]: FishingRodData[] } = {
	[ServerType.ONYX]: [
		{
			slot: 10,
			price: 5_000,
			name: 'Old Rod',
			name_raw: '§7§lOld Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.grey('Old Rod'))}`,
		},
		{
			slot: 11,
			price: 20_000,
			name: 'Novice Rod',
			name_raw: '§e§lNovice Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.yellow('Novice Rod'))}`,
		},
		{
			slot: 13,
			price: 100_000,
			name: 'Apprentice Rod',
			name_raw: '§a§lApprentice Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.green('Apprentice Rod'))}`,
		},
		{
			slot: 15,
			price: 400_000,
			name: 'Sturdy Rod',
			name_raw: '§b§lSturdy Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.blue('Sturdy Rod'))}`,
		},
		{
			slot: 16,
			price: 1_000_000,
			name: 'Mega Rod',
			name_raw: '§c§lMega Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.red('Mega Rod'))}`,
		},
	],
	[ServerType.RUBY]: [
		{
			slot: 10,
			price: 5_000,
			name: 'Old Rod',
			name_raw: '§7§lOld Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.grey('Old Rod'))}`,
		},
		{
			slot: 11,
			price: 20_000,
			name: 'Novice Rod',
			name_raw: '§e§lNovice Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.yellow('Novice Rod'))}`,
		},
		{
			slot: 13,
			price: 100_000,
			name: 'Apprentice Rod',
			name_raw: '§a§lApprentice Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.green('Apprentice Rod'))}`,
		},
		{
			slot: 15,
			price: 400_000,
			name: 'Sturdy Rod',
			name_raw: '§b§lSturdy Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.blue('Sturdy Rod'))}`,
		},
		{
			slot: 16,
			price: 1_000_000,
			name: 'Mega Rod',
			name_raw: '§c§lMega Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.red('Mega Rod'))}`,
		},
	],
	[ServerType.AMBER]: [
		{
			slot: 10,
			price: 5_000,
			name: 'Old Rod',
			name_raw: '§7§lOld Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.grey('Old Rod'))}`,
		},
		{
			slot: 11,
			price: 20_000,
			name: 'Novice Rod',
			name_raw: '§e§lNovice Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.yellow('Novice Rod'))}`,
		},
		{
			slot: 13,
			price: 100_000,
			name: 'Apprentice Rod',
			name_raw: '§a§lApprentice Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.green('Apprentice Rod'))}`,
		},
		{
			slot: 15,
			price: 400_000,
			name: 'Sturdy Rod',
			name_raw: '§b§lSturdy Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.blue('Sturdy Rod'))}`,
		},
		{
			slot: 16,
			price: 1_000_000,
			name: 'Mega Rod',
			name_raw: '§c§lMega Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.red('Mega Rod'))}`,
		},
	],
	[ServerType.CHAOS]: [
		{
			slot: 10,
			price: 1_000_000,
			name: 'Old Rod',
			name_raw: '§7§lOld Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.grey('Old Rod'))}`,
		},
		{
			slot: 11,
			price: 2_000_000,
			name: 'Novice Rod',
			name_raw: '§e§lNovice Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.yellow('Novice Rod'))}`,
		},
		{
			slot: 13,
			price: 5_000_000,
			name: 'Apprentice Rod',
			name_raw: '§a§lApprentice Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.green('Apprentice Rod'))}`,
		},
		{
			slot: 15,
			price: 10_000_000,
			name: 'Sturdy Rod',
			name_raw: '§b§lSturdy Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.blue('Sturdy Rod'))}`,
		},
		{
			slot: 16,
			price: 25_000_000,
			name: 'Mega Rod',
			name_raw: '§c§lMega Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.red('Mega Rod'))}`,
		},
	],
	[ServerType.GENESIS]: [
		{
			slot: 10,
			price: 1_000_000,
			name: 'Old Rod',
			name_raw: '§7§lOld Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.grey('Old Rod'))}`,
		},
		{
			slot: 11,
			price: 2_000_000,
			name: 'Novice Rod',
			name_raw: '§e§lNovice Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.yellow('Novice Rod'))}`,
		},
		{
			slot: 13,
			price: 5_000_000,
			name: 'Apprentice Rod',
			name_raw: '§a§lApprentice Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.green('Apprentice Rod'))}`,
		},
		{
			slot: 15,
			price: 10_000_000,
			name: 'Sturdy Rod',
			name_raw: '§b§lSturdy Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.blue('Sturdy Rod'))}`,
		},
		{
			slot: 16,
			price: 25_000_000,
			name: 'Mega Rod',
			name_raw: '§c§lMega Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.red('Mega Rod'))}`,
		},
	],
	[ServerType.ORIGINS]: [
		{
			slot: 10,
			price: 1_000_000,
			name: 'Old Rod',
			name_raw: '§7§lOld Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.grey('Old Rod'))}`,
		},
		{
			slot: 11,
			price: 2_000_000,
			name: 'Novice Rod',
			name_raw: '§e§lNovice Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.yellow('Novice Rod'))}`,
		},
		{
			slot: 13,
			price: 5_000_000,
			name: 'Apprentice Rod',
			name_raw: '§a§lApprentice Rod',
			name_coloured_pretty: `an ${chalk.bold(chalk.green('Apprentice Rod'))}`,
		},
		{
			slot: 15,
			price: 10_000_000,
			name: 'Sturdy Rod',
			name_raw: '§b§lSturdy Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.blue('Sturdy Rod'))}`,
		},
		{
			slot: 16,
			price: 25_000_000,
			name: 'Mega Rod',
			name_raw: '§c§lMega Rod',
			name_coloured_pretty: `a ${chalk.bold(chalk.red('Mega Rod'))}`,
		},
	],
};

// Fishing rod data for selected server in config
export const FISHING_ROD_DATA: FishingRodData[] =
	ALL_FISHING_ROD_DATA[config.server];

// Minecraft version
export const VERSION = config.version;

// Rod index to purchase slot conversion
export const ROD_TO_BAIT = [9, 11, 13, 15, 15] as const;

// Slot to coloured bait name
export const SLOT_TO_BAIT_NAME = {
	9: 'Simple Bait',
	11: 'Basic Bait',
	13: 'Advanced Bait',
	15: 'Pro Bait',
	17: 'All-Purpose Bait',
};

// Slot to bait name
export const SLOT_TO_COLOURED_BAIT_NAME = {
	9: chalk.bold(chalk.grey('Simple Bait')),
	11: chalk.bold(chalk.green('Basic Bait')),
	13: chalk.bold(chalk.blue('Advanced Bait')),
	15: chalk.bold(chalk.red('Pro Bait')),
	17: chalk.bold(chalk.yellow('All-Purpose Bait')),
};

// Path to `worker.js`
export const WORKER_PATH = path.join(__dirname, 'worker.js');

// Number of fish slots to fill before selling
export const FISH_THRESHOLD = 24;

// Number of fish to have before selling
export const FISH_COUNT_THRESHOLD = 50;

// Number of bait to have before replenishing
export const BAIT_THRESHOLD = 5;

// Time to wait between each message
export const MESSAGE_COOLDOWN = 1_500;

// time to wait between each command
export const COMMAND_COOLDOWN = 3_100;

// Pattern for in-game commands. Translation:
// `({username}) {message}
export const COMMAND_REGEX = /^\((\w{3,16})\)\s(.+)$/;

// Teleportation request. Translation:
// `{username} has requested to teleport to you.`
export const TELEPORT_REGEX = /^(\w{3,16}) has requested to teleport to you\.$/;

// Balance message. Translation:
// `Your balance is ${money}
export const BALANCE_REGEX = /^Your balance is \$([\d,\.]+)/;

// Mob Coins balance. Translation:
// `You have {number} MobCoins
export const MOBCOINS_REGEX = /^You have ([\d,\.]+) MobCoins/;

// Fishmonger sell message. Translation:
// `You sold all your fish for ${money}`
export const FISHMONGER_COINS_SELL_REGEX =
	/^You sold all your fish for \$([\d,\.]+)/;

// Fishmonger Mob Coin sell message. Translation:
// `You sold all your fish for {number} MobCoins`
export const FISHMONGER_MOBCOINS_SELL_REGEX =
	/^You sold all your fish for ([\d,\.]+) MobCoins/;

// Money sent message. Translation:
// `${money} has been sent to {username}`
export const SEND_MONEY_REGEX = /^\$([\d,\.]+) has been sent to \w{1,16}\./;

// Direct message. Translation:
// `[{realm}] ({username} ➥ me) {message}`
export const DIRECT_MESSAGE_REGEX = /^(?:\[\w+\] )?\((\w{1,16}) ➥ me\) (.+)/;

// Chat message. Translation:
// `[{faction}] [{level}] [{rank}] {username}: {message}`
export const CHAT_MESSAGE_REGEX =
	/^(?:\[\w{3,10}\] )?(?:\[\d+\] )?\[\w+\] (\w{1,16}): (.+)/;

// Money received message. Translation:
// `${money} has been received from {username}.`
export const RECEIVE_MONEY_REGEX =
	/^\$([\d,\.]+) has been received from \w{1,16}\./;

// Server join error message. Translation:
// `Unable to connect to {realm}: {message}`
export const JOIN_ERROR_REGEX = /^Unable to connect to \w+: (.+)/;

// Amount of money to obtain before automatically paying it to `config.autopay_to`
export const MONEY_THRESHOLD = 5_000_000;

// Amount of money to keep in reserve
export const SURPLUS_MONEY_THRESHOLD = 150_000;

// Time to wait before requesting a new CAPTCHA
export const RENEW_CAPTCHA_INTERVAL = 15_000;

// Minimum time to wait before solving a CAPTCHA
export const CAPTCHA_TIME_THRESHOLD = 4_000;

// Minimum time to wait between window clicks
export const TIME_BETWEEN_WINDOW_CLICKS = 750;
