import type { Worker } from 'worker_threads';

import config, { discordConfig } from './config';
import { VERSION } from './constants';
import { create } from './discord';
import { SellType } from './typings';
import { startNewProcess } from './utils';

const workers = new Map<string, Worker>();
const client = discordConfig.enabled ? create(discordConfig, workers) : null;

const defaults = {
	whitelist: new Set(config.whitelist),
	logger: config.log,
	host: 'best.thearchon.net',
	port: 25565,
	version: VERSION,
	hideErrors: true,
};

for (const options of config.accounts) {
	startNewProcess(
		{
			options: {
				...defaults,
				...options,
				sellType: SellType.COINS,
				fish: true,
			},
		},
		workers,
		client,
	);
}
