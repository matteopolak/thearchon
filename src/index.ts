import type { Worker } from 'worker_threads';

import config, { discordConfig } from './config';
import { create } from './discord';
import { BaseBotOptions, SellType } from './typings';
import { startNewProcess } from './utils';

const workers = new Map<string, Worker>();
const client = discordConfig.enabled ? create(discordConfig, workers) : null;

const defaults: Partial<BaseBotOptions> = {
	whitelist: new Set(config.whitelist),
	logger: config.log,
	host: 'archonhq.net',
	port: 25565,
	version: '1.12.2',
	hideErrors: true,
	viewDistance: config.minimize_memory_usage ? 'tiny' : 'far',
};

for (const options of config.accounts) {
	startNewProcess(
		{
			options: {
				...defaults,
				...options,
				sell_type: SellType.COINS,
				fish: true,
			},
		},
		workers,
		client,
	);
}
