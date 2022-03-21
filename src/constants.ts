import config from './config';
import path from 'path';

export const FISHING_RODS = [
	'§7§lOld Rod',
	'§e§lNovice Rod',
	'§a§lApprentice Rod',
	'§b§lSturdy Rod',
	'§c§lMega Rod',
];

export const VERSION = config.version;
export const ROD_TO_BAIT = [9, 11, 13, 15, 15];

export const WORKER_PATH = path.join(__dirname, 'worker.js');
