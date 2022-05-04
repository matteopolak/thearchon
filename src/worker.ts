import fs from 'fs';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import chalk from 'chalk';
import { createClient } from 'minecraft-protocol';
import { mineflayer as viewer } from 'prismarine-viewer';
import { SocksClient } from 'socks';
import { SocksProxyAgent } from 'socks-proxy-agent';

import FishBot from './classes/FishBot';
import StorageBot from './classes/StorageBot';
import config from './config';
import {
	BaseBotOptions,
	MessageType,
	ParentMessage,
	StaffState,
} from './typings';
import { createPromiseResolvePair, sleep } from './utils';

if (config.witai_key) {
	config.witai_key = fs.readFileSync(
		path.join(__dirname, '..', 'resources', 'wit_token'),
		{ encoding: 'utf8' },
	);
}

async function waitForStaffDisconnect() {
	let startWait = 0;

	const { promise, resolve } = createPromiseResolvePair();
	const messageListener = (message: ParentMessage) => {
		if (message.type !== MessageType.STAFF_STATE_CHANGE) return;
		if (!message.states.includes(StaffState.OFFLINE)) {
			startWait = Date.now();
			return;
		}

		parentPort!.off('message', messageListener);
		sleep(startWait - Date.now() + 60_000 * 5).then(resolve);
	};

	parentPort!.on('message', messageListener);
	parentPort!.postMessage({ type: MessageType.REQUEST_STAFF_STATE });

	return promise;
}

async function run() {
	const { options }: { options: BaseBotOptions } = workerData;

	if (options.disconnect_while_staff_present) {
		await waitForStaffDisconnect();
	}

	if (options.proxy !== undefined) {
		const [proxyHost, _proxyPort] = options.proxy.slice(9).split(':');
		const proxyPort = parseInt(_proxyPort);

		options.client = createClient({
			username: options.username,
			password: options.password,
			host: options.host,
			port: options.port,
			authServer: options.authServer,
			sessionServer: options.sessionServer,
			connect: async client => {
				const info = await SocksClient.createConnection({
					proxy: {
						host: proxyHost,
						port: proxyPort,
						type: parseInt(options.proxy![5]) as 4 | 5,
					},
					command: 'connect',
					destination: {
						host: options.host!,
						port: options.port!,
					},
				});

				client.setSocket(info.socket);
				client.emit('connect');
			},
			agent: new SocksProxyAgent(options.proxy),
		});
	}

	const bot =
		options.type === 'storage'
			? new StorageBot(options, parentPort!)
			: new FishBot(options, parentPort!);

	if (options.viewer_port !== undefined) {
		bot.addLoginHook(() => {
			viewer(bot._bot, { port: options.viewer_port! });
		});
	}

	console.log(
		`         ${' '.repeat(17)}${chalk.bold(
			chalk.cyan('Worker'),
		)} Starting ${chalk.yellow(options.alias)}${
			options.proxy ? ` with proxy ${chalk.yellow(options.proxy)}` : ''
		}`,
	);

	bot._bot.on('kicked', async reason => {
		bot.logger.error(`Kicked: ${chalk.redBright(reason)}`);

		process.nextTick(() => process.exit(reason.includes('BANNED') ? 1 : 0));
	});

	bot._bot.on('end', async reason => {
		setTimeout(() => {
			bot.logger.error(`Ended: ${chalk.redBright(reason)}`);

			process.nextTick(() => process.exit(0));
		}, 1000);
	});

	bot._bot.once('spawn', bot.join.bind(bot));

	bot.init();
}

run();
