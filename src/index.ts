import fs from 'fs';
import path from 'path';
import type { Worker } from 'worker_threads';

import axios from 'axios';
import chalk from 'chalk';

import config, { discordConfig } from './config';
import {
	THEALTENING_AUTHENTICATION_URL,
	THEALTENING_SESSIONSERVER_URL,
} from './constants';
import { create } from './discord';
import { BaseBotOptions, SellType } from './typings';
import { check } from './update';
import {
	fetchStaffList,
	generateAlteningToken,
	startNewProcess,
} from './utils';

async function run() {
	await check();

	const workers = new Map<string, Worker>();
	const discord = discordConfig.enabled ? create(discordConfig, workers) : null;

	const defaults: Partial<BaseBotOptions> = {
		whitelist: new Set(config.whitelist),
		logger: config.log,
		host: 'archonhq.net',
		port: 25565,
		version: '1.12.2',
		hideErrors: true,
		viewDistance: config.minimize_memory_usage ? 'tiny' : 'far',
	};

	const staff = await fetchStaffList();

	console.log(
		`         ${' '.repeat(17)}${chalk.bold(
			chalk.cyan('Parent'),
		)} Fetched staff list of ${chalk.magenta(staff.size)} members`,
	);

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
		if (options.auth === 'thealtening') {
			if (!options.username) {
				const data = await generateAlteningToken();

				if (data === null) {
					console.log(
						`        ${' '.repeat(17)}${chalk.bold(
							chalk.cyan('Parent'),
						)} Could not generate token for ${chalk.yellow(options.alias)}`,
					);

					continue;
				}

				options.alias = data.token.slice(11);
				options.username = data.token;
				options.expires = data.expires;
			}

			options.auth = undefined;
			options.temporary = true;

			options.sessionServer = THEALTENING_SESSIONSERVER_URL;
			options.authServer = THEALTENING_AUTHENTICATION_URL;
		}

		startNewProcess(
			{
				// @ts-ignore
				options: {
					...defaults,
					...options,
					sell_type: SellType.COINS,
					fish: config.fishing.fish_on_join,
					staff,
				},
			},
			workers,
			discord,
		);
	}
}

run();
