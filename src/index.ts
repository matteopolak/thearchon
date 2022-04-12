import fs from 'fs';
import path from 'path';
import type { Worker } from 'worker_threads';

import axios from 'axios';

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

async function run() {
	if (config.witai_key !== undefined) {
		try {
			await fs.promises.access(
				path.join(__dirname, '..', 'resources', 'wit_token'),
				fs.constants.W_OK,
			);
		} catch (e) {
			const { data } = await axios.post(
				'https://api.wit.ai/import',
				await fs.promises.readFile(
					path.join(__dirname, '..', 'resources', 'wit.zip'),
				),
				{
					headers: {
						Authorization: `Bearer ${config.witai_key}`,
					},
					params: {
						private: true,
						name: 'autofisher',
					},
				},
			);

			await fs.promises.writeFile(
				path.join(__dirname, '..', 'resources', 'wit_token'),
				data.access_token,
			);
		}
	}

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
}

run();
