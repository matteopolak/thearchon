import { Worker } from 'worker_threads';

import type { BaseBotOptions } from './classes/BaseBot';
import config from './config';
import { VERSION, WORKER_PATH } from './constants';
import { SellType } from './typings';

function sleep(ms: number) {
	return new Promise(r => setTimeout(r, ms));
}

const defaults = {
	whitelist: new Set(config.whitelist),
	host: 'best.thearchon.net',
	port: 25565,
	version: VERSION,
	hideErrors: true,
};

function start(payload: { options: BaseBotOptions }) {
	console.log(`[PARENT] Starting worker for ${payload.options.alias}`);

	const worker = new Worker(WORKER_PATH, {
		workerData: payload,
	});

	const messageHandler = (data: { isFishing: boolean; sellType: SellType }) => {
		console.log(
			`[PARENT] ${payload.options.alias} is ${
				data.isFishing ? 'fishing' : 'not fishing'
			} and trading for ${
				data.sellType === SellType.COINS ? 'coins' : 'mob coins'
			}`,
		);

		payload.options.fish = data.isFishing;
		payload.options.sellType = data.sellType;
	};

	worker.on('message', messageHandler);

	worker.once('error', async error => {
		console.error(payload.options.alias, error);

		worker.removeListener('message', messageHandler);
		worker.terminate();
	});

	worker.once('exit', async () => {
		worker.removeListener('message', messageHandler);

		await sleep(10_000);

		start(payload);
	});
}

for (const options of config.accounts) {
	start({
		options: {
			...defaults,
			...options,
			sellType: SellType.COINS,
			fish: true,
		},
	});
}
