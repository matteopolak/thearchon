import { Worker } from 'worker_threads';

import chalk from 'chalk';

import characters from './characters';
import { WORKER_PATH } from './constants';
import { SellType } from './typings';
import type { BaseBotOptions, RawMapData } from './typings';

const CHARACTER_WIDTH = 12;
const CHARACTER_HEIGHT = 14;

// prettier-ignore
const filter: string[][] = [
	['0', '2', '3', '6', '7', '8', '9', 'C', 'D', 'G', 'J', 'L', 'O', 'Q', 'U', 'V', 'W', 'Z'],
	['1', '4', '5', 'A', 'B', 'E', 'F', 'H', 'I', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'X', 'Y'],
	[],
];

export const currencyFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
});

function findCharacter(
	json: RawMapData,
	options: { x: number; y: number },
): string | undefined {
	// half of the letters have a pixel here, so it's worthwhile
	// to check for it at the start
	const bit = json.data[options.x + 4 + (options.y + 4) * json.columns];
	const filtered = filter[bit === 119 || bit === 34 ? 1 : 0];

	for (const character of filtered) {
		let match = true;

		const bits: number[] = characters[character as keyof typeof characters];

		for (let i = 0; i < CHARACTER_HEIGHT; i += 2) {
			for (let j = 0; j < CHARACTER_WIDTH; j += 2) {
				const index = options.x + j + (options.y + i) * json.columns;

				if (json.data[index] === 2) {
					options.x += CHARACTER_WIDTH;

					return undefined;
				}

				if (
					!!bits[j + i * CHARACTER_WIDTH] !==
					(json.data[index] === 119 || json.data[index] === 34)
				) {
					match = false;
					break;
				}
			}

			if (!match) break;
		}

		if (match) {
			for (let i = 0; i < CHARACTER_HEIGHT; i++) {
				for (let j = 0; j < CHARACTER_WIDTH; j++) {
					json.data[options.x + j + (options.y + i) * json.columns] = 2;
				}
			}

			options.x += CHARACTER_WIDTH;

			return character;
		}
	}

	return undefined;
}

export function unscramble(json: RawMapData) {
	const rows = json.rows;
	const columns = json.columns;

	const characters = [];
	const options = {
		x: 0,
		y: 0,
	};

	for (options.y = 0; options.y < rows - CHARACTER_HEIGHT; ++options.y) {
		for (options.x = 0; options.x < columns - CHARACTER_WIDTH; ++options.x) {
			const character = findCharacter(json, options);

			if (character) {
				characters.push(character);
			}
		}
	}

	return characters;
}

export function sleep(ms: number): Promise<true> | undefined {
	if (ms <= 0) return;

	return new Promise(r => setTimeout(r, ms, true));
}

export function createPromiseResolvePair(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	let resolve: any;
	const promise: Promise<void> = new Promise(r => (resolve = r));

	return { promise, resolve };
}

export function startNewProcess(
	payload: { options: BaseBotOptions },
	workers: Map<string, Worker>,
) {
	console.log(
		`${' '.repeat(17)}${chalk.bold(
			chalk.cyan('Parent'),
		)} Starting worker for ${chalk.yellow(payload.options.alias)}`,
	);

	const worker = new Worker(WORKER_PATH, {
		workerData: payload,
	});

	workers.set(payload.options.alias, worker);

	const messageHandler = (data: { isFishing: boolean; sellType: SellType }) => {
		console.log(
			`${' '.repeat(17)}${chalk.bold(chalk.cyan('Parent'))} ${chalk.yellow(
				payload.options.alias,
			)} is ${data.isFishing ? 'fishing' : 'not fishing'} and trading for ${
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

		startNewProcess(payload, workers);
	});
}
